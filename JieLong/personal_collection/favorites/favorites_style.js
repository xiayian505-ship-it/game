(() => {
  "use strict";

  // 在帝國 iframe 內離境時，通知主城恢復秘藏之谷入口。
  // 獨立開啟此頁時則保留原生連結，返回帝國第四頁。
  document.querySelector("[data-collection-leave]")?.addEventListener("click", (event) => {
    if (window.parent === window) return;
    event.preventDefault();
    window.parent.postMessage({
      type: "slowly-empire-leave",
      territory: "territory-trove"
    }, window.location.origin);
  });
})();
