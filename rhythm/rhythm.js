/**
 * 鹿雨森・雨律 / Rhythm Demo 04
 * 改編自使用者自製 rhythm_tap_v1：保留 BPM 譜面、時間窗、分數、連擊、排行榜及模式，
 * 改成 9 個扇形排列的「向外飛行音符 → 觸碰光環」玩法。
 * 共用底層：軍火庫 FrameLoop / BeatTime / SlowlyRandom / FictionStorage / FictionSort / FictionPaginate。
 * 宿主專有：九圈布局、隨機譜面、視覺、判定、排行規則。沒有歌曲譜面／音訊。
 */
(() => {
  'use strict';
  const requires = ['FrameLoop', 'BeatTime', 'SlowlyRandom', 'FictionStorage', 'FictionSort', 'FictionPaginate'];
  const missing = requires.filter(name => !window[name]);
  if (missing.length) {
    const error = document.getElementById('engineError');
    error.hidden = false;
    error.textContent = `無法啟動節奏試煉：軍火庫零件載入失敗（${missing.join('、')}）。請確認網路連線。`;
    document.getElementById('btnStart').disabled = true;
    return;
  }
  const $ = id => document.getElementById(id);
  const stage = $('rhythmStage'), noteLayer = $('noteLayer'), padLayer = $('padLayer');
  const modeEl=$('gameMode'), bpmEl=$('bpm'), diffEl=$('difficulty');
  const btnStart=$('btnStart'),btnPause=$('btnPause'),btnEnd=$('btnEnd');
  const overlay=$('stageOverlay'), overlayTitle=$('overlayTitle'),overlayText=$('overlayText');
  const totalTimeMs=60000, rampDuration=180000, travelMs=1650, leadMs=1800;
  const greatMs=120, perfectMs=60, goodMs=200;
  const scores={perfect:100,great:50,good:20,miss:0};
  const weights={perfect:1,great:.7,good:.4,miss:0};
  const difficulty={easy:{label:'簡單',density:.48,subdiv:1},normal:{label:'普通',density:.52,subdiv:2},hard:{label:'困難',density:.77,subdiv:2}};
  // Love Live 類型的「U 形」九個目標；中央留給鹿角。座標為舞台的百分比。
  const pads=Array.from({length:9},(_,i)=>{
    const theta=Math.PI-i*Math.PI/8;
    return {x:50+43*Math.cos(theta),y:58+31*Math.sin(theta)};
  });
  const padElements=[];
  let state='idle',mode='fixed',diff='normal',bpm=120,timeMs=0;
  let score=0,combo=0,maxCombo=0,missCount=0,totalJudged=0,accuracySum=0;
  let chart=[],nextMissIndex=0,nextSpawnIndex=0,lastHitMs=0;
  let activeNotes=new Set(),stageW=0,stageH=0,endInProgress=false;
  let judgeTimer=0,activeRanking='fixed';
  const storage=FictionStorage.create({namespace:'Silvarain_rhythm_demo_v1'});
  const rand=(a,b)=>SlowlyRandom.int(a,b);
  const selectedMode=()=>modeEl.value==='ramp'?'ramp':'fixed';
  const selectedDiff=()=>difficulty[diffEl.value]?diffEl.value:'normal';
  const selectedBpm=()=>Number(bpmEl.value)||120;
  const isRunning=()=>state==='running';
  const loop=FrameLoop.create({callback({elapsed}){if(!isRunning())return;timeMs=elapsed;tick();}});

  function resizeStage(){stageW=stage.clientWidth;stageH=stage.clientHeight;}
  function makePads(){
    pads.forEach((p,i)=>{
      const b=document.createElement('button');b.type='button';b.className='rhythm-pad';
      b.style.setProperty('--x',p.x+'%');b.style.setProperty('--y',p.y+'%');
      b.dataset.pad=String(i);b.setAttribute('aria-label',`符文 ${i+1}`);
      const symbol=document.createElement('span');symbol.className='rhythm-pad-symbol';symbol.textContent=['✧','◈','✦','☽','✺','☽','✦','◈','✧'][i];
      const label=document.createElement('span');label.className='rhythm-pad-index';label.textContent=String(i+1);
      b.append(symbol,label);
      b.addEventListener('pointerdown',e=>{e.preventDefault();hitPad(i);});
      padElements.push(b);padLayer.appendChild(b);
    });
  }
  function setState(v){
    state=v;
    btnStart.disabled=!(v==='idle'||v==='ended');
    btnPause.disabled=!(v==='running'||v==='paused');
    btnEnd.disabled=!(v==='running'||v==='paused');
    btnPause.textContent=v==='paused'?'繼續':'暫停';
    modeEl.disabled=(v==='running'||v==='paused');
    bpmEl.disabled=modeEl.disabled;
    diffEl.disabled=modeEl.disabled;
  }
  function status(s){$('rhythmStatus').textContent=s;}
  function showOverlay(title,text){overlayTitle.textContent=title;overlayText.textContent=text;overlay.hidden=false;}
  function hideOverlay(){overlay.hidden=true;}
  function flash(i,kind){
    const b=padElements[i];b.classList.remove('is-hit','is-miss');void b.offsetWidth;
    const name=kind==='miss'?'is-miss':'is-hit';b.classList.add(name);
    window.setTimeout(()=>b.classList.remove(name),340);
  }
  function judge(kind){
    const n=$('judgement');n.textContent=kind.toUpperCase();n.dataset.kind=kind;
    n.classList.remove('is-on');void n.offsetWidth;n.classList.add('is-on');
    clearTimeout(judgeTimer);judgeTimer=setTimeout(()=>n.classList.remove('is-on'),440);
  }
  function updateHud(){
    $('score').textContent=score.toLocaleString('en-US');
    $('combo').textContent=String(combo);
    $('accuracy').textContent=(totalJudged?accuracySum/totalJudged*100:100).toFixed(1)+'%';
    const played=Math.max(0,timeMs-leadMs);
    const duration=mode==='fixed'?totalTimeMs:rampDuration;
    const displayMs=mode==='fixed'?Math.max(0,duration-played):played;
    const secs=Math.floor(displayMs/1000),min=Math.floor(secs/60);
    $('time').textContent=String(min).padStart(2,'0')+':'+String(secs%60).padStart(2,'0');
    $('timeLabel').textContent=mode==='fixed'?'剩餘時間':'已經過時間';
  }
  function makeNote(pad,hitTime){return {pad,hitTime,judged:false,element:null};}
  function pickPad(last,lastTime,t){
    // 不在 150ms 內連續分配同一個圓圈，降低非預期重疊。
    const r=rand(0,8);
    return r===last && t-lastTime<150?(last+1+rand(0,7))%9:r;
  }
  function generateChart(){
    chart=[];const settings=difficulty[diff];
    const duration=mode==='fixed'?totalTimeMs:rampDuration;
    let previous=-1,previousTime=-999999;
    if(mode==='fixed'){
      const step=BeatTime.secondsPerBeat(bpm)*1000/settings.subdiv;
      for(let t=0;t<duration;t+=step){
        if(rand(0,999)>=Math.round(settings.density*1000))continue;
        const pad=pickPad(previous,previousTime,t);chart.push(makeNote(pad,t+leadMs));previous=pad;previousTime=t;
      }
    }else{
      let t=0;
      while(t<duration){
        const rampBpm=Math.min(200,80+Math.floor(t/20000)*10);
        const beat=BeatTime.secondsPerBeat(rampBpm)*1000;
        for(let s=0;s<settings.subdiv;s++){
          const at=t+s*beat/settings.subdiv;if(at>=duration)break;
          if(rand(0,999)>=Math.round(settings.density*1000))continue;
          const pad=pickPad(previous,previousTime,at);chart.push(makeNote(pad,at+leadMs));previous=pad;previousTime=at;
        }
        t+=beat;
      }
    }
    lastHitMs=chart.length?chart[chart.length-1].hitTime:0;
  }
  function clearNotes(){activeNotes.forEach(n=>n.element?.remove());activeNotes.clear();noteLayer.replaceChildren();}
  function reset(){
    clearNotes();nextMissIndex=0;nextSpawnIndex=0;timeMs=0;score=0;combo=0;maxCombo=0;missCount=0;totalJudged=0;accuracySum=0;lastHitMs=0;endInProgress=false;
  }
  function spawn(note){
    if(note.judged||note.element)return;
    const el=document.createElement('span');el.className='rhythm-note';el.setAttribute('aria-hidden','true');
    note.element=el;noteLayer.appendChild(el);activeNotes.add(note);
  }
  function removeNote(note){
    if(note.element){note.element.remove();note.element=null;}
    activeNotes.delete(note);
  }
  function tick(){
    // 自動 Miss 使用時間順序索引，只檢查已過判定窗的音符。
    while(nextMissIndex<chart.length && chart[nextMissIndex].hitTime+goodMs<timeMs){
      const n=chart[nextMissIndex++];if(!n.judged)applyJudge(n,'miss');
    }
    while(nextSpawnIndex<chart.length && chart[nextSpawnIndex].hitTime-travelMs<=timeMs){
      const n=chart[nextSpawnIndex++];spawn(n);
    }
    // 譜面在幀之間以位置內插向外飛，所有目標為九個靜態圓圈。
    for(const n of activeNotes){
      if(n.judged){removeNote(n);continue;}
      const t=(timeMs-(n.hitTime-travelMs))/travelMs;
      if(t<0)continue;
      const pad=pads[n.pad];const eased=Math.max(0,Math.min(1.06,t));
      const x=(50+(pad.x-50)*eased)/100*stageW;
      const y=(25+(pad.y-25)*eased)/100*stageH;
      n.element.style.transform=`translate3d(${x}px,${y}px,0) translate(-50%,-50%) scale(${.6+Math.min(1,t)*.4})`;
    }
    updateHud();
    const duration=mode==='fixed'?totalTimeMs:rampDuration;
    if(mode==='ramp'&&missCount>=10){void finish('miss');return;}
    if(timeMs>=leadMs+duration+goodMs){void finish('complete');return;}
  }
  function applyJudge(n,kind){
    if(n.judged)return;n.judged=true;
    score+=scores[kind];totalJudged++;accuracySum+=weights[kind];
    if(kind==='miss'){combo=0;missCount++;}else{combo++;maxCombo=Math.max(maxCombo,combo);flash(n.pad,kind);}
    if(kind!=='miss'||missCount<=3||missCount%3===0)judge(kind);
    removeNote(n);
  }
  function emptyMiss(i){totalJudged++;missCount++;combo=0;flash(i,'miss');judge('miss');status('太早或太晚！光點抵達圓圈時再按。');updateHud();}
  function hitPad(i){
    if(!isRunning())return;
    let target=null,best=Infinity;
    for(const n of chart){
      if(n.judged||n.pad!==i)continue;
      const diffTime=Math.abs(n.hitTime-timeMs);
      if(diffTime<=goodMs&&diffTime<best){best=diffTime;target=n;}
    }
    if(!target){emptyMiss(i);return;}
    applyJudge(target,best<=perfectMs?'perfect':best<=greatMs?'great':'good');
    if(combo>0&&combo%10===0)status(`連擊 ${combo}！霧光與你共鳴。`);
    updateHud();
  }
  function start(){
    if(state!=='idle'&&state!=='ended')return;
    mode=selectedMode();diff=selectedDiff();bpm=selectedBpm();reset();generateChart();resizeStage();hideOverlay();
    setState('running');loop.start();status('靈光即將飛出……抵達外圈光環時點擊。');updateHud();
  }
  function pause(){if(!isRunning())return;loop.pause();setState('paused');showOverlay('雨聲暫歇','按下「繼續」，回到剛才的節拍。');status('已暫停。');}
  function resume(){if(state!=='paused')return;loop.resume();setState('running');hideOverlay();status('試煉繼續。');}
  function togglePause(){if(isRunning())pause();else if(state==='paused')resume();}
  const storeName=()=>mode==='fixed'?`top3_fixed_${diff}_${bpm}`:`top3_ramp_${diff}`;
  const scoreSorter=(a,b)=>(Number(b.score)-Number(a.score))||(Number(b.maxCombo)-Number(a.maxCombo))||(Number(b.accuracy)-Number(a.accuracy));
  const top3=records=>FictionPaginate.paginate(FictionSort.sort(records,{direction:'asc',compare:scoreSorter}),{page:1,pageSize:3}).data;
  async function recordResult(){
    const coll=storage.collection(storeName());
    await coll.add({mode,difficulty:diff,bpm:mode==='fixed'?bpm:null,score,maxCombo,
      accuracy:totalJudged?Number((accuracySum/totalJudged*100).toFixed(1)):100,
      timeMs:Math.round(Math.max(0,timeMs-leadMs)),at:Date.now()});
    await coll.replace(top3(await coll.all()));
  }
  async function renderRanking(){
    const chosenMode=selectedMode(),chosenDiff=selectedDiff(),chosenBpm=selectedBpm();
    const name=chosenMode==='fixed'?`top3_fixed_${chosenDiff}_${chosenBpm}`:`top3_ramp_${chosenDiff}`;
    $('rankContext').textContent=chosenMode==='fixed'?`${difficulty[chosenDiff].label} · ${chosenBpm} BPM · 60 秒`:`${difficulty[chosenDiff].label} · 漸快耐力`;
    const list=$('rankList');list.replaceChildren();
    try{
      const records=top3(await storage.collection(name).all());
      if(!records.length){const p=document.createElement('p');p.textContent='尚無紀錄。完成試煉後，讓這裡留下你的迴響。';list.append(p);return;}
      records.forEach((r,i)=>{
        const item=document.createElement('div');item.className='rhythm-rank-item';
        const title=document.createElement('b');title.textContent=`TOP ${i+1}　${Number(r.score).toLocaleString('en-US')} 分`;
        const info=document.createElement('small');info.textContent=`${Number(r.accuracy).toFixed(1)}% · ${r.maxCombo} COMBO`;
        item.append(title,info);list.append(item);
      });
    }catch(err){list.textContent='瀏覽器無法讀取本機排行榜。';console.warn('[鹿雨森節奏] 排行榜讀取失敗',err);}
  }
  async function finish(reason){
    if(!isRunning()&&state!=='paused'||endInProgress)return;
    endInProgress=true;loop.stop();clearNotes();setState('ended');
    const completed=reason!=='manual';
    if(completed){try{await recordResult();}catch(err){console.warn('[鹿雨森節奏] 排行榜無法寫入',err);}}
    const accuracy=totalJudged?(accuracySum/totalJudged*100).toFixed(1):'100.0';
    const text=reason==='manual'?'試煉已結束；手動結束不列入排行榜。':reason==='miss'?'霧光失去節律，漏接累積十次。':`試煉完成！準確率 ${accuracy}% · 最大連擊 ${maxCombo}。`;
    showOverlay(reason==='complete'?'森林回應了你':reason==='miss'?'節拍漸行漸遠':'試煉暫歇',text);
    status(`${text}　得分 ${score.toLocaleString('en-US')}。可以再次開始。`);
    if(!$('rankingPanel').hidden)void renderRanking();
    endInProgress=false;
  }
  btnStart.addEventListener('click',start);
  btnPause.addEventListener('click',togglePause);
  btnEnd.addEventListener('click',()=>void finish('manual'));
  modeEl.addEventListener('change',()=>{$('bpmRow').hidden=selectedMode()!=='fixed';updateHud();if(!$('rankingPanel').hidden)void renderRanking();});
  bpmEl.addEventListener('change',()=>{if(!$('rankingPanel').hidden)void renderRanking();});
  diffEl.addEventListener('change',()=>{if(!$('rankingPanel').hidden)void renderRanking();});
  $('btnRanking').addEventListener('click',()=>{$('rankingPanel').hidden=!$('rankingPanel').hidden;if(!$('rankingPanel').hidden){if(isRunning())pause();void renderRanking();}});
  $('btnRankClose').addEventListener('click',()=>{$('rankingPanel').hidden=true;});
  window.addEventListener('keydown',event=>{
    if(event.repeat||!isRunning()||event.target instanceof HTMLSelectElement)return;
    const i=Number(event.key)-1;if(!Number.isInteger(i)||i<0||i>8)return;
    event.preventDefault();hitPad(i);
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&isRunning())pause();});
  let pendingResize=0;
  window.addEventListener('resize',()=>{if(pendingResize)return;pendingResize=requestAnimationFrame(()=>{pendingResize=0;resizeStage();});});
  window.addEventListener('beforeunload',()=>loop.stop());
  makePads();resizeStage();setState('idle');updateHud();$('bpmRow').hidden=false;
})();
