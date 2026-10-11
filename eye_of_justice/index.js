/** 官網功能：只提示本機進度。實際遊戲狀態由 game/game.js 管理。 */
(() => {
  'use strict';
  try {
    const saved = JSON.parse(localStorage.getItem('eye-of-justice:01-01:progress') || 'null');
    const status = document.querySelector('.hero-meta');
    if (saved && status) {
      status.textContent = saved.finished
        ? '第一節已完成 · 可重新體驗'
        : '偵測到本機調查紀錄 · 進入遊戲可選擇繼續';
    }
  } catch (_) { /* 本機儲存非必要。 */ }
})();
