/** 霧林之契｜宿主 UI：頁面、卡面與互動呈現，不在此計算戰鬥結果。 */
(() => {
  "use strict";
  const Data = window.LinCardData;
  const root = document.getElementById("app");
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const pct = (a, b) => Math.max(0, Math.min(100, (100 * a) / (b || 1)));

  // 軍火庫 Tree Selection 專管展開狀態；卡牌資料、畫面樣式與點擊行為由宿主處理。
  // 選牌與初始選牌分開紀錄畫面狀態，不修改 localStorage 或既有選牌演算。
  const treeStates = {
    choose: window.TreeSelection?.create?.({ expansion: "single" }) || null,
    deck: window.TreeSelection?.create?.({ expansion: "single" }) || null
  };
  const openDetails = { choose: null, deck: null };

  // 初始 25 張與對戰前 30 張共用卡牌陳列；原有上限與實體卡 ID 互不混用。
  function groupedDeckCards(cards) {
    const groups = new Map();
    for (const card of cards) {
      const key = `${card.cardId}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(card);
    }
    return [...groups.values()];
  }
  function deckGroupMarkup(cards, chosen, mode) {
    const sample = cards[0];
    const count = cards.filter(card => chosen.has(card.id)).length;
    const limit = mode === "choose" ? 25 : 30;
    const full = count === cards.length || chosen.size >= limit;
    const key = `${sample.cardId}`;
    const expanded = openDetails[mode] === key;
    const displayCard = cards.find(card => chosen.has(card.id)) || sample;
    return `<div class="lc-deck-stack ${count ? "has-picks" : ""}" data-stack="${esc(key)}">
      <div class="lc-deck-stack-face">
        ${cardMarkup(displayCard, { action: `${mode}-plus`, selected: count > 0, disabled: full })}
        <span class="lc-deck-stack-count" aria-hidden="true">×${count}</span>
      </div>
      <div class="lc-deck-stack-controls">
        <button type="button" class="lc-deck-minus" data-act="${mode}-minus" data-id="${esc(sample.id)}" aria-label="減少一張${esc(Data.cardName(sample))}" ${count ? "" : "disabled"}>−</button>
        <span aria-label="已選 ${count} 張，持有 ${cards.length} 張">${count} / ${cards.length}</span>
      </div>
      ${cards.length > 1 ? `<button type="button" class="lc-deck-variants-toggle" data-act="${mode}-variants" data-key="${esc(key)}" aria-controls="lc-deck-variants-${esc(mode)}-${esc(sample.id)}" aria-expanded="${expanded}">${expanded ? "收起各張 ↑" : "查看各張 ↓"}</button>` : ""}
    </div>`;
  }
  // 查看各張展開整組的每張實體卡；直接選取 ID，等級與分支只顯示既有牌面內容。
  // 展開區跨越分類的兩欄，避免各張卡再被擠進單一半欄。
  function deckVariantsMarkup(cards, chosen, mode) {
    const sample = cards[0];
    return `<div class="lc-deck-variants" id="lc-deck-variants-${esc(mode)}-${esc(sample.id)}">
      <div class="lc-deck-variants-heading">${esc(Data.cardName(sample))} · ${cards.length} 張</div>
      <div class="lc-deck-variant-list">${cards.map((card, i) => {
        const selected = chosen.has(card.id);
        const canPick = selected || chosen.size < (mode === "choose" ? 25 : 30);
        const level = Data.LEVEL_TYPES.includes(card.type) ? `Lv.${card.level}` : "固定效果";
        const action = selected ? "點擊移出" : "點擊加入";
        return `<div class="lc-deck-variant-card ${selected ? "is-picked" : ""}">
          ${cardMarkup(card, { action: mode, selected, disabled: !canPick, ariaLabel: `${Data.cardName(card)} 第 ${i + 1} 張 ${level}，${selected ? "已選，點擊移出" : canPick ? "未選，點擊加入" : `未選，${mode === "choose" ? "初始選牌" : "出戰牌組"}已滿`}` })}
          <span class="lc-deck-variant-caption">第 ${i + 1} 張 · ${selected ? "已選" : canPick ? action : "已選滿"}</span>
        </div>`;
      }).join("")}</div>
    </div>`;
  }
  function deckCategoryCards(members, chosen, mode) {
    const groups = groupedDeckCards(members);
    const html = [];
    for (let i = 0; i < groups.length; i += 2) {
      const pair = groups.slice(i, i + 2);
      html.push(...pair.map(cards => deckGroupMarkup(cards, chosen, mode)));
      const expanded = pair.find(cards => openDetails[mode] === `${cards[0].cardId}` && cards.length > 1);
      if (expanded) html.push(deckVariantsMarkup(expanded, chosen, mode));
    }
    return html.join("");
  }
  function selectionTree(cards, mode, chosen) {
    const tree = treeStates[mode];
    if (!tree) return `<p class="lc-error">軍火庫 Tree Selection 尚未載入。請確認網路連線後重新整理，避免無法展開卡牌分類。</p>`;
    // 初選七大類中的攻擊牌已固定配發，展示但不能重複選進 25 張候選額度。
    return `<div class="lc-selection-tree" aria-label="依卡牌類型選牌">${Data.TYPES.map(type => {
      const members = cards.filter(card => card.type === type);
      const fixed = mode === "choose" && type === "attack";
      const expanded = tree.isExpanded(type);
      const selectedCount = members.filter(card => chosen.has(card.id)).length;
      const groupId = `lc-tree-${mode}-${type}`;
      const body = fixed ? members.map(card => `<div class="lc-deck-stack lc-deck-stack--fixed">
        <div class="lc-deck-stack-face">${cardMarkup(card)}</div>
        <div class="lc-deck-fixed-caption">已配發</div>
      </div>`).join("") : deckCategoryCards(members, chosen, mode);
      return `<section class="lc-tree-group ${expanded ? "is-expanded" : ""}">
        <button type="button" class="lc-tree-heading" data-act="tree-category" data-mode="${mode}" data-type="${type}" aria-expanded="${expanded}" aria-controls="${groupId}">
          <span class="lc-tree-heading-label"><span class="lc-tree-symbol" aria-hidden="true">${esc(Data.SYMBOLS[type])}</span>${esc(Data.LABELS[type])}牌</span>
          <span class="lc-tree-heading-count">${fixed ? `已配發 ${members.length} 張` : `已選 ${selectedCount} / ${members.length}`}</span><span class="lc-tree-chevron" aria-hidden="true">${expanded ? "⌄" : "›"}</span>
        </button>
        ${expanded ? `<div class="lc-tree-items lc-deck-two-columns" id="${groupId}">${members.length ? body : `<p class="lc-tree-empty">目前沒有此類卡牌。</p>`}</div>` : ""}
      </section>`;
    }).join("")}</div>`;
  }

  // 手牌採重疊扇形排列；每張牌依位置計算傾斜角。
  function fanHandMarkup(cards, selectedIndex, energy, mana, buff, foeShield) {
    if (!cards.length) return `<p class="lc-empty">手牌已空。若抽牌堆尚有牌，可結束回合後補牌。</p>`;
    return cards.map((c, i) => {
      const mid = (cards.length - 1) / 2;
      const angle = (i - mid) * (cards.length <= 4 ? 4.6 : 15 / (cards.length - 1));
      const rise = Math.round(Math.abs(i - mid) * 5);
      return cardMarkup(c, { action: "hand", index: i, selected: i === selectedIndex,
        unpayable: (Data.resource(c) === "mana" ? Data.cost(c) > mana : Data.cost(c) > energy) || (c.type === "special" && Data.effectOf(c) === "sacrifice" && energy + mana === 0) || (Data.effectOf(c) === "shatter" && foeShield === 0), buff, angle, rise });
    }).join("");
  }

  function cardMarkup(card, opts = {}) {
    const action = opts.action || "";
    const hasLevel = Data.LEVEL_TYPES.includes(card.type);
    const level = hasLevel ? `Lv.${Data.effectiveLevel(card, opts.buff || 0)}${opts.buff ? " ✦" : ""}` : "固定效果";
    const cost = Data.cost(card);
    const selected = !!opts.selected;
    const unpayable = !!opts.unpayable;
    const resource = Data.resource(card);
    const costLabel = Data.effectOf(card) === "sacrifice" ? "雙歸零" : resource === "none" ? "免費" : `${resource === "mana" ? "✺" : "✧"} ${cost}`;
    const costTitle = resource === "mana" ? "魔法點費用" : resource === "energy" ? "行動點費用" : "不需預付點數";
    const inner = `<span class="lc-card-head"><span class="lc-family">${esc(Data.LABELS[card.type])}</span><span class="lc-cost" title="${costTitle}">${costLabel}</span></span>
      <span class="lc-card-symbol" aria-hidden="true">${esc(Data.SYMBOLS[card.type])}</span>
      <span class="lc-card-name">${esc(Data.cardName(card))}</span>
      <span class="lc-card-description">${esc(Data.describe(card, opts.buff || 0))}</span>
      <span class="lc-card-foot"><span>${level}</span><span>${card.branch && card.branch !== "標準" ? esc(card.branch) : "✦"}</span></span>`;
    const style = Number.isFinite(opts.angle) ? ` style="--fan-tilt:${opts.angle.toFixed(2)}deg;--fan-rise:${opts.rise || 0}px"` : "";
    const attr = action ? ` type="button" data-act="${esc(action)}" data-id="${esc(card.id)}" ${opts.disabled ? "disabled" : ""}${Number.isInteger(opts.index) ? `data-index="${opts.index}"` : ""}${opts.ariaLabel ? ` aria-label="${esc(opts.ariaLabel)}"` : ""}${style}` : "";
    const cls = `lc-card ${selected ? "is-selected" : ""} ${unpayable ? "is-unpayable" : ""}`;
    return action ? `<button class="${cls}" data-type="${card.type}"${attr} aria-pressed="${selected}">${inner}</button>`
      : `<div class="${cls}" data-type="${card.type}">${inner}</div>`;
  }
  function headline(save, preamble, title, detail) {
    return `<div class="lc-section-heading"><p class="lc-eyebrow">${esc(preamble)}</p><h2>${esc(title)}</h2><p>${esc(detail)}</p></div>`;
  }
  function chooseView(v) {
    const cards = v.save.pool;
    return `<div class="lc-deck-prep-count">已選 ${v.chosenInitial.size} / 25 張</div>
      ${selectionTree([...v.save.starter, ...cards], "choose", v.chosenInitial)}
      <div class="lc-deck-prep-actions"><button class="lc-secondary" type="button" data-act="retreat">息兵</button><button class="lc-primary" type="button" data-act="confirm-initial" ${v.chosenInitial.size !== 25 ? "disabled" : ""}>出戰</button></div>`;
  }
  function deckView(v) {
    // 初始選牌與接關選牌沿用同一無框版型；只更換張數上限與出戰行為。
    return `<div class="lc-deck-prep-count">已選 ${v.chosenDeck.size} / 30 張</div>
      ${selectionTree(v.save.player, "deck", v.chosenDeck)}
      <div class="lc-deck-prep-actions"><button class="lc-secondary" type="button" data-act="retreat">息兵</button><button class="lc-primary" type="button" data-act="start" ${v.chosenDeck.size === 0 || !v.hasLibrary ? "disabled" : ""}>出戰</button></div>
      ${v.hasLibrary ? "" : `<p class="lc-error">軍火庫 Deck 尚未載入。必須連上網路才能開戰；請確認 HTTPS 引用可用。</p>`}`;
  }
  // 首頁三道霧林路徑互斥聚焦：第一次點選，第二次確認進入。
  // 只是 UI 暫存狀態，不寫入存檔、不干涉遊戲或故事進度。
  const requestedView = new URL(window.location.href).searchParams.get("view");
  let screen = requestedView === "game" ? "game" : requestedView === "challenge" ? "levels" : "home";
  let homeFocus = null;
  const homePaths = Object.freeze([
    { key: "profile", title: "關於旅人", symbol: Data.SYMBOLS.shield, subtitle: "回望你的收藏與足跡" },
    { key: "levels", title: "開始試煉", symbol: Data.SYMBOLS.action, subtitle: "循著霧光，迎向下一場試煉" },
    { key: "story", title: "旅程回顧", symbol: Data.SYMBOLS.special, subtitle: "重拾林中遺落的篇章" }
  ]);
  function homeView() {
    return `<nav class="lc-home-paths ${homeFocus ? "has-focus" : ""}" aria-label="旅人的選擇">
      ${homePaths.map(path => {
        const selected = homeFocus === path.key;
        return `<button type="button" class="lc-home-path ${selected ? "is-focused" : ""}" data-act="focus-home" data-dest="${path.key}" aria-label="${path.title}${selected ? "，再次點擊" + (path.key === "story" ? "；旅程回顧尚未開放" : "進入") : "，點擊選取"}" aria-pressed="${selected}">
          <span class="lc-home-path-glow" aria-hidden="true"></span>
          <span class="lc-home-path-symbol" aria-hidden="true">${path.symbol}</span>
          <span class="lc-home-path-description" aria-hidden="${!selected}"><strong>${path.title}</strong><small>${path.subtitle}</small></span>
        </button>`;
      }).join("")}
    </nav>`;
  }
  // v1.0.0｜兩大內頁與首頁共用無框、互斥聚焦、再點進入的路徑模式。
  // 這些只是目前開啟的 UI 層級；不寫入存檔、不變更關卡進度。
  const sectionPaths = Object.freeze({
    profile: [
      { key: "collection", symbol: "✦", title: "永久收藏", subtitle: "留在掌心的，皆有來處。" },
      { key: "decks", symbol: "❈", title: "個人牌組", subtitle: "以手中之牌，編織自己的戰術。" },
      { key: "catalog", symbol: "♧", title: "霧林圖鑑", subtitle: "每一張牌，都藏著未竟的可能。" }
    ],
    levels: [
      { key: "marks", symbol: "◈", title: "試煉刻痕", subtitle: "踏過的每一重霧，都留有印記。" },
      { key: "trials", symbol: "✥", title: "十重試煉", subtitle: "霧幕之後，下一道命運正等著你。" }
    ],
    trials: [
      { key: "challenge", symbol: "⚔", title: "試煉挑戰", subtitle: "十重霧障，終有一途通往真相。" },
      { key: "boss", symbol: "♜", title: "霧影牌鑑", subtitle: "知曉對手的底牌，未必能改寫命運。" }
    ]
  });
  const sectionFocus = { profile: null, levels: null, trials: null };
  let profileSection = null;
  let levelsSection = requestedView === "challenge" ? "trials" : null;
  let trialSection = requestedView === "challenge" ? "challenge" : null;

  function scrollToTop() { window.scrollTo?.({ top: 0, behavior: "instant" }); }
  function openScreen(dest) {
    screen = dest;
    homeFocus = null;
    profileSection = null;
    levelsSection = null;
    trialSection = null;
    for (const area of Object.keys(sectionFocus)) sectionFocus[area] = null;
    render();
    scrollToTop();
  }
  function focusHome(dest) {
    if (screen !== "home" || !homePaths.some(path => path.key === dest)) return;
    if (homeFocus !== dest) { homeFocus = dest; render(); return; }
    // 「旅程回顧」目前僅顯示選取效果，未正式開放。
    if (dest !== "story") openScreen(dest);
  }
  function sectionMenu(area) {
    const entries = sectionPaths[area];
    const focused = sectionFocus[area];
    return `<nav class="lc-home-paths lc-sub-paths ${entries.length === 2 ? "is-pair" : ""} ${focused ? "has-focus" : ""}" aria-label="${area === "profile" ? "關於旅人" : area === "levels" ? "開始試煉" : "十重試煉"}">
      ${entries.map(path => {
        const selected = focused === path.key;
        return `<button type="button" class="lc-home-path ${selected ? "is-focused" : ""}" data-act="focus-section" data-area="${area}" data-dest="${path.key}" aria-pressed="${selected}" aria-label="${esc(path.title)}，${selected ? "再次點擊進入" : "點擊選取"}">
          <span class="lc-home-path-glow" aria-hidden="true"></span>
          <span class="lc-home-path-symbol" aria-hidden="true">${esc(path.symbol)}</span>
          <span class="lc-home-path-description" aria-hidden="${!selected}"><strong>${esc(path.title)}</strong><small>${esc(path.subtitle)}</small></span>
        </button>`;
      }).join("")}
    </nav>`;
  }
  function focusSection(area, dest) {
    if (!sectionPaths[area]?.some(path => path.key === dest)) return;
    if ((area === "profile" && (screen !== "profile" || profileSection)) ||
        (area === "levels" && (screen !== "levels" || levelsSection)) ||
        (area === "trials" && (screen !== "levels" || levelsSection !== "trials" || trialSection))) return;
    if (sectionFocus[area] !== dest) { sectionFocus[area] = dest; render(); return; }
    if (area === "profile") profileSection = dest;
    if (area === "levels") levelsSection = dest;
    if (area === "trials") trialSection = dest;
    sectionFocus[area] = null;
    render();
    scrollToTop();
  }
  function backSection(area) {
    if (area === "profile") {
      if (profileSection === "editor") profileSection = "decks";
      else profileSection = null;
    } else if (area === "prologue" || area === "epilogue") {
      trialSection = "challenge";
    } else if (area === "levels") {
      if (trialSection) trialSection = null;
      else levelsSection = null;
    }
    render();
    scrollToTop();
  }
  function sectionBack(label, area) {
    return `<button class="lc-section-back" type="button" data-act="back-section" data-area="${area}"><span aria-hidden="true">‹</span> ${esc(label)}</button>`;
  }
  function sectionTitle(path) {
    return `<header class="lc-sub-heading"><span class="lc-sub-heading-symbol" aria-hidden="true">${esc(path.symbol)}</span><h2>${esc(path.title)}</h2><p>${esc(path.subtitle)}</p></header>`;
  }
  // 點擊關卡名稱只切換導覽層級；不改變戰鬥、永久收藏或通關存檔。
  function backToChallenge() {
    if (screen !== "game" || bossAnimating) return;
    screen = "levels";
    homeFocus = null;
    profileSection = null;
    levelsSection = "trials";
    trialSection = "challenge";
    for (const area of Object.keys(sectionFocus)) sectionFocus[area] = null;
    render();
    scrollToTop();
  }

  // 圖鑑只看資料定義，不呼叫 battle／reward，也不讀寫牌組存檔。
  const allCardSamples = Data.TYPES.flatMap(type => Data.CARD_CATALOG[type].map((def, i) =>
    ({ id: `archive-${type}-${i}`, cardId: def.cardId, type, level: 0, branch: "標準" })));
  // 使用現有卡池建立一次只讀的初始牌鑑；105 張基礎牌＋40 張初選候選牌。
  // 禁止與會成長的 save.boss 混用，否則會把旅人後續棄牌誤列在初始牌鑑。
  const bossOpeningCards = Data.bossBase();
  const travelerOpeningPool = Data.initialPool();
  function groupedCards(cards) {
    const grouped = new Map();
    for (const card of cards) {
      const key = `${card.cardId}:${card.level || 0}:${card.branch || "標準"}`;
      if (grouped.has(key)) grouped.get(key).count++;
      else grouped.set(key, { card, count: 1 });
    }
    return [...grouped.values()];
  }
  function cardGallery(cards, { grouped = false } = {}) {
    if (!cards.length) return `<p class="lc-archive-empty">尚無卡牌</p>`;
    const rows = grouped ? groupedCards(cards) : cards.map(card => ({ card, count: 1 }));
    return `<div class="lc-archive-gallery">${rows.map(({ card, count }) => `<div class="lc-archive-card">${cardMarkup(card)}${count > 1 ? `<span class="lc-archive-quantity" aria-label="共 ${count} 張">× ${count}</span>` : ""}</div>`).join("")}</div>`;
  }
  function archiveGroups(cards, groupCounts = false) {
    return `<div class="lc-archive-groups">${Data.TYPES.map(type => {
      const members = cards.filter(card => card.type === type);
      if (!members.length) return "";
      return `<details class="lc-archive-group"><summary><span class="lc-archive-symbol" aria-hidden="true">${esc(Data.SYMBOLS[type])}</span><strong>${esc(Data.LABELS[type])}牌</strong><small>${members.length} 張</small><span class="lc-archive-chevron" aria-hidden="true">⌄</span></summary>${cardGallery(members, { grouped: groupCounts })}</details>`;
    }).join("")}</div>`;
  }
  function collectionView(v) {
    return `${sectionBack("關於旅人", "profile")}${sectionTitle(sectionPaths.profile[0])}
      <div class="lc-archive-count">已收藏 <strong>${v.save.player.length}</strong> / 80</div>
      ${v.save.player.length ? archiveGroups(v.save.player) : `<p class="lc-archive-empty">尚未建立收藏</p>`}`;
  }
  function catalogView() {
    return `${sectionBack("關於旅人", "profile")}${sectionTitle(sectionPaths.profile[2])}
      <div class="lc-archive-count">七大類・<strong>${allCardSamples.length}</strong> 種卡牌</div>
      ${archiveGroups(allCardSamples)}`;
  }
  function presetsView(v) {
    const save = v.save;
    const busy = save.phase !== "deck";
    const own = new Map(save.player.map(card => [card.id, card]));
    return `${sectionBack("關於旅人", "profile")}${sectionTitle(sectionPaths.profile[1])}
      <div class="lc-profile-decks">${save.deckPresets.map((ids, index) => {
        const cards = ids.map(id => own.get(id)).filter(Boolean);
        const active = index === save.activeDeckIndex;
        const summary = cards.length ? cards.slice(0, 6).map(card => esc(Data.cardName(card))).join("、") + (cards.length > 6 ? `……等 ${cards.length} 張` : "") : "尚未放入卡牌";
        return `<section class="lc-profile-deck ${active ? "is-active" : ""}"><div class="lc-profile-deck-head"><div><small>0${index + 1}</small><h3>牌組${["一", "二", "三"][index]}</h3></div><span>${cards.length} / 30 張</span></div>
          <p class="lc-profile-deck-preview">${summary}</p>
          <div class="lc-profile-actions"><button class="lc-secondary" type="button" data-act="activate-preset" data-slot="${index}" ${busy || active ? "disabled" : ""}>${active ? "目前使用" : "設為出戰牌組"}</button><button class="lc-primary" type="button" data-act="edit-preset" data-slot="${index}" ${busy ? "disabled" : ""}>編輯牌組 →</button></div></section>`;
      }).join("")}</div>
      ${busy ? `<p class="lc-archive-empty">完成目前的選牌或戰鬥流程後，即可編輯三套牌組。</p>` : ""}`;
  }
  function profileEditorView(v) {
    const number = ["一", "二", "三"][v.save.activeDeckIndex];
    return `${sectionBack("個人牌組", "profile")}
      <header class="lc-sub-heading"><span class="lc-sub-heading-symbol">❈</span><h2>牌組${number}</h2><p>已選 ${v.chosenDeck.size} / 30 張</p></header>
      <div class="lc-count-line"><strong>${v.chosenDeck.size} / 30</strong><button class="lc-quiet" type="button" data-act="select-all">快速選前 30 張</button></div>
      ${selectionTree(v.save.player, "deck", v.chosenDeck)}
      <div class="lc-editor-finish"><button class="lc-secondary" type="button" data-act="back-section" data-area="profile">完成編輯 ✓</button></div>`;
  }
  function profileView(v) {
    if (profileSection === "collection") return collectionView(v);
    if (profileSection === "catalog") return catalogView();
    if (profileSection === "decks") return presetsView(v);
    if (profileSection === "editor") return profileEditorView(v);
    return sectionMenu("profile");
  }
  function marksView(v) {
    const save = v.save;
    const finished = save.completed >= 10;
    return `${sectionBack("開始試煉", "levels")}${sectionTitle(sectionPaths.levels[0])}
      <div class="lc-marks-list" aria-label="十關通關刻痕">${Data.CHAPTERS.map((name, i) => {
        const cleared = i < save.completed;
        const current = !finished && i + 1 === save.stage;
        return `<div class="lc-mark-row ${cleared ? "is-cleared" : current ? "is-current" : "is-locked"}"><span class="lc-mark-num">${String(i + 1).padStart(2, "0")}</span><span class="lc-mark-name">${esc(name)}</span><span class="lc-mark-state">${cleared ? "✓ 已通過" : current ? "目前關卡" : "未解鎖"}</span></div>`;
      }).join("")}</div>`;
  }
  function prologueView() {
    // 劇情第 0 章尚未啟用；目前僅作為完整清除本作遊戲紀錄的明確入口。
    return `${sectionBack("試煉挑戰", "prologue")}
      <header class="lc-sub-heading lc-prologue-heading"><span class="lc-sub-heading-symbol" aria-hidden="true">☾</span><h2>契約之前</h2></header>
      <div class="lc-prologue-restart"><p>昔日所行之路，將重新隱沒於霧中。</p>
        <p>重新啟程會清除全部遊戲紀錄，包括永久收藏、Boss 牌庫、個人牌組、十關進度及故事紀錄，無法復原。</p>
        <div class="lc-prologue-actions"><button type="button" data-act="restart-journey">重新啟程</button><button type="button" data-act="back-prologue">留在此處</button></div>
      </div>`;
  }
  function challengeView(v) {
    const save = v.save;
    const finished = save.completed >= 10;
    return `${sectionBack("十重試煉", "levels")}${sectionTitle(sectionPaths.trials[0])}
      <div class="lc-chapter-choices"><button type="button" class="lc-chapter-choice lc-chapter-prologue" data-act="open-prologue">
        <span>CHAPTER 00</span><strong>契約之前</strong><small>重新啟程</small></button>${Data.CHAPTERS.map((name, i) => {
        const number = i + 1;
        const cleared = number <= save.completed;
        const current = !finished && number === save.stage;
        const label = cleared ? "✓ 已通關" : current ? "開始挑戰 →" : "尚未解鎖";
        return `<button type="button" class="lc-chapter-choice ${cleared ? "is-cleared" : current ? "is-current" : "is-locked"}" data-act="enter-stage" ${current ? "" : "disabled"}>
          <span>CHAPTER ${String(number).padStart(2, "0")}</span><strong>${esc(name)}</strong><small>${label}</small></button>`;
      }).join("")}
      <button type="button" class="lc-chapter-choice lc-chapter-epilogue ${finished ? "is-cleared" : "is-locked"}" data-act="open-epilogue" ${finished ? "" : "disabled"}>
        <span>AFTER THE PACT</span><strong>契約之後</strong><small>${finished ? "閱讀篇章 →" : "尚未解鎖"}</small></button></div>
      ${finished ? `<div class="lc-actions-center"><button class="lc-primary" data-act="enter-stage">查看通關紀錄 →</button></div>` : ""}`;
  }
  function bossArchiveView() {
    return `${sectionBack("十重試煉", "levels")}${sectionTitle(sectionPaths.trials[1])}
      <section class="lc-archive-part"><h3>霧影原始牌庫 <span>${bossOpeningCards.length} 張</span></h3>${archiveGroups(bossOpeningCards, true)}</section>
      <section class="lc-archive-part"><h3>旅人初選卡池 <span>${travelerOpeningPool.length} 張</span></h3>${archiveGroups(travelerOpeningPool, true)}</section>`;
  }
  function levelsView(v) {
    if (levelsSection === "marks") return marksView(v);
    if (levelsSection === "trials") {
      if (trialSection === "challenge") return challengeView(v);
      if (trialSection === "prologue") return prologueView();
      if (trialSection === "boss") return bossArchiveView();
      return `${sectionBack("開始試煉", "levels")}${sectionTitle(sectionPaths.levels[1])}${sectionMenu("trials")}`;
    }
    return sectionMenu("levels");
  }
  function healthMeter(side, isBoss = false) {
    return `<div class="lc-hud-hp"><div class="lc-health-line"><span>生命 HP</span><strong>${side.hp} / ${side.maxHP}</strong></div>
      <div class="lc-health"><span style="width:${pct(side.hp, side.maxHP)}%"></span></div></div>`;
  }
  function bossFigure() {
    // 以 CSS 繪製霧影對手，保持戰鬥舞台的獨立視覺。
    return `<div class="lc-foe" aria-hidden="true"><span class="lc-foe-halo"></span>
      <span class="lc-foe-antler left"></span><span class="lc-foe-antler right"></span>
      <span class="lc-foe-cloak"></span><span class="lc-foe-face"></span>
      <span class="lc-foe-eyes"></span><span class="lc-foe-ground"></span></div>`;
  }
  function battleView(v) {
    if (!v.battle) return `<p class="lc-error">本場戰鬥資料未建立。重新整理後，可從選牌畫面開新一場。</p>`;
    const b = v.battle;
    const hand = b.player.hand;
    const bossAction = b.log.find(text => text.startsWith("Boss") || text.includes("Boss 牌庫")) || "迷霧正等待你的下一步。";
    // 關卡名稱只在外部主標題顯示；戰場內只保留必要的狀態與操作。
    return `<div class="lc-battle-board" aria-label="霧林之契戰鬥舞台">
        <div class="lc-battle-turn"><strong>ROUND ${String(b.round).padStart(2, "0")}</strong><span>✦</span><small>玩家回合</small><div class="lc-battle-settings"><button class="lc-battle-sound" type="button" data-act="toggle-battle-sound" aria-pressed="${window.MistBattleFX?.enabled !== false}">${window.MistBattleFX?.enabled !== false ? "♫ 音效開" : "♪ 音效關"}</button><button class="lc-battle-sound lc-battle-vibration" type="button" data-act="toggle-battle-vibration" aria-pressed="${window.MistBattleHaptics?.enabled === true}" ${window.MistBattleHaptics?.supported ? "" : "disabled"}>${!window.MistBattleHaptics?.supported ? "震動不支援" : window.MistBattleHaptics?.enabled ? "▰ 震動開" : "▱ 震動關"}</button></div></div>
        <section class="lc-battle-boss" aria-label="Boss 狀態">
          ${bossFigure()}
          <div class="lc-boss-tags"><span>❖ 護盾 ${b.boss.shield}</span><span>♧ 防禦 ${b.boss.guard}</span><span>✧ 行動 ${b.boss.energy}</span><span>✺ 魔法 ${b.boss.mana}</span>${b.boss.buff ? `<span>✦ 共鳴 +${b.boss.buff}</span>` : ""}${b.boss.pierceNext ? `<span>⌁ 穿盾待發</span>` : ""}</div>
          ${healthMeter(b.boss, true)}
          <p class="lc-boss-card-count" aria-label="Boss 剩餘牌數">剩餘可用 <strong>${b.boss.drawPile.length + b.boss.hand.length}</strong> 張 <span>｜抽牌 ${b.boss.drawPile.length} · 手牌 ${b.boss.hand.length} · 棄牌 ${b.boss.discardPile.length}</span></p>
          <p class="lc-boss-report" aria-live="polite">${esc(bossAction)}</p>
        </section>
        <section class="lc-battle-hand-zone" aria-label="玩家手牌">
          <div class="lc-hand-title">YOUR HAND <span>·</span> 手中之牌</div>
          ${b.openingExchangeAvailable && b.player.drawPile.length > 0
            ? `<div class="lc-opening-exchange"><button type="button" class="lc-secondary lc-exchange-button" data-act="opening-exchange" ${v.selectedCard === null ? "disabled" : ""}>換掉選中手牌 ↻</button></div>`
            : ""}
          <div class="lc-battle-hand">${fanHandMarkup(hand, v.selectedCard, b.player.energy, b.player.mana, b.player.buff, b.boss.shield)}</div>
        </section>
        <section class="lc-battle-player" aria-label="玩家狀態">
          <div class="lc-player-emblem" aria-hidden="true">✧</div>
          <div class="lc-player-name">森林旅人</div>
          ${healthMeter(b.player)}
        </section>
        <div class="lc-battle-actions"><button class="lc-primary" data-act="end-turn">結束回合 <span aria-hidden="true">→</span></button><button class="lc-surrender" data-act="concede" type="button" title="認輸本場戰鬥，保留永久進度">敗北／認輸</button></div>
        <div class="lc-battle-resources">
          <div class="lc-resource-energy"><span>✧ 行動點</span><strong>${b.player.energy}</strong></div>
          <div class="lc-resource-energy"><span>✺ 魔法點</span><strong>${b.player.mana}</strong></div>
          ${b.player.buff ? `<span>✦ ${esc(Data.cardName({ cardId: "magic_07" }))} +${b.player.buff}（效果 Lv.5 封頂）</span>` : ""}
          ${b.player.pierceNext ? `<span>⌁ 下次攻擊穿盾</span>` : ""}
          <span>♧ 防禦 ${b.player.guard}</span><span>❖ 護盾 ${b.player.shield}</span>
          <span>抽牌 ${b.player.drawPile.length} · 棄牌 ${b.player.discardPile.length}</span>
          <button class="lc-quiet lc-battle-discard" data-act="discard" ${v.selectedCard === null || b.freeDiscardUsed ? "disabled" : ""} title="本回合可免費整理一張">整理選中手牌</button>
        </div>
      </div>
      <details class="lc-log"><summary>戰鬥紀錄 <span>最近 ${Math.min(12, b.log.length)} 則</span></summary><ol>${b.log.slice(0, 12).map(x => `<li>${esc(x)}</li>`).join("")}</ol></details>
      ${v.targetPrompt ? targetView(v.targetPrompt) : ""}`;
  }
  function targetView(prompt) {
    const cards = prompt.type === "discard" && prompt.piles
      ? prompt.piles.map(pile => `<section class="lc-discard-source"><h4>${esc(pile.label)} <span>${pile.cards.length} 張</span></h4><div class="lc-dialog-cards">${pile.cards.length ? pile.cards.map(c => cardMarkup(c, { action: "target" })).join("") : `<p class="lc-tree-empty">目前沒有棄牌</p>`}</div></section>`).join("")
      : `<div class="lc-dialog-cards">${prompt.cards.map(c => cardMarkup(c, { action: "target" })).join("")}</div>`;
    return `<div class="lc-overlay" role="dialog" aria-modal="true" aria-label="卡牌目標"><div class="lc-dialog"><div class="lc-dialog-head"><h3>${esc(prompt.label)}</h3><button class="lc-close" type="button" data-act="close-target">✕</button></div>
    ${cards}</div></div>`;
  }
  // 收藏達 80 張時，點「留於掌心」才展開舊卡替換清單。
  // 僅保存 UI 展開狀態，不影響任何永久資料。
  let replacingRewardCardId = null;
  function rewardView(v) {
    const pending = v.save.pendingReward;
    if (!pending) return `<p class="lc-error">獎勵狀態有誤，請重新整理。</p>`;
    const current = window.LinCardGame.currentReward();
    if (!pending.mode) {
      const info = [
        ["card1", "額外獲得 1 張新卡", "隨機獲得一張七大類卡牌"],
        ["deck_up", "出戰牌組升 1 級", "本場出戰的可升等卡牌全部 +1 級"],
        ["card4", "額外獲得 4 張新卡", "一次領取四張隨機卡牌"],
        ["collection_up", "永久收藏升 1 級", "所有可升等收藏卡牌全部 +1 級"]
      ];
      return `${headline(v.save, "04 / VICTORY · REWARD", "戰後試煉", `本關固定獲得攻擊牌 1 張，下一場玩家初始行動點 +1（${5 + v.save.completed} → ${6 + v.save.completed}）。另選一種獎勵。`)}
        <div class="lc-reward-grid">${info.map(([key, title, value]) => `<button class="lc-reward-choice" data-act="reward" data-mode="${key}"><span>選擇獎勵</span><strong>${esc(title)}</strong><small>${esc(value)}</small><b>領取獎勵 →</b></button>`).join("")}</div>`;
    }
    const full = v.save.player.length >= 80;
    const showReplacement = full && current && replacingRewardCardId === current.id;
    return `<div class="lc-reward-card">${current ? cardMarkup(current) : ""}</div>
      <div class="lc-reward-actions" aria-label="新卡歸屬">
        <button type="button" class="lc-reward-link" data-act="${full ? "choose-replace" : "keep-reward"}" ${showReplacement ? 'aria-expanded="true"' : ""}>留於掌心</button>
        <button type="button" class="lc-reward-link" data-act="reject-reward">歸於霧影</button>
      </div>
      ${showReplacement ? `<section class="lc-replace-options" aria-label="選擇替換的舊卡"><h3 class="lc-replace-heading">收藏已滿，選一張舊卡交給霧影</h3><div class="lc-card-grid">${v.save.player.map(c => `<div class="lc-deck-item">${cardMarkup(c)}<button class="lc-replace-button" data-act="replace" data-id="${esc(c.id)}">交出這張牌</button></div>`).join("")}</div></section>` : ""}`;
  }
  function defeatView(v) {
    return `${headline(v.save, "DEFEAT / THE FOREST REMEMBERS", `第 ${v.save.stage} 關・戰敗`, "已獲得的卡牌、等級、關卡進度與 Boss 永久收藏全部保留。")}
      <div class="lc-finish-icon">☾</div><p class="lc-finish-text">你可以從當前關卡重新挑戰，不必重打之前的關卡。</p>
      <div class="lc-actions-center"><button class="lc-primary" data-act="retry">重試第 ${v.save.stage} 關 →</button><button disabled class="lc-secondary" title="尚未開放">復活｜尚未開放</button></div>`;
  }
  function completeView(v) {
    return `${headline(v.save, "THE END / TEN CHAPTERS", "十關試煉通關", "你擊敗了同一位對手的十個稱號。那些被捨棄的牌，都成了這場旅程的一部分。")}
      <div class="lc-finish-icon">✧</div><div class="lc-status-grid"><div><span>完成關卡</span><strong>10 / 10</strong></div><div><span>最後玩家收藏</span><strong>${v.save.player.length} 張</strong></div><div><span>Boss 最終牌庫</span><strong>${v.save.boss.length} 張</strong></div></div><p class="lc-finish-text">十關已完成，旅程暫告一段落。</p>`;
  }
  function render() {
    if (!root || !window.LinCardGame) return;
    const v = window.LinCardGame.view();
    const phaseView = {
      choose: chooseView, deck: deckView, battle: battleView,
      reward: rewardView, defeat: defeatView, complete: completeView
    }[v.save.phase] || deckView;
    const view = screen === "home" ? homeView : screen === "levels" ? levelsView : screen === "profile" ? profileView : phaseView;
    const isGame = screen === "game";
    const isRewardAllocation = isGame && v.save.phase === "reward" && !!v.save.pendingReward?.mode;
    const isDeckPrep = isGame && (v.save.phase === "choose" || v.save.phase === "deck");
    const isBattle = isGame && v.save.phase === "battle";
    // 準備頁不顯示一般流程通知；真正的開戰／存檔錯誤仍應讓玩家看見。
    const deckError = /^(開戰失敗|存檔寫入失敗|軍火庫 Deck 尚未載入)/.test(v.notice || "");
    const battleError = /^(存檔寫入失敗|開戰失敗|行動點|選擇已失效|只有回合|本回合)/.test(v.notice || "");
    document.getElementById("status-message").hidden = !isGame || isRewardAllocation || (isDeckPrep && !deckError) || (isBattle && !battleError);
    const intro = document.querySelector(".lc-intro");
    intro?.classList.toggle("is-compact", screen !== "home");
    intro?.classList.toggle("is-home-art", screen === "home");
    intro?.classList.toggle("is-page-title", screen === "levels" || screen === "profile");
    intro?.classList.toggle("is-trial-heading", screen === "levels");
    intro?.classList.toggle("is-stage-title", isGame);
    const stageTitle = document.getElementById("lc-stage-title");
    if (stageTitle) stageTitle.textContent = Data.CHAPTERS[v.save.stage - 1] || "十重試煉";
    // 兩個內頁沿用首頁三路徑的圖示、四字標題和副文，不再顯示英文標語。
    const pagePath = homePaths.find(path => path.key === screen);
    const pageTitle = intro?.querySelector(".lc-page-home-link h1");
    const pageSymbol = intro?.querySelector(".lc-page-symbol");
    const pageSubtitle = intro?.querySelector(".lc-page-subtitle");
    if (pageTitle) pageTitle.textContent = pagePath?.title || "霧林之契";
    if (pageSymbol) pageSymbol.textContent = pagePath?.symbol || "";
    if (pageSubtitle) pageSubtitle.textContent = pagePath?.subtitle || "";
    document.getElementById("wf-game")?.classList.toggle("is-home-screen", screen === "home");
    document.getElementById("wf-game")?.classList.toggle("is-journey-screen", screen === "profile" || screen === "levels");
    document.getElementById("status-message").textContent = v.notice || "卡牌牌庫不會自動洗回；行動與魔法點每場重置，但回合不重置。";
    root.classList.toggle("is-home-panel", screen === "home");
    root.classList.toggle("is-page-heading", screen === "levels" || screen === "profile");
    root.classList.toggle("is-journey-panel", screen === "levels" || screen === "profile");
    root.classList.toggle("is-stage-panel", isGame);
    root.classList.toggle("is-reward-allocation", isRewardAllocation);
    root.classList.toggle("is-deck-prep", isDeckPrep);
    root.classList.toggle("is-battle", isBattle);
    root.innerHTML = view(v);
  }
  function flightGeometry(source, card) {
    const destination = document.querySelector((card?.type === "attack" || ["shatter", "energy_seal"].includes(Data.effectOf(card))) ? ".lc-battle-boss .lc-foe" : ".lc-battle-player");
    return source && destination ? { from: source.getBoundingClientRect(), to: destination.getBoundingClientRect() } : null;
  }
  function cardFlight(source, card, geometry) {
    if (!source || !geometry || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches || !source.animate) {
      void window.MistBattleFX?.play(card, "player");
      return;
    }
    const a = geometry.from;
    const b = geometry.to;
    if (!a.width || !b.width) {
      void window.MistBattleFX?.play(card, "player");
      return;
    }
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const clone = source.cloneNode(true);
    clone.removeAttribute("data-act");
    clone.classList.remove("is-selected");
    clone.classList.add("lc-card-flight");
    clone.setAttribute("aria-hidden", "true");
    clone.tabIndex = -1;
    clone.disabled = true;
    Object.assign(clone.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px`, margin: "0", transform: "none" });
    document.body.append(clone);
    const animation = clone.animate([
      { transform: "translate(0,0) rotate(0deg) scale(1)", opacity: 1 },
      { transform: `translate(${dx * .5}px,${dy * .50 - 25}px) rotate(-8deg) scale(.75)`, opacity: 1, offset: .55 },
      { transform: `translate(${dx}px,${dy}px) rotate(9deg) scale(.22)`, opacity: 0 }
    ], { duration: 470, easing: "cubic-bezier(.22,.67,.3,1)", fill: "forwards" });
    animation.finished.catch(() => {}).finally(() => {
      clone.remove();
      void window.MistBattleFX?.play(card, "player");
      const target = document.querySelector((card.type === "attack" || ["shatter", "energy_seal"].includes(Data.effectOf(card))) ? ".lc-battle-boss" : ".lc-battle-player");
      if (target?.animate) target.animate([
        { filter: "brightness(1)" }, { filter: "brightness(1.75)", offset: .4 }, { filter: "brightness(1)" }
      ], { duration: 420, easing: "ease-out" });
    });
  }
  function playHand(index, element) {
    const G = window.LinCardGame;
    const before = G.view();
    const card = before.battle?.player?.hand[index];
    const isSecondTap = before.selectedCard === index;
    const prevLog = before.battle?.log[0];
    const geometry = card ? flightGeometry(element, card) : null;
    if (isSecondTap) void window.MistBattleFX?.unlock();
    G.cardClick(index);
    const after = G.view();
    // 有指定目標的特殊牌，確認目標後才動畫；不能在第一次點選時飛牌。
    if (isSecondTap && card && !after.targetPrompt && after.battle?.log[0] !== prevLog) cardFlight(element, card, geometry);
  }
  function confirmTarget(id) {
    const G = window.LinCardGame;
    const before = G.view();
    const card = before.battle?.player?.hand[before.targetPrompt?.index];
    const source = document.querySelector('.lc-battle-hand .lc-card.is-selected');
    const log = before.battle?.log[0];
    const geometry = card ? flightGeometry(source, card) : null;
    void window.MistBattleFX?.unlock();
    G.playTarget(id);
    if (card && G.view().battle?.log[0] !== log) cardFlight(source, card, geometry);
  }
  // Boss 的規則逐張結算，卡面逐張飛出，命中後再更新戰場 HUD。
  // 避免把最終結果提前畫出來，也避免一口氣閃三次或重複觸發回合。
  function previewBossAction(action) {
    if (!action?.after) return;
    const state = action.after;
    const text = (selector, value) => {
      const el = document.querySelector(selector);
      if (el) el.textContent = String(value);
    };
    for (const side of ["boss", "player"]) {
      const who = state[side];
      const base = side === "boss" ? ".lc-battle-boss" : ".lc-battle-player";
      text(`${base} .lc-health-line strong`, `${who.hp} / ${who.maxHP}`);
      const bar = document.querySelector(`${base} .lc-health > span`);
      if (bar) bar.style.width = `${pct(who.hp, who.maxHP)}%`;
    }
    const energyAndMana = document.querySelectorAll(".lc-battle-resources .lc-resource-energy strong");
    if (energyAndMana[0]) energyAndMana[0].textContent = state.player.energy;
    if (energyAndMana[1]) energyAndMana[1].textContent = state.player.mana;
    const tags = document.querySelector(".lc-boss-tags");
    if (tags) {
      tags.innerHTML = `<span>❖ 護盾 ${state.boss.shield}</span><span>♧ 防禦 ${state.boss.guard}</span><span>✧ 行動 ${state.boss.energy}</span><span>✺ 魔法 ${state.boss.mana}</span>${state.boss.buff ? `<span>✦ 共鳴 +${state.boss.buff}</span>` : ""}${state.boss.pierceNext ? `<span>⌁ 穿盾待發</span>` : ""}`;
    }
    text(".lc-boss-report", action.description);
    text(".lc-battle-boss .lc-boss-card-count strong", state.boss.drawPile.length + state.boss.hand.length);
  }

  let bossAnimating = false;
  async function bossTurn() {
    if (bossAnimating) return;
    const G = window.LinCardGame;
    if (G.view().save.phase !== "battle") return;
    bossAnimating = true;
    // 由真實點擊事件啟動音訊；Chrome / Android 不允許程式自行自動播放。
    void window.MistBattleFX?.unlock();
    const started = G.startBossTurn();
    if (!started) { bossAnimating = false; return; }
    const roundTag = document.querySelector(".lc-battle-turn small");
    if (roundTag) roundTag.textContent = "對手回合";
    const limit = G.view().battle?.stage <= 3 ? 1 : G.view().battle?.stage <= 7 ? 2 : 3;
    let count = 0;
    try {
      while (count < limit) {
        const action = G.nextBossCard();
        if (!action) break;
        count++;
        const impact = () => window.MistBattleFX?.play(action.card, "boss");
        try {
          if (window.MistBossCardAnimation?.play) {
            await window.MistBossCardAnimation.play(action.card, cardMarkup(action.card), {
              countLabel: `${count}/${limit}`,
              onImpact: impact
            });
          } else await impact();
        } catch (error) {
          console.warn("Boss 卡牌動畫失敗，仍繼續結算其他合法卡牌。", error);
          await impact();
        }
        previewBossAction(action);
        if (action.after.outcome) break;
      }
    } catch (error) {
      console.error("Boss 回合出牌出現問題；仍會結束回合以避免畫面卡住。", error);
    } finally {
      G.finishBossTurn();
      bossAnimating = false;
      render();
    }
  }
  root?.addEventListener("click", event => {
    const button = event.target.closest("[data-act]");
    if (!button || button.disabled || bossAnimating) return;
    const G = window.LinCardGame;
    const act = button.dataset.act;
    const id = button.dataset.id;
    const slot = Number(button.dataset.slot);
    const open = dest => openScreen(dest);
    const map = {
      "open-home": () => open("home"), "open-levels": () => open("levels"), "open-profile": () => open("profile"),
      "focus-home": () => focusHome(button.dataset.dest),
      "focus-section": () => focusSection(button.dataset.area, button.dataset.dest),
      "back-section": () => backSection(button.dataset.area),
      "enter-stage": () => open("game"),
      "open-prologue": () => { trialSection = "prologue"; render(); scrollToTop(); },
      "open-epilogue": () => {
        if (G.view().save.completed < 10) return;
        const url = "./story/index.html?entry=epilogue&return=challenge";
        if (window.SlowlyNavigation?.go) window.SlowlyNavigation.go(url);
        else window.location.assign(url);
      },
      "back-prologue": () => { trialSection = "challenge"; render(); scrollToTop(); },
      "restart-journey": () => { if (G.newGame()) { openDetails.choose = null; openDetails.deck = null; open("game"); } },
      "activate-preset": () => G.activateDeck(slot),
      "edit-preset": () => { if (G.view().save.phase !== "deck") return; profileSection = "editor"; if (!G.activateDeck(slot)) profileSection = "decks"; scrollToTop(); },
      "tree-category": () => {
        const mode = button.dataset.mode;
        if (!treeStates[mode]) return;
        treeStates[mode].toggleExpanded(button.dataset.type);
        openDetails[mode] = null;
        render();
      },
      choose: () => G.pickInitial(id), "choose-plus": () => G.addInitialCopy(id), "choose-minus": () => G.removeInitialCopy(id),
      "choose-variants": () => { openDetails.choose = openDetails.choose === button.dataset.key ? null : button.dataset.key; render(); },
      "confirm-initial": G.confirmInitial,
      retreat: backToChallenge,
      deck: () => G.toggleDeck(id), "deck-plus": () => G.addDeckCopy(id), "deck-minus": () => G.removeDeckCopy(id),
      "deck-variants": () => { openDetails.deck = openDetails.deck === button.dataset.key ? null : button.dataset.key; render(); },
      "select-all": G.selectAllDeck,
      start: G.beginBattle, hand: () => playHand(Number(button.dataset.index), button),
      "close-target": G.closeTarget, target: () => confirmTarget(id),
      "end-turn": bossTurn, "toggle-battle-sound": () => { window.MistBattleFX?.setEnabled(!window.MistBattleFX.enabled); render(); }, "toggle-battle-vibration": () => { window.MistBattleHaptics?.setEnabled(!window.MistBattleHaptics.enabled); render(); }, "opening-exchange": G.openingExchange, discard: G.freeDiscard, concede: G.concede,
      retry: G.retry, reward: () => G.chooseReward(button.dataset.mode),
      "choose-replace": () => { replacingRewardCardId = G.currentReward()?.id || null; render(); },
      "keep-reward": () => { replacingRewardCardId = null; G.acceptReward(); },
      "reject-reward": () => { replacingRewardCardId = null; G.rejectReward(); },
      replace: () => { replacingRewardCardId = null; G.acceptReward(id); }
    };
    map[act]?.();
  });
  document.querySelector(".lc-page-home-link")?.addEventListener("click", () => {
    if (screen === "profile" || screen === "levels") openScreen("home");
  });
  document.querySelector(".lc-stage-home-link")?.addEventListener("click", backToChallenge);
  root?.addEventListener("change", event => {
    const select = event.target.closest("select[data-branch-id]");
    if (select) window.LinCardGame.changeBranch(select.dataset.branchId, select.value);
  });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    if (window.LinCardGame?.view().targetPrompt) window.LinCardGame.closeTarget();
    else if (screen === "profile" && profileSection) backSection("profile");
    else if (screen === "levels" && levelsSection) backSection("levels");
  });
  function paintForest() {
    try {
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      window.SlowlyPineForest?.create?.({ canvas: "#lin-forest", seed: 19, density: .72, maxDpr: 1.4,
        layers: [
          { baseline: .78, minHeight: .17, maxHeight: .35, color: "#234337", width: .42 },
          { baseline: .98, minHeight: .30, maxHeight: .51, color: "#091e1b", width: .45 }
        ] });
      window.SlowlyCanvasFog?.create?.({ canvas: "#lin-fog", count: reduced ? 8 : 17,
        color: "#9dc2b2", opacity: .34, size: 1.1, speed: reduced ? 0 : .28, maxDpr: 1.4, autoStart: !reduced });
    } catch (error) { console.warn("霧林之契：軍火庫背景效果不可用，使用 CSS 森林背景。", error); }
  }
  // 主選單藝術標題讀取失敗時，恢復原本的可閱讀文字標題。
  document.querySelector(".lc-title-art")?.addEventListener("error", () => {
    document.querySelector(".lc-intro")?.classList.add("is-art-missing");
  });
  // SVG 載入失敗時顯示等大文字，避免手機看到空白標語。
  document.querySelector(".lc-motto-art")?.addEventListener("error", () => {
    document.querySelector(".lc-footer-motto")?.classList.add("is-motto-missing");
  });
  // 開場頁先隱藏遊戲區；等玩家真正進場、Canvas 有尺寸時才啟動軍火庫森林與霧。
  window.addEventListener("mistforest:enter", paintForest, { once: true });
  window.LinCardUI = Object.freeze({ render });
  if (document.readyState !== "loading") render();
})();
