(() => {
  "use strict";

  const gameShell = document.getElementById("gameShell");
  const completedArea = document.getElementById("completedArea");
  const bombOverlay = document.getElementById("bombOverlay");
  const bombText = document.getElementById("bombText");
  const bombPlus = document.getElementById("bombPlus");
  const bombSubtext = document.getElementById("bombSubtext");
  const victoryParticles = document.getElementById("victoryParticles");
  const message = document.getElementById("message");
  const messageTitle = document.getElementById("messageTitle");
  const messageText = document.getElementById("messageText");
  const messageBest = document.getElementById("messageBest");
  const messageClears = document.getElementById("messageClears");
  const messageUidRow = document.getElementById("messageUidRow");
  const messageUid = document.getElementById("messageUid");
  const messageCopyUidButton = document.getElementById("messageCopyUidButton");

  const LAST_VICTORY_EFFECTS_STORAGE_KEY = "freecell_microsoft_last_victory_effects_v1";
  const VICTORY_EFFECTS = Object.freeze([
    "confetti", "gold-rain", "stars", "shockwave", "flash-shake",
    "jackpot-pop", "card-rain", "victory-beam", "classic-fireworks"
  ]);
  const VICTORY_CARD_RAIN_ITEMS = Object.freeze([
    "♠", "♥", "♦", "♣", "A♠", "A♥", "A♦", "A♣", "K♠", "K♥", "K♦", "K♣"
  ]);

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
    return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  }

  function clearEffect(api, target) {
    try { api?.clear?.(target); } catch {}
  }

  function clearVictoryParticles() {
    clearEffect(window.SlowlyConfettiBurst, victoryParticles);
    clearEffect(window.SlowlyGoldRain, victoryParticles);
    clearEffect(window.SlowlyStarExplosion, victoryParticles);
    clearEffect(window.SlowlyShockwave, victoryParticles);
    clearEffect(window.SlowlyFlashShake, victoryParticles);
    clearEffect(window.SlowlyJackpotPop, bombPlus);
    clearEffect(window.SlowlyCardRain, victoryParticles);
    clearEffect(window.SlowlyVictoryBeam, victoryParticles);
    clearEffect(window.SlowlyClassicFireworks, victoryParticles);
    if (victoryParticles) victoryParticles.innerHTML = "";
  }

  function pickVictoryEffects() {
    if (prefersReducedMotion()) return ["jackpot-pop"];
    const pool = VICTORY_EFFECTS.slice();
    for (let index = pool.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
    }
    let selected = pool.slice(0, 4 + Math.floor(Math.random() * 3));
    if (lastVictoryEffects.length && selected.every(name => lastVictoryEffects.includes(name))) {
      selected = pool.slice(-5);
    }
    lastVictoryEffects = selected.slice();
    try { localStorage.setItem(LAST_VICTORY_EFFECTS_STORAGE_KEY, JSON.stringify(selected)); } catch {}
    return selected;
  }

  function playEffect(api, target, options) {
    if (!api?.play || !target) return;
    void api.play(target, options).catch(() => {});
  }

  function activateVictoryEffects(selected) {
    clearVictoryParticles();
    if (selected.includes("confetti")) playEffect(window.SlowlyConfettiBurst, victoryParticles);
    if (selected.includes("gold-rain")) playEffect(window.SlowlyGoldRain, victoryParticles);
    if (selected.includes("stars")) playEffect(window.SlowlyStarExplosion, victoryParticles);
    if (selected.includes("shockwave")) playEffect(window.SlowlyShockwave, victoryParticles);
    if (selected.includes("flash-shake")) playEffect(window.SlowlyFlashShake, victoryParticles, { shakeTarget: gameShell });
    if (selected.includes("jackpot-pop")) playEffect(window.SlowlyJackpotPop, bombPlus);
    if (selected.includes("card-rain")) playEffect(window.SlowlyCardRain, victoryParticles, { items: VICTORY_CARD_RAIN_ITEMS });
    if (selected.includes("victory-beam")) playEffect(window.SlowlyVictoryBeam, victoryParticles);
    if (selected.includes("classic-fireworks")) playEffect(window.SlowlyClassicFireworks, victoryParticles);
  }

  async function playVictory(result = {}) {
    const reduced = prefersReducedMotion();
    bombText.textContent = "牌局完成";
    bombPlus.textContent = "CLEAR";
    bombSubtext.textContent = result?.isNew ? "本機已解牌局 +1" : "本機牌局再次完成";
    bombText.classList.remove("slowly-shine-text");
    void bombText.offsetWidth;
    bombText.classList.add("slowly-shine-text");
    completedArea?.classList.remove("victory-flash");
    void completedArea?.offsetWidth;
    completedArea?.classList.add("victory-flash");
    activateVictoryEffects(pickVictoryEffects());
    bombOverlay?.setAttribute("aria-hidden", "false");
    bombOverlay?.classList.add("is-active");
    await sleep(reduced ? 220 : 1780);
    bombOverlay?.classList.remove("is-active");
    await sleep(reduced ? 60 : 380);
    bombOverlay?.setAttribute("aria-hidden", "true");
    completedArea?.classList.remove("victory-flash");
    clearVictoryParticles();
  }

  function showWinMessage(steps, result = {}) {
    messageTitle.textContent = result?.isNew ? "本機已解牌局 +1" : "牌局完成";
    messageText.textContent = `完成！共用了 ${steps} 步。`;
    const best = Number(result?.bestSteps);
    messageBest.hidden = !(best > 0);
    messageBest.textContent = best > 0 ? `本局 ${steps} 步｜最佳紀錄 ${best} 步` : "";
    const clears = Math.max(0, Number(result?.clearCount) || 0);
    messageClears.hidden = !(clears > 0);
    messageClears.textContent = clears > 0 ? `這個編號已成功破關 ${clears} 次` : "";
    const uid = String(result?.uid || "");
    messageUidRow.hidden = !uid;
    messageUid.textContent = uid ? (window.FreeCellData?.shortUid?.(uid) || uid) : "";
    messageCopyUidButton.dataset.uid = uid;
    message.hidden = false;
  }

  messageCopyUidButton?.addEventListener("click", () => {
    void window.FreeCellCopyFeedback?.copy?.(messageCopyUidButton.dataset.uid);
  });

  window.FreeCellUI = Object.freeze({ playVictory, showWinMessage });
})();
