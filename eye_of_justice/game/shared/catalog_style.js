/** 目錄雨霧氛圍：軍火庫公開資源以 HTTPS 絕對 URL 引用。 */
(() => {
  'use strict';
  const effects = [];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function setup() {
    if (reduced) return;
    if (window.SlowlyCanvasFog?.create) {
      effects.push(window.SlowlyCanvasFog.create({
        canvas:'#catalogFog',count:12,color:'#c1dace',opacity:0.34,
        speed:0.25,size:1.1,maxDpr:1.5,autoStart:true
      }));
    }
    if (window.SlowlyCanvasRain?.create) {
      effects.push(window.SlowlyCanvasRain.create({
        canvas:'#catalogRain',count:Math.min(135,Math.floor(innerWidth/9)),
        color:'#bcd8d9',opacity:0.31,speed:0.66,wind:0.14,
        length:0.75,maxDpr:1.5,autoStart:true
      }));
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',setup,{once:true});
  else setup();
  addEventListener('pagehide',()=>effects.forEach(effect=>effect?.destroy?.()),{once:true});
})();
