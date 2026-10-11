(() => {
  "use strict";

  // 秘藏之谷個人資料儲存名稱｜先定義，不擅自新增空資料或更改既有 Key。
  // FreeCell 現有資料沿用原 Key；其他五種玩法為下一輪接入最愛／標記功能預留。
  const keys = {
    spider_easy: {
      favorite: "spider_easy_favorite_deals_v1",
      possible: "spider_easy_possible_unsolvable_deals_v1"
    },
    spider_medium: {
      favorite: "spider_medium_favorite_deals_v1",
      possible: "spider_medium_possible_unsolvable_deals_v1"
    },
    spider_hard: {
      favorite: "spider_hard_favorite_deals_v1",
      possible: "spider_hard_possible_unsolvable_deals_v1"
    },
    klondike_draw1: {
      favorite: "klondike_draw1_favorite_deals_v1",
      possible: "klondike_draw1_possible_unsolvable_deals_v1"
    },
    klondike_draw3: {
      favorite: "klondike_draw3_favorite_deals_v1",
      possible: "klondike_draw3_possible_unsolvable_deals_v1"
    }
  };
  for (const entry of Object.values(keys)) Object.freeze(entry);
  window.EmpireCollectionKeys = Object.freeze(keys);
})();
