/**
 * 霧林之契｜手機震動回饋（獨立 UI 零件）
 * 原生 Vibration API；非軍火庫功能。無支援時自動停用，不干擾戰鬥。
 * 音效與震動分開儲存、分別切換。
 */
(() => {
  "use strict";

  const SAVE_KEY = "mistforest_pact_battle_vibration_v1";
  const supported = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  let enabled = true;
  try { enabled = localStorage.getItem(SAVE_KEY) !== "off"; }
  catch (_) { /* 無權限儲存時僅影響當次 */ }

  const patterns = Object.freeze({
    attack: 40,
    shatter: [45, 55, 75],
    defense: 18,
    shield: 22,
    heal: 18,
    magic: 45,
    sacrifice: [75, 65, 95],
    victory: [45, 65, 55, 75, 90]
  });

  function vibrate(pattern) {
    if (!supported || !enabled || document.hidden) return false;
    try { return navigator.vibrate(pattern) === true; }
    catch (_) { return false; }
  }

  function play(kind) {
    return vibrate(patterns[kind] ?? 24);
  }

  function setEnabled(next) {
    enabled = Boolean(next);
    try { localStorage.setItem(SAVE_KEY, enabled ? "on" : "off"); }
    catch (_) { /* 略過，仍可暫時使用 */ }
    if (supported) {
      try { navigator.vibrate(enabled ? 28 : 0); } catch (_) { /* 不影響設定 */ }
    }
    return enabled;
  }

  window.MistBattleHaptics = Object.freeze({
    supported,
    get enabled() { return enabled; },
    setEnabled,
    play
  });
})();
