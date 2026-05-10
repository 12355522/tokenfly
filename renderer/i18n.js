'use strict';

const LANGS = {
  'zh-TW': {
    tab_limits:      '使用限制',
    tab_session:     'Session',
    tab_month:       '本月',
    current_session: 'Current session',
    weekly_limits:   'Weekly limits',
    all_models:      'All models',
    today_cost:      '今日費用',
    session_cost:    'Session Cost',
    total_tokens:    'Total Tokens',
    month_cost:      '本月費用',
    toggle_title:    '展開/收合',
    close_title:     '隱藏',
    lang_title:      '切換語言',
    reset:           '重置',
    active:          '持續',
    msgs:            '訊息',
    sessions:        'sessions',
    avg:             '平均',
    per_week:        '/週',
    lt1min:          '< 1 分鐘',
    minutes:         '分鐘',
    hours:           '小時',
    hour_unit:       '時',
    min_unit:        '分',
    used:            'used',
  },
  'zh-CN': {
    tab_limits:      '使用限制',
    tab_session:     'Session',
    tab_month:       '本月',
    current_session: 'Current session',
    weekly_limits:   'Weekly limits',
    all_models:      'All models',
    today_cost:      '今日费用',
    session_cost:    'Session Cost',
    total_tokens:    'Total Tokens',
    month_cost:      '本月费用',
    toggle_title:    '展开/收合',
    close_title:     '隐藏',
    lang_title:      '切换语言',
    reset:           '重置',
    active:          '持续',
    msgs:            '消息',
    sessions:        'sessions',
    avg:             '平均',
    per_week:        '/周',
    lt1min:          '< 1 分钟',
    minutes:         '分钟',
    hours:           '小时',
    hour_unit:       '时',
    min_unit:        '分',
    used:            'used',
  },
  'en': {
    tab_limits:      'Limits',
    tab_session:     'Session',
    tab_month:       'Month',
    current_session: 'Current session',
    weekly_limits:   'Weekly limits',
    all_models:      'All models',
    today_cost:      "Today's cost",
    session_cost:    'Session Cost',
    total_tokens:    'Total Tokens',
    month_cost:      'Monthly Cost',
    toggle_title:    'Expand/Collapse',
    close_title:     'Hide',
    lang_title:      'Switch language',
    reset:           'Resets',
    active:          'Active',
    msgs:            'msgs',
    sessions:        'sessions',
    avg:             'avg',
    per_week:        '/wk',
    lt1min:          '< 1 min',
    minutes:         'min',
    hours:           'hr',
    hour_unit:       'h',
    min_unit:        'm',
    used:            'used',
  },
  'ja': {
    tab_limits:      '制限',
    tab_session:     'セッション',
    tab_month:       '今月',
    current_session: '現在のセッション',
    weekly_limits:   '週間制限',
    all_models:      '全モデル',
    today_cost:      '本日のコスト',
    session_cost:    'セッションコスト',
    total_tokens:    '合計トークン',
    month_cost:      '今月のコスト',
    toggle_title:    '展開/折りたたむ',
    close_title:     '非表示',
    lang_title:      '言語を切り替える',
    reset:           'リセット',
    active:          '経過',
    msgs:            '件',
    sessions:        'セッション',
    avg:             '平均',
    per_week:        '/週',
    lt1min:          '< 1分',
    minutes:         '分',
    hours:           '時間',
    hour_unit:       '時間',
    min_unit:        '分',
    used:            '使用中',
  },
  'ko': {
    tab_limits:      '사용량',
    tab_session:     '세션',
    tab_month:       '이번달',
    current_session: '현재 세션',
    weekly_limits:   '주간 한도',
    all_models:      '전체 모델',
    today_cost:      '오늘 비용',
    session_cost:    '세션 비용',
    total_tokens:    '총 토큰',
    month_cost:      '이번달 비용',
    toggle_title:    '펼치기/접기',
    close_title:     '숨기기',
    lang_title:      '언어 전환',
    reset:           '초기화',
    active:          '진행중',
    msgs:            '메시지',
    sessions:        '세션',
    avg:             '평균',
    per_week:        '/주',
    lt1min:          '< 1분',
    minutes:         '분',
    hours:           '시간',
    hour_unit:       '시',
    min_unit:        '분',
    used:            '사용됨',
  },
};

const LANG_ORDER  = ['zh-TW', 'zh-CN', 'en', 'ja', 'ko'];
const LANG_LABELS = { 'zh-TW': '繁', 'zh-CN': '简', en: 'EN', ja: '日', ko: '한' };

let currentLang = localStorage.getItem('tokenfly-lang') || 'zh-TW';

function t(key) {
  return LANGS[currentLang]?.[key] ?? LANGS['zh-TW'][key] ?? key;
}

function cycleLang() {
  const idx = LANG_ORDER.indexOf(currentLang);
  currentLang = LANG_ORDER[(idx + 1) % LANG_ORDER.length];
  localStorage.setItem('tokenfly-lang', currentLang);
  applyI18n();
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  const langBtn = document.getElementById('btn-lang');
  if (langBtn) langBtn.textContent = LANG_LABELS[currentLang];
  document.documentElement.lang = currentLang;
}
