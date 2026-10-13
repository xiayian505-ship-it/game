/* 慢慢遊戲大廳｜卡牌版：唯一清單、隨機五張、輪播、分類與跳頁。 */
(()=>{
  'use strict';

  const $ = id => document.getElementById(id);
  const FEATURED_COUNT = 5;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const color = value => /^#[\da-fA-F]{6}$/.test(value) ? value : '#e8c56a';
  const safeUrl = value => { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } };
  const shuffle = input => {
    const result = [...input];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };

  let games = [], byId = new Map(), featured = [], currentIndex = 0;
  let navigating = false;

  function normalize(input){
    if (!Array.isArray(input)) throw new Error('games.json 的 games 必須是陣列');
    const seen = new Set();
    return input.filter(raw => raw && raw.id && raw.name && safeUrl(raw.url))
      .map(raw => ({
        id:String(raw.id),
        name:String(raw.name),
        url:safeUrl(raw.url),
        cat:String(raw.cat || '其他'),
        tags:Array.isArray(raw.tags) ? raw.tags.map(String).slice(0, 12) : [],
        description:String(raw.description || '從慢慢遊戲收藏館，走進另一個好玩的世界。'),
        icon:String(raw.icon || '✦').slice(0, 8),
        accent:color(raw.accent)
      }))
      .filter(game => !seen.has(game.id) && seen.add(game.id));
  }

  function shortText(value, limit = 34){
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= limit) return text;
    return `${text.slice(0, limit)}…`;
  }

  // 五張輪播牌背沿用固定扇形；下方遊戲牌組另以滑動位置計算弧度。
  function applyFanLayout(elements){
    const nodes = Array.from(elements);
    const middle = (nodes.length - 1) / 2;
    nodes.forEach((node, index) => {
      const offset = index - middle;
      node.style.setProperty('--fan-rotate', `${offset * 7}deg`);
      node.style.setProperty('--fan-rise', `${Math.abs(offset) * 6}px`);
      node.style.setProperty('--fan-z', String(100 - Math.round(Math.abs(offset) * 10) + index));
    });
  }

  const hand = $('hand-viewport');
  const handPrev = $('hand-prev');
  const handNext = $('hand-next');
  let handFrame = 0;
  let handFocus = null;
  function updateHand(){
    handFrame = 0;
    const nodes = $('grid').children;
    const center = hand.scrollLeft + hand.clientWidth / 2;
    const halfWidth = Math.max(1, hand.clientWidth / 2);
    let closest = null;
    let closestDistance = Infinity;
    // 只更新視窗附近的牌，數百張也不會每次滑動都計算全部旋轉角度。
    if (nodes.length) {
      const step = nodes.length > 1 ? Math.max(1, nodes[1].offsetLeft - nodes[0].offsetLeft) : nodes[0].offsetWidth;
      const offsetStart = nodes[0].offsetLeft;
      const first = Math.max(0, Math.floor((hand.scrollLeft - offsetStart - 200) / step));
      const last = Math.min(nodes.length, Math.ceil((hand.scrollLeft + hand.clientWidth - offsetStart + 200) / step) + 1);
      for (let i = first; i < last; i++) {
        const card = nodes[i];
        const position = card.offsetLeft + card.offsetWidth / 2;
        const distance = Math.abs(position - center);
        if (distance < closestDistance) { closest = card; closestDistance = distance; }
        const offset = Math.max(-1.25, Math.min(1.25, (position - center) / halfWidth));
        card.style.setProperty('--fan-rotate', `${offset * 14}deg`);
        card.style.setProperty('--fan-rise', `${Math.abs(offset) * 13}px`);
        card.style.setProperty('--fan-z', String(100 - Math.round(Math.abs(offset) * 14)));
      }
    }
    if (handFocus !== closest) {
      handFocus?.classList.remove('is-hand-focus');
      handFocus = closest;
      handFocus?.classList.add('is-hand-focus');
    }
    const max = Math.max(0, hand.scrollWidth - hand.clientWidth);
    const hasOverflow = max > 2;
    handPrev.disabled = !hasOverflow || hand.scrollLeft <= 2;
    handNext.disabled = !hasOverflow || hand.scrollLeft >= max - 2;
    hand.closest('.hand-carousel').classList.toggle('can-scroll', hasOverflow);
  }
  function queueHandUpdate(){
    if (!handFrame) handFrame = requestAnimationFrame(updateHand);
  }
  function moveHand(direction){
    const card = $('grid').firstElementChild;
    if (!card) return;
    // 一次翻約兩至三張；手機滑動與箭頭使用同一條原生水平捲軸。
    const stride = card.offsetWidth + parseFloat(getComputedStyle(card).marginLeft || 0);
    const distance = Math.max(Math.abs(stride) * 2, Math.min(hand.clientWidth * .7, Math.abs(stride) * 3));
    hand.scrollBy({left: distance * direction, behavior: reducedMotion.matches ? 'instant' : 'smooth'});
  }

  function createTile(game){
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'game-tile';
    button.dataset.selectId = game.id;
    button.style.setProperty('--accent', game.accent);
    button.setAttribute('aria-label', `讓《${game.name}》登上展示舞台`);
    const number = String(games.findIndex(item => item.id === game.id) + 1).padStart(2, '0');
    button.innerHTML =
      `<span class="game-tile-head"><span class="tile-category">${escapeHtml(game.cat)}</span><span class="tile-number">${number}</span></span>` +
      `<span class="tile-art" aria-hidden="true"><span class="tile-icon">${escapeHtml(game.icon)}</span></span>` +
      `<span class="game-tile-name">${escapeHtml(game.name)}</span>`;
    return button;
  }

  function renderCollection(){
    const grid = $('grid');
    const fragment = document.createDocumentFragment();
    games.forEach(game => fragment.append(createTile(game)));
    grid.replaceChildren(fragment);
    $('empty').hidden = games.length !== 0;
    hand.scrollLeft = 0;
    queueHandUpdate();
    highlightLibrary();
  }

  function renderTabs(){
    const nav = $('stage-nav');
    nav.replaceChildren();
    featured.forEach((game, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'stage-tab';
      button.dataset.slide = String(index);
      button.style.setProperty('--accent', game.accent);
      button.setAttribute('aria-label', `展示第 ${index + 1} 張牌：《${game.name}》`);
      button.setAttribute('aria-pressed', String(index === currentIndex));
      button.innerHTML =
        `<span class="stage-back-face" aria-hidden="true">` +
          `<span class="stage-back-mark">慢 慢</span>` +
          `<span class="stage-back-core">✦</span>` +
          `<span class="stage-back-sub">GAME HALL</span>` +
          `<span class="stage-back-no">0${index + 1}</span>` +
        `</span>`;
      nav.append(button);
    });
    applyFanLayout(nav.children);
  }

  function highlightLibrary(){
    const activeId = featured[currentIndex]?.id || '';
    document.querySelectorAll('.game-tile[data-select-id]').forEach(tile => {
      const active = tile.dataset.selectId === activeId;
      tile.setAttribute('aria-pressed', String(active));
      tile.classList.toggle('is-selected', active);
    });
    document.querySelectorAll('.stage-tab[data-slide]').forEach((tab, index) => {
      const active = index === currentIndex;
      tab.setAttribute('aria-pressed', String(active));
      tab.classList.toggle('is-current', active);
    });
  }

  function showCurrent(source = 'auto'){
    const game = featured[currentIndex];
    if (!game) return;
    $('stage-name').textContent = game.name;
    $('stage-description').textContent = shortText(game.description, 42);
    $('stage-category').textContent = game.cat;
    $('stage-icon').textContent = game.icon;
    $('slide-index').textContent = String(currentIndex + 1).padStart(2, '0');
    const play = $('play-link');
    play.href = game.url;
    play.setAttribute('aria-label', `進入《${game.name}》`);
    play.removeAttribute('aria-disabled');
    $('spotlight').dataset.effectSlot = String(currentIndex + 1);
    $('spotlight').dataset.gameId = game.id;
    renderTabs();
    highlightLibrary();
    document.dispatchEvent(new CustomEvent('slowly:lobby-spotlight', {
      detail: { game, slot: currentIndex + 1, source }
    }));
  }

  function newLineup(){
    const old = featured[currentIndex]?.id;
    const selected = shuffle(games);
    if (old && selected[0]?.id === old && selected.length > 1) {
      [selected[0], selected[1]] = [selected[1], selected[0]];
    }
    featured = selected.slice(0, Math.min(FEATURED_COUNT, selected.length));
    currentIndex = 0;
    showCurrent('shuffle');
  }

  function advance(amount, manual = false){
    const next = currentIndex + amount;
    if (next >= featured.length) {
      newLineup();
      return;
    }
    currentIndex = (next + featured.length) % featured.length;
    showCurrent(manual ? 'manual' : 'auto');
  }

  function selectFromLibrary(id){
    const game = byId.get(id);
    if (!game) return;
    const existing = featured.findIndex(item => item.id === id);
    if (existing >= 0) {
      currentIndex = existing;
    } else if (featured.length) {
      featured[currentIndex] = game;
    } else {
      featured = [game];
      currentIndex = 0;
    }
    showCurrent('catalog');
    $('featured').scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
  }

  // 只在使用者親自點牌時觸發；裝置或瀏覽器不支援時安靜略過。
  function tapCardFeedback(){
    try {
      if (typeof navigator.vibrate === 'function') navigator.vibrate(18);
    } catch (_) { /* 震動不是必要功能，不能影響切牌。 */ }
  }

  function bindEvents(){
    $('prev').addEventListener('click', () => advance(-1, true));
    $('next').addEventListener('click', () => advance(1, true));
    $('stage-nav').addEventListener('click', event => {
      const tab = event.target.closest('button[data-slide]');
      if (!tab) return;
      tapCardFeedback();
      currentIndex = Number(tab.dataset.slide);
      showCurrent('manual');
    });
    $('grid').addEventListener('click', event => {
      const button = event.target.closest('button[data-select-id]');
      if (button) {
        tapCardFeedback();
        selectFromLibrary(button.dataset.selectId);
      }
    });
    handPrev.addEventListener('click', () => moveHand(-1));
    handNext.addEventListener('click', () => moveHand(1));
    hand.addEventListener('scroll', queueHandUpdate, {passive:true});
    hand.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        moveHand(event.key === 'ArrowLeft' ? -1 : 1);
      }
    });
    addEventListener('resize', queueHandUpdate);

    let start = null;
    const stage = $('spotlight');
    stage.addEventListener('pointerdown', event => {
      start = event.pointerType === 'touch' && !event.target.closest('a,button') ? { x: event.clientX, y: event.clientY } : null;
    });
    stage.addEventListener('pointerup', event => {
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      start = null;
      if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.3) advance(dx < 0 ? 1 : -1, true);
    });
    stage.addEventListener('pointercancel', () => { start = null; });

    addEventListener('pageshow', () => {
      navigating = false;
      window.SlowlyPortalWipe?.reset?.();
    });
    $('play-link').addEventListener('click', async event => {
      const game = featured[currentIndex];
      if (!game) {
        event.preventDefault();
        return;
      }
      tapCardFeedback();
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.currentTarget.hasAttribute('download')) return;
      if (navigating) {
        event.preventDefault();
        return;
      }
      const portal = window.SlowlyPortalWipe;
      if (reducedMotion.matches || typeof portal?.play !== 'function') return;
      event.preventDefault();
      navigating = true;
      try {
        const rect = event.currentTarget.getBoundingClientRect();
        await portal.play({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, color: game.accent, hold: true });
      } catch(error) {
        console.warn('傳送門無法播放，改用原生跳頁', error);
      }
      window.location.assign(game.url);
    });
  }

  async function loadGames(){
    $('load-status').hidden = true;
    try {
      const response = await fetch('./games.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      games = normalize(Array.isArray(payload) ? payload : payload.games);
      if (!games.length) throw new Error('遊戲清單沒有有效資料');
      byId = new Map(games.map(game => [game.id, game]));
      renderCollection();
      newLineup();
    } catch(error) {
      console.error('遊戲清單載入失敗', error);
      $('load-status').hidden = false;
      $('stage-description').textContent = '遊戲清單暫時無法讀取。';
      $('play-link').setAttribute('aria-disabled', 'true');
    }
  }

  bindEvents();
  $('retry').addEventListener('click', loadGames);
  loadGames();
})();
