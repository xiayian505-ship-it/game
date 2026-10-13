/** 鹿雨森 Rhythm：純視覺森林雨霧，引用共用軍火庫原件；不干預節奏判定。 */
(() => {
 'use strict';
 const lowMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 try {
   window.SlowlyPineForest?.create?.({canvas:'#forest',seed:43,maxDpr:1.4,density:.8,
     layers:[{baseline:.74,minHeight:.18,maxHeight:.34,color:'#193b37',width:.38},{baseline:.95,minHeight:.30,maxHeight:.54,color:'#071b20',width:.43}]});
   window.SlowlyCanvasFog?.create?.({canvas:'#fog',count:lowMotion?7:18,color:'#b3d8cf',opacity:.43,size:1.15,speed:lowMotion?0:.38,maxDpr:1.4,autoStart:!lowMotion});
   window.SlowlyCanvasRain?.create?.({canvas:'#weather',count:lowMotion?15:Math.min(145,Math.max(55,Math.floor(innerWidth/9))),color:'#c6e3dc',opacity:.49,speed:.74,wind:.12,length:.6,maxDpr:1.4,autoStart:!lowMotion});
 } catch(error) { console.warn('[鹿雨森 Rhythm] 背景效果載入異常',error); }
})();
