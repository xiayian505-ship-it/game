/** 霧林之契｜進度持久化：存完整永久牌庫，不直接儲存每回合臨時戰鬥狀態。 */
(() => {
  "use strict";
  const KEY = "mistforest_pact_save_v1";
  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.version !== 3 || !Array.isArray(parsed.player) || !Array.isArray(parsed.boss) || !Number.isInteger(parsed.stage)) return null;
      return parsed;
    } catch (error) {
      console.warn("霧林之契：讀取存檔失敗", error);
      return null;
    }
  }
  function write(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...data, version: 3 }));
      return true;
    } catch (error) {
      console.error("霧林之契：寫入存檔失敗", error);
      return false;
    }
  }
  function remove() { try { localStorage.removeItem(KEY); return true; } catch { return false; } }
  window.LinCardSave = Object.freeze({ read, write, remove, KEY });
})();
