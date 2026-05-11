'use strict';

const { exec } = require('child_process');
const https = require('https');
const os = require('os');
const path = require('path');
const fs = require('fs');

// Cache: avoid hitting the API too often
let _cache = null;
let _cacheTime = 0;
let _rateLimitedUntil = 0;        // 429 退避：此時間前不再呼叫 API
const CACHE_TTL_MS   = 5 * 60 * 1000;  // 5 分鐘正常快取
const RATE_LIMIT_BACKOFF_MS = 10 * 60 * 1000; // 429 後等 10 分鐘

function readKeychainAsync() {
  return new Promise((resolve) => {
    exec(
      'security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null',
      { timeout: 4000 },
      (err, stdout) => {
        if (err || !stdout.trim()) { resolve(null); return; }
        try { resolve(JSON.parse(stdout.trim())); } catch (_) { resolve(null); }
      }
    );
  });
}

async function getOAuthToken() {
  // 1. macOS Keychain（非阻塞）
  const kc = await readKeychainAsync();
  if (kc?.claudeAiOauth?.accessToken) {
    const o = kc.claudeAiOauth;
    if (!o.expiresAt || Date.now() < o.expiresAt) return o.accessToken;
  }

  // 2. ~/.claude/.credentials.json
  try {
    const raw = fs.readFileSync(path.join(os.homedir(), '.claude', '.credentials.json'), 'utf8');
    const o = JSON.parse(raw)?.claudeAiOauth;
    if (o?.accessToken && (!o.expiresAt || Date.now() < o.expiresAt)) return o.accessToken;
  } catch (_) {}

  // 3. 環境變數
  return process.env.CLAUDE_CODE_OAUTH_TOKEN || null;
}

function httpsGet(token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.anthropic.com',
      path: '/api/oauth/usage',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'float-token/1.0',
      },
      timeout: 8000,
    };

    const req = https.request(options, (res) => {
      if (res.statusCode === 401) { reject(new Error('401')); return; }
      if (res.statusCode === 429) { reject(new Error('429')); return; }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function parseResetTime(isoStr) {
  if (!isoStr) return null;
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('zh-TW', {
      month: 'numeric', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  } catch (_) {
    return null;
  }
}

async function fetchUsageData() {
  const now = Date.now();

  // 快取未過期 → 直接回傳
  if (_cache && now - _cacheTime < CACHE_TTL_MS) {
    return _cache;
  }

  // 429 退避中 → 回傳舊快取（即使過期），避免繼續被擋
  if (now < _rateLimitedUntil) {
    return _cache;
  }

  const token = await getOAuthToken();
  if (!token) return _cache;

  try {
    const raw = await httpsGet(token);

    const result = {
      session: null,
      weekly: null,
    };

    if (raw.five_hour) {
      result.session = {
        usedPercent: raw.five_hour.utilization ?? null,
        resetsAt: parseResetTime(raw.five_hour.resets_at),
        resetsAtRaw: raw.five_hour.resets_at,
      };
    }

    if (raw.seven_day) {
      result.weekly = {
        usedPercent: raw.seven_day.utilization ?? null,
        resetsAt: parseResetTime(raw.seven_day.resets_at),
        resetsAtRaw: raw.seven_day.resets_at,
      };
    }

    _cache = result;
    _cacheTime = Date.now();
    _rateLimitedUntil = 0;
    return result;
  } catch (err) {
    if (err.message === '429') {
      // 被速率限制：設定退避，回傳舊快取
      _rateLimitedUntil = Date.now() + RATE_LIMIT_BACKOFF_MS;
    }
    return _cache; // 失敗時回傳上次的快取，而不是 null
  }
}

function clearCache() {
  _cache = null;
  _cacheTime = 0;
  // 不重置 _rateLimitedUntil，避免退避期間被繞過
}

module.exports = { fetchUsageData, clearCache };
