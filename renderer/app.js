'use strict';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTokens(n) {
  if (!n || n === 0) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function fmtCost(usd) {
  if (!usd || usd === 0) return '$0.00';
  if (usd < 0.001) return '<$0.001';
  if (usd < 0.01) return '$' + usd.toFixed(4);
  if (usd < 1) return '$' + usd.toFixed(3);
  return '$' + usd.toFixed(2);
}

function fmtModel(m) {
  if (!m || m === 'unknown') return '–';
  return m.replace('claude-', '').replace('sonnet', 'S').replace('opus', 'O').replace('haiku', 'H').replace(/-(\d)/g, '$1').toUpperCase();
}

function fmtDuration(minutes) {
  if (minutes < 1) return t('lt1min');
  if (minutes < 60) return `${minutes} ${t('minutes')}`;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return m > 0 ? `${h} ${t('hour_unit')} ${m} ${t('min_unit')}` : `${h} ${t('hours')}`;
}

function setBar(id, pct, color) {
  const el = document.getElementById(id);
  if (!el) return;
  const clamped = Math.max(0, Math.min(100, pct));
  el.style.width = clamped + '%';
  el.className = 'progress-fill ' + (clamped >= 90 ? 'red' : clamped >= 70 ? 'yellow' : color);
}

// ── State ─────────────────────────────────────────────────────────────────────
let isCompact = false;
let activeTab = 'limits';

// ── DOM ───────────────────────────────────────────────────────────────────────
const appEl = document.getElementById('app');
const modelBadge = document.getElementById('model-badge');
const compactInfo = document.getElementById('compact-info');
const btnToggle = document.getElementById('btn-toggle');
const btnClose = document.getElementById('btn-close');
const btnLang = document.getElementById('btn-lang');

// ── Render ─────────────────────────────────────────────────────────────────────

let _lastData = null;

function renderStats(data) {
  if (!data) return;
  _lastData = data;
  const { session, today, week, month, cache, usage } = data;

  // Model badge
  const model = session?.model || today?.model || 'unknown';
  modelBadge.textContent = fmtModel(model);

  // Compact bar: session usage% or cost
  if (usage?.session?.usedPercent != null) {
    compactInfo.textContent = `${Math.round(usage.session.usedPercent)}% ${t('used')}`;
  } else {
    compactInfo.textContent = session ? fmtCost(session.cost) : '–';
  }

  // ─── LIMITS PANEL ─────────────────────────────────────────────────────

  const sessionApiPct = usage?.session?.usedPercent ?? null;
  const sessionApiReset = usage?.session?.resetsAt ?? null;

  if (session || sessionApiPct != null) {
    if (session) {
      setText('lim-session-msgs', `${session.messages || 0} ${t('msgs')}`);
      setText('lim-session-duration', `${t('active')} ${fmtDuration(session.sessionDurationMin || 0)}`);
      setText('lim-session-tokens', `↑ ${fmtTokens(session.input)} in  ↓ ${fmtTokens(session.output)} out  ${fmtTokens(session.cacheRead)} cached`);
    }

    if (sessionApiPct != null) {
      const pct = Math.round(sessionApiPct);
      setText('lim-session-pct', `${pct}%`);
      setBar('lim-session-bar', pct, 'blue');
      if (sessionApiReset) setText('lim-session-duration', `${t('reset')}: ${sessionApiReset}`);
    } else if (session) {
      const todayMsgs = today?.messages || session.messages;
      const sessionBar = todayMsgs > 0 ? Math.round((session.messages / todayMsgs) * 100) : 50;
      setText('lim-session-pct', `${session.messages} ${t('msgs')}`);
      setBar('lim-session-bar', sessionBar, 'blue');
    }
  }

  const weekApiPct = usage?.weekly?.usedPercent ?? null;
  const weekApiReset = usage?.weekly?.resetsAt ?? null;

  if (week || weekApiPct != null) {
    if (week) {
      const weekCost = fmtCost(week.cost);
      const sessions = cache?.weekSessions || '–';
      setText('lim-week-msgs', `${sessions} ${t('sessions')}  ${week.messages} ${t('msgs')}`);
      const avgNote = (cache && cache.avgWeekMessages > 0)
        ? `  |  ${t('avg')} ${cache.avgWeekMessages}${t('per_week')}` : '';
      setText('lim-week-tokens', `${fmtTokens((week.input||0)+(week.output||0)+(week.cacheRead||0))} tokens  ${weekCost}${avgNote}`);
    }

    if (weekApiPct != null) {
      const pct = Math.round(weekApiPct);
      setText('lim-week-pct', `${pct}%`);
      setBar('lim-week-bar', pct, 'blue');
      if (weekApiReset) setText('lim-week-reset', `${t('reset')}: ${weekApiReset}`);
    } else if (week) {
      const avgRef = (cache && cache.avgWeekMessages > 0) ? cache.avgWeekMessages : week.messages;
      const weekPct = avgRef > 0 ? Math.min(100, Math.round((week.messages / avgRef) * 100)) : 50;
      setText('lim-week-pct', `${weekPct}%`);
      if (cache?.nextSatStr) setText('lim-week-reset', `${t('reset')}: ${cache.nextSatStr}`);
      setBar('lim-week-bar', weekPct, 'blue');
    }
  }

  if (today) {
    setText('lim-today-msgs', `${today.messages} ${t('msgs')}  ${fmtTokens((today.input||0)+(today.output||0)+(today.cacheWrite||0)+(today.cacheRead||0))} tokens`);
    setText('lim-today-cost', fmtCost(today.cost));
    setText('lim-today-tokens', `↑ ${fmtTokens(today.input)} in  ↓ ${fmtTokens(today.output)} out  ${fmtTokens(today.cacheRead)} cached`);
  }

  // ─── SESSION PANEL ────────────────────────────────────────────────────
  if (session) {
    setText('s-cost', fmtCost(session.cost));
    setText('s-msgs', `${session.messages || 0} ${t('msgs')}`);
    const total = (session.input||0)+(session.output||0)+(session.cacheWrite||0)+(session.cacheRead||0);
    setText('s-total-tokens', fmtTokens(total));
    setText('s-input', fmtTokens(session.input));
    setText('s-output', fmtTokens(session.output));
    setText('s-cache-w', fmtTokens(session.cacheWrite));
    setText('s-cache-r', fmtTokens(session.cacheRead));
  }

  // ─── MONTH PANEL ─────────────────────────────────────────────────────
  if (month) {
    setText('m-cost', fmtCost(month.cost));
    setText('m-msgs', `${month.messages || 0} ${t('msgs')}`);
    const total = (month.input||0)+(month.output||0)+(month.cacheWrite||0)+(month.cacheRead||0);
    setText('m-total-tokens', fmtTokens(total));
    setText('m-input', fmtTokens(month.input));
    setText('m-output', fmtTokens(month.output));
    setText('m-cache-w', fmtTokens(month.cacheWrite));
    setText('m-cache-r', fmtTokens(month.cacheRead));
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// ── Tab Switching ─────────────────────────────────────────────────────────────
function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === `panel-${tab}`));
}
document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

// ── Language ──────────────────────────────────────────────────────────────────
btnLang.addEventListener('click', () => {
  cycleLang();
  if (_lastData) renderStats(_lastData);
});

// ── Compact Toggle ────────────────────────────────────────────────────────────
function setCompact(compact) {
  isCompact = compact;
  appEl.classList.toggle('compact', compact);
  btnToggle.textContent = compact ? '▸' : '▾';
  window.claude.resize(300, compact ? 44 : 320);
}
btnToggle.addEventListener('click', () => setCompact(!isCompact));
document.getElementById('titlebar').addEventListener('dblclick', () => setCompact(!isCompact));

// ── Close ─────────────────────────────────────────────────────────────────────
btnClose.addEventListener('click', () => window.claude.close());

// ── Init ──────────────────────────────────────────────────────────────────────
applyI18n();
window.claude.onStatsUpdate(data => renderStats(data));
window.claude.getStats().then(data => { if (data && !data.error) renderStats(data); });
