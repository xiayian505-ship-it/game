/*
 * 作弊模擬器｜界面互動與接龍帝國導覽
 *
 * 只管理鍵盤、復古對話框、狀態提示及頁面跳轉；
 * 真正的牌局與作弊結果交由 cheat.js 處理。
 */
(() => {
  "use strict";

  // 第一張展示區：梅花徽章是唯一的說明開關，與作弊模擬器互不干擾。
  // 文字動畫仿照鹿雨森 game 的 title-rise（先模糊，逐漸清晰）。
  const secretStage = document.querySelector("#cheatSecretStage");
  const secretRevealButton = document.querySelector("#cheatSecretReveal");
  const introductionCopy = document.querySelector("#cheatIntroductionCopy");
  const reduceIntroMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  secretRevealButton?.addEventListener("click", () => {
    if (!secretStage || !introductionCopy || secretStage.classList.contains("is-dissolving")) return;

    secretRevealButton.setAttribute("aria-expanded", "true");
    secretStage.classList.add("is-dissolving");
    // 先讓環繞舞台退場，再由模糊到清晰浮出原本的密技介紹。
    window.setTimeout(() => {
      secretStage.hidden = true;
      introductionCopy.hidden = false;
    }, reduceIntroMotion.matches ? 0 : 540);
  });

  // 第二區：鹿雨森「踏入霧中」的退場與霧幕節奏。
  // 模擬器首次顯示後重新計算八欄牌寬；否則隱藏時會被量成 0px。
  const experienceSection = document.querySelector(".experience-section");
  const experienceGateway = document.querySelector("#experienceGateway");
  const experienceEnterButton = document.querySelector("#experienceEnterButton");
  const experienceSimulator = document.querySelector("#experienceSimulator");
  let experienceOpening = false;

  experienceEnterButton?.addEventListener("click", () => {
    if (experienceOpening || !experienceSection || !experienceSimulator || !experienceGateway) return;
    experienceOpening = true;
    experienceEnterButton.setAttribute("aria-expanded", "true");

    if (reduceIntroMotion.matches) {
      experienceGateway.hidden = true;
      experienceSimulator.hidden = false;
      experienceSimulator.classList.add("is-revealed", "is-settled");
      window.dispatchEvent(new Event("resize"));
      return;
    }

    // 鹿雨森入口：文字淡出、放大、失焦，霧幕在同一區域聚攏。
    experienceSection.classList.add("is-entering");

    window.setTimeout(() => {
      experienceGateway.hidden = true;
      experienceSimulator.hidden = false;
      experienceSimulator.classList.add("is-awakening");
      // 重新渲染遊戲牌面，避免先 hidden 導致牌寬計算不正確。
      window.dispatchEvent(new Event("resize"));
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          experienceSection.classList.add("is-unveiling");
          experienceSimulator.classList.add("is-revealed");
        });
      });
      // 微弱光邊隨霧散去收斂，模擬器保持原本的經典 Windows 外觀。
      window.setTimeout(() => {
        experienceSimulator.classList.add("is-settled");
        experienceSimulator.classList.remove("is-awakening");
      }, 1800);
    }, 1550);
  });

  const simulator = window.FreeCellCheatSimulator;
  const dialogShade = document.querySelector("#dialogShade");
  const dialogTitle = document.querySelector("#dialogTitle");
  const dialogMessage = document.querySelector("#dialogMessage");
  const dialogIcon = document.querySelector("#dialogIcon");
  const dialogActions = document.querySelector("#dialogActions");
  const status = document.querySelector("#classicStatus");
  const dealNumberInput = document.querySelector("#dealNumber");
  const virtualKeys = Array.from(document.querySelectorAll("[data-shortcut-key]"));
  const classicWindow = document.querySelector("#classicWindow");
  const victoryCanvas = document.querySelector("#victoryCanvas");
  const victoryBanner = document.querySelector("#victoryBanner");
  const victorySubtitle = document.querySelector("#victorySubtitle");
  const victoryPlayAgain = document.querySelector("#victoryPlayAgain");

  let held = { ctrl: false, shift: false, f10: false };
  let shortcutTriggered = false;
  let activeDialog = null;
  let lastFocusedElement = null;
  let audioContext = null;
  let victoryAnimationFrame = null;
  let effectTimeouts = [];

  // 經典密技的短音效；在使用者點擊／按鍵後建立 AudioContext。
  function playTone(frequency, duration = .1, wave = "square", delay = 0) {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      audioContext ??= new AudioContextClass();
      if (audioContext.state === "suspended") audioContext.resume().catch(() => {});

      const oscillator = audioContext.createOscillator();
      const volume = audioContext.createGain();
      const start = audioContext.currentTime + delay;
      oscillator.type = wave;
      oscillator.frequency.value = frequency;
      volume.gain.setValueAtTime(.06, start);
      volume.gain.exponentialRampToValueAtTime(.0001, start + duration);
      oscillator.connect(volume).connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + duration);
    } catch (error) {
      // 靜音模式／不支援 Web Audio 的瀏覽器仍能正常玩牌。
    }
  }

  function triggerWindowEffect(className, duration) {
    classicWindow.classList.remove(className);
    // 允許短時間內重新觸發相同的 CSS 動畫。
    void classicWindow.offsetWidth;
    classicWindow.classList.add(className);
    effectTimeouts.push(window.setTimeout(() => {
      classicWindow.classList.remove(className);
    }, duration));
  }

  function stopVictoryEffects() {
    if (victoryAnimationFrame !== null) {
      window.cancelAnimationFrame(victoryAnimationFrame);
      victoryAnimationFrame = null;
    }
    for (const timeout of effectTimeouts) window.clearTimeout(timeout);
    effectTimeouts = [];
    classicWindow.classList.remove("is-debugging", "is-cheat-loss");
    victoryCanvas.hidden = true;
    victoryBanner.hidden = true;
    // 重新發牌後釋放上一局 canvas 的影像記憶體。
    victoryCanvas.width = 0;
    victoryCanvas.height = 0;
  }

  // 還原 Claude 原版的勝利彈跳牌雨，而不是只顯示文字對話框。
  // Canvas 只覆蓋本模擬器；不會跑出接龍帝國的 iframe。
  function showVictoryEffects(cheated) {
    stopVictoryEffects();
    victorySubtitle.textContent = cheated ? "Ctrl＋Shift＋F10 的魔法" : "手氣不錯";
    victoryBanner.hidden = false;
    [523, 659, 784, 1047, 1319].forEach((frequency, index) => {
      playTone(frequency, .25, "triangle", index * .11);
    });

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const context = victoryCanvas.getContext("2d");
    if (!context) return;
    const width = classicWindow.clientWidth;
    const height = classicWindow.clientHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    victoryCanvas.width = Math.round(width * ratio);
    victoryCanvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    victoryCanvas.hidden = false;

    const windowRect = classicWindow.getBoundingClientRect();
    const foundationRects = Array.from(
      classicWindow.querySelectorAll('.classic-slot[data-zone="foundation"]')
    ).map((slot) => {
      const rect = slot.getBoundingClientRect();
      return { x: rect.left - windowRect.left, y: rect.top - windowRect.top };
    });

    const suitSymbols = ["♣", "♦", "♥", "♠"];
    const rankSymbols = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
    const cardWidth = Math.min(72, width / 8);
    const cardHeight = cardWidth * 1.42;
    const queue = [];
    for (let rank = 12; rank >= 0; rank--) {
      for (let suit = 0; suit < 4; suit++) queue.push(rank * 4 + suit);
    }

    let particles = [];
    let frame = 0;

    function drawFlyingCard(particle) {
      const suit = particle.card & 3;
      const rank = particle.card >> 2;
      context.fillStyle = "#fffdf7";
      context.strokeStyle = "#0007";
      context.beginPath();
      if (typeof context.roundRect === "function") {
        context.roundRect(particle.x, particle.y, cardWidth, cardHeight, 5);
      } else {
        context.rect(particle.x, particle.y, cardWidth, cardHeight);
      }
      context.fill();
      context.stroke();

      context.fillStyle = suit === 1 || suit === 2 ? "#c1272d" : "#1a1a1a";
      context.font = `700 ${cardWidth * .32}px Georgia`;
      context.fillText(`${rankSymbols[rank]}${suitSymbols[suit]}`, particle.x + 4, particle.y + cardWidth * .36);
      context.font = `${cardWidth * .6}px serif`;
      context.fillText(suitSymbols[suit], particle.x + cardWidth * .28, particle.y + cardHeight * .88);
    }

    function drawFrame() {
      context.clearRect(0, 0, width, height);
      if (frame++ % 7 === 0 && queue.length) {
        const card = queue.shift();
        const start = foundationRects[card & 3];
        if (start) {
          particles.push({
            card,
            x: start.x,
            y: start.y,
            vx: (Math.random() < .5 ? -1 : 1) * (1.5 + Math.random() * 4),
            vy: -Math.random() * 7
          });
        }
      }

      for (const particle of particles) {
        particle.vy += .45;
        particle.x += particle.vx;
        particle.y += particle.vy;
        if (particle.y + cardHeight > height) {
          particle.y = height - cardHeight;
          particle.vy *= -.82;
        }
        drawFlyingCard(particle);
      }
      particles = particles.filter((particle) => particle.x > -cardWidth && particle.x < width);
      if (particles.length || queue.length) {
        victoryAnimationFrame = window.requestAnimationFrame(drawFrame);
      } else {
        victoryAnimationFrame = null;
      }
    }

    victoryAnimationFrame = window.requestAnimationFrame(drawFrame);
  }

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

    triggerWindowEffect("is-debugging", 500);
    playTone(440, .2);
    playTone(330, .3, "square", .15);
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
      playTone(900, .03);
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
    stopVictoryEffects();
    displayStatus("按 Ctrl + Shift + F10 試試經典密技");
  });
  document.addEventListener("freecell-cheat:mode", (event) => {
    const message = {
      win: "已選擇「中止」：下一手成功移牌就會贏！",
      lose: "已選擇「重試」：下一手成功移牌就會輸！"
    }[event.detail.mode] || "已選擇「略過」：恢復正常遊戲。";
    displayStatus(message);
    if (event.detail.mode) playTone(event.detail.mode === "win" ? 880 : 200, .2);
  });
  document.addEventListener("freecell-cheat:moved", () => {
    playTone(660, .05, "triangle");
  });
  document.addEventListener("freecell-cheat:cheat-card", (event) => {
    playTone(400 + (52 - event.detail.remaining) * 9, .05, "triangle");
  });
  document.addEventListener("freecell-cheat:animating", () => {
    displayStatus("經典密技生效：撲克牌正在自動回收……");
  });
  document.addEventListener("freecell-cheat:finished", (event) => {
    const { result, cheated } = event.detail;
    displayStatus(result === "win" ? "本局獲勝！" : "本局結束。");
    if (result === "win") {
      showVictoryEffects(cheated);
      return;
    }

    triggerWindowEffect("is-cheat-loss", 800);
    [392, 330, 262, 196].forEach((frequency, index) => {
      playTone(frequency, .3, "sawtooth", index * .16);
    });
    showResultDialog(result, cheated);
  });
  document.addEventListener("freecell-cheat:invalid-move", () => {
    playTone(150, .1);
    displayStatus("只能移動符合紅黑相間、點數遞減的牌組。");
  });

  victoryPlayAgain.addEventListener("click", () => simulator.newDeal(simulator.randomDeal()));

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
  // 最底部的歷史旁白：使用軍火庫 SlowlyTypewriter 循環打字／刪字。
  // 當外部函式未載入或使用者偏好減少動態時，保留 HTML 裡的完整靜態文字。
  const vistaTypewriterTarget = document.querySelector("#cheatVistaTypewriter");
  if (vistaTypewriterTarget && !reduceIntroMotion.matches && window.SlowlyTypewriter?.create) {
    const phrase = vistaTypewriterTarget.textContent.trim();
    const vistaTypewriter = window.SlowlyTypewriter.create({
      target: vistaTypewriterTarget,
      phrases: [phrase],
      typeMin: 90,
      typeJitter: 35,
      deleteDelay: 34,
      holdDelay: 2400,
      gapDelay: 700,
      loop: true
    });

    vistaTypewriterTarget.textContent = "";
    vistaTypewriter.start();
    window.addEventListener("pagehide", () => vistaTypewriter.stop());
    window.addEventListener("pageshow", () => vistaTypewriter.start());
  }
})();
