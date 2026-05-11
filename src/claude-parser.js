'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { calculateCost } = require('./cost-calculator');

const CLAUDE_DIR = path.join(os.homedir(), '.claude', 'projects');
const STATS_CACHE_PATH = path.join(os.homedir(), '.claude', 'stats-cache.json');

function getAllSessionFiles() {
  if (!fs.existsSync(CLAUDE_DIR)) return [];
  const files = [];
  try {
    const projects = fs.readdirSync(CLAUDE_DIR, { withFileTypes: true });
    for (const proj of projects) {
      if (!proj.isDirectory()) continue;
      const projPath = path.join(CLAUDE_DIR, proj.name);
      try {
        const entries = fs.readdirSync(projPath);
        for (const entry of entries) {
          if (entry.endsWith('.jsonl')) {
            files.push(path.join(projPath, entry));
          }
        }
      } catch (_) {}
    }
  } catch (_) {}
  return files;
}

function parseSessionFile(filePath) {
  const records = [];
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    return records;
  }

  const lines = content.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    let obj;
    try { obj = JSON.parse(line); } catch (_) { continue; }

    if (obj.type !== 'assistant') continue;
    const msg = obj.message;
    if (!msg || !msg.usage) continue;

    const usage = msg.usage;
    const model = msg.model || 'unknown';

    records.push({
      timestamp: obj.timestamp || new Date().toISOString(),
      model,
      input: usage.input_tokens || 0,
      output: usage.output_tokens || 0,
      cacheWrite: usage.cache_creation_input_tokens || 0,
      cacheRead: usage.cache_read_input_tokens || 0,
      cost: calculateCost(usage, model),
      sessionId: obj.sessionId || path.basename(filePath, '.jsonl'),
    });
  }
  return records;
}

function aggregateRecords(records) {
  const stats = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, cost: 0, messages: 0, model: 'unknown' };
  if (records.length === 0) return stats;
  stats.model = records[records.length - 1].model;
  for (const r of records) {
    stats.input += r.input;
    stats.output += r.output;
    stats.cacheWrite += r.cacheWrite;
    stats.cacheRead += r.cacheRead;
    stats.cost += r.cost;
    stats.messages++;
  }
  return stats;
}

