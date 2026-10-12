### v0.8.2 新增

- 主選單中文標語使用本專案內 `assets/motto.svg`，為透明向量 SVG（已描成字形路徑，不必依賴使用者裝置字型）。不需要另傳圖床；上傳整個 `lin_card/` 到 GitHub Pages 即可。
- 戰鬥有獨立「音效／震動」開關，設定各自保存在本機；不支援 Vibration API 的裝置可照常戰鬥。
- 標語外觀／尺寸由 `site.css` 控制；震動模式由 `game/battle_haptics.js` 控制，不更動戰鬥判定。

# 霧林之契｜Mistforest Pact v0.8.1

> 你所捨棄的一切，終將成為你的敵人。

《慢慢好玩遊戲區》獨立前端策略卡牌小遊戲，前身為《林間卡牌》(`lin_card`)。**v0.8.1 延續 v0.8.0 的故事骨架、四選一獎勵與 Boss 翻牌演出，新增兩張魔法、依關卡增加 Boss 單回合出牌數，以及戰鬥聲光效果。原本每張卡牌的結算規則與固定通關補給保留。**

## 進入遊戲

將 ZIP 中的 `lin_card/` 目錄上傳到網站（也可以自行更名成 `mistforest_pact/`），再開啟裡面的 `index.html`。先顯示霧林開場，點擊中央 **「霧林之契」**，才進入原有的 **「旅人的選擇」**（「選擇關卡」／「查看個人資料」）。接著照舊初始選牌、使用三套牌組與挑戰十關。

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
│  ├─ boss_card_animation.js  Boss 單張翻牌／飛牌播放
│  ├─ boss_card_animation.css
│  ├─ battle_fx.js            戰鬥聲音與閃光觸發（宿主編排）
│  ├─ battle_fx.css           戰鬥特效的最小宿主樣式
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
- `https://lib.stillnessbyslowly.com/effects/celebration/flash_shake.js` + `.css`（輕量閃光與晃動）
- `https://lib.stillnessbyslowly.com/effects/celebration/shockwave.js` + `.css`（能量震波）
- `https://lib.stillnessbyslowly.com/audio/context/audio_context.js`（音訊環境）
- `https://lib.stillnessbyslowly.com/audio/source/noise.js`（噪音音源）
- `https://lib.stillnessbyslowly.com/audio/tone/harmonic_chime.js`（和聲）

沒有網路時無法載入軍火庫 Tree / Deck，**正式遊玩請用可連線的 HTTPS 網站**。

## 進度與遊戲規則

- **v0.8.1 測試存檔已重置到新 key `mistforest_pact_save_v2`、schema version 4**，舊 v0.8.0 的 `mistforest_pact_save_v1` 不再讀取也不刪除；新版本從第一關重新選牌。故事進度一併使用 `mistforest_pact_story_progress_v2`。
- 玩家初始固定 5 張攻擊牌，再從 40 張選 25 張；剩餘 15 張交給 Boss，Boss 初始 120 張。
- 七大類卡牌；玩家永久收藏上限 80、出戰上限 30、可自行儲存 3 套出戰牌組。
- 每關勝利固定攻擊牌 +1、下一場起始行動點 +1；另外四選一領取新卡或可升等卡牌升級。
- 行動／魔法雙資源、裂盾／穿盾、萬木共鳴、同命之契、枯木逢春從雙方棄牌堆取牌、每回合起手換牌皆保留。
- 舊版（v0.3–v0.8.0）不進行存檔遷移。原本的 HP 傷害、防禦、護盾、魔法與勝負計算不重做；v0.8.1 只新增兩種魔法效果及 Boss 一回合最多 1／2／3 張的出牌次數規則。

## 測試

- 全部本地 JavaScript 語法檢查。
- 靜態資源路徑驗證、SVG 與 ZIP 完整性檢查。
- Chromium 模擬 390px 手機：開場 → 旅人的選擇 → 關卡 → 初始 40 選 25 → 戰鬥、重載新存檔通過。
- 測試環境不能連向 `lib.stillnessbyslowly.com`，瀏覽器互動測試改以**相同介面 API 的測試替身**提供 Tree / Deck；正式專案仍只使用上述 HTTPS 引用，未將測試替身打包。請上線後驗收實機畫面及聲音。



