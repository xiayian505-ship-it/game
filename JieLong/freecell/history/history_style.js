(() => {
  const leaveButton = document.querySelector("#leaveHistoryButton");
  leaveButton?.addEventListener("click", () => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: "slowly-freecell-leave", mode: "history" }, window.location.origin);
      return;
    }
    if (window.history.length > 1) window.history.back();
  });
})();
