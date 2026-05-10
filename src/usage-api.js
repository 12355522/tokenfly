'use strict';

const { execSync } = require('child_process');
const https = require('https');
const os = require('os');
const path = require('path');
const fs = require('fs');

// Cache: avoid hitting the API too often
let _cache = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

function getOAuthToken() {
  // 1. Try macOS Keychain (primary)
  try {
    const raw = execSync(
      'security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null',
      { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }
    );
    const data = JSON.parse(raw.trim());
    const oauth = data.claudeAiOauth;
    if (oauth?.accessToken) {
      if (!oauth.expiresAt || Date.now() < oauth.expiresAt) {
        return { token: oauth.accessToken, refreshToken: oauth.refreshToken };
      }
      // Expired — return refresh token so caller can try to refresh
      return { token: null, refreshToken: oauth.refreshToken, expired: true };
    }
  } catch (_) {}

  // 2. Try ~/.claude/.credentials.json (file-based fallback)
  try {
    const credPath = path.join(os.homedir(), '.claude', '.credentials.json');
    const raw = fs.readFileSync(credPath, 'utf8');
    const data = JSON.parse(raw);
    const oauth = data.claudeAiOauth;
    if (oauth?.accessToken) {
      if (!oauth.expiresAt || Date.now() < oauth.expiresAt) {
        return { token: oauth.accessToken, refreshToken: oauth.refreshToken };
      }
    }
  } catch (_) {}

  // 3. Environment variable
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    return { token: process.env.CLAUDE_CODE_OAUTH_TOKEN };
  }

  return null;
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
  // Return cached value if fresh
  if (_cache && Date.now() - _cacheTime < CACHE_TTL_MS) {
    return _cache;
  }

  const auth = getOAuthToken();
  if (!auth?.token) return null;

  try {
    const raw = await httpsGet(auth.token);

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
    return result;
  } catch (_) {
    return null;
  }
}

function clearCache() {
  _cache = null;
  _cacheTime = 0;
}

module.exports = { fetchUsageData, clearCache };
