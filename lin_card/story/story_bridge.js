/** 故事 ↔ 主遊戲跳轉橋接：只判斷是否進故事，不修改任何戰鬥／通關結果。 */
(() => {
  "use strict";
  const SAVE_KEY = "mistforest_pact_story_progress_v3";
  const enabled = () => window.MistStoryConfig?.autoStory === true;
  function seen(section) {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY) || "null")?.seenSections?.includes(section) === true; }
    catch { return false; }
  }
  function enter(section) {
    const target = `./story/index.html?entry=${encodeURIComponent(section)}&return=game`;
    if (window.SlowlyNavigation?.go) window.SlowlyNavigation.go(target);
    else window.location.assign(target); // 網頁跳轉可在離線下安全退回標準導航；不複製軍火庫實作。
    return true;
  }
  function beforeBattle(save) {
    return enabled() && save.completed === 0 && !seen("prologue") ? enter("prologue") : false;
  }
  function afterReward(save) {
    const section = `chapter_${String(save.completed).padStart(2, "0")}`;
    return enabled() && save.completed >= 1 && save.completed <= 10 && !seen(section) ? enter(section) : false;
  }
  function reset() {
    try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem("mistforest_pact_story_progress_v2"); return true; }
    catch (err) { console.warn("故事進度清除失敗", err); return false; }
  }
  window.MistStoryBridge = Object.freeze({ beforeBattle, afterReward, reset, SAVE_KEY });
})();
