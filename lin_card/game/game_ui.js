/** 霧林之契｜宿主 UI：頁面、卡面與互動呈現，不在此計算戰鬥結果。 */
(() => {
  "use strict";
  const Data = window.LinCardData;
  const root = document.getElementById("app");
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const pct = (a, b) => Math.max(0, Math.min(100, (100 * a) / (b || 1)));
  const names = {
    card1: "額外獲得 1 張新卡", deck_up: "出戰牌組升 1 級",
    card4: "額外獲得 4 張新卡", collection_up: "永久收藏升 1 級",
    // 兼容 v0.7.2 已選完、尚未領取的舊式存檔，不重新發獎。
    classic1: "舊版獎勵｜新卡 1 張", classic3: "舊版獎勵｜出戰牌升級",
    spider1: "舊版獎勵｜新卡 2 張", freecell: "舊版獎勵｜新卡 3 張", spider2: "舊版獎勵｜新卡 4 張"
  };


  // 軍火庫 Tree Selection 專管展開狀態；卡牌資料、畫面樣式與點擊行為由宿主處理。
  // 選牌與初始選牌分開紀錄畫面狀態，不修改 localStorage 或既有選牌演算。
  const treeStates = {
    choose: window.TreeSelection?.create?.({ expansion: "single" }) || null,
    deck: window.TreeSelection?.create?.({ expansion: "single" }) || null
  };
  const openDetails = { choose: null, deck: null };

  function treeCardDetail(card, mode, chosen) {
    const isChosen = chosen.has(card.id);
    const maximum = mode === "choose" ? 25 : 30;
    const canAdd = isChosen || chosen.size < maximum;
    const resource = Data.resource(card);
    const costText = card.name === "同命之契" ? "耗盡當下雙資源" : resource === "none" ? "免費" : `${resource === "mana" ? "魔法點" : "行動點"} ${Data.cost(card)}`;
    const levelText = Data.LEVEL_TYPES.includes(card.type) ? `Lv.${card.level}` : "固定效果";
    const branches = mode === "deck" && card.level > 0 && Data.BRANCHES[card.type]
      ? `<label class="lc-tree-branch">戰術分支 <select data-branch-id="${esc(card.id)}">${Data.BRANCHES[card.type].map(branch => `<option value="${esc(branch)}" ${card.branch === branch ? "selected" : ""}>${esc(branch)}</option>`).join("")}</select></label>`
      : "";
    return `<div id="lc-tree-detail-${esc(mode)}-${esc(card.id)}" class="lc-tree-detail">
      <div class="lc-tree-detail-heading"><strong>${esc(card.name)}</strong><span>${esc(Data.LABELS[card.type])}牌 · ${levelText}</span></div>
      <p class="lc-tree-detail-cost">${esc(costText)}</p>
      <p class="lc-tree-detail-effect">${esc(Data.describe(card))}</p>
      ${branches}
      <button type="button" class="${isChosen ? "lc-secondary" : "lc-primary"} lc-tree-pick" data-act="${mode === "choose" ? "choose" : "deck"}" data-id="${esc(card.id)}" ${canAdd ? "" : "disabled"}>${isChosen ? (mode === "choose" ? "取消選擇" : "移出這套牌組") : (mode === "choose" ? "選擇這張卡" : "加入這套牌組")}</button>
      ${canAdd ? "" : `<p class="lc-tree-full">已選滿 ${maximum} 張，請先移除其他卡牌。</p>`}
    </div>`;
  }

  function selectionTree(cards, mode, chosen) {
    const tree = treeStates[mode];
    if (!tree) return `<p class="lc-error">軍火庫 Tree Selection 尚未載入。請確認網路連線後重新整理，避免無法展開卡牌分類。</p>`;
    const groups = mode === "choose" ? Data.TYPES.filter(type => cards.some(card => card.type === type)) : Data.TYPES;
    return `<div class="lc-selection-tree" aria-label="依卡牌類型選牌">${groups.map(type => {
      const members = cards.filter(card => card.type === type);
      const expanded = tree.isExpanded(type);
      const selectedCount = members.filter(card => chosen.has(card.id)).length;
      const groupId = `lc-tree-${mode}-${type}`;
      return `<section class="lc-tree-group ${expanded ? "is-expanded" : ""}">
        <button type="button" class="lc-tree-heading" data-act="tree-category" data-mode="${mode}" data-type="${type}" aria-expanded="${expanded}" aria-controls="${groupId}">
          <span class="lc-tree-heading-label"><span class="lc-tree-symbol" aria-hidden="true">${esc(Data.SYMBOLS[type])}</span>${esc(Data.LABELS[type])}牌</span>
          <span class="lc-tree-heading-count">已選 ${selectedCount} / ${members.length}</span><span class="lc-tree-chevron" aria-hidden="true">${expanded ? "⌄" : "›"}</span>
        </button>
        ${expanded ? `<div class="lc-tree-items" id="${groupId}">${members.length ? members.map(card => {
          const detailOpen = openDetails[mode] === card.id;
          const selected = chosen.has(card.id);
          return `<div class="lc-tree-item ${selected ? "is-picked" : ""}">
            <button type="button" class="lc-tree-card-name" data-act="tree-detail" data-mode="${mode}" data-id="${esc(card.id)}" aria-expanded="${detailOpen}" aria-controls="lc-tree-detail-${mode}-${esc(card.id)}">
              <span>${esc(card.name)}${selected ? `<span class="lc-tree-selected" title="已選取" aria-label="已選取"> ✓</span>` : ""}</span><span class="lc-tree-more">${detailOpen ? "收起 ↑" : "詳細 ↓"}</span>
            </button>
            ${detailOpen ? treeCardDetail(card, mode, chosen) : ""}
          </div>`;
        }).join("") : `<p class="lc-tree-empty">目前沒有此類卡牌。</p>`}</div>` : ""}
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
        unpayable: (Data.resource(c) === "mana" ? Data.cost(c) > mana : Data.cost(c) > energy) || (c.type === "special" && Data.SPECIALS[c.name]?.key === "sacrifice" && energy + mana === 0) || (c.name === "裂盾" && foeShield === 0), buff, angle, rise });
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
    const costLabel = card.name === "同命之契" ? "雙歸零" : resource === "none" ? "免費" : `${resource === "mana" ? "✺" : "✧"} ${cost}`;
    const costTitle = resource === "mana" ? "魔法點費用" : resource === "energy" ? "行動點費用" : "不需預付點數";
    const inner = `<span class="lc-card-head"><span class="lc-family">${esc(Data.LABELS[card.type])}</span><span class="lc-cost" title="${costTitle}">${costLabel}</span></span>
      <span class="lc-card-symbol" aria-hidden="true">${esc(Data.SYMBOLS[card.type])}</span>
      <span class="lc-card-name">${esc(card.name)}</span>
      <span class="lc-card-description">${esc(Data.describe(card, opts.buff || 0))}</span>
      <span class="lc-card-foot"><span>${level}</span><span>${card.branch && card.branch !== "標準" ? esc(card.branch) : "✦"}</span></span>`;
    const style = Number.isFinite(opts.angle) ? ` style="--fan-tilt:${opts.angle.toFixed(2)}deg;--fan-rise:${opts.rise || 0}px"` : "";
    const attr = action ? ` type="button" data-act="${esc(action)}" data-id="${esc(card.id)}" ${Number.isInteger(opts.index) ? `data-index="${opts.index}"` : ""}${style}` : "";
    const cls = `lc-card ${selected ? "is-selected" : ""} ${unpayable ? "is-unpayable" : ""}`;
    return action ? `<button class="${cls}" data-type="${card.type}"${attr} aria-pressed="${selected}">${inner}</button>`
      : `<div class="${cls}" data-type="${card.type}">${inner}</div>`;
  }
  function stageIndicator(save) {
    return `<div class="lc-stages" aria-label="十關進度">${Array.from({ length: 10 }, (_, i) => `<span class="lc-stage ${i < save.completed ? "is-cleared" : i === save.stage - 1 && save.phase !== "complete" ? "is-current" : ""}" title="第 ${i + 1} 關">${i < save.completed ? "✓" : i + 1}</span>`).join("")}</div>`;
  }
  function headline(save, preamble, title, detail) {
    return `<div class="lc-section-heading"><p class="lc-eyebrow">${esc(preamble)}</p><h2>${esc(title)}</h2><p>${esc(detail)}</p></div>`;
  }
  function chooseView(v) {
    const cards = v.save.pool;
    return `${headline(v.save, "01 / THE FIRST DIVISION", "初始選牌", "攻擊牌 5 張直接配發；其餘六類共 40 張候選牌，請自選 25 張。沒選的 15 張歸 Boss。")}
      <div class="lc-starter-note">✦ 已保留你的 5 張專屬攻擊牌：${v.save.starter.map(c => esc(c.name)).join("、")}</div>
      <div class="lc-count-line"><strong>${v.chosenInitial.size} / 25</strong><span>點分類展開 → 點卡名詳細 → 選擇卡牌</span></div>
      ${selectionTree(cards, "choose", v.chosenInitial)}
      <div class="lc-sticky-actions"><p>注意：選剩的卡牌會加入 Boss 原有 105 張牌庫。</p><button class="lc-primary" data-act="confirm-initial" ${v.chosenInitial.size !== 25 ? "disabled" : ""}>領取 5 張攻擊＋25 張自選，開始遊戲 →</button></div>`;
  }
  function deckView(v) {
    const save = v.save;
    const stage = save.stage;
    const deckName = ["一", "二", "三"][save.activeDeckIndex] || "一";
    return `${headline(save, `02 / CHAPTER ${String(stage).padStart(2, "0")}`, `第 ${stage} 關｜${Data.CHAPTERS[stage - 1]}`, `目前編輯牌組${deckName}。從永久收藏自由配置最多 30 張出戰卡牌。`)}
      <div class="lc-status-grid">
        <div><span>你的生命</span><strong>${Data.HEALTH[stage - 1]}</strong></div>
        <div><span>Boss 生命</span><strong>${Data.HEALTH[stage - 1] / 2}</strong></div>
        <div><span>永久收藏</span><strong>${save.player.length} / 80</strong></div>
        <div><span>Boss 牌庫</span><strong>${save.boss.length} 張</strong></div>
      </div>
      <div class="lc-starter-note">✧ 本關玩家初始行動點 ${5 + save.completed}（已通關 ${save.completed} 次）；Boss 仍是 5 點；雙方開場魔法點皆為 5。</div>
      <div class="lc-count-line"><strong>牌組${deckName}：${v.chosenDeck.size} / 30 張</strong><button class="lc-quiet" data-act="select-all">快速選前 30 張</button></div>
      <p class="lc-tree-guide">七大類預設收合，分類互斥；點卡名的「詳細」，才會顯示效果、消耗及加入／移出操作。</p>
      ${selectionTree(save.player, "deck", v.chosenDeck)}
      <div class="lc-sticky-actions"><p>每場生命、行動點與魔法點重新補滿；牌的等級和 Boss 收到的棄牌則永久保留。</p><button class="lc-primary" data-act="start" ${v.chosenDeck.size === 0 || !v.hasLibrary ? "disabled" : ""}>帶 ${v.chosenDeck.size} 張牌出戰 →</button></div>
      ${v.hasLibrary ? "" : `<p class="lc-error">軍火庫 Deck 尚未載入。必須連上網路才能開戰；請確認 HTTPS 引用可用。</p>`}`;
  }
  // 首頁三道霧林路徑互斥聚焦：第一次點選，第二次確認進入。
  // 只是 UI 暫存狀態，不寫入存檔、不干涉遊戲或故事進度。
  let screen = new URL(window.location.href).searchParams.get("view") === "game" ? "game" : "home";
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
  function focusHome(dest) {
    if (screen !== "home" || !homePaths.some(path => path.key === dest)) return;
    if (homeFocus !== dest) {
      homeFocus = dest;
      render();
      return;
    }
    // 回顧入口的選取動畫正常，但故事尚未公開，第二次點擊不導頁。
    if (dest === "story") return;
    screen = dest;
    homeFocus = null;
    render();
    window.scrollTo?.({ top: 0, behavior: "instant" });
  }
  function backHome() { return `<div class="lc-screen-bar"><button class="lc-quiet" type="button" data-act="open-home">← 回到主畫面</button></div>`; }
  function levelsView(v) {
    const save = v.save;
    const stage = save.stage;
    const finished = save.completed >= 10;
    return `${backHome()}${headline(save, "CHAPTER SELECTION", "開始試煉", "已通過的關卡保留紀錄；尚未解鎖的關卡不能提前挑戰。")}
      <div class="lc-chapter-choices">${Data.CHAPTERS.map((name, i) => {
        const number = i + 1;
        const cleared = number <= save.completed;
        const current = !finished && number === stage;
        const label = cleared ? "✓ 已通關" : current ? "開始挑戰 →" : "尚未解鎖";
        return `<button type="button" class="lc-chapter-choice ${cleared ? "is-cleared" : current ? "is-current" : "is-locked"}" data-act="enter-stage" ${current ? "" : "disabled"}>
          <span>CHAPTER ${String(number).padStart(2, "0")}</span><strong>${esc(name)}</strong><small>${label}</small></button>`;
      }).join("")}</div>
      ${finished ? `<div class="lc-actions-center"><button class="lc-primary" data-act="enter-stage">查看通關紀錄 →</button></div>` : ""}`;
  }
  function profileView(v) {
    const save = v.save;
    const busy = save.phase !== "deck";
    const own = new Map(save.player.map(card => [card.id, card]));
    return `${backHome()}${headline(save, "TRAVELER PROFILE", "關於旅人", "三套出戰牌組共用永久收藏，每套最多 30 張；玩家自行選牌。")}
      <div class="lc-profile-stats"><div><small>永久收藏</small><strong>${save.player.length} / 80</strong></div><div><small>已通關</small><strong>${save.completed} / 10</strong></div><div><small>目前關卡</small><strong>${save.stage}</strong></div></div>
      <div class="lc-profile-decks">${save.deckPresets.map((ids, index) => {
        const cards = ids.map(id => own.get(id)).filter(Boolean);
        const active = index === save.activeDeckIndex;
        const summary = cards.length ? cards.slice(0, 6).map(card => esc(card.name)).join("、") + (cards.length > 6 ? `……等 ${cards.length} 張` : "") : "尚未放入卡牌";
        return `<section class="lc-profile-deck ${active ? "is-active" : ""}"><div class="lc-profile-deck-head"><div><small>DECK 0${index + 1}</small><h3>牌組${["一", "二", "三"][index]}</h3></div><span>${cards.length} / 30 張</span></div>
          <p class="lc-profile-deck-preview">${summary}</p>
          <div class="lc-profile-actions"><button class="lc-secondary" type="button" data-act="activate-preset" data-slot="${index}" ${busy || active ? "disabled" : ""}>${active ? "目前使用" : "設為出戰牌組"}</button><button class="lc-primary" type="button" data-act="edit-preset" data-slot="${index}" ${busy ? "disabled" : ""}>編輯牌組 →</button></div></section>`;
      }).join("")}</div>
      <p class="lc-profile-hint">${busy ? "目前正在初始選牌、戰鬥、領獎或結算中。完成目前流程後，即可編輯三套牌組。" : "切換牌組後，從「選擇關卡」進入目前關卡，即可使用所選牌組出戰。"}</p>`;
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
    return `${headline(v.save, `03 / BATTLE · ROUND ${b.round}`, `第 ${v.save.stage} 關｜${Data.CHAPTERS[v.save.stage - 1]}`, "霧影在上，手牌在下。點擊卡牌選取，再點一次出牌；魔法牌消耗魔法點。")} 
      <div class="lc-battle-board" aria-label="霧林之契戰鬥舞台">
        <div class="lc-battle-turn"><strong>ROUND ${String(b.round).padStart(2, "0")}</strong><span>✦</span><small>YOUR TURN · 玩家回合</small><div class="lc-battle-settings"><button class="lc-battle-sound" type="button" data-act="toggle-battle-sound" aria-pressed="${window.MistBattleFX?.enabled !== false}">${window.MistBattleFX?.enabled !== false ? "♫ 音效開" : "♪ 音效關"}</button><button class="lc-battle-sound lc-battle-vibration" type="button" data-act="toggle-battle-vibration" aria-pressed="${window.MistBattleHaptics?.enabled === true}" ${window.MistBattleHaptics?.supported ? "" : "disabled"}>${!window.MistBattleHaptics?.supported ? "震動不支援" : window.MistBattleHaptics?.enabled ? "▰ 震動開" : "▱ 震動關"}</button></div></div>
        <section class="lc-battle-boss" aria-label="Boss 狀態">
          ${bossFigure()}
          <div class="lc-boss-name">${esc(Data.CHAPTERS[v.save.stage - 1])}</div>
          <div class="lc-boss-tags"><span>❖ 護盾 ${b.boss.shield}</span><span>♧ 防禦 ${b.boss.guard}</span><span>✧ 行動 ${b.boss.energy}</span><span>✺ 魔法 ${b.boss.mana}</span>${b.boss.buff ? `<span>✦ 共鳴 +${b.boss.buff}</span>` : ""}${b.boss.pierceNext ? `<span>⌁ 穿盾待發</span>` : ""}</div>
          ${healthMeter(b.boss, true)}
          <p class="lc-boss-card-count" aria-label="Boss 剩餘牌數">剩餘可用 <strong>${b.boss.drawPile.length + b.boss.hand.length}</strong> 張 <span>｜抽牌 ${b.boss.drawPile.length} · 手牌 ${b.boss.hand.length} · 棄牌 ${b.boss.discardPile.length}</span></p>
          <p class="lc-boss-report" aria-live="polite">${esc(bossAction)}</p>
        </section>
        <section class="lc-battle-hand-zone" aria-label="玩家手牌">
          <div class="lc-hand-title">YOUR HAND <span>·</span> 手中之牌</div>
          <p class="lc-selection-hint">${v.selectedCard === null ? "點一下選牌，再點同一張出牌" : `已選取「${esc(hand[v.selectedCard]?.name || "卡牌")}」 · 再點一次出牌`}</p>
          ${b.openingExchangeAvailable && b.player.drawPile.length > 0
            ? `<div class="lc-opening-exchange"><span>回合開始：可以免費棄 1 張、抽 1 張（限一次；出牌或整理後失效）</span><button type="button" class="lc-secondary lc-exchange-button" data-act="opening-exchange" ${v.selectedCard === null ? "disabled" : ""}>換掉選中手牌 ↻</button></div>`
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
          ${b.player.buff ? `<span>✦ 萬木共鳴 +${b.player.buff}（效果 Lv.5 封頂）</span>` : ""}
          ${b.player.pierceNext ? `<span>⌁ 下次攻擊穿盾</span>` : ""}
          <span>♧ 防禦 ${b.player.guard}</span><span>❖ 護盾 ${b.player.shield}</span>
          <span>抽牌 ${b.player.drawPile.length} · 棄牌 ${b.player.discardPile.length}</span>
          <button class="lc-quiet lc-battle-discard" data-act="discard" ${v.selectedCard === null || b.freeDiscardUsed ? "disabled" : ""} title="本回合可免費整理一張">整理選中手牌</button>
        </div>
        <p class="lc-battle-status">牌庫不會自動洗回 · 行動點與魔法點只在新的一場戰鬥開始時重置</p>
      </div>
      <details class="lc-log"><summary>戰鬥紀錄 <span>最近 ${Math.min(12, b.log.length)} 則</span></summary><ol>${b.log.slice(0, 12).map(x => `<li>${esc(x)}</li>`).join("")}</ol></details>
      ${v.targetPrompt ? targetView(v.targetPrompt) : ""}`;
  }
  function targetView(prompt) {
    const cards = prompt.type === "discard" && prompt.piles
      ? prompt.piles.map(pile => `<section class="lc-discard-source"><h4>${esc(pile.label)} <span>${pile.cards.length} 張</span></h4><div class="lc-dialog-cards">${pile.cards.length ? pile.cards.map(c => cardMarkup(c, { action: "target" })).join("") : `<p class="lc-tree-empty">目前沒有棄牌</p>`}</div></section>`).join("")
      : `<div class="lc-dialog-cards">${prompt.cards.map(c => cardMarkup(c, { action: "target" })).join("")}</div>`;
    const note = prompt.type === "discard"
      ? "可以從任一方的棄牌堆取回一張，放進自己的手牌；只影響本場戰鬥，不改變永久收藏。"
      : "手牌交換只影響本場戰鬥，不會改變永久收藏歸屬。";
    return `<div class="lc-overlay" role="dialog" aria-modal="true" aria-label="卡牌目標"><div class="lc-dialog"><div class="lc-dialog-head"><h3>${esc(prompt.label)}</h3><button class="lc-close" type="button" data-act="close-target">✕</button></div>
    ${cards}<p class="lc-dialog-note">${note}</p></div></div>`;
  }
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
      return `${headline(v.save, "04 / VICTORY · REWARD", "戰後試煉", `本關固定獲得攻擊牌 1 張，下一場玩家初始行動點 +1（${5 + v.save.completed} → ${6 + v.save.completed}）。另選一種獎勵；測試期四種皆可直接領取。`)}
        <div class="lc-reward-grid">${info.map(([key, title, value]) => `<button class="lc-reward-choice" data-act="reward" data-mode="${key}"><span>選擇獎勵</span><strong>${esc(title)}</strong><small>${esc(value)}</small><b>領取獎勵 →</b></button>`).join("")}</div>`;
    }
    const full = v.save.player.length >= 80;
    const rewardLabel = names[pending.mode] || "戰後獎勵";
    return `${headline(v.save, "04 / REWARD ALLOCATION", `${esc(rewardLabel)}｜獎勵 ${pending.cursor + 1} / ${pending.queue.length}`, "每次過關固定多一張攻擊牌。保留、替換或放棄都遵循原本的收藏規則；永久棄牌歸 Boss。")}
      ${current?.source === "victory-guarantee" ? `<div class="lc-starter-note">✦ ${"本關固定補給：攻擊牌 +1"}（不佔四選一的額度）</div>` : ""}
      <div class="lc-reward-card">${current ? cardMarkup(current) : ""}</div>
      <div class="lc-status-grid"><div><span>玩家收藏</span><strong>${v.save.player.length} / 80</strong></div><div><span>Boss 收藏</span><strong>${v.save.boss.length} 張</strong></div></div>
      <div class="lc-reward-actions">${!full ? `<button class="lc-primary" data-act="keep-reward">保留新卡 ✓</button>` : ""}<button class="lc-secondary" data-act="reject-reward">放棄新卡 → 交給 Boss</button></div>
      ${full ? `<h3 class="lc-replace-heading">收藏已滿：請選一張舊卡替換</h3><div class="lc-card-grid">${v.save.player.map(c => `<div class="lc-deck-item">${cardMarkup(c)}<button class="lc-replace-button" data-act="replace" data-id="${esc(c.id)}">換掉此牌 → Boss</button></div>`).join("")}</div>` : ""}`;
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
    document.getElementById("progress").hidden = !isGame;
    document.getElementById("game-overview").hidden = screen === "home" || screen === "profile";
    document.getElementById("status-message").hidden = !isGame;
    document.querySelector(".lc-intro")?.classList.toggle("is-compact", screen !== "home");
    document.querySelector(".lc-intro")?.classList.toggle("is-home-art", screen === "home");
    document.getElementById("wf-game")?.classList.toggle("is-home-screen", screen === "home");
    document.getElementById("progress").innerHTML = stageIndicator(v.save);
    document.getElementById("chapter-count").textContent = `${v.save.completed} / 10`;
    document.getElementById("boss-count").textContent = String(v.save.boss.length);
    document.getElementById("status-message").textContent = v.notice || "卡牌牌庫不會自動洗回；行動與魔法點每場重置，但回合不重置。";
    root.classList.toggle("is-home-panel", screen === "home");
    root.innerHTML = (isGame ? backHome() : "") + view(v);
  }
  function flightGeometry(source, card) {
    const destination = document.querySelector((card?.type === "attack" || ["裂盾", "行動封印"].includes(card?.name)) ? ".lc-battle-boss .lc-foe" : ".lc-battle-player");
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
      const target = document.querySelector((card.type === "attack" || ["裂盾", "行動封印"].includes(card.name)) ? ".lc-battle-boss" : ".lc-battle-player");
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
    if (roundTag) roundTag.textContent = "BOSS TURN · 對手回合";
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
    const open = dest => { screen = dest; homeFocus = null; render(); window.scrollTo?.({ top: 0, behavior: "instant" }); };
    const map = {
      "open-home": () => open("home"), "open-levels": () => open("levels"), "open-profile": () => open("profile"),
      "focus-home": () => focusHome(button.dataset.dest),
      "enter-stage": () => open("game"),
      "activate-preset": () => G.activateDeck(slot),
      "edit-preset": () => { if (G.activateDeck(slot)) open("game"); },
      "tree-category": () => {
        const mode = button.dataset.mode;
        if (!treeStates[mode]) return;
        treeStates[mode].toggleExpanded(button.dataset.type);
        openDetails[mode] = null;
        render();
      },
      "tree-detail": () => {
        const mode = button.dataset.mode;
        if (!treeStates[mode]) return;
        openDetails[mode] = openDetails[mode] === id ? null : id;
        render();
      },
      choose: () => G.pickInitial(id), "confirm-initial": G.confirmInitial,
      deck: () => G.toggleDeck(id), "select-all": G.selectAllDeck,
      start: G.beginBattle, hand: () => playHand(Number(button.dataset.index), button),
      "close-target": G.closeTarget, target: () => confirmTarget(id),
      "end-turn": bossTurn, "toggle-battle-sound": () => { window.MistBattleFX?.setEnabled(!window.MistBattleFX.enabled); render(); }, "toggle-battle-vibration": () => { window.MistBattleHaptics?.setEnabled(!window.MistBattleHaptics.enabled); render(); }, "opening-exchange": G.openingExchange, discard: G.freeDiscard, concede: G.concede,
      retry: G.retry, reward: () => G.chooseReward(button.dataset.mode),
      "keep-reward": () => G.acceptReward(), "reject-reward": G.rejectReward,
      replace: () => G.acceptReward(id)
    };
    map[act]?.();
  });
  root?.addEventListener("change", event => {
    const select = event.target.closest("select[data-branch-id]");
    if (select) window.LinCardGame.changeBranch(select.dataset.branchId, select.value);
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && window.LinCardGame?.view().targetPrompt) window.LinCardGame.closeTarget();
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