function isToday(ts) {
  const d = new Date(ts), now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function isThisWeek(ts) {
  const d = new Date(ts), now = new Date();
  // Week starts Sunday
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(now.getDate() - now.getDay());
  return d >= startOfWeek;
}

function isThisMonth(ts) {
  const d = new Date(ts), now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

/**
 * Read stats-cache.json for historical message/token counts.
 * Returns weekly and daily summaries.
 */
function getStatsCache() {
  try {
    const raw = fs.readFileSync(STATS_CACHE_PATH, 'utf8');
    const data = JSON.parse(raw);

    const now = new Date();
    // Start of current week (Sunday 00:00)
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekStartStr = weekStart.toISOString().slice(0, 10);

    // Next Saturday 11:00 AM (Pro weekly reset)
    const nextSat = new Date(now);
    const daysToSat = (6 - now.getDay() + 7) % 7 || 7;
    nextSat.setDate(now.getDate() + daysToSat);
    nextSat.setHours(11, 0, 0, 0);
    const weekResetMs = nextSat - now;

    const todayStr = now.toISOString().slice(0, 10);

    let weekMessages = 0, weekSessions = 0, weekToolCalls = 0;
    let todayMessages = 0, todaySessions = 0;
    let weekTokens = 0, todayTokens = 0;

    const dailyActivity = data.dailyActivity || [];
    const dailyModelTokens = data.dailyModelTokens || [];

    // Build a map of date → tokens
    const tokensByDate = {};
    for (const entry of dailyModelTokens) {
      const total = Object.values(entry.tokensByModel || {}).reduce((a, b) => a + b, 0);
      tokensByDate[entry.date] = (tokensByDate[entry.date] || 0) + total;
    }

    for (const entry of dailyActivity) {
      if (entry.date >= weekStartStr) {
        weekMessages += entry.messageCount || 0;
        weekSessions += entry.sessionCount || 0;
        weekToolCalls += entry.toolCallCount || 0;
        weekTokens += tokensByDate[entry.date] || 0;
      }
      if (entry.date === todayStr) {
        todayMessages = entry.messageCount || 0;
        todaySessions = entry.sessionCount || 0;
        todayTokens = tokensByDate[entry.date] || 0;
      }
    }

    // Compute averages from last 4 full weeks (excluding current week)
    const prevWeeks = [];
    for (let w = 1; w <= 4; w++) {
      const ws = new Date(weekStart);
      ws.setDate(ws.getDate() - w * 7);
      const we = new Date(ws);
      we.setDate(we.getDate() + 7);
      const wsStr = ws.toISOString().slice(0, 10);
      const weStr = we.toISOString().slice(0, 10);
      let wMsgs = 0;
      for (const entry of dailyActivity) {
        if (entry.date >= wsStr && entry.date < weStr) {
          wMsgs += entry.messageCount || 0;
        }
      }
      if (wMsgs > 0) prevWeeks.push(wMsgs);
    }
    const avgWeekMessages = prevWeeks.length > 0
      ? Math.round(prevWeeks.reduce((a, b) => a + b, 0) / prevWeeks.length)
      : weekMessages;

    return {
      weekMessages, weekSessions, weekToolCalls, weekTokens,
      todayMessages, todaySessions, todayTokens,
      avgWeekMessages,
      weekResetMs,
      nextSatStr: nextSat.toLocaleDateString('zh-TW', { weekday: 'short', hour: '2-digit', minute: '2-digit' }),
    };
  } catch (_) {
    return null;
  }
}

/**
 * Get current session stats (most recently modified JSONL).
 * Also returns session start time and message count.
 */
function getCurrentSessionStats() {
  const files = getAllSessionFiles();
  if (files.length === 0) return null;

  let latestFile = null, latestMtime = 0;
  for (const f of files) {
    try {
      const stat = fs.statSync(f);
      if (stat.mtimeMs > latestMtime) { latestMtime = stat.mtimeMs; latestFile = f; }
    } catch (_) {}
  }
  if (!latestFile) return null;

  const records = parseSessionFile(latestFile);
  const sessionId = path.basename(latestFile, '.jsonl');
  const sessionRecords = records.filter(r => r.sessionId === sessionId);
  const used = sessionRecords.length > 0 ? sessionRecords : records;

  // Session start time (first message timestamp)
  const sessionStart = used.length > 0 ? new Date(used[0].timestamp) : new Date();
  const sessionDurationMs = Date.now() - sessionStart.getTime();
  const sessionDurationMin = Math.round(sessionDurationMs / 60000);

  return {
    ...aggregateRecords(used),
    filePath: latestFile,
    sessionId,
    sessionStartMs: sessionStart.getTime(),
    sessionDurationMin,
  };
}

function getAllStats() {
  const files = getAllSessionFiles();
  const cutoff = Date.now() - 32 * 24 * 60 * 60 * 1000; // 只讀近 32 天的檔案

  const allRecords = [];
  for (const f of files) {
    try {
      if (fs.statSync(f).mtimeMs < cutoff) continue; // 跳過超過 32 天未修改的檔案
    } catch (_) { continue; }
    allRecords.push(...parseSessionFile(f));
  }
  allRecords.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const todayRecords = allRecords.filter(r => isToday(r.timestamp));
  const weekRecords = allRecords.filter(r => isThisWeek(r.timestamp));
  const monthRecords = allRecords.filter(r => isThisMonth(r.timestamp));

  return {
    today: aggregateRecords(todayRecords),
    week: aggregateRecords(weekRecords),
    month: aggregateRecords(monthRecords),
  };
}

module.exports = {
  getAllSessionFiles,
  parseSessionFile,
  getCurrentSessionStats,
  getAllStats,
  getStatsCache,
  CLAUDE_DIR,
};
