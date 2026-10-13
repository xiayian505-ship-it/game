/* 慢慢遊戲大廳｜UI：舞台換景與主題色。未來五種特效只需在此依 slot 接入軍火庫。 */
(()=>{
  'use strict';
  const stage=document.getElementById('spotlight');
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');

  document.addEventListener('slowly:lobby-spotlight',event=>{
    const {game,slot}=event.detail;
    stage.style.setProperty('--stage-accent',game.accent);
    stage.setAttribute('data-effect-slot',String(slot));
    // 基礎版只做輕量淡入；五套特殊舞台特效在定案後加入，不和遊戲 ID 綁定。
    stage.classList.remove('spotlight--arriving');
    if(!reduce.matches){
      void stage.offsetWidth;
      stage.classList.add('spotlight--arriving');
    }
  });
})();
