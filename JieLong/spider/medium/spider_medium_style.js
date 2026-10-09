(() => {
  "use strict";
  // 帝國 Spider UI 操作：獨立於牌局規則與資料庫程式。
  const ui = window.SpiderEmpireUI;
  if (!ui) return;
  const on = (id, event, handler) => document.getElementById(id)?.addEventListener(event, handler);
  on("restartButton", "click", () => ui.openRestartConfirm());
  on("restartCancelButton", "click", () => ui.hideRestartConfirm());
  on("restartCurrentButton", "click", () => ui.restartCurrentDeal());
  on("restartConfirmButton", "click", () => ui.selectOtherDeal());
  on("dealPickerBackButton", "click", () => ui.hideDealPicker());
  on("randomDealButton", "click", () => ui.selectRandomDeal());
  on("solvedDealButton", "click", () => void ui.openContributedPanel("solved"));
  on("pendingDealButton", "click", () => void ui.openContributedPanel("pending"));
  on("randomContributedButton", "click", () => void ui.loadRandomSolvedDeal());
  on("contributedPrevButton", "click", () => void ui.previousPage());
  on("contributedNextButton", "click", () => void ui.nextPage());
  on("uidDealButton", "click", () => ui.toggleUidSearch());
  on("uidSearchButton", "click", () => void ui.loadDealByUid());
  on("uidInput", "keydown", (event) => { if (event.key === "Enter") void ui.loadDealByUid(); });
  on("copyDealUidButton", "click", () => void ui.copyCurrentUid());
  on("messageCopyUidButton", "click", () => void ui.copyMessageUid());
  on("playAgainButton", "click", () => ui.chooseNextDeal());
  // 同 FreeCell：在 iframe 裡通知帝國主城收起領地，不清除目前牌局。
  document.getElementById("leaveEmpireButton")?.addEventListener("click", () => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: "slowly-empire-leave", territory: "territory-spider" }, window.location.origin);
      return;
    }
    if (window.history.length > 1) window.history.back();
  });
})();
