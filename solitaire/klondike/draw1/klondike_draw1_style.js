(() => {
  "use strict";

  const gameShell = document.getElementById("gameShell");
  const completedArea = document.getElementById("completedArea");
  const restartButton = document.getElementById("restartButton");

  const dealPicker = document.getElementById("dealPicker");
  const dealPickerNotice = document.getElementById("dealPickerNotice");
  const dealPickerBackButton = document.getElementById("dealPickerBackButton");
  const randomDealButton = document.getElementById("randomDealButton");
  const solvedDealButton = document.getElementById("solvedDealButton");
  const contributedPanel = document.getElementById("contributedPanel");
  const uidDealButton = document.getElementById("uidDealButton");
  const uidSearchPanel = document.getElementById("uidSearchPanel");
  const uidInput = document.getElementById("uidInput");
  const uidSearchButton = document.getElementById("uidSearchButton");

  const restartConfirm = document.getElementById("restartConfirm");
  const restartCancelButton = document.getElementById("restartCancelButton");
  const restartCurrentButton = document.getElementById("restartCurrentButton");
  const restartConfirmButton = document.getElementById("restartConfirmButton");

  const bombOverlay = document.getElementById("bombOverlay");
  const bombText = document.getElementById("bombText");
  const bombPlus = document.getElementById("bombPlus");
  const bombSubtext = document.getElementById("bombSubtext");
  const victoryParticles = document.getElementById("victoryParticles");

  const message = document.getElementById("message");
  const messageText = document.getElementById("messageText");
  const playAgainButton = document.getElementById("playAgainButton");

  const LAST_VICTORY_EFFECTS_STORAGE_KEY = "klondike_draw1_last_victory_effects_v1";
  const VICTORY_EFFECTS = Object.freeze([
    "confetti",
    "gold-rain",
    "stars",
    "shockwave",
    "flash-shake",
    "jackpot-pop",
    "card-rain",
    "victory-beam",
    "classic-fireworks"
  ]);
  const VICTORY_CARD_RAIN_ITEMS = Object.freeze([
    "♠", "♥", "♦", "♣",
    "A♠", "A♥", "A♦", "A♣",
    "K♠", "K♥", "K♦", "K♣"
  ]);

  let lastVictoryEffectSignature = "";
  let lastVictoryEffects = (() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(LAST_VICTORY_EFFECTS_STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.filter(name => VICTORY_EFFECTS.includes(name)) : [];
    } catch {
      return [];
    }
  })();

  function sleep(ms) {
    return new Promise(resolve => window.setTimeout(resolve, Math.max(0, ms)));
  }

  function prefersReducedMotion() {
    return Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function setPickerNotice(text) {
    dealPickerNotice.textContent = String(text || "");
  }

  function showDealPicker(options = {}) {
    const canReturn = options.canReturn !== false;
    restartConfirm.hidden = true;
    message.hidden = true;
    dealPickerBackButton.hidden = !canReturn;
    contributedPanel.hidden = true;
    uidSearchPanel.hidden = true;
    uidDealButton.setAttribute("aria-expanded", "false");
    uidInput.value = "";
    setPickerNotice("");
    dealPicker.hidden = false;
  }

  function hideDealPicker() {
    dealPicker.hidden = true;
    contributedPanel.hidden = true;
    uidSearchPanel.hidden = true;
    uidDealButton.setAttribute("aria-expanded", "false");
    setPickerNotice("");
  }

  function clearVictoryEffect(api, target) {
    if (!api?.clear || !target) return;
    try { api.clear(target); } catch {}
  }

  function clearVictoryParticles() {
    clearVictoryEffect(window.SlowlyConfettiBurst, victoryParticles);
    clearVictoryEffect(window.SlowlyGoldRain, victoryParticles);
    clearVictoryEffect(window.SlowlyStarExplosion, victoryParticles);
    clearVictoryEffect(window.SlowlyShockwave, victoryParticles);
    clearVictoryEffect(window.SlowlyFlashShake, victoryParticles);
    clearVictoryEffect(window.SlowlyJackpotPop, bombPlus);
    clearVictoryEffect(window.SlowlyCardRain, victoryParticles);
    clearVictoryEffect(window.SlowlyVictoryBeam, victoryParticles);
    clearVictoryEffect(window.SlowlyClassicFireworks, victoryParticles);
    if (victoryParticles) victoryParticles.innerHTML = "";
  }

  function pickVictoryEffects() {
    if (prefersReducedMotion()) return ["jackpot-pop"];

    function shuffledPool() {
      const pool = VICTORY_EFFECTS.slice();
      for (let index = pool.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
      }
      return pool;
    }

    function visualDifference(leftList, rightList) {
      const left = new Set(leftList);
      const right = new Set(rightList);
      let changed = 0;
      VICTORY_EFFECTS.forEach(name => {
        if (left.has(name) !== right.has(name)) changed += 1;
      });
      return changed;
    }

    let selected = [];
    let signature = "";

    for (let attempt = 0; attempt < 40; attempt += 1) {
      const pool = shuffledPool();
      const count = 4 + Math.floor(Math.random() * 3);
      const candidate = pool.slice(0, count);
      const candidateSignature = candidate.slice().sort().join("|");
      if (
        candidateSignature !== lastVictoryEffectSignature &&
        (lastVictoryEffects.length === 0 || visualDifference(candidate, lastVictoryEffects) >= 4)
      ) {
        selected = candidate;
        signature = candidateSignature;
        break;
      }
    }

    if (!selected.length) {
      selected = shuffledPool().slice(0, 4);
      signature = selected.slice().sort().join("|");
    }

    lastVictoryEffectSignature = signature;
    lastVictoryEffects = selected.slice();
    try { localStorage.setItem(LAST_VICTORY_EFFECTS_STORAGE_KEY, JSON.stringify(lastVictoryEffects)); } catch {}
    return selected;
  }

  function playVictoryEffect(api, target, options) {
    if (!api?.play || !target) return;
    void api.play(target, options).catch(error => {
      console.warn("[Klondike Draw 1] 勝利特效播放失敗：", error);
    });
  }

  function activateVictoryEffects(selectedEffects) {
    clearVictoryParticles();
    if (selectedEffects.includes("confetti")) playVictoryEffect(window.SlowlyConfettiBurst, victoryParticles);
    if (selectedEffects.includes("gold-rain")) playVictoryEffect(window.SlowlyGoldRain, victoryParticles);
    if (selectedEffects.includes("stars")) playVictoryEffect(window.SlowlyStarExplosion, victoryParticles);
    if (selectedEffects.includes("shockwave")) playVictoryEffect(window.SlowlyShockwave, victoryParticles);
    if (selectedEffects.includes("flash-shake")) playVictoryEffect(window.SlowlyFlashShake, victoryParticles, { shakeTarget: gameShell });
    if (selectedEffects.includes("jackpot-pop")) playVictoryEffect(window.SlowlyJackpotPop, bombPlus);
    if (selectedEffects.includes("card-rain")) playVictoryEffect(window.SlowlyCardRain, victoryParticles, { items: VICTORY_CARD_RAIN_ITEMS });
    if (selectedEffects.includes("victory-beam")) playVictoryEffect(window.SlowlyVictoryBeam, victoryParticles);
    if (selectedEffects.includes("classic-fireworks")) playVictoryEffect(window.SlowlyClassicFireworks, victoryParticles);
  }

  function flashCompletedArea() {
    completedArea.classList.remove("victory-flash");
    void completedArea.offsetWidth;
    completedArea.classList.add("victory-flash");
  }

  async function playVictory() {
    const reduced = prefersReducedMotion();
    const selectedEffects = pickVictoryEffects();

    bombText.textContent = "牌局完成";
    bombPlus.textContent = "CLEAR";
    bombSubtext.textContent = "翻 1 張牌局完成";
    bombText.classList.remove("slowly-shine-text");
    void bombText.offsetWidth;
    bombText.classList.add("slowly-shine-text");

    flashCompletedArea();
    activateVictoryEffects(selectedEffects);
    bombOverlay.setAttribute("aria-hidden", "false");
    bombOverlay.classList.add("is-active");

    await sleep(reduced ? 220 : 1780);
    bombOverlay.classList.remove("is-active");
    await sleep(reduced ? 60 : 380);
    bombOverlay.setAttribute("aria-hidden", "true");
    completedArea.classList.remove("victory-flash");
    clearVictoryParticles();
  }

  function showWinMessage(steps) {
    messageText.textContent = `完成！共用了 ${steps} 步。`;
    message.hidden = false;
  }

  restartButton.addEventListener("click", () => {
    if (window.KlondikeDraw1Game?.isBusy()) return;
    restartConfirm.hidden = false;
  });

  restartCancelButton.addEventListener("click", () => {
    restartConfirm.hidden = true;
  });

  restartCurrentButton.addEventListener("click", () => {
    if (window.KlondikeDraw1Game?.restartCurrentDeal()) restartConfirm.hidden = true;
  });

  restartConfirmButton.addEventListener("click", () => {
    restartConfirm.hidden = true;
    showDealPicker({ canReturn: true });
  });

  randomDealButton.addEventListener("click", () => {
    if (window.KlondikeDraw1Game?.isBusy()) return;
    try {
      window.KlondikeDraw1Game?.startRandomGame();
      hideDealPicker();
    } catch (error) {
      console.error(error);
      setPickerNotice(error?.message || "無法開始牌局。");
    }
  });

  solvedDealButton.addEventListener("click", () => {
    contributedPanel.hidden = false;
    setPickerNotice("前端預覽版尚未接 DB。");
  });

  uidDealButton.addEventListener("click", () => {
    const willOpen = uidSearchPanel.hidden;
    uidSearchPanel.hidden = !willOpen;
    uidDealButton.setAttribute("aria-expanded", String(willOpen));
    if (willOpen) uidInput.focus();
  });

  uidSearchButton.addEventListener("click", () => {
    setPickerNotice("前端預覽版尚未接 DB。");
  });

  uidInput.addEventListener("keydown", event => {
    if (event.key === "Enter") setPickerNotice("前端預覽版尚未接 DB。");
  });

  dealPickerBackButton.addEventListener("click", hideDealPicker);

  playAgainButton.addEventListener("click", () => {
    message.hidden = true;
    showDealPicker({ canReturn: false });
  });

  window.KlondikeDraw1UI = Object.freeze({
    playVictory,
    showWinMessage,
    showDealPicker
  });

  if (!window.KlondikeDraw1Game?.hasGame()) {
    showDealPicker({ canReturn: false });
  }
})();
