# 霧林之契｜Mistforest Pact v0.8.0

> 你所捨棄的一切，終將成為你的敵人。

《慢慢好玩遊戲區》獨立前端策略卡牌小遊戲，前身為《林間卡牌》(`lin_card`)。**v0.8.0 在 v0.7.2 的開場及七大類卡牌基礎上，加入故事檔案骨架、四選一戰後獎勵，以及 Boss 實際出牌的自動翻牌動畫。戰鬥規則並未重做。**

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
├─ story/
│  ├─ index.html            獨立視覺小說頁（目前未公開入口）
│  ├─ story.css             閱讀器功能樣式
│  ├─ story.js              章節資料／書籤／解鎖
│  ├─ story_style.css       故事外觀
│  ├─ story_style.js        故事頁 UI
│  ├─ story_bridge.js       遊戲／故事跳轉橋接
│  ├─ story_config.js       自動故事開關（目前 false）
│  └─ data/                 chapters.json + 11 篇各自 JSON
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
- 每關勝利固定攻擊牌 +1、下一場起始行動點 +1；另外四選一領取新卡或可升等卡牌升級。
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

## v0.8.0｜故事骨架、四種通關獎勵、Boss 自動出牌

### 故事（先備妥，不提前開放）
- `story/data/chapters.json` 列出**序章（第一關前）+ 第一至十關通關故事**，共 11 篇。
- `story/data/prologue/prologue.json` 和 `story/data/chapter_01/01_01.json` … `chapter_10/10_01.json` 均已存在，`events: []` 表示**還沒有正式故事**，不是遊戲錯誤或假台詞。
- 參照《鹿雨森》的 `id/title/events` 資料結構：支援 `scene`、`narration`、`dialogue`、`text`、`choice`（選項 `goto` 事件 ID），亦保留 `challenge` 事件提示。故事頁上的手機點擊對話框可往下讀，支援分支、跳過、重讀、書籤與獨立進度。
- **只需在對應 JSON 的 `events` 內填入內容**，播放器就能辨識該篇已寫入，不需要改 JS 文字。故事不會因為閱讀／跳過而增加遊戲關卡進度；第一至十關的故事僅由 `mistforest_pact_save_v1.completed` 解鎖。
- 尚未設計故事入口，所以 `story/story_config.js` 裡 `autoStory: false`；因此**現在不會出現故事按鈕，也不會強迫玩家看空故事**。以後內容準備妥當並完成介面時，設定 `autoStory: true` 才會啟動「開第一關前序章、每關獎勵領完後播放通關故事」的橋接。閱讀完或略過都可返回遊戲，並不替玩家通關。
- 可在 GitHub Pages 部署後直接以 `/story/index.html` 檢查故事頁；正式入口尚未放進「旅人的選擇」。`file://` 方式無法正常 fetch JSON，請使用 HTTP(S)。
- 儲存：原遊戲 key `mistforest_pact_save_v1` **原封不動**，故事獨立使用 `mistforest_pact_story_progress_v1`。重新開始遊戲會清除故事進度。跳轉沿用 HTTPS `https://lib.stillnessbyslowly.com/state/navigation/navigation.js`。

範例：編輯 `data/prologue/prologue.json` 中 `events` 陣列（例子只寫在 README，不填進正式故事 JSON）：

```json
"events": [
  { "id": "p_001", "type": "scene", "title": "霧林入口", "scene": "mist" },
  { "id": "p_002", "type": "narration", "text": "在這裡寫你的故事。", "scene": "mist" },
  { "id": "p_003", "type": "dialogue", "speaker": "旅人", "text": "這裡是哪裡？", "scene": "mist" },
  { "id": "p_004", "type": "choice", "prompt": "往哪裡走？", "options": [{"text":"往前", "goto":"p_005"}] },
  { "id": "p_005", "type": "narration", "text": "霧氣向兩旁散去。" }
]
```

### 戰後獎勵（測試期）
- 四選一：`card1` 新卡 1 張／`deck_up` 本場出戰可升等卡 +1 級／`card4` 新卡 4 張／`collection_up` 所有永久收藏可升等卡 +1 級。
- **固定獎勵完全保留**：獲勝固定攻擊牌 1 張、下一場起始行動點 +1；因此領牌方案合計為 2 或 5 張待處理。仍維持收藏 80 上限、替換／放棄卡歸 Boss 的規則，升等上限 Lv.5。
- 測試期四項直接領，不提廣告。程式 `game/game.js` 的 `REWARD_MODES` 保留 `requiresAd` 標記：`card4`、`collection_up` 為未來廣告獎勵；目前 `REWARD_TEST_MODE = true`。正式啟用廣告時需做真正的廣告完成驗證，**目前沒有廣告串接，也不可僅改測試開關即視為完成**。
- v0.7.2 已在領獎中的存檔繼續處理原有 queue，不回溯重發獎勵。舊獎勵名稱僅作存檔兼容。

### Boss 自動翻牌
- 玩家結束回合後，若 Boss 實際成功使用了卡牌，從 Boss 身前翻出**真正使用的那張卡**，沿用相同 `.lc-card` 模板、七大類色彩、等級及文字；停留供閱讀，再飛向玩家或 Boss 自己。
- Boss 沒有合法牌時只顯示原戰鬥文字，不會假裝出牌；原有文字戰報仍保留。動畫期間會暫停操作並延後 UI 重繪，戰鬥判定本身仍同步照原規則執行。對「減少動態效果」用戶保留短暫卡片顯示，不播放飛行。
- 動畫與排版單獨在 `boss_card_animation.js/.css`，並未將特效複製到軍火庫。

### 驗證註記
- 已通過全部 JavaScript `node --check`、11 篇 JSON 格式檢查、程式層級模擬：Boss 實際出牌、120 張 Boss 起始牌、四類獎勵及下一關、80 張替換與 Boss 捐牌、故事打贏才解鎖／分支／跳過。
- 執行環境的 Chromium 對本地網頁禁止導航，**未能完成本機手機畫面實測**；上傳 GitHub Pages 後請用手機確認卡片動畫與故事頁顯示。
