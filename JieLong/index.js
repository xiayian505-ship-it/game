(() => {
  "use strict";

  // 遊戲入口已連結至帝國獨立版；原本的快捷面板結構保留。
  document.querySelectorAll("a.game-link, a.quick-game-entry").forEach((link) => {
    link.addEventListener("click", () => {
      document.documentElement.dataset.lastGate = link.href;
    });
  });
})();
