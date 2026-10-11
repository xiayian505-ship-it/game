(() => {
  "use strict";

  // 秘藏之谷第三層：返回留在館藏，離境只通知主城收起 iframe。
  document.querySelector("[data-collection-leave]")?.addEventListener("click", (event) => {
    if (window.parent === window) return;
    event.preventDefault();
    window.parent.postMessage({
      type: "slowly-empire-leave",
      territory: "territory-trove"
    }, window.location.origin);
  });
})();
