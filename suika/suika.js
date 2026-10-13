/**
 * 鹿雨森 / Suika Demo「霧核鍊成」
 * 以使用者原創 suika_v1 的重力、碰撞、同階合成玩法為基礎。
 * 這裡只保留鹿雨森自己的玩法整合；軍火庫零件從 HTTPS 引用。
 * 不啟用原型的音效、排行榜或存檔。
 */
(() => {
  'use strict';
  const canvas = document.querySelector('#gameCanvas');
  const ctx = canvas.getContext('2d');
  const $ = selector => document.querySelector(selector);
  const el = {
    bossHpText:$('#bossHpText'),bossHpFill:$('#bossHpFill'),bossShield:$('#bossShield'),
    bossCountdown:$('#bossCountdown'),turnStatus:$('#turnStatus'),dropCount:$('#dropCount'),
    nextCore:$('#nextCore'),nextName:$('#nextName'),highestName:$('#highestName'),
    mergeCount:$('#mergeCount'),battleLog:$('#battleLog'),
    endOverlay:$('#endOverlay'),endTitle:$('#endTitle'),endText:$('#endText'),
    restart:$('#restart'),resetConfirm:$('#resetConfirm'),
    cancelReset:$('#cancelReset'),confirmReset:$('#confirmReset'),again:$('#againBtn')
  };
  const W = canvas.width,H = canvas.height;
  const WALL=10,FLOOR_Y=H-12,DROP_Y=78,DANGER_Y=120;
  const GRAVITY=820,RESTITUTION=.18,AIR_DAMPING=.999,FLOOR_FRICTION=.985;
  const MERGE_COOLDOWN=180,LOSE_HOLD_MS=1800,DROP_DELAY_MS=420;
  const BOSS_MAX_HP=240,BOSS_INTERVAL=5;
  const LEVELS=Object.freeze([
    {name:'霧塵',symbol:'✧',radius:15,color:'#92c1c7'},
    {name:'雨珠',symbol:'◈',radius:18,color:'#8db9cf'},
    {name:'林芽',symbol:'✦',radius:22,color:'#9dcbb4'},
    {name:'露紋',symbol:'❖',radius:26,color:'#92d0cb'},
    {name:'月瓣',symbol:'☽',radius:31,color:'#bfbee1'},
    {name:'星枝',symbol:'✶',radius:36,color:'#d0c3a0'},
    {name:'霧晶',symbol:'✧',radius:42,color:'#b7b4dc'},
    {name:'森林之息',symbol:'✦',radius:49,color:'#b7d6ab'},
    {name:'月華',symbol:'☾',radius:57,color:'#ccc3e5'},
    {name:'鹿角靈輝',symbol:'♢',radius:66,color:'#e1d2b6'},
    {name:'生命共鳴',symbol:'✺',radius:78,color:'#d5f2dc'}
  ]);
  const visuals=window.SilvaSuikaVisuals??{};
  let fruits=[],currentLevel=0,nextLevel=1,dropX=W/2;
  let bossHp=BOSS_MAX_HP,bossShield=0,dropCount=0,mergeCount=0,highest=-1;
  let running=true,canDrop=true,pointerDown=false,lastTime=0,rafId=0;
  let dangerSince=null,fruitId=0,bossBusy=false,bossTimer=0,swallowTimer=0,dropTimer=0;
  let warningFruitId=null,gameId=0;

  function randomInt(min,max) {
    if (window.SlowlyRandom?.int) return window.SlowlyRandom.int(min,max);
    return Math.floor(Math.random()*(max-min+1))+min;
  }
  function starterLevel(){return randomInt(0,2);}
  function message(text){el.battleLog.textContent=text;}
  function newFruit(level,x,y,vx=0,vy=0){
    const now=performance.now();
    return {id:++fruitId,level,x,y,vx,vy,radius:LEVELS[level].radius,bornAt:now,mergeLockedUntil:now+MERGE_COOLDOWN};
  }
  function stopTimers(){
    cancelAnimationFrame(rafId);
    clearTimeout(bossTimer);clearTimeout(swallowTimer);clearTimeout(dropTimer);
    rafId=bossTimer=swallowTimer=dropTimer=0;
  }
  function updateUI(){
    el.bossHpText.textContent=`${bossHp} / ${BOSS_MAX_HP}`;
    el.bossHpFill.style.width=`${Math.max(0,100*bossHp/BOSS_MAX_HP)}%`;
    el.bossShield.textContent=`霧盾 ${bossShield}`;
    const left=BOSS_INTERVAL-dropCount%BOSS_INTERVAL;
    el.bossCountdown.textContent=bossBusy?'霧蝕正在降臨…':`還有 ${left} 次投放發動霧蝕`;
    el.dropCount.textContent=`已投放 ${dropCount} 顆`;
    const next=LEVELS[nextLevel];
    el.nextCore.textContent=next.symbol;el.nextCore.style.color=next.color;
    el.nextName.textContent=next.name;
    el.highestName.textContent=highest<0?'尚未融合':LEVELS[highest].name;
    el.mergeCount.textContent=mergeCount;
    el.turnStatus.textContent=bossBusy?'霧蝕即將發動':running?'旅人回合':'試煉已結束';
  }
  function resetGame(){
    stopTimers();gameId++;
    fruits=[];currentLevel=starterLevel();nextLevel=starterLevel();dropX=W/2;
    bossHp=BOSS_MAX_HP;bossShield=0;dropCount=0;mergeCount=0;highest=-1;
    running=true;canDrop=true;pointerDown=false;dangerSince=null;warningFruitId=null;bossBusy=false;
    el.endOverlay.hidden=true;el.resetConfirm.hidden=true;
    visuals.reset?.();message('相同階級的靈核碰撞融合，便能傷害迷霧之影。');
    updateUI();draw();lastTime=performance.now();rafId=requestAnimationFrame(loop);
  }
  function finish(won,reason){
    if(!running)return;
    running=false;canDrop=false;bossBusy=false;warningFruitId=null;stopTimers();
    el.endTitle.textContent=won?'霧影消散':'鍊成場失控';
    el.endText.textContent=won?`成功擊敗迷霧之影！這場共完成 ${mergeCount} 次融合。`:(reason||'靈核堆積太高，森林的霧氣吞沒了鍊成場。');
    message(won?'試煉成功，森林再次安靜下來。':'試煉失敗。調整落點，再試一次。');
    el.endOverlay.hidden=false;visuals.result?.(won);updateUI();draw();
  }
  function applyDamage(amount){
    if(!running)return;
    const absorbed=Math.min(bossShield,amount);
    bossShield-=absorbed;const actual=Math.min(bossHp,amount-absorbed);
    bossHp-=actual;
    if(actual>0) visuals.bossHurt?.(actual);
    if(bossHp<=0){updateUI();finish(true);return;}
    return {actual,absorbed};
  }
  function mergePair(i,j){
    const a=fruits[i],b=fruits[j];
    const level=a.level+1;
    const x=(a.x+b.x)/2,y=(a.y+b.y)/2;
    const vx=(a.vx+b.vx)/2,vy=Math.min((a.vy+b.vy)/2,0);
    fruits.splice(Math.max(i,j),1);fruits.splice(Math.min(i,j),1);
    fruits.push(newFruit(level,x,y,vx,vy));
    mergeCount++;highest=Math.max(highest,level);
    const damage=6+level*6;
    const result=applyDamage(damage);
    // Boss 被擊敗時由 finish() 保留勝利訊息，避免被融合通知蓋掉。
    if (!running) return;
    message(result?.absorbed?`${LEVELS[level].name}鍊成！霧盾抵擋 ${result.absorbed}，Boss 受到 ${result.actual} 傷害。`:`${LEVELS[level].name}鍊成！對 Boss 造成 ${damage} 點傷害。`);
    updateUI();
  }
  function integrate(dt){
    for(const f of fruits){
      f.vy+=GRAVITY*dt;
      f.vx*=AIR_DAMPING;f.vy*=AIR_DAMPING;
      f.x+=f.vx*dt;f.y+=f.vy*dt;
      const r=f.radius;
      if(f.x-r<WALL){f.x=WALL+r;f.vx=Math.abs(f.vx)*RESTITUTION;}
      else if(f.x+r>W-WALL){f.x=W-WALL-r;f.vx=-Math.abs(f.vx)*RESTITUTION;}
      if(f.y+r>FLOOR_Y){
        f.y=FLOOR_Y-r;
        if(f.vy>0)f.vy=-f.vy*RESTITUTION;
        f.vx*=FLOOR_FRICTION;
        if(Math.abs(f.vy)<8)f.vy=0;
        if(Math.abs(f.vx)<2)f.vx=0;
      }
    }
  }
  function solveCollisions(){
    for(let iteration=0;iteration<4&&running;iteration++){
      let merged=false;
      outer:for(let i=0;i<fruits.length;i++)for(let j=i+1;j<fruits.length;j++){
        const a=fruits[i],b=fruits[j],dx=b.x-a.x,dy=b.y-a.y;
        const minDist=a.radius+b.radius,distSq=dx*dx+dy*dy;
        if(distSq>=minDist*minDist)continue;
        const dist=Math.sqrt(distSq)||.001,now=performance.now();
        if(a.level===b.level&&a.level<LEVELS.length-1&&now>=a.mergeLockedUntil&&now>=b.mergeLockedUntil){
          mergePair(i,j);merged=true;break outer;
        }
        const nx=dx/dist,ny=dy/dist,overlap=minDist-dist;
        const am=a.radius*a.radius,bm=b.radius*b.radius,total=am+bm;
        a.x-=nx*overlap*(bm/total);a.y-=ny*overlap*(bm/total);
        b.x+=nx*overlap*(am/total);b.y+=ny*overlap*(am/total);
        const along=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
        if(along<0){
          const impulse=-(1+RESTITUTION)*along*.5;
          a.vx-=impulse*nx;a.vy-=impulse*ny;
          b.vx+=impulse*nx;b.vy+=impulse*ny;
        }
      }
      if(merged)iteration=-1;
    }
  }
  function clampAll(){for(const f of fruits){const r=f.radius;f.x=Math.max(WALL+r,Math.min(W-WALL-r,f.x));f.y=Math.min(FLOOR_Y-r,f.y);}}
  function checkDanger(now){
    const danger=fruits.some(f=>now-f.bornAt>900&&Math.abs(f.vy)<40&&f.y-f.radius<DANGER_Y);
    if(danger){
      if(dangerSince===null)dangerSince=now;
      else if(now-dangerSince>=LOSE_HOLD_MS)finish(false,'靈核堆積太高，越過危險線太久。');
    } else dangerSince=null;
  }
  function doSwallow(targetId,token){
    if(!running||token!==gameId)return;
    const index=fruits.findIndex(f=>f.id===targetId);
    // 若警示期間恰好被融合，改選目前剩餘的一顆，避免憑空回血。
    const chosen=index>=0?index:(fruits.length?randomInt(0,fruits.length-1):-1);
    warningFruitId=null;
    if(chosen>=0){
      const [eaten]=fruits.splice(chosen,1);
      const power=Math.min(23,3+eaten.level*3);
      const missing=BOSS_MAX_HP-bossHp;
      if(missing>0){
        const healed=Math.min(missing,power);bossHp+=healed;
        message(`迷霧之影吞噬「${LEVELS[eaten.level].name}」，恢復 ${healed} HP。`);
        visuals.bossRecover?.('heal',healed);
      }else{
        const gained=Math.min(60-bossShield,power);
        bossShield+=Math.max(0,gained);
        message(`迷霧之影吞噬「${LEVELS[eaten.level].name}」，霧盾增加 ${Math.max(0,gained)}。`);
        visuals.bossRecover?.('shield',Math.max(0,gained));
      }
    } else message('場上沒有可吞噬的靈核，霧蝕落空了。');
    bossBusy=false;canDrop=true;updateUI();
  }
  function bossTurn(token){
    if(!running||token!==gameId)return;
    const eligible=fruits.filter(f=>performance.now()-f.bornAt>220);
    const list=eligible.length?eligible:fruits;
    if(!list.length){bossBusy=false;canDrop=true;message('霧蝕尋不到任何靈核。');updateUI();return;}
    const target=list[randomInt(0,list.length-1)];
    warningFruitId=target.id;
    message(`霧蝕鎖定了「${LEVELS[target.level].name}」……`);
    visuals.bossEat?.();
    swallowTimer=setTimeout(()=>doSwallow(target.id,token),650);
  }
  function dropCurrent(){
    if(!running||!canDrop||bossBusy||!el.resetConfirm.hidden)return;
    const r=LEVELS[currentLevel].radius;
    dropX=Math.max(WALL+r,Math.min(W-WALL-r,dropX));
    fruits.push(newFruit(currentLevel,dropX,DROP_Y));
    currentLevel=nextLevel;nextLevel=starterLevel();dropCount++;
    canDrop=false;
    const token=gameId;
    if(dropCount%BOSS_INTERVAL===0){
      bossBusy=true;message('霧林震動……迷霧之影準備吞噬靈核！');
      bossTimer=setTimeout(()=>bossTurn(token),1050);
    } else {
      dropTimer=setTimeout(()=>{if(running&&token===gameId)canDrop=true;},DROP_DELAY_MS);
    }
    updateUI();
  }
  function canvasX(event){const rect=canvas.getBoundingClientRect();return(event.clientX-rect.left)*W/rect.width;}
  function moveDropX(event){
    const r=LEVELS[currentLevel].radius;
    dropX=Math.max(WALL+r,Math.min(W-WALL-r,canvasX(event)));
    draw();
  }
  canvas.addEventListener('pointerdown',event=>{
    if(!running||!el.resetConfirm.hidden)return;
    pointerDown=true;
    canvas.setPointerCapture?.(event.pointerId);moveDropX(event);
  });
  canvas.addEventListener('pointermove',event=>{
    if(!running)return;
    if(pointerDown||event.pointerType==='mouse')moveDropX(event);
  });
  canvas.addEventListener('pointerup',event=>{
    if(!pointerDown)return;
    pointerDown=false;
    if(!running||!el.resetConfirm.hidden)return;
    moveDropX(event);dropCurrent();
  });
  canvas.addEventListener('pointercancel',()=>{pointerDown=false;});
  canvas.addEventListener('keydown',event=>{
    if(!running)return;
    if(['ArrowLeft','ArrowRight',' ','Enter'].includes(event.key))event.preventDefault();
    if(event.key==='ArrowLeft')dropX=Math.max(WALL+LEVELS[currentLevel].radius,dropX-18);
    if(event.key==='ArrowRight')dropX=Math.min(W-WALL-LEVELS[currentLevel].radius,dropX+18);
    if(event.key===' '||event.key==='Enter')dropCurrent();
  });
  // 所有繪圖使用原生 Canvas 畫鹿雨森專屬的無 emoji 靈核；正式美術可日後替換。
  function drawCore(core,alpha=1){
    const info=LEVELS[core.level];const{x,y,radius:r}=core;
    ctx.save();ctx.globalAlpha*=alpha;
    const outer=ctx.createRadialGradient(x-r*.3,y-r*.37,1,x,y,r);
    outer.addColorStop(0,'#edfdf3');outer.addColorStop(.32,info.color);outer.addColorStop(.76,'#253d4b');outer.addColorStop(1,'#0a2330');
    ctx.shadowBlur=Math.min(20,3+r*.2);ctx.shadowColor=info.color;
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=outer;ctx.fill();
    ctx.shadowBlur=0;ctx.lineWidth=Math.max(1.3,r*.055);ctx.strokeStyle='rgba(228,254,239,.62)';ctx.stroke();
    ctx.beginPath();ctx.arc(x,y,r*.79,0,Math.PI*2);ctx.lineWidth=.8;ctx.strokeStyle='rgba(230,255,246,.23)';ctx.stroke();
    const size=Math.min(r*1.23,56);
    ctx.font=`${Math.round(size)}px Georgia, "Times New Roman", serif`;
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#effff6';
    ctx.shadowColor=info.color;ctx.shadowBlur=8;
    ctx.fillText(info.symbol,x,y+1);
    ctx.shadowBlur=0;
    if(core.id===warningFruitId){
      ctx.beginPath();ctx.arc(x,y,r+4,0,Math.PI*2);
      ctx.setLineDash([4,4]);ctx.strokeStyle='#f0a4e0';ctx.lineWidth=3;ctx.stroke();ctx.setLineDash([]);
    }
    ctx.restore();
  }
  function drawPreview(){
    if(!running||!canDrop)return;
    const info=LEVELS[currentLevel];
    ctx.save();ctx.setLineDash([3,6]);ctx.strokeStyle='rgba(180,226,208,.32)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(dropX,DROP_Y+info.radius+6);ctx.lineTo(dropX,Math.min(DANGER_Y+130,FLOOR_Y));ctx.stroke();ctx.restore();
    drawCore({level:currentLevel,x:dropX,y:DROP_Y,radius:info.radius},.82);
  }
  function draw(){
    ctx.clearRect(0,0,W,H);
    const bg=ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#172f37');bg.addColorStop(.48,'#102831');bg.addColorStop(1,'#091922');
    ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    // 容器背後的霧光層
    const mist=ctx.createRadialGradient(W*.5,H*.37,1,W*.5,H*.37,W*.63);
    mist.addColorStop(0,'rgba(130,206,173,.13)');mist.addColorStop(1,'transparent');
    ctx.fillStyle=mist;ctx.fillRect(0,0,W,H);
    ctx.save();ctx.strokeStyle='rgba(162,228,205,.29)';ctx.lineWidth=3.5;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(WALL,54);ctx.lineTo(WALL,FLOOR_Y);ctx.lineTo(W-WALL,FLOOR_Y);ctx.lineTo(W-WALL,54);ctx.stroke();ctx.restore();
    ctx.save();ctx.setLineDash([7,6]);ctx.lineWidth=1.5;
    ctx.strokeStyle=dangerSince!==null?'rgba(239,144,174,.8)':'rgba(213,133,172,.38)';
    ctx.beginPath();ctx.moveTo(WALL,DANGER_Y);ctx.lineTo(W-WALL,DANGER_Y);ctx.stroke();ctx.restore();
    for(const f of fruits)drawCore(f);
    drawPreview();
    ctx.save();ctx.fillStyle='rgba(194,225,209,.52)';ctx.font='10px Georgia,serif';ctx.textAlign='center';
    ctx.fillText('S I L V A R A I N   /   F U S I O N',W/2,H-3);ctx.restore();
  }
  function loop(now){
    if(!running){draw();return;}
    const dt=Math.min(Math.max(0,(now-lastTime)/1000),.025);lastTime=now;
    integrate(dt);solveCollisions();
    if(!running){draw();return;}
    clampAll();checkDanger(now);draw();
    if(running)rafId=requestAnimationFrame(loop);
  }
  el.restart.addEventListener('click',()=>{
    if(!running||(!fruits.length&&mergeCount===0)){resetGame();return;}
    el.resetConfirm.hidden=false;pointerDown=false;
  });
  el.cancelReset.addEventListener('click',()=>{el.resetConfirm.hidden=true;});
  el.confirmReset.addEventListener('click',resetGame);
  el.again.addEventListener('click',resetGame);
  el.resetConfirm.addEventListener('click',event=>{if(event.target===el.resetConfirm)el.resetConfirm.hidden=true;});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!el.resetConfirm.hidden)el.resetConfirm.hidden=true;});
  resetGame();
})();
