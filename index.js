/* 慢慢遊戲大廳｜功能：唯一清單、隨機五款、輪播、搜尋分類、最近玩過與跳頁。 */
(()=>{
  'use strict';

  const $ = id => document.getElementById(id);
  const ALL = '全部';
  const RECENT_KEY = 'slowly:recent'; // 沿用舊版紀錄，不讓既有玩家紀錄消失。
  const RECENT_MAX = 8;
  const FEATURED_COUNT = 5;
  const ROTATE_MS = 8500;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const color = value => /^#[\da-fA-F]{6}$/.test(value) ? value : '#e8c56a';
  const safeUrl = value => { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } };
  const shuffle = input => {
    const result = [...input];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i],result[j]] = [result[j],result[i]];
    }
    return result;
  };

  let games = [], byId = new Map(), featured = [], currentIndex = 0;
  let category = ALL, searchTerm = '', autoPlaying = !reducedMotion.matches;
  let timer = null, navigating = false;

  function normalize(input){
    if (!Array.isArray(input)) throw new Error('games.json 的 games 必須是陣列');
    const seen = new Set();
    return input.filter(raw => raw && raw.id && raw.name && safeUrl(raw.url))
      .map(raw => ({
        id:String(raw.id),name:String(raw.name),url:safeUrl(raw.url),
        cat:String(raw.cat || '其他'),
        tags:Array.isArray(raw.tags)?raw.tags.map(String).slice(0,12):[],
        description:String(raw.description || '從慢慢遊戲收藏館，走進另一個好玩的世界。'),
        icon:String(raw.icon || '✦').slice(0,8),accent:color(raw.accent)
      })).filter(g => !seen.has(g.id) && seen.add(g.id));
  }

  function readRecent(){
    try {
      const ids = JSON.parse(localStorage.getItem(RECENT_KEY));
      return Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : [];
    } catch(error){ console.warn('最近玩過讀取失敗',error); return []; }
  }
  function recordRecent(id){
    try {
      const ids = [id,...readRecent().filter(x => x !== id)].slice(0,RECENT_MAX);
      localStorage.setItem(RECENT_KEY,JSON.stringify(ids));
    } catch(error){ console.warn('最近玩過無法儲存',error); }
  }

  function createTile(game,small=false){
    const button = document.createElement('button');
    button.type='button';
    button.className=small?'recent-item':'game-tile';
    button.dataset.selectId=game.id;
    button.style.setProperty('--accent',game.accent);
    button.setAttribute('aria-label',`讓《${game.name}》登上展示舞台`);
    button.innerHTML= small
      ? `<span class="recent-symbol" aria-hidden="true">${escapeHtml(game.icon)}</span><span class="recent-name">${escapeHtml(game.name)}</span>`
      : `<span class="game-tile-head"><span class="tile-category">${escapeHtml(game.cat)}</span><span class="tile-arrow" aria-hidden="true">↗</span></span>`+
        `<span class="tile-icon" aria-hidden="true">${escapeHtml(game.icon)}</span>`+
        `<span class="game-tile-name">${escapeHtml(game.name)}</span>`+
        `<span class="game-tile-footer"><span>${escapeHtml(game.tags.slice(0,2).join(' · ') || '慢慢遊戲')}</span><span>上舞台</span></span>`;
    return button;
  }

  function renderRecent(){
    const items=readRecent().map(id=>byId.get(id)).filter(Boolean);
    $('recent').hidden=!items.length;
    const row=$('recent-row');row.replaceChildren();
    for(const game of items) row.append(createTile(game,true));
  }

  function renderCollection(){
    const keyword=searchTerm.trim().toLocaleLowerCase();
    const filtered=games.filter(g => (category===ALL || g.cat===category)
      && (!keyword || [g.name,g.cat,g.description,...g.tags].join(' ').toLocaleLowerCase().includes(keyword)));
    const grid=$('grid');
    const fragment=document.createDocumentFragment();
    for(const game of filtered) fragment.append(createTile(game));
    grid.replaceChildren(fragment);
    $('count').textContent=`${games.length} 款收藏`;
    $('result-note').textContent=keyword || category!==ALL
      ? `找到 ${filtered.length} 款遊戲 · 點選卡片送上舞台`
      : '點選卡片送上舞台，再按「進入遊戲」';
    $('empty').hidden=filtered.length!==0;
    document.querySelectorAll('[data-cat]').forEach(b => {
      const active=b.dataset.cat===category;
      b.setAttribute('aria-pressed',String(active));
    });
  }

  function renderCategories(){
    const cats=[ALL,...new Set(games.map(g => g.cat))];
    const chips=$('chips');chips.replaceChildren();
    for(const cat of cats){
      const button=document.createElement('button');
      button.type='button';button.className='chip';button.dataset.cat=cat;
      button.textContent=cat;chips.append(button);
    }
  }

  function renderTabs(){
    const nav=$('stage-nav');nav.replaceChildren();
    for(let i=0;i<featured.length;i++){
      const game=featured[i];
      const b=document.createElement('button');
      b.type='button';b.className='stage-tab';b.dataset.slide=String(i);
      b.style.setProperty('--accent',game.accent);
      b.setAttribute('aria-label',`展示第 ${i+1} 款：${game.name}`);
      b.setAttribute('aria-pressed',String(i===currentIndex));
      b.innerHTML=`<span class="stage-tab-number">0${i+1}</span>`+
       `<span class="stage-tab-copy"><span class="stage-tab-caption">${escapeHtml(game.cat)}</span>`+
       `<span class="stage-tab-name">${escapeHtml(game.name)}</span></span>`;
      nav.append(b);
    }
  }

  function showCurrent(source='auto'){
    const game=featured[currentIndex];if(!game)return;
    $('stage-name').textContent=game.name;
    $('stage-description').textContent=game.description;
    $('stage-category').textContent=game.cat;
    $('stage-icon').textContent=game.icon;
    $('slide-index').textContent=`${String(currentIndex+1).padStart(2,'0')} / ${String(featured.length).padStart(2,'0')}`;
    const tags=$('stage-tags');tags.replaceChildren();
    for(const tag of game.tags.slice(0,3)){
      const li=document.createElement('li');li.textContent=tag;tags.append(li);
    }
    const play=$('play-link');play.href=game.url;
    play.setAttribute('aria-label',`進入《${game.name}》`);
    play.removeAttribute('aria-disabled');
    $('spotlight').dataset.effectSlot=String(currentIndex+1);
    $('spotlight').dataset.gameId=game.id;
    renderTabs();
    document.dispatchEvent(new CustomEvent('slowly:lobby-spotlight',{
      detail:{game,slot:currentIndex+1,source}
    }));
  }

  function newLineup(){
    const old=featured[currentIndex]?.id;
    const selected=shuffle(games);
    // 每一輪五款不重複，盡量避免上輪最後一款又立刻當下一輪首張。
    if(old && selected[0]?.id===old && selected.length>1){
      [selected[0],selected[1]]=[selected[1],selected[0]];
    }
    featured=selected.slice(0,Math.min(FEATURED_COUNT,selected.length));
    currentIndex=0;
    showCurrent('shuffle');
  }

  function advance(amount,manual=false){
    if(manual) setAutoplay(false);
    const next=currentIndex+amount;
    if(next>=featured.length){newLineup();return;}
    currentIndex=(next+featured.length)%featured.length;
    showCurrent(manual?'manual':'auto');
  }

  function setAutoplay(enabled){
    autoPlaying=Boolean(enabled && !reducedMotion.matches);
    if(timer!==null){clearInterval(timer);timer=null;}
    if(autoPlaying && games.length>1 && !document.hidden){
      timer=setInterval(()=>advance(1,false),ROTATE_MS);
    }
    const b=$('auto-toggle');
    b.setAttribute('aria-pressed',String(autoPlaying));
    b.textContent=autoPlaying?'Ⅱ 暫停輪播':'▶ 開啟輪播';
    b.setAttribute('aria-label',autoPlaying?'暫停自動輪播':'開啟自動輪播');
    b.disabled=reducedMotion.matches;
    if(reducedMotion.matches) b.title='已依系統偏好減少動態';
  }

  function selectFromLibrary(id){
    const game=byId.get(id);if(!game)return;
    setAutoplay(false);
    const existing=featured.findIndex(g=>g.id===id);
    if(existing>=0){currentIndex=existing;}
    else if(featured.length){featured[currentIndex]=game;}
    else{featured=[game];currentIndex=0;}
    showCurrent('catalog');
    $('featured').scrollIntoView({behavior:reducedMotion.matches?'auto':'smooth',block:'start'});
  }

  function bindEvents(){
    $('shuffle').addEventListener('click',()=>{
      if(!games.length)return;
      newLineup();
      if(autoPlaying)setAutoplay(true);
    });
    $('prev').addEventListener('click',()=>advance(-1,true));
    $('next').addEventListener('click',()=>advance(1,true));
    $('auto-toggle').addEventListener('click',()=>setAutoplay(!autoPlaying));
    $('stage-nav').addEventListener('click',e=>{
      const tab=e.target.closest('button[data-slide]');
      if(!tab)return;
      setAutoplay(false);currentIndex=Number(tab.dataset.slide);showCurrent('manual');
    });
    $('chips').addEventListener('click',e=>{
      const button=e.target.closest('button[data-cat]');
      if(button){category=button.dataset.cat;renderCollection();}
    });
    const input=$('q');
    const search=()=>{searchTerm=input.value;renderCollection();};
    input.addEventListener('input',e=>{if(!e.isComposing)search();});
    input.addEventListener('compositionend',search);
    document.addEventListener('keydown',e=>{
      if(e.key==='/' && !/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName||'')){
        e.preventDefault();input.focus();
      }
    });
    $('grid').addEventListener('click',e=>{
      const b=e.target.closest('button[data-select-id]');if(b)selectFromLibrary(b.dataset.selectId);
    });
    $('recent-row').addEventListener('click',e=>{
      const b=e.target.closest('button[data-select-id]');if(b)selectFromLibrary(b.dataset.selectId);
    });
    // 手機橫向滑動舞台以切換，不搶佔一般上下捲動，也不攔截「進入遊戲」。
    let start=null;
    const stage=$('spotlight');
    stage.addEventListener('pointerdown',e=>{
      start=e.pointerType==='touch' && !e.target.closest('a,button')?{x:e.clientX,y:e.clientY}:null;
    });
    stage.addEventListener('pointerup',e=>{
      if(!start)return;
      const dx=e.clientX-start.x,dy=e.clientY-start.y;start=null;
      if(Math.abs(dx)>65 && Math.abs(dx)>Math.abs(dy)*1.3){advance(dx<0?1:-1,true);}
    });
    stage.addEventListener('pointercancel',()=>{start=null;});

    document.addEventListener('visibilitychange',()=>{
      if(autoPlaying)setAutoplay(true);
    });
    addEventListener('pageshow',()=>{
      navigating=false;window.SlowlyPortalWipe?.reset?.();
      if(games.length)renderRecent();
      if(autoPlaying)setAutoplay(true);
    });
    $('play-link').addEventListener('click',async e=>{
      const game=featured[currentIndex];
      if(!game){e.preventDefault();return;}
      recordRecent(game.id);renderRecent();
      if(e.defaultPrevented || e.button!==0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.currentTarget.hasAttribute('download'))return;
      if(navigating){e.preventDefault();return;}
      const portal=window.SlowlyPortalWipe;
      if(reducedMotion.matches || typeof portal?.play!=='function')return;
      e.preventDefault();navigating=true;
      try {
        const r=e.currentTarget.getBoundingClientRect();
        await portal.play({x:r.left+r.width/2,y:r.top+r.height/2,color:game.accent,hold:true});
      }catch(error){console.warn('傳送門無法播放，改用原生跳頁',error);}
      window.location.assign(game.url);
    });
  }

  async function loadGames(){
    $('load-status').hidden=true;
    try {
      const response=await fetch('./games.json',{cache:'no-cache'});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const payload=await response.json();
      games=normalize(Array.isArray(payload)?payload:payload.games);
      if(!games.length)throw new Error('遊戲清單沒有有效資料');
      byId=new Map(games.map(g=>[g.id,g]));
      renderCategories();renderCollection();renderRecent();newLineup();setAutoplay(autoPlaying);
    }catch(error){
      console.error('遊戲清單載入失敗',error);
      $('load-status').hidden=false;
      $('stage-description').textContent='遊戲清單暫時無法讀取，請檢查檔案後重新整理。';
      $('play-link').setAttribute('aria-disabled','true');
      $('count').textContent='讀取失敗';
      setAutoplay(false);
    }
  }

  bindEvents();
  $('retry').addEventListener('click',loadGames);
  loadGames();
})();
