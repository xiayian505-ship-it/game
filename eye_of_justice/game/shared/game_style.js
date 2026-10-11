/** 遊戲視覺層：場景切換、慢慢軍火庫雨霧特效。無遊戲規則。 */
(() => {
  'use strict';
  let rainEffect = null;
  let fogEffect = null;
  const rainCanvas = '#rainCanvas';
  const fogCanvas = '#mistCanvas';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setup() {
    // 兩個效果均沿用慢慢軍火庫網站的 HTTPS 原檔；若網路不通，CSS 雨霧層仍保留。
    if (!reduced && window.SlowlyCanvasRain?.create) {
      rainEffect = window.SlowlyCanvasRain.create({
        canvas: rainCanvas, count: Math.min(160, Math.floor(innerWidth / 8)),
        color: '#c7dce9', opacity: 0.45, speed: 0.68,
        wind: 0.19, length: 0.87, maxDpr: 1.4, autoStart: true
      });
    }
    if (!reduced && window.SlowlyCanvasFog?.create) {
      fogEffect = window.SlowlyCanvasFog.create({
        canvas: fogCanvas, count: 15, color: '#b0d5c8',
        opacity: 0.47, speed: 0.28, size: 1.25,
        maxDpr: 1.4, autoStart: true
      });
    }
  }

  addEventListener('eye:scene', event => {
    document.body.dataset.chapterScene = event.detail.scene;
  });
  addEventListener('pagehide', () => {
    for (const effect of [rainEffect, fogEffect]) effect?.destroy?.();
  }, { once: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true });
  else setup();
})();
