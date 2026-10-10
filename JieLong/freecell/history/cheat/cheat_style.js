/*
 * 作弊模擬器｜界面互動與接龍帝國導覽
 *
 * 只管理鍵盤、復古對話框、狀態提示及頁面跳轉；
 * 真正的牌局與作弊結果交由 cheat.js 處理。
 */
(() => {
  "use strict";

  const simulator = window.FreeCellCheatSimulator;
  const dialogShade = document.querySelector("#dialogShade");
  const dialogTitle = document.querySelector("#dialogTitle");
  const dialogMessage = document.querySelector("#dialogMessage");
  const dialogIcon = document.querySelector("#dialogIcon");
  const dialogActions = document.querySelector("#dialogActions");
  const status = document.querySelector("#classicStatus");
  const dealNumberInput = document.querySelector("#dealNumber");
  const virtualKeys = Array.from(document.querySelectorAll("[data-shortcut-key]"));

  let held = { ctrl: false, shift: false, f10: false };
  let shortcutTriggered = false;
  let activeDialog = null;
  let lastFocusedElement = null;

  function displayStatus(message) {
    status.textContent = message;
  }

  function syncShortcutButtons() {
    for (const button of virtualKeys) {
      const pressed = held[button.dataset.shortcutKey];
      button.classList.toggle("is-held", pressed);
      button.setAttribute("aria-pressed", String(pressed));
    }
  }

  function clearShortcut() {
    held = { ctrl: false, shift: false, f10: false };
    shortcutTriggered = false;
    syncShortcutButtons();
  }

  function openDialog({ title, message, icon = "✖", question = false, actions }) {
    if (activeDialog) return;
    lastFocusedElement = document.activeElement;
    activeDialog = { actions };
    simulator.setModalOpen(true);

    dialogTitle.textContent = title;
    dialogMessage.innerHTML = message;
    dialogIcon.textContent = icon;
    dialogIcon.classList.toggle("is-question", question);
    dialogActions.replaceChildren();

    for (const action of actions) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = action.label;
      button.dataset.dialogKey = action.key;
      button.addEventListener("click", () => chooseDialogAction(action));
      dialogActions.appendChild(button);
    }

    dialogShade.hidden = false;
    dialogActions.querySelector("button")?.focus();
  }

  function closeDialog() {
    dialogShade.hidden = true;
    activeDialog = null;
    simulator.setModalOpen(false);
    clearShortcut();
    lastFocusedElement?.focus?.();
  }

  function chooseDialogAction(action) {
    if (!activeDialog) return;
    closeDialog();
    action.perform();
  }

  function showCheatDialog() {
    if (activeDialog) return;
    if (simulator.isFinished()) {
      displayStatus("本局已結束。請按「發牌」開始新局。");
      return;
    }

    openDialog({
      title: "Microsoft Visual C++ Runtime Library",
      icon: "✖",
      message: "<strong>Debug Error!</strong><br>" +
        "程式：C:\\WINDOWS\\system32\\freecell.exe<br>" +
        "異常的程式終止<br><br>" +
        "(按『重試』以偵錯應用程式)",
      actions: [
        {
          label: "中止(A)",
          key: "a",
          perform: () => simulator.setCheatMode("win")
        },
        {
          label: "重試(R)",
          key: "r",
          perform: () => simulator.setCheatMode("lose")
        },
        {
          label: "略過(I)",
          key: "i",
          perform: () => simulator.setCheatMode(null)
        }
      ]
    });
  }

  function showResultDialog(result, cheated) {
    const success = result === "win";
    const message = success
      ? `恭喜您，您贏了這一局！${cheated ? "<br>（已使用 Ctrl + Shift + F10 密技）" : ""}<br>要再玩一局嗎？`
      : "本局結束。<br>要再玩一局嗎？";

    openDialog({
      title: "新接龍",
      icon: "!",
      question: true,
      message,
      actions: [
        {
          label: "是(Y)",
          key: "y",
          perform: () => simulator.newDeal(simulator.randomDeal())
        },
        {
          label: "否(N)",
          key: "n",
          perform: () => displayStatus(success ? "本局已完成。" : "本局已結束。")
        }
      ]
    });
  }

  function evaluateShortcut() {
    const allHeld = held.ctrl && held.shift && held.f10;
    if (!allHeld) {
      shortcutTriggered = false;
      return;
    }
    if (shortcutTriggered || activeDialog) return;
    shortcutTriggered = true;
    showCheatDialog();
  }

  // 手機虛擬按鍵採「點一下保持按下」：三鍵都亮起時觸發。
  for (const button of virtualKeys) {
    button.addEventListener("click", () => {
      if (activeDialog) return;
      const key = button.dataset.shortcutKey;
      held[key] = !held[key];
      syncShortcutButtons();
      evaluateShortcut();
    });
  }

  const keyMap = { Control: "ctrl", Shift: "shift", F10: "f10" };
  window.addEventListener("keydown", (event) => {
    if (activeDialog) {
      const matched = activeDialog.actions.find((action) => action.key === event.key.toLowerCase());
      if (matched) {
        event.preventDefault();
        chooseDialogAction(matched);
      } else if (event.key === "Tab") {
        const buttons = Array.from(dialogActions.querySelectorAll("button"));
        const currentIndex = buttons.indexOf(document.activeElement);
        if (buttons.length) {
          event.preventDefault();
          const nextIndex = (currentIndex + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
          buttons[nextIndex].focus();
        }
      }
      return;
    }

    // 無論焦點是否停在牌局編號欄位，都保留歷史快捷鍵。
    // 遇到 F10 時阻止瀏覽器啟用選單。
    const key = keyMap[event.key];
    if (!key) return;
    if (event.key === "F10") event.preventDefault();
    held[key] = true;
    syncShortcutButtons();
    if (!event.repeat) evaluateShortcut();
  });

  window.addEventListener("keyup", (event) => {
    const key = keyMap[event.key];
    if (!key || activeDialog) return;
    held[key] = false;
    syncShortcutButtons();
    evaluateShortcut();
  });
  window.addEventListener("blur", clearShortcut);

  document.addEventListener("freecell-cheat:invalid-deal", () => {
    displayStatus("請輸入 1～1000000 之間的整數牌局編號。");
    dealNumberInput.focus();
  });
  document.addEventListener("freecell-cheat:reset", () => {
    if (activeDialog) closeDialog();
    clearShortcut();
    displayStatus("按 Ctrl + Shift + F10 試試經典密技");
  });
  document.addEventListener("freecell-cheat:mode", (event) => {
    const message = {
      win: "已選擇「中止」：下一手成功移牌就會贏！",
      lose: "已選擇「重試」：下一手成功移牌就會輸！"
    }[event.detail.mode] || "已選擇「略過」：恢復正常遊戲。";
    displayStatus(message);
  });
  document.addEventListener("freecell-cheat:animating", () => {
    displayStatus("經典密技生效：撲克牌正在自動回收……");
  });
  document.addEventListener("freecell-cheat:finished", (event) => {
    displayStatus(event.detail.result === "win" ? "本局獲勝！" : "本局結束。");
    showResultDialog(event.detail.result, event.detail.cheated);
  });
  document.addEventListener("freecell-cheat:invalid-move", () => {
    displayStatus("只能移動符合紅黑相間、點數遞減的牌組。");
  });

  // 和 history.html 相同的帝國訊息機制：不開新分頁，不直接碰正式遊戲狀態。
  function navigateWithinEmpire(mode, fallback) {
    if (window.parent !== window) {
      window.parent.postMessage({ type: "slowly-freecell-open", mode }, window.location.origin);
      return;
    }
    window.location.href = fallback;
  }

  document.querySelector("#returnHistoryButton")?.addEventListener("click", () => {
    navigateWithinEmpire("history", "../history.html");
  });
  document.querySelector("#leaveFreeCellButton")?.addEventListener("click", () => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: "slowly-freecell-leave", mode: "cheat" }, window.location.origin);
      return;
    }
    window.location.href = "../../../index.html";
  });
})();
