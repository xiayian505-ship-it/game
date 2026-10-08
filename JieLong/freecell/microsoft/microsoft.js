(() => {
  "use strict";

  const randomButton = document.getElementById("randomMicrosoftButton");
  const solvedButton = document.getElementById("solvedMicrosoftButton");
  const numberInput = document.getElementById("microsoftDealInput");
  const loadButton = document.getElementById("loadMicrosoftButton");
  const picker = document.getElementById("microsoftPicker");
  const solvedPanel = document.getElementById("microsoftSolvedPanel");
  const solvedList = document.getElementById("microsoftSolvedList");
  const solvedPrev = document.getElementById("microsoftSolvedPrev");
  const solvedNext = document.getElementById("microsoftSolvedNext");
  const solvedPageInfo = document.getElementById("microsoftSolvedPageInfo");
  const pickerBack = document.getElementById("microsoftPickerBack");
  const restartButton = document.getElementById("restartButton");
  const restartConfirm = document.getElementById("restartConfirm");
  const restartCancelButton = document.getElementById("restartCancelButton");
  const restartCurrentButton = document.getElementById("restartCurrentButton");
  const restartConfirmButton = document.getElementById("restartConfirmButton");
  const playAgainButton = document.getElementById("playAgainButton");
  const message = document.getElementById("message");
  const leaveButton = document.getElementById("leaveFreeCellButton");
  const hiddenDealButtons = Array.from(document.querySelectorAll("[data-hidden-microsoft-deal]"));

  let solvedPage = 1;

  function showPicker({ canReturn = true } = {}) {
    if (restartConfirm) restartConfirm.hidden = true;
    if (message) message.hidden = true;
    if (pickerBack) pickerBack.hidden = !canReturn;
    if (solvedPanel) solvedPanel.hidden = true;
    if (numberInput) numberInput.value = "";
    if (picker) picker.hidden = false;
  }

  function hidePicker() {
    if (picker) picker.hidden = true;
    if (solvedPanel) solvedPanel.hidden = true;
  }

  function startDeal(dealNumber) {
    const number = window.MicrosoftFreeCellLocal?.normalizeDealNumber?.(dealNumber);
    if (!number) return false;

    const deal = window.FreeCellGame?.createMicrosoftDeal?.(number);
    if (!deal) return false;

    const local = window.MicrosoftFreeCellLocal?.findByNumber?.(number);
    window.FreeCellGame?.abandonCurrentDeal?.();
    const started = window.FreeCellGame?.startKnownGame?.({
      deal,
      uid: window.MicrosoftFreeCellLocal.uidFor(number),
      bestSteps: local?.bestSteps || null,
      clearCount: local?.clearCount || 0
    });

    if (started) {
      const hidden = window.FreeCellGame?.classicHiddenDeals?.().find(record => record.dealNumber === number);
      const isKnownUnsolvable = window.FreeCellGame?.classicDealNumbers?.().includes(number);

      if (hidden) {
        window.FreeCellGame?.setNotice?.(`#${number}｜${hidden.result}`);
      } else if (isKnownUnsolvable) {
        window.FreeCellGame?.setNotice?.(`#${number}｜知名無解牌局`);
      }

      hidePicker();
      return true;
    }
    return false;
  }

  function randomDealNumber() {
    return Math.floor(Math.random() * 1000000) + 1;
  }

  function renderSolvedPage(page = 1) {
    const result = window.MicrosoftFreeCellLocal?.listPage?.(page, 5);
    if (!result || !solvedList) return;
    solvedPage = result.page;
    solvedList.innerHTML = "";

    if (!result.records.length) {
      const empty = document.createElement("p");
      empty.className = "contributed-empty";
      empty.textContent = "本機目前還沒有已解牌局。";
      solvedList.appendChild(empty);
    } else {
      result.records.forEach(record => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "contributed-deal-row";

        const code = document.createElement("span");
        code.className = "contributed-code";
        code.textContent = `#${record.dealNumber}`;

        const info = document.createElement("span");
        info.className = "contributed-best";
        info.textContent = `最佳 ${record.bestSteps || "—"} 步｜破關 ${record.clearCount} 次`;

        button.append(code, info);
        button.addEventListener("click", () => startDeal(record.dealNumber));
        solvedList.appendChild(button);
      });
    }

    if (solvedPageInfo) solvedPageInfo.textContent = `${result.page} / ${result.totalPages}`;
    if (solvedPrev) solvedPrev.disabled = result.page <= 1;
    if (solvedNext) solvedNext.disabled = result.page >= result.totalPages;
  }

  function openSolvedPanel() {
    if (solvedPanel) solvedPanel.hidden = false;
    renderSolvedPage(1);
  }

  randomButton?.addEventListener("click", () => startDeal(randomDealNumber()));
  hiddenDealButtons.forEach(button => {
    button.addEventListener("click", () => startDeal(button.dataset.hiddenMicrosoftDeal));
  });
  solvedButton?.addEventListener("click", openSolvedPanel);
  loadButton?.addEventListener("click", () => startDeal(numberInput?.value));
  numberInput?.addEventListener("keydown", event => {
    if (event.key === "Enter") startDeal(numberInput.value);
  });
  solvedPrev?.addEventListener("click", () => renderSolvedPage(solvedPage - 1));
  solvedNext?.addEventListener("click", () => renderSolvedPage(solvedPage + 1));
  pickerBack?.addEventListener("click", hidePicker);

  restartButton?.addEventListener("click", () => {
    if (window.FreeCellGame?.isBusy?.()) return;
    if (restartConfirm) restartConfirm.hidden = false;
  });
  restartCancelButton?.addEventListener("click", () => { if (restartConfirm) restartConfirm.hidden = true; });
  restartCurrentButton?.addEventListener("click", () => {
    if (window.FreeCellGame?.restartCurrentDeal?.() && restartConfirm) restartConfirm.hidden = true;
  });
  restartConfirmButton?.addEventListener("click", () => showPicker({ canReturn: true }));
  playAgainButton?.addEventListener("click", () => showPicker({ canReturn: false }));

  leaveButton?.addEventListener("click", () => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: "slowly-freecell-leave" }, window.location.origin);
      return;
    }
    if (window.history.length > 1) window.history.back();
  });

  window.MicrosoftFreeCellUI = Object.freeze({ showPicker, hidePicker, startDeal });

  void window.FreeCellData?.initialize?.();
  if (!window.FreeCellGame?.hasGame?.()) showPicker({ canReturn: false });
})();
