/* 慢慢遊戲大廳｜UI 互動：向軍火庫要求特效；不在此重寫特效。 */
(()=>{
  'use strict';
  // 桌面滑鼠的卡片傾斜＋追光；行動裝置／減少動態由軍火庫處理。
  if(window.SlowlyTiltSpotlight?.attach){
    document.querySelectorAll('.game-card[data-slowly-tilt]').forEach(card=>{
      window.SlowlyTiltSpotlight.attach(card,{angle:9,lift:8,perspective:900});
    });
  }

  // 點擊粒子只是裝飾，不與跳頁、傳送門綁死。
  document.addEventListener('slowly:lobby-launch',event=>{
    const burst=window.SlowlyClickBurst?.burst;
    const container=document.querySelector('.page');
    if(typeof burst!=='function'||!container)return;
    const rect=container.getBoundingClientRect();
    const {x,y,color}=event.detail;
    burst({container,x:x-rect.left,y:y-rect.top,color,count:70});
  });
})();
