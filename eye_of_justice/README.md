# 執法之眼 | Eye of Justice

新編包公案《玄幻刑偵》改編的原創、純前端探索解謎遊戲。**目前實際可玩：第一集《人格篡位》、第一回、第一節〈敕令〉**（小說開頭至第一個 `＃`）。

## GitHub Pages 部署

不需要另開 repo。**將本 ZIP 內的 `eye_of_justice/` 資料夾整包放到 `game.stillnessbyslowly.com` 對應的既有 repo 根目錄**，與現有遊戲並列，不要覆蓋既有主站 `index.html`。

- 官網：`https://game.stillnessbyslowly.com/eye_of_justice/`
- 選集：`https://game.stillnessbyslowly.com/eye_of_justice/game/`
- 選回：`https://game.stillnessbyslowly.com/eye_of_justice/game/book_01/`
- 選節：`https://game.stillnessbyslowly.com/eye_of_justice/game/book_01/chapter_01/`
- 第一節遊戲：`https://game.stillnessbyslowly.com/eye_of_justice/game/book_01/chapter_01/section_01/`

請不要只搬 `section_01/`：關卡共用引擎與美術已移到 `game/shared/`。上述所有路徑是以此目錄結構為基準寫的相對連結，軍火庫則一律 HTTPS 絕對路徑。

## 專案結構

```text
eye_of_justice/
├── index.html                  # 官網
├── index.css                   # 官網基礎樣式
├── index.js                    # 官網功能
├── index_style.css             # 官網美術與響應式
├── index_style.js              # 官網特效
├── assets/crest.svg            # 原創徽記
└── game/
    ├── index.html             # 選集
    ├── shared/                # 所有關卡共用（無需複製到每一節）
    │   ├── catalog.css / catalog_style.css
    │   ├── catalog.js / catalog_style.js
    │   ├── game.css / game_style.css
    │   ├── game.js / game_style.js
    │   ├── dream_wind.js        # 夢中公堂專用合成風聲
    │   └── assets/
    │       ├── court.svg
    │       ├── office.svg
    │       └── pendant.svg
    └── book_01/
        ├── index.html          # 第一集選回
        └── chapter_01/
            ├── index.html      # 第一回選節
            └── section_01/
                ├── index.html  # 第一節獨立遊戲頁
                └── data/
                    └── episode_01_01.js  # 第一節劇情與謎題
```

未完成的集、回、節只在選單顯示「尚未開放」，**沒有新增空資料夾或假遊戲**。以後新的一節只需新增 `section_02/` 並依內容接入共用引擎。確切的題目／演出依新關卡需求開發，不保證所有節都有同一種謎題。

## 更新重點

- 新增三層可操作選單：選集、選回、選節；官網與獨立關卡維持分開。
- 官網入口導向選集；第一節開場、遊戲工具列與通關頁均可返回**第一回選節**；遊戲頁品牌連結可返回官網。
- 遊戲資料留在 `section_01/data/`，共用玩法與場景美術歸入 `game/shared/`。
- 新增 `game/shared/dream_wind.js`：只在**夢中公堂**播放 Web Audio 合成風聲；醒來切換辦公室時柔和淡出。風聲會跟隨既有音效開關，不新增 MP3/WAV，不依賴外部音效素材。
- 原本第一節遊戲玩法、敘事、音效及場景保留不重做；未擅自修改執法之眼原有設定。
- **存檔相容**：仍讀寫舊版 `localStorage` 鍵 `eye-of-justice:01-01:progress`。只要在同一個 `game.stillnessbyslowly.com` 網域，搬目錄前的紀錄仍可續玩。之後新的章節應使用各自獨立的儲存鍵，不能共用此鍵。
- 選單會顯示第一節目前「可遊玩／調查進行中／已通關」，其他章節不受影響。

## 慢慢軍火庫與素材

頁面直接用公開 HTTPS 絕對 URL 載入下列軍火庫資源（不下載、不內嵌或複製）：

- `https://lib.stillnessbyslowly.com/ui/responsive.css`
- `https://lib.stillnessbyslowly.com/effects/background/fog.js`
- `https://lib.stillnessbyslowly.com/effects/background/rain.js`
- `https://lib.stillnessbyslowly.com/effects/light/button_shine.css`
- 官網另用 `https://lib.stillnessbyslowly.com/effects/reveal/fade_up.css` 和 `https://lib.stillnessbyslowly.com/effects/reveal/auto_reveal.js`

沿用 Claude 原型的可用 WebAudio 合成音效、卷宗、凝視與對話機制；夢中風聲使用本作新寫的 `dream_wind.js`，沒有額外引用外部遊戲程式。公堂、辦公室與吊墜使用本作原創 SVG；沒有取用鹿雨森的人物、圖片或原始碼。CSS 保留必要的本作風格，仍可由各頁調整外觀。

## 第一節操作方式

公堂調查四個熱點（至少調查三處且包含發光小物）→ 聆聽敕令並回答 → 醒來調查辦公室 → 查看吊墜並使用凝視 → 選擇正確線索比對 → 通關。可開卷宗、提示、靜音；可重新體驗或從存檔續玩。鍵盤：`Enter` / `Space` 推進對話，`E` 凝視，`R` 卷宗，`M` 靜音，`Esc` 關閉浮層。

本地可直接以 `file://` 開啟 HTML（絕對路徑軍火庫可能因網路／瀏覽器政策限制無法顯示，核心關卡仍可玩）；無需 npm、打包器、後端或資料庫。
