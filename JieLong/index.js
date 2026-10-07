(() => {
  "use strict";

  // 目前六個遊戲入口仍通往既有乾淨版。
  // 未來帝國版各遊戲完成後，只需替換入口網址，不影響首頁與快捷面板結構。
  document.querySelectorAll("a.game-link, a.quick-game-entry").forEach((link) => {
    link.addEventListener("click", () => {
      document.documentElement.dataset.lastGate = link.href;
    });
  });
})();
