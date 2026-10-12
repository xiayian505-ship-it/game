/**
 * 霧林之契｜戰鬥聲光觸發器（宿主設定）
 * 閃光、晃動、震波與音訊原子零件由慢慢軍火庫 HTTPS 取得。
 * 此檔只決定何時、在哪裡，以及用什麼音色播放；不修改戰鬥數值。
 */
(() => {
  "use strict";

  const SAVE_KEY = "mistforest_pact_battle_sound_v1";
  let soundEnabled = true;
  try { soundEnabled = localStorage.getItem(SAVE_KEY) !== "off"; } catch (_) { /* 無儲存權限時僅使用本次設定 */ }
  const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;

  async function unlock() {
    if (!soundEnabled || !window.SlowlyAudioContext?.isSupported?.()) return null;
    try { return await window.SlowlyAudioContext.resume(); }
    catch (error) { console.warn("戰鬥音訊暫時無法啟動：", error); return null; }
  }

  function note(ctx, frequency, duration, wave = "sine", volume = 0.07, toFrequency = frequency, delay = 0) {
    if (!ctx || !soundEnabled) return;
    const t = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, t);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, toFrequency), t + duration);
    gain.gain.setValueAtTime(Math.max(0.0001, volume), t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(t);
    oscillator.stop(t + duration + 0.01);
  }

  function noise(ctx, duration, volume = 0.08, frequency = 600, filterType = "lowpass") {
    if (!ctx || !soundEnabled || !window.SlowlyAudioNoise) return;
    const source = window.SlowlyAudioNoise.create(ctx, { type: "brown", duration, loop: false });
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(Math.max(0.0001, volume), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(now);
    source.stop(now + duration);
  }

  function sfx(kind) {
    if (!soundEnabled) return;
    const ctx = window.SlowlyAudioContext?.get?.();
    if (!ctx || ctx.state !== "running") return;
    try {
      switch (kind) {
        case "attack":
          noise(ctx, 0.27, 0.13, 430);
          note(ctx, 145, 0.32, "triangle", 0.09, 64);
          break;
        case "shatter":
          noise(ctx, 0.34, 0.095, 1600, "highpass");
          [1280, 960, 640].forEach((frequency, i) => note(ctx, frequency, 0.24, "triangle", 0.045, frequency * 0.66, i * 0.045));
          break;
        case "heal":
          window.SlowlyHarmonicChime?.play?.(ctx, {
            frequencies: [392, 587, 784], gains: [0.052, 0.030, 0.018], stagger: 0.075, decay: 0.55
          });
          break;
        case "shield":
        case "defense":
          note(ctx, 310, 0.35, "sine", 0.055, 540);
          note(ctx, 520, 0.29, "sine", 0.033, 720, 0.045);
          break;
        case "magic":
          note(ctx, 195, 0.55, "sine", 0.075, 590);
          note(ctx, 380, 0.52, "triangle", 0.034, 740, 0.06);
          break;
        case "sacrifice":
          noise(ctx, 0.63, 0.16, 170);
          note(ctx, 78, 0.65, "sawtooth", 0.12, 41);
          break;
        case "victory":
          window.SlowlyHarmonicChime?.play?.(ctx, {
            frequencies: [392, 523, 659, 784], gains: [0.07, 0.05, 0.04, 0.028], stagger: 0.1, decay: 1
          });
          break;
        default:
          note(ctx, 470, 0.17, "sine", 0.045, 600);
      }
    } catch (error) { console.warn("霧林之契音效播放失敗：", error); }
  }

  function typeOf(card) {
    if (card.name === "同命之契") return "sacrifice";
    if (card.name === "裂盾") return "shatter";
    if (card.type === "attack") return "attack";
    if (card.type === "shield") return "shield";
    if (card.type === "defense") return "defense";
    if (card.type === "heal") return "heal";
    if (card.type === "magic") return "magic";
    if (card.type === "special") return "magic";
    return "magic";
  }

  function targetSelector(card, owner) {
    const hostile = card.type === "attack" ||
      ["裂盾", "斷枝奪葉", "借影易形", "移花接木", "行動封印", "同命之契"].includes(card.name);
    return owner === "boss"
      ? (hostile ? ".lc-battle-player" : ".lc-battle-boss")
      : (hostile ? ".lc-battle-boss" : ".lc-battle-player");
  }

  /** 有新牌命中時呼叫；不會讀寫 HP、行動點、牌堆。 */
  async function play(card, owner = "player") {
    if (!card) return;
    const kind = typeOf(card);
    sfx(kind);
    window.MistBattleHaptics?.play(kind);
    const board = document.querySelector(".lc-battle-board");
    const target = document.querySelector(targetSelector(card, owner));
    if (!board || !target || reducedMotion()) return;

    const targetRect = target.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();
    const centerX = targetRect.left + targetRect.width / 2;
    const centerY = targetRect.top + targetRect.height / 2;
    const x = ((centerX - boardRect.left) / Math.max(1, boardRect.width)) * 100;
    const y = ((centerY - boardRect.top) / Math.max(1, boardRect.height)) * 100;
    const options = { originX: x, originY: y, endScale: 3.6,
      count: kind === "sacrifice" ? 3 : 1, interval: 90, duration: 470, size: 85,
      color: kind === "sacrifice" ? "rgba(213,171,136,.66)" : "rgba(157,227,194,.72)",
      glow: "rgba(103,199,156,.28)", innerGlow: "rgba(169,234,202,.16)", zIndex: 2 };
    const jobs = [];
    if (["shield", "defense", "heal", "magic", "sacrifice", "shatter"].includes(kind)) {
      if (window.SlowlyShockwave?.play) jobs.push(window.SlowlyShockwave.play(board, options));
    }
    if (["attack", "shatter", "sacrifice"].includes(kind) && window.SlowlyFlashShake?.play) {
      const strong = kind === "sacrifice";
      jobs.push(window.SlowlyFlashShake.play(board, {
        shakeTarget: board, flashDuration: strong ? 390 : 235, shakeDuration: strong ? 360 : 245,
        flashCore: "rgba(211,245,228,.65)", flashMid: "rgba(112,210,166,.37)",
        flashEdge: "rgba(15,43,38,0)", flashPeak: strong ? .35 : .23,
        flashMidOpacity: .16, shakeX: strong ? 5 : 2.3,
        shakeY: strong ? 3 : 1.3, shakeRotation: strong ? .15 : .065, zIndex: 4
      }));
    }
    if (kind === "attack") {
      const slash = document.createElement("span");
      slash.className = "lc-impact-slash";
      slash.style.left = `${x}%`;
      slash.style.top = `${y}%`;
      board.append(slash);
      jobs.push(new Promise(resolve => setTimeout(() => { slash.remove(); resolve(); }, 330)));
    }
    try { await Promise.allSettled(jobs); }
    catch (error) { console.warn("霧林之契聲光演出未完成：", error); }
  }

  function setEnabled(value) {
    soundEnabled = Boolean(value);
    try { localStorage.setItem(SAVE_KEY, soundEnabled ? "on" : "off"); } catch (_) { /* 略過 */ }
    if (soundEnabled) void unlock();
    return soundEnabled;
  }

  window.MistBattleFX = Object.freeze({
    get enabled() { return soundEnabled; },
    setEnabled, unlock, play, sfx
  });
})();
