# 朕的接龍帝國｜秘藏之谷三城館藏擴建

完整純前端帝國。秘藏之谷分三級：領地首頁 → 玩家最愛局／可能無解局系列選單 → Spider、FreeCell、Klondike 個人館藏。

- 玩家最愛局：Spider／FreeCell／Klondike 三系列；FreeCell 第三層有自由之都／百萬牌局標籤；Spider 有初階／中階／高階，Klondike 有翻一張／翻三張。
- 可能無解局：相同三系列；FreeCell 第三層只有一般 FreeCell，沒有微軟模式。
- Spider 與 Klondike 的個人館藏入口已接通，依據五種玩法各自的 localStorage Key 顯示最愛及可能無解清單。
- 每組館藏每頁 20 筆，附總筆數、上一頁／下一頁、重新整理；讀取本機 localStorage，不變更 Supabase。
- 點 UID 會進入對應的秩序之城／自由之都／傳說之境玩法並重新開局；遊戲離境返回該領地。
- 第二層離境回秘藏之谷；第三層返回對應的第二層選單。

## 既有本機資料 Key（不變更）

- `freecell_favorite_deals_v1`
- `freecell_microsoft_favorites_v1`
- `freecell_microsoft_solved_v1`
- `freecell_possible_unsolvable_deals_v1`
- 挑戰次數可參照既有的 `freecell_pending_deals_v1` 本機待解紀錄

館藏資料與裝置／瀏覽器綁定，不是帳號雲端收藏。

## 第三階段的既有實作（歷史紀錄）

新增 `personal_collection/collection_store.js`，以及 `favorites/freecell/`、`unsolvable/freecell/` 各五檔；調整兩個第二層的 HTML/CSS、主城導航 `index_style.js`、一般 FreeCell 啟動入口 `freecell_style.js` 及兩處 JS 快取參數。不改其他三城遊戲規則與主城按鈕。

軍火庫 Tabs 與 FictionPaginate 維持 HTTPS 絕對 URL 載入。


## 秩序之城、傳說之境：開局 UID（2026-10-11）

本輪讓 Spider 初／中／高階與 Klondike 翻一張／翻三張，在每次開新局時就建立 UID，並寫入既有進行中牌局存檔。重新開始沿用相同 UID；遇到已解／待破解的同牌組紀錄會沿用舊 UID。舊進度缺 UID 時補建；非同步牌局辨識不得覆蓋已換掉的新局。既有遊戲規則、資料表、紀錄格式不變。

為後續個人館藏功能，新增 `personal_collection/collection_keys.js`，由五種玩法共同載入，集中保留十個 localStorage Key：

| 玩法 | 最愛收藏 | 可能無解標記 |
|---|---|---|
| Spider 初階 | `spider_easy_favorite_deals_v1` | `spider_easy_possible_unsolvable_deals_v1` |
| Spider 中階 | `spider_medium_favorite_deals_v1` | `spider_medium_possible_unsolvable_deals_v1` |
| Spider 高階 | `spider_hard_favorite_deals_v1` | `spider_hard_possible_unsolvable_deals_v1` |
| Klondike 翻一張 | `klondike_draw1_favorite_deals_v1` | `klondike_draw1_possible_unsolvable_deals_v1` |
| Klondike 翻三張 | `klondike_draw3_favorite_deals_v1` | `klondike_draw3_possible_unsolvable_deals_v1` |

**上述 Key 原先僅預留命名，後續階段已完成遊戲內最愛與可能無解標記；本次則完成秘藏之谷清單與指定開局接線。**


## 秘藏之谷：Spider／Klondike 館藏接線（2026-10-12）

- 新增四個第三層目錄：`favorites/spider/`、`favorites/klondike/`、`unsolvable/spider/`、`unsolvable/klondike/`，每個頁面採五檔分離，沿用 FreeCell 的館藏 CSS 規格。
- Spider 使用初階／中階／高階三個頁籤；Klondike 使用翻一張／翻三張兩個頁籤。每類各自計數、每頁 20 筆、換頁／重整，不展示收藏或標記時間。
- `collection_archive.js` 僅讀取原本的本機紀錄，`collection_archive_ui.js` 管理清單與頁籤；軍火庫的 Tabs 和 FictionPaginate 均經由公開 HTTPS URL 載入，不複製軍火庫實作。
- 主城只接受秘藏之谷 iframe 發來的指定開局訊息，依原始完整 UID 與 Key 驗證後切換至對應遊戲；同一 UID 重選也會重新開始，不改遊戲規則。
- 開局時沿用五種遊戲既有 `startGame`／`startKnownGame` 函式；可能無解牌局沿用原本挑戰次數紀錄，破關後的清標記規則仍在遊戲端。
- 兩座城橫幅的最愛星星移除多餘的外框（只有星星本身），點擊區仍保留。
- 不更改既有 Supabase 資料表，也不更改任何原有 localStorage Key 或紀錄格式。完整的正式站跨 iframe 操作需部署後再驗收。
