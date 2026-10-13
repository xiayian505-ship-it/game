/* 慢慢遊戲大廳｜五套可交叉搭配的軍火庫舞台效果。
   遊戲資料仍只放 games.json；這裡只負責舞台視覺與短暫演出。 */
(()=>{
  'use strict';
  const stage=document.getElementById('spotlight');
  const icon=document.getElementById('stage-icon');
  const title=document.getElementById('stage-name');
  const label=document.getElementById('effect-caption');
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const labels=['星環脈光','流光星門','霓虹電場','星塵漂浮','曜光流金'];
  const libraryClasses=['sbs-breathe','slowly-shine-text','slowly-text-gradient-flow','sbs-atom'];
  let sweep=null;
  if(window.SlowlySweepLine?.create){
    // JS 軍火庫零件只建立一次；每次換景只播放，不重複綁定。
    sweep=window.SlowlySweepLine.create(stage,{duration:610,size:3,length:'32%'});
  }

  document.addEventListener('slowly:lobby-spotlight',event=>{
    const {game,slot,source}=event.detail;
    stage.style.setProperty('--stage-accent',game.accent);
    stage.dataset.effectSlot=String(slot);
    label.textContent=`${labels[slot-1] || '慢慢遊戲'} · ${String(slot).padStart(2,'0')} / 05`;
    icon.classList.remove(...libraryClasses);
    title.classList.remove(...libraryClasses);
    // 避免上次舞台留下的效果混進下一輪。
    sweep?.clear();
    switch(slot){
      case 1: icon.classList.add('sbs-breathe');break;
      case 2: icon.classList.add('slowly-shine-text');break;
      case 3: icon.classList.add('sbs-breathe');break;
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
    // 電場進場時掃過舞台，不影響輪播的功能流程。
    if(slot===3 && sweep){
      sweep.play([{targets:[icon],direction:'horizontal',duration:680,size:3,length:'38%',color:game.accent},
                  {targets:[title],direction:'vertical',duration:570,size:2,length:'23%',color:game.accent}])
        .catch(error=>console.warn('掃描線無法播放，略過視覺效果。',error));
    }
    // 手動選遊戲時給少量亮點回饋；自動輪播不反覆炸粒子。
    if(source==='catalog' && typeof window.SlowlyClickBurst?.burst==='function'){
      const art=stage.querySelector('.spotlight-art');
      if(art){
        window.SlowlyClickBurst.burst({container:art,x:art.clientWidth/2,y:art.clientHeight/2,color:game.accent,count:24});
      }
    }
  });
})();