## v0.8.1｜魔法、Boss 成長與戰鬥聲光（目前版本）

- 新增**魔法牌**「行動封印」（魔法點 4、將對方現有行動點歸零）與「行動復甦」（魔法點 4，自己行動點只補足至本場的預設起始值；超過預設值不扣點）。目前名稱與費用供測試，之後可再調整。兩種牌都可從初始候選牌或獎勵獲得，Boss 基礎牌庫也納入兩種牌；初始 40、Boss 基礎 105、最後 120 的總量不變。
- Boss 每回合出牌上限：第 **1～3** 關 1 張、第 **4～7** 關 2 張、第 **8～10** 關 3 張。每次從目前合法手牌隨機選一張；如果資源不夠、沒有合法卡牌或有人倒下，就停止，不保證出滿上限；不額外補充行動點。
- Boss 翻牌改為**逐張結算、逐張播放**，每張顯示真實牌面與 1/3 等演出計數。命中後更新 HP、護盾、能量、Boss 報告，播完才繼續下一張；動畫不負責傷害判定。
- 出牌附帶輕量青綠光閃、斬擊光線、戰場微晃、護盾／魔法震波以及 Web Audio 即時合成音效。`SlowlyFlashShake`、`SlowlyShockwave`、`SlowlyAudioContext`、`SlowlyAudioNoise`、`SlowlyHarmonicChime` **皆由軍火庫 HTTPS 絕對網址直接載入**；遊戲只負責音效組合及判定何時播放，**沒有複製軍火庫原始碼**。
- 戰鬥區有獨立「♫ 音效開／關」按鈕；音效只能在玩家操作後播放，不需要外部音檔。開場風雨聲仍是獨立開關。支援系統「減少動態效果」，不進行連續高強度白光頻閃。
- **測試存檔重新起算**：使用新 `mistforest_pact_save_v2`，故事用 `mistforest_pact_story_progress_v2`；不碰也不遷移 v0.8.0 已通關的舊紀錄。
- 保留 v0.8.0 的故事骨架（自動播放仍關閉）、四選一獎勵、固定通關攻擊牌＋下一場行動點＋1、三套牌組及所有原有關卡 UI。

**測試限制：** 已完成本地 JavaScript 語法、Node 規則測試，以及 Chromium 390px 手機尺寸的內嵌頁面操作與 Boss 連播三張測試。因執行環境限制，本機 HTTP 頁面與實際連外軍火庫未能透過瀏覽器整合測試；內嵌頁面使用暫時的 Deck／Tree／聲光模組測試替身，這些替身**完全不包含在正式 ZIP**。部署後請實機確認外部軍火庫載入、音效和手機動畫表現。

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
- **只需在對應 JSON 的 `events` 內填入內容**，播放器就能辨識該篇已寫入，不需要改 JS 文字。故事不會因為閱讀／跳過而增加遊戲關卡進度；第一至十關的故事僅由目前 `mistforest_pact_save_v2.completed` 解鎖。
- 尚未設計故事入口，所以 `story/story_config.js` 裡 `autoStory: false`；因此**現在不會出現故事按鈕，也不會強迫玩家看空故事**。以後內容準備妥當並完成介面時，設定 `autoStory: true` 才會啟動「開第一關前序章、每關獎勵領完後播放通關故事」的橋接。閱讀完或略過都可返回遊戲，並不替玩家通關。
- 可在 GitHub Pages 部署後直接以 `/story/index.html` 檢查故事頁；正式入口尚未放進「旅人的選擇」。`file://` 方式無法正常 fetch JSON，請使用 HTTP(S)。
- v0.8.1 儲存：遊戲 key `mistforest_pact_save_v2`，故事獨立 key `mistforest_pact_story_progress_v2`。重新開始遊戲會清除故事進度。跳轉沿用 HTTPS `https://lib.stillnessbyslowly.com/state/navigation/navigation.js`。

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
