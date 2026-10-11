/** 共用目錄狀態：只讀取本機已存在的第一節存檔，不改變遊戲進度。 */
(() => {
  'use strict';
  const key = 'eye-of-justice:01-01:progress'; // 沿用舊版，Git 上線後仍能續玩。
  let save = null;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const value = JSON.parse(raw);
      if (value && ['dream', 'office'].includes(value.phase)) save = value;
    }
  } catch (_) { /* 私密模式可能禁止讀取 localStorage；選單仍可使用。 */ }
  const status = save?.finished ? '已通關' : save ? '調查進行中' : '可遊玩';
  document.querySelectorAll('[data-section="01-01-01"]').forEach(card => {
    card.querySelectorAll('[data-stage-status]').forEach(label => { label.textContent = status; });
    if (save?.finished) card.classList.add('is-complete');
    card.querySelectorAll('[data-stage-action]').forEach(label => {
      label.textContent = save && !save.finished ? '返回調查' : save?.finished ? '再次體驗' : '進入調查';
    });
  });
})();
