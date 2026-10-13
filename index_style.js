/* 慢慢遊戲大廳｜五套可交叉搭配的軍火庫舞台效果。
   遊戲資料仍只放 games.json；這裡只負責舞台視覺與短暫演出。 */
(()=>{
  'use strict';
  const stage=document.getElementById('spotlight');
  const icon=document.getElementById('stage-icon');
  const title=document.getElementById('stage-name');
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const libraryClasses=['sbs-breathe','slowly-shine-text','slowly-text-gradient-flow','sbs-atom'];

  document.addEventListener('slowly:lobby-spotlight',event=>{
    const {game,slot,source}=event.detail;
    stage.style.setProperty('--stage-accent',game.accent);
    stage.dataset.effectSlot=String(slot);
    icon.classList.remove(...libraryClasses);
    title.classList.remove(...libraryClasses);
    // 避免上次舞台留下的效果混進下一輪。
    window.SlowlyStarExplosion?.clear?.(stage);
    switch(slot){
      case 1: icon.classList.add('sbs-breathe');break;
      case 2: icon.classList.add('slowly-shine-text');break;
      case 3: break; // 第三展位僅用 Grid Overlay ＋ Star Explosion。
      case 4: icon.classList.add('sbs-atom');break;
      case 5:
        icon.classList.add('slowly-text-gradient-flow');
        title.classList.add('slowly-shine-text');
        break;
    }
    stage.classList.remove('spotlight--arriving');
    if(reduce.matches)return;
    void stage.offsetWidth;
    stage.classList.add('spotlight--arriving');
    // 第三展位：一次性星光爆發。切換進場才觸發，不會循環轟炸畫面。
    if(slot===3 && typeof window.SlowlyStarExplosion?.play==='function'){
      const reach=Math.min(stage.clientWidth*.52,260);
      window.SlowlyStarExplosion.play(stage,{
        count:20,glyphs:['✦','✧','✶'],color:game.accent,glow:game.accent,
        originX:50,originY:49,distanceMin:Math.min(70,reach*.3),distanceMax:reach,
        sizeMin:10,sizeMax:20,delayMin:0,delayMax:105,
        durationMin:760,durationMax:1060,zIndex:3,respectReducedMotion:true
      }).catch(error=>console.warn('星光爆發無法播放，略過視覺效果。',error));
    }
    // 手動選遊戲時給少量亮點回饋；自動輪播不反覆炸粒子。
    if(source==='catalog' && typeof window.SlowlyClickBurst?.burst==='function'){
      const art=stage.querySelector('.card-visual');
      if(art){
        window.SlowlyClickBurst.burst({container:art,x:art.clientWidth/2,y:art.clientHeight/2,color:game.accent,count:24});
      }
    }
  });
})();
