/** 官網視覺效果：慢慢軍火庫 Auto Reveal、Rain、Fog。 */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const effects = [];

  if (!reduced && window.SlowlyCanvasFog?.create) {
    effects.push(window.SlowlyCanvasFog.create({
      canvas: '#homeFog', count: 12, color: '#cde1c5',
      opacity: 0.42, speed: 0.3, size: 1.1, maxDpr: 1.5, autoStart: true
    }));
  }
  if (!reduced && window.SlowlyCanvasRain?.create) {
    effects.push(window.SlowlyCanvasRain.create({
      canvas: '#homeRain', count: Math.min(145, Math.floor(innerWidth / 9)),
      color: '#c8e1d8', opacity: 0.36, speed: 0.72,
      wind: 0.1, length: 0.7, maxDpr: 1.5, autoStart: true
    }));
  }
  if (!reduced && window.SlowlyReveal?.create) {
    document.querySelectorAll('[data-reveal]').forEach(node => node.classList.add('slowly-fade-up'));
    effects.push(window.SlowlyReveal.create({
      selector: '[data-reveal]', className: 'is-visible',
      threshold: 0.05, rootMargin: '0px 0px 30px 0px', once: true
    }));
  }
  addEventListener('pagehide', () => {
    effects.forEach(effect => effect?.destroy?.());
  }, { once: true });
})();
