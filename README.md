# Float Token

一個為 Claude Code 設計的浮動視窗，即時顯示 Token 使用量、費用與使用限制。

> 資料來源與 `claude /usage` 指令完全相同——直接讀取 Anthropic 伺服器回傳的真實使用率，而非本地估算。

---

## 畫面預覽

```
┌─────────────────────────────────┐
│ ● Float Token  S46  ▾  ✕       │
├─────────────────────────────────┤
│ 使用限制  Session  本月          │
├─────────────────────────────────┤
│ Current session                 │
│ 376 訊息          64%           │
│ ██████████████░░░░░░░           │
│ 重置: 5/11 上午01:19            │
│ ↑ 62.3K in  ↓ 24.1K out  ...  │
│ ─────────────────────────────── │
│ Weekly limits                   │
│ 重置: 5/16 上午11:00            │
│ 3 sessions  439 訊息    22%    │
│ █████░░░░░░░░░░░░░░░           │
│ ─────────────────────────────── │
│ 今日費用                         │
│ 439 訊息  86.4K tokens $15.06  │
└─────────────────────────────────┘
```

---

## 功能

### 使用限制面板（預設）
| 資料 | 說明 |
|------|------|
| **Session 使用率 %** | 5 小時視窗的真實用量（來自 Anthropic API） |
| **Session 重置時間** | 確切的重置時間點 |
| **Weekly 使用率 %** | 7 天視窗的真實用量（all models） |
| **Weekly 重置時間** | 每週六上午 11:00 重置 |
| **今日費用** | 當日累計費用與 Token 數 |

### Session 面板
- 本次 Session 總費用
- Input / Output / Cache Write / Cache Read Token 明細

### 本月面板
- 本月累計費用
- 完整 Token 明細

### 其他特性
- **模型識別**：標題列顯示目前使用的模型（S46 = Sonnet 4.6）
- **進度條顏色**：`藍 → 黃（≥70%）→ 紅（≥90%）`
- **收合模式**：雙擊標題列或按 `▾` 收合成小工具列
- **永遠置頂**：跨所有桌面與全螢幕應用顯示
- **即時更新**：監聽 JSONL 檔案變更立即刷新；每 3 分鐘重新呼叫 API 取得最新使用率
- **系統托盤**：右鍵可顯示/隱藏視窗

---

## 需求

- **macOS** 10.15+ 或 **Windows** 10+
- **Node.js** 18+
- 已安裝並登入 [Claude Code](https://claude.ai/code)（需為 claude.ai 訂閱帳號，非純 API Key 模式）

---

## 安裝與執行

```bash
git clone https://github.com/your-username/float-token.git
cd float-token
npm install
npm start
```

### macOS 說明
首次啟動若出現「無法驗證開發者」，請至 **系統設定 → 隱私權與安全性** 點選「仍要打開」。

---

## 資料來源說明

Float Token 使用兩個資料來源：

### 1. Anthropic OAuth API（真實使用率）
呼叫 `https://api.anthropic.com/api/oauth/usage`，取得與 `/usage` 指令完全相同的資料：
- `five_hour.utilization` → Session 使用率 %
- `seven_day.utilization` → Weekly 使用率 %

OAuth Token 從 **macOS Keychain**（服務名稱：`Claude Code-credentials`）自動讀取，無需任何設定。

### 2. 本地 JSONL 檔案（Token 明細）
解析 `~/.claude/projects/**/*.jsonl`，計算各模型的 Token 數與費用。支援 Claude 4.x / 3.5 全系列模型定價。

---

## 專案結構

```
float-token/
├── main.js              # Electron 主程序
├── preload.js           # 安全橋接（contextBridge）
├── scripts/
│   └── launch.js        # 修正 ELECTRON_RUN_AS_NODE 環境變數
├── src/
│   ├── claude-parser.js # JSONL 解析、Token/費用計算
│   ├── cost-calculator.js # 模型定價表
│   └── usage-api.js     # OAuth API 呼叫、Keychain 讀取
└── renderer/
    ├── index.html
    ├── app.js
    └── style.css
```

---

## 注意事項

- 本工具**不會**儲存或上傳任何 Token 或 API 金鑰
- OAuth Token 僅用於讀取使用率，在記憶體中使用後即捨棄
- 所有網路請求僅連線至 `api.anthropic.com`

---

## License

MIT
