# 朕的接龍帝國｜秘藏之谷第三階段

完整純前端帝國。秘藏之谷分三級：領地首頁 → 玩家最愛局／可能無解局系列選單 → FreeCell 個人館藏。

- 玩家最愛局：Spider／FreeCell／Klondike 三系列；FreeCell 第三層有一般 FreeCell／Microsoft 百萬牌局標籤。
- 可能無解局：相同三系列；FreeCell 第三層只有一般 FreeCell，沒有微軟模式。
- Spider 與 Klondike 個人館藏功能尚未實作，分類顯示「籌備中」，並非可點擊的空連結。
- 每組館藏每頁 20 筆，附總筆數、上一頁／下一頁、重新整理；讀取本機 localStorage，不變更 Supabase。
- 點 UID 會進入自由之都的指定牌局並重新開局；遊戲離境依舊返回自由之都。
- 第二層離境回秘藏之谷；第三層返回對應的第二層選單。

## 既有本機資料 Key（不變更）

- `freecell_favorite_deals_v1`
- `freecell_microsoft_favorites_v1`
- `freecell_microsoft_solved_v1`
- `freecell_possible_unsolvable_deals_v1`
- 挑戰次數可參照既有的 `freecell_pending_deals_v1` 本機待解紀錄

館藏資料與裝置／瀏覽器綁定，不是帳號雲端收藏。

## 本階段實作範圍

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

**此處僅確定名稱與載入對照表，不會自動寫入空 localStorage，更不會擅自啟用尚未實作的最愛／可能無解按鈕。** 它們的實際收藏、標記、核對已解、秘藏之谷清單連動，後續再獨立施工。
