/* =====================================================================
   feedback_effects.js
   把「音效 + 特效」包成有意義的遊戲事件，例如 playEnemyHitEffect()。
   實際的光影、爆炸、煙火、音色，全部呼叫 lib.stillnessbyslowly.com 的函式庫。
   ===================================================================== */
(function (global) {
  "use strict";

  let effectStageElement = null;
  let toastInstance = null;
  let isSoundEnabled = true;

  const CHIME_PRESETS = Object.freeze({
    click:   { frequencies: [660, 990],        gains: [0.10, 0.04], stagger: 0,    decay: 0.5 },
    clue:    { frequencies: [523, 784, 1046],  gains: [0.14, 0.08, 0.04], stagger: 0.08, decay: 1.6 },
    hit:     { frequencies: [196, 294],        gains: [0.22, 0.10], stagger: 0,    decay: 0.7 },
    ward:    { frequencies: [392, 588, 784],   gains: [0.12, 0.06, 0.03], stagger: 0.05, decay: 1.2 },
    heal:    { frequencies: [440, 660, 880],   gains: [0.12, 0.07, 0.03], stagger: 0.07, decay: 1.8 },
    danger:  { frequencies: [147, 110],        gains: [0.26, 0.14], stagger: 0.06, decay: 1.4 },
    victory: { frequencies: [523, 659, 784, 1046], gains: [0.16, 0.12, 0.08, 0.05], stagger: 0.12, decay: 3.2 }
  });

  function initialize(options) {
    effectStageElement = options.effectStageElement;
    toastInstance = global.SlowlyToast.create(options.toastElement, { duration: 2200 });
    toastInstance.element.classList.add("slowly-toast");
  }

  async function playSound(presetName) {
    if (!isSoundEnabled || !CHIME_PRESETS[presetName]) return;
    try {
      const audioContext = await global.SlowlyAudioContext.resume();
      global.SlowlyHarmonicChime.play(audioContext, CHIME_PRESETS[presetName]);
    } catch (audioError) {
      /* 瀏覽器不支援音訊時，遊戲照常進行 */
    }
  }

  function toggleSound() {
    isSoundEnabled = !isSoundEnabled;
    return isSoundEnabled;
  }

  function showToast(message) {
    if (toastInstance) toastInstance.show(message);
  }

  /* ---------- 點擊光爆（全畫面通用） ---------- */
  function attachClickBurst() {
    document.addEventListener("click", (clickEvent) => {
      const stageBox = effectStageElement.getBoundingClientRect();
      global.SlowlyClickBurst.burst({
        container: effectStageElement,
        x: clickEvent.clientX - stageBox.left,
        y: clickEvent.clientY - stageBox.top,
        color: "#ffd98a"
      });
    });
  }

  /* ---------- 畫面轉場：傳送門擴散後切換，再還原 ---------- */
  async function playScreenTransition(switchScreenCallback, originEvent) {
    const originX = originEvent && originEvent.clientX ? originEvent.clientX : global.innerWidth / 2;
    const originY = originEvent && originEvent.clientY ? originEvent.clientY : global.innerHeight / 2;
    await global.SlowlyPortalWipe.play({ x: originX, y: originY, color: "#120b1f", hold: true });
    switchScreenCallback();
    global.SlowlyPortalWipe.reset();
  }

  /* ---------- 遊戲事件特效 ---------- */
  function playClueFoundEffect() {
    playSound("clue");
    global.SlowlyStarExplosion.play(effectStageElement, { count: 22, color: "#ffe9a8", distanceMax: 300 });
  }

  function playEnemyHitEffect(originXPercent, originYPercent) {
    playSound("hit");
    global.SlowlyFlashShake.play(effectStageElement, { shakeX: 6, shakeY: 3 });
    global.SlowlyStarExplosion.play(effectStageElement, {
      count: 12, glyphs: ["✦", "✧"], color: "#ffb0b0", originX: originXPercent, originY: originYPercent, distanceMax: 200
    });
  }

  function playThunderEffect(originXPercent, originYPercent) {
    playSound("hit");
    global.SlowlyFlashShake.play(effectStageElement, { flashCore: "rgba(210,245,255,.98)", flashMid: "rgba(132,210,255,.72)", shakeX: 10, shakeY: 5 });
    global.SlowlyShockwave.play(effectStageElement, {
      count: 3, color: "rgba(159,224,255,.95)", glow: "rgba(110,207,255,.65)", originX: originXPercent, originY: originYPercent
    });
  }

  function playWardEffect() {
    playSound("ward");
    global.SlowlyShockwave.play(effectStageElement, { count: 2, color: "rgba(150,255,200,.9)", glow: "rgba(90,220,160,.5)", originX: 50, originY: 80 });
  }

  function playHealEffect() {
    playSound("heal");
    global.SlowlyStarExplosion.play(effectStageElement, { count: 18, glyphs: ["✚", "✦"], color: "#9dffb8", originX: 50, originY: 82, distanceMax: 240 });
  }

  function playPlayerHurtEffect() {
    playSound("danger");
    global.SlowlyFlashShake.play(effectStageElement, { flashCore: "rgba(255,120,120,.9)", flashMid: "rgba(200,40,40,.6)", shakeX: 12, shakeY: 6 });
  }

  function playWrongAnswerEffect() {
    playSound("danger");
    global.SlowlyShockwave.play(effectStageElement, { count: 3, color: "rgba(255,90,90,.95)", glow: "rgba(200,30,30,.5)" });
    global.SlowlyFlashShake.play(effectStageElement, { shakeX: 10, shakeY: 4 });
  }

  function playVictoryEffect() {
    playSound("victory");
    global.SlowlyConfettiBurst.play(effectStageElement, { count: 70 });
    global.SlowlyClassicFireworks.play(effectStageElement, { bursts: 5, particlesPerBurst: 40 });
    global.SlowlyVictoryBeam.play(effectStageElement);
  }

  function playTitlePopEffect(targetElement) {
    global.SlowlyJackpotPop.play(targetElement);
  }

  global.FogInnFeedback = Object.freeze({
    initialize, toggleSound, showToast, playSound, attachClickBurst, playScreenTransition,
    playClueFoundEffect, playEnemyHitEffect, playThunderEffect, playWardEffect, playHealEffect,
    playPlayerHurtEffect, playWrongAnswerEffect, playVictoryEffect, playTitlePopEffect
  });
})(window);
