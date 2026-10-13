/**
 * 鹿雨森 / 霧核鍊成 — 純視覺層。
 * 雨、霧、樹：全部透過軍火庫 HTTPS 引用。
 * 戰鬥數值和合成物理不在這裡計算；不播放聲音。
 */
(() => {
  'use strict';
  const lowMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const instances = [];
  try {
    if (window.SlowlyPineForest?.create) instances.push(window.SlowlyPineForest.create({
      canvas:'#forest', seed:31, maxDpr:1.4, density:.82,
      layers:[
        {baseline:.75,minHeight:.18,maxHeight:.34,color:'#193a35',width:.4},
        {baseline:.94,minHeight:.32,maxHeight:.51,color:'#071b1e',width:.4}
      ]
    }));
    if (window.SlowlyCanvasFog?.create) instances.push(window.SlowlyCanvasFog.create({
      canvas:'#fog',count:lowMotion?8:18,color:'#b3d2c9',opacity:.48,size:1.15,
      speed:lowMotion?0:.44,maxDpr:1.4,autoStart:!lowMotion
    }));
    if (window.SlowlyCanvasRain?.create) instances.push(window.SlowlyCanvasRain.create({
      canvas:'#weather',count:lowMotion?17:Math.min(145,Math.max(55,Math.floor(innerWidth/9))),
      color:'#c7e4e0',opacity:.52,speed:.72,wind:.17,length:.6,maxDpr:1.4,autoStart:!lowMotion
    }));
  } catch(error) { console.warn('[Silvarain Suika] 部分背景特效無法啟動',error); }

  const figure = document.querySelector('#bossFigure');
  const float = document.querySelector('#bossFloat');
  const shell = document.querySelector('#canvasShell');
  const arena = document.querySelector('#arena');
  let timeout = null;
  let floatTimeout = null;
  function effect(klass,ms){
    if (!figure) return;
    figure.classList.remove('is-eating','is-hurt','is-guard');
    figure.classList.add(klass);
    clearTimeout(timeout);
    timeout = setTimeout(() => figure.classList.remove(klass),lowMotion?100:ms);
  }
  function announce(message){
    if (!float) return;
    float.textContent = message;
    float.classList.remove('is-visible');
    clearTimeout(floatTimeout);
    if (lowMotion) {float.style.opacity='1';floatTimeout=setTimeout(()=>{float.style.opacity='';},500);return;}
    void float.offsetWidth;
    float.classList.add('is-visible');
    floatTimeout=setTimeout(()=>float.classList.remove('is-visible'),1150);
  }
  window.SilvaSuikaVisuals = Object.freeze({
    bossHurt(amount){effect('is-hurt',480);announce(`−${amount}`);},
    bossEat(){effect('is-eating',850);shell?.classList.add('is-swallowing');setTimeout(()=>shell?.classList.remove('is-swallowing'),850);},
    bossRecover(kind,amount){effect('is-guard',800);announce(`${kind==='heal'?'+HP':'+霧盾'} ${amount}`);},
    result(won){arena?.classList.toggle('is-victory',won);},
    reset(){arena?.classList.remove('is-victory');shell?.classList.remove('is-swallowing');figure?.classList.remove('is-eating','is-hurt','is-guard');}
  });
})();
