/** lin_card｜進度持久化：存完整永久牌庫，不直接儲存每回合臨時戰鬥狀態。 */
(() => {
  "use strict";
  const KEY = "lin_card_save_v1";
  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.version !== 1 || !Array.isArray(parsed.player) || !Array.isArray(parsed.boss) || !Number.isInteger(parsed.stage)) return null;
      return parsed;
    } catch (error) {
      console.warn("lin_card：讀取存檔失敗", error);
      return null;
    }
  }
  function write(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...data, version: 1 }));
      return true;
    } catch (error) {
      console.error("lin_card：寫入存檔失敗", error);
      return false;
    }
  }
  function remove() { try { localStorage.removeItem(KEY); return true; } catch { return false; } }
  window.LinCardSave = Object.freeze({ read, write, remove, KEY });
})();
