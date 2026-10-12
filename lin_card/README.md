# 霧林之契｜Mistforest Pact v0.7

> 你所捨棄的一切，終將成為你的敵人。

《慢慢好玩遊戲區》獨立前端策略卡牌小遊戲，前身為《林間卡牌》(`lin_card`)。**v0.7 主要是重新命名、整理目錄、製作遊戲開場；原本的七大類牌、十關戰鬥、Boss 規則及三套牌組並未重做。**

## 進入遊戲

開啟 `mistforest_pact/index.html`。先顯示霧林開場，點擊中央 **「霧林之契」**，才進入原有的 **「旅人的選擇」**（「選擇關卡」／「查看個人資料」）。接著照舊初始選牌、使用三套牌組與挑戰十關。

- 開場背景由宿主自製 **SVG 森林、Canvas 細雨和螢火蟲、CSS 霧氣**組成，不使用 AI 或第三方背景圖片。
- **風聲／雨聲使用 Web Audio 合成**，不用外部音效檔。手機瀏覽器限制自動播放，請先按 **「♫ 開啟風雨聲」** 才能聽；可再按一次關閉。進入遊戲後，開場環境音會淡出停止。
- 遵守系統的「減少動態效果」設定，並限制 Canvas 像素比例和粒子數量。
- 頂部不再有「返回慢慢遊戲」與「重新開始」按鈕；舊小標移除、英文 **The Forest Keeps What You Leave Behind** 保留。
- 頁尾只留不可點擊的純文字：**慢 慢 | Stillness by Slowly**。
- 「遊戲說明」不放在公開介面；前一版文字移至 `docs/game_guide_draft.md`，等待你決定新位置。
- 「旅人的選擇」本身外觀暫時保留，等下一批調整。

## 專案檔案

```text
mistforest_pact/
├─ index.html                 靜態頁面與 HTTPS 軍火庫引用
├─ site.css                   遊戲頁面外殼、標題、文字 Logo
├─ opening/
│  ├─ forest.svg              自繪森林景深
│  ├─ opening.css             開場視覺與轉場
│  ├─ opening.js              雨絲、螢火蟲、進場互動
│  └─ ambience.js             風聲／雨聲音效合成
├─ game/
│  ├─ cards.js                卡牌資料與七大類效果
│  ├─ battle_rules.js         戰鬥結算
│  ├─ save.js                 新版永久進度儲存
│  ├─ game.js                 十關、收藏、獎勵、牌組流程
│  ├─ game.css                卡片等功能本體樣式
│  ├─ game_ui.js              牌組／戰鬥等介面
│  └─ game_ui.css             遊戲畫面排版樣式
├─ docs/game_guide_draft.md  暫存的遊戲說明
├─ CHANGELOG.md
└─ README.md
```

原程式的 `LinCard*` 全域 API、`lc-*` CSS class 目前保留以免改壞戰鬥功能；**公開顯示名稱及資料夾已更名**。將整個資料夾保持這個相對目錄結構部署到 GitHub Pages 即可。

## 慢慢軍火庫

以 **HTTPS 絕對網址**載入，不複製共用核心：

- `https://lib.stillnessbyslowly.com/state/tree_selection.js`（選牌分類單一展開）
- `https://lib.stillnessbyslowly.com/game/card/deck.js`（牌庫、手牌、棄牌堆）
- `https://lib.stillnessbyslowly.com/effects/background/pine_forest.js`（進場後背景）
- `https://lib.stillnessbyslowly.com/effects/background/fog.js`（進場後背景）
- `https://lib.stillnessbyslowly.com/ui/responsive.css`（共用版面）

沒有網路時無法載入軍火庫 Tree / Deck，**正式遊玩請用可連線的 HTTPS 網站**。

## 進度與遊戲規則

- v0.7 使用全新 `localStorage` key：`mistforest_pact_save_v1`，**不載入舊版 `lin_card_save_v1`**。既有舊資料不會自動刪除，但新遊戲從第 1 關開始。進度及永久收藏仍會在 v0.7 儲存。
- 玩家初始固定 5 張攻擊牌，再從 40 張選 25 張；剩餘 15 張交給 Boss，Boss 初始 120 張。
- 七大類卡牌；玩家永久收藏上限 80、出戰上限 30、可自行儲存 3 套出戰牌組。
- 每關勝利固定攻擊牌 +1、下一場起始行動點 +1；戰後五選一獎勵照舊。
- 行動／魔法雙資源、裂盾／穿盾、萬木共鳴、同命之契、枯木逢春從雙方棄牌堆取牌、每回合起手換牌皆保留。
- 這一版移除過去針對 v0.3–v0.6 舊存檔的遷移流程與過時的舊版說明檔，不改戰鬥計算。

## 測試

- 全部本地 JavaScript 語法檢查。
- 靜態資源路徑驗證、SVG 與 ZIP 完整性檢查。
- Chromium 模擬 390px 手機：開場 → 旅人的選擇 → 關卡 → 初始 40 選 25 → 戰鬥、重載新存檔通過。
- 測試環境不能連向 `lib.stillnessbyslowly.com`，瀏覽器互動測試改以**相同介面 API 的測試替身**提供 Tree / Deck；正式專案仍只使用上述 HTTPS 引用，未將測試替身打包。請上線後驗收實機畫面及聲音。


## v0.7.1｜雙標題圖床外連
- 開場：`霧林之契002.png`（深色森林華麗版），點圖可進場。
- 旅人的選擇：`霧林之契001.png`（青綠幽光版），只在主選單顯示。
- 圖片使用使用者提供的 `https://img.stillnessbyslowly.com/` 絕對路徑，ZIP 不含 PNG。
- 圖片未能載入時，兩個位置均退回中文文字標題。
- 原有開場雨霧、風雨音效、主選單英文副標，以及遊戲戰鬥/存檔全部保留。


## v0.7.2｜標題統一
- 開場與「旅人的選擇」目前都使用 `霧林之契001.png`（青綠幽光／透明背景），由慢慢圖床提供。
- v0.7.1 的 002 華麗版暫不顯示，其他功能不變。
