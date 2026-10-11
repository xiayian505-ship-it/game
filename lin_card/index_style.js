/** lin_card｜宿主 UI：頁面、卡面與互動呈現，不在此計算戰鬥結果。 */
(() => {
  "use strict";
  const Data = window.LinCardData;
  const root = document.getElementById("app");
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const pct = (a, b) => Math.max(0, Math.min(100, (100 * a) / (b || 1)));
  const names = { classic1: "經典接龍・翻 1 張", classic3: "經典接龍・翻 3 張", spider1: "連環新接龍・初階", freecell: "新接龍", spider2: "連環新接龍・中階" };

  // 手牌沿用《鹿雨森》Demo 的重疊扇形邏輯；每張牌依位置計算傾斜角。
  function fanHandMarkup(cards, selectedIndex, energy) {
    if (!cards.length) return `<p class="lc-empty">手牌已空。若抽牌堆尚有牌，可結束回合後補牌。</p>`;
    return cards.map((c, i) => {
      const mid = (cards.length - 1) / 2;
      const angle = (i - mid) * (cards.length <= 4 ? 4.6 : 15 / (cards.length - 1));
      const rise = Math.round(Math.abs(i - mid) * 5);
      return cardMarkup(c, { action: "hand", index: i, selected: i === selectedIndex,
        unpayable: Data.cost(c) > energy, angle, rise });
    }).join("");
  }

  function cardMarkup(card, opts = {}) {
    const action = opts.action || "";
    const level = card.type === "special" ? "固定效果" : `Lv.${card.level}`;
    const cost = Data.cost(card);
    const selected = !!opts.selected;
    const unpayable = !!opts.unpayable;
    const inner = `<span class="lc-card-head"><span class="lc-family">${esc(Data.LABELS[card.type])}</span><span class="lc-cost" title="行動點費用">✧ ${cost}</span></span>
      <span class="lc-card-symbol" aria-hidden="true">${esc(Data.SYMBOLS[card.type])}</span>
      <span class="lc-card-name">${esc(card.name)}</span>
      <span class="lc-card-description">${esc(Data.describe(card))}</span>
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
    return `${headline(v.save, "01 / THE FIRST DIVISION", "初始選牌", "攻擊牌 5 張直接配發；其餘五類各五張共 25 張，請選 10 張。沒選的 15 張歸 Boss。")}
      <div class="lc-starter-note">✦ 已保留你的 5 張專屬攻擊牌：${v.save.starter.map(c => esc(c.name)).join("、")}</div>
      <div class="lc-count-line"><strong>${v.chosenInitial.size} / 10</strong><span>從 25 張非攻擊牌中自選 10 張</span></div>
      <div class="lc-card-grid">${cards.map(c => cardMarkup(c, { action: "choose", selected: v.chosenInitial.has(c.id) })).join("")}</div>
      <div class="lc-sticky-actions"><p>注意：選剩的卡牌會加入 Boss 原有 72 張牌庫。</p><button class="lc-primary" data-act="confirm-initial" ${v.chosenInitial.size !== 10 ? "disabled" : ""}>領取 5 張攻擊＋10 張自選，開始遊戲 →</button></div>`;
  }
  function deckView(v) {
    const save = v.save;
    const stage = save.stage;
    return `${headline(save, `02 / CHAPTER ${String(stage).padStart(2, "0")}`, `第 ${stage} 關｜${Data.CHAPTERS[stage - 1]}`, "同一個人，換了十個名字。選擇本場出戰牌組，最多三十張。")}
      <div class="lc-status-grid">
        <div><span>你的生命</span><strong>${Data.HEALTH[stage - 1]}</strong></div>
        <div><span>Boss 生命</span><strong>${Data.HEALTH[stage - 1] / 2}</strong></div>
        <div><span>永久收藏</span><strong>${save.player.length} / 60</strong></div>
        <div><span>Boss 牌庫</span><strong>${save.boss.length} 張</strong></div>
      </div>
      <div class="lc-count-line"><strong>已帶 ${v.chosenDeck.size} / 30 張</strong><button class="lc-quiet" data-act="select-all">快速選前 30 張</button></div>
      <div class="lc-card-grid">${save.player.map(c => `<div class="lc-deck-item">${cardMarkup(c, { action: "deck", selected: v.chosenDeck.has(c.id) })}
        ${c.level > 0 && c.type !== "special" ? `<label class="lc-branch-label">戰術分支 <select data-branch-id="${esc(c.id)}">${Data.BRANCHES[c.type].map(b => `<option value="${esc(b)}" ${c.branch === b ? "selected" : ""}>${esc(b)}</option>`).join("")}</select></label>` : ""}</div>`).join("")}</div>
      <div class="lc-sticky-actions"><p>每場生命及行動點補滿；牌的等級和 Boss 收到的棄牌則永久保留。</p><button class="lc-primary" data-act="start" ${v.chosenDeck.size === 0 || !v.hasLibrary ? "disabled" : ""}>帶 ${v.chosenDeck.size} 張牌出戰 →</button></div>
      ${v.hasLibrary ? "" : `<p class="lc-error">軍火庫 Deck 尚未載入。必須連上網路才能開戰；請確認 HTTPS 引用可用。</p>`}`;
  }
  function healthMeter(side, isBoss = false) {
    return `<div class="lc-hud-hp"><div class="lc-health-line"><span>生命 HP</span><strong>${side.hp} / ${side.maxHP}</strong></div>
      <div class="lc-health"><span style="width:${pct(side.hp, side.maxHP)}%"></span></div></div>`;
  }
  function bossFigure() {
    // CSS 程式美術沿用 Demo「霧影」的舞台形式，獨立宿主不帶鹿雨森標誌。
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
    return `${headline(v.save, `03 / BATTLE · ROUND ${b.round}`, `第 ${v.save.stage} 關｜${Data.CHAPTERS[v.save.stage - 1]}`, "沿用《鹿雨森》Demo 戰場：霧影在上，扇形手牌在下。點兩次出牌。")} 
      <div class="lc-battle-board" aria-label="林間卡牌戰鬥舞台">
        <div class="lc-battle-turn"><strong>ROUND ${String(b.round).padStart(2, "0")}</strong><span>✦</span><small>YOUR TURN · 玩家回合</small></div>
        <section class="lc-battle-boss" aria-label="Boss 狀態">
          ${bossFigure()}
          <div class="lc-boss-name">${esc(Data.CHAPTERS[v.save.stage - 1])}</div>
          <div class="lc-boss-tags"><span>❖ 護盾 ${b.boss.shield}</span><span>♧ 防禦 ${b.boss.guard}</span><span>✧ 行動 ${b.boss.energy}</span></div>
          ${healthMeter(b.boss, true)}
          <p class="lc-boss-report" aria-live="polite">${esc(bossAction)}</p>
        </section>
        <section class="lc-battle-hand-zone" aria-label="玩家手牌">
          <div class="lc-hand-title">YOUR HAND <span>·</span> 手中之牌</div>
          <p class="lc-selection-hint">${v.selectedCard === null ? "點一下選牌，再點同一張出牌" : `已選取「${esc(hand[v.selectedCard]?.name || "卡牌")}」 · 再點一次出牌`}</p>
          <div class="lc-battle-hand">${fanHandMarkup(hand, v.selectedCard, b.player.energy)}</div>
        </section>
        <section class="lc-battle-player" aria-label="玩家狀態">
          <div class="lc-player-emblem" aria-hidden="true">✧</div>
          <div class="lc-player-name">森林旅人</div>
          ${healthMeter(b.player)}
        </section>
        <div class="lc-battle-actions"><button class="lc-primary" data-act="end-turn">結束回合 <span aria-hidden="true">→</span></button><button class="lc-surrender" data-act="concede" type="button" title="認輸本場戰鬥，保留永久進度">敗北／認輸</button></div>
        <div class="lc-battle-resources">
          <div class="lc-resource-energy"><span>✧ 行動點</span><strong>${b.player.energy}</strong></div>
          <span>♧ 防禦 ${b.player.guard}</span><span>❖ 護盾 ${b.player.shield}</span>
          <span>抽牌 ${b.player.drawPile.length} · 棄牌 ${b.player.discardPile.length}</span>
          <button class="lc-quiet lc-battle-discard" data-act="discard" ${v.selectedCard === null || b.freeDiscardUsed ? "disabled" : ""} title="本回合可免費整理一張">整理選中手牌</button>
        </div>
        <p class="lc-battle-status">牌庫不會自動洗回 · 行動點只在新的一場戰鬥開始時重置</p>
      </div>
      <details class="lc-log"><summary>戰鬥紀錄 <span>最近 ${Math.min(12, b.log.length)} 則</span></summary><ol>${b.log.slice(0, 12).map(x => `<li>${esc(x)}</li>`).join("")}</ol></details>
      ${v.targetPrompt ? targetView(v.targetPrompt) : ""}`;
  }
  function targetView(prompt) {
    return `<div class="lc-overlay" role="dialog" aria-modal="true" aria-label="卡牌目標"><div class="lc-dialog"><div class="lc-dialog-head"><h3>${esc(prompt.label)}</h3><button class="lc-close" type="button" data-act="close-target">✕</button></div>
    <div class="lc-dialog-cards">${prompt.cards.map(c => cardMarkup(c, { action: "target" })).join("")}</div><p class="lc-dialog-note">手牌交換只影響本場戰鬥，不會改變永久收藏歸屬。</p></div></div>`;
  }
  function rewardView(v) {
    const pending = v.save.pendingReward;
    if (!pending) return `<p class="lc-error">獎勵狀態有誤，請重新整理。</p>`;
    const current = window.LinCardGame.currentReward();
    if (!pending.mode) {
      const info = [
        ["classic1", "經典接龍・翻 1 張", "獲得 1 張新卡"],
        ["classic3", "經典接龍・翻 3 張", "整副出戰牌組升 1 級"],
        ["spider1", "連環新接龍・初階", "獲得 2 張新卡"],
        ["freecell", "新接龍", "獲得 3 張新卡"],
        ["spider2", "連環新接龍・中階", "獲得 4 張新卡"]
      ];
      return `${headline(v.save, "04 / VICTORY · REWARD", "戰後試煉", "挑選一種戰後獎勵，立即領取；這款小遊戲不用另外通關接龍。")}
        <div class="lc-reward-grid">${info.map(([key, title, value]) => `<button class="lc-reward-choice" data-act="reward" data-mode="${key}"><span>選擇獎勵</span><strong>${esc(title)}</strong><small>${esc(value)}</small><b>領取獎勵 →</b></button>`).join("")}</div>`;
    }
    const full = v.save.player.length >= 60;
    return `${headline(v.save, "04 / REWARD ALLOCATION", `${esc(names[pending.mode])}｜獎勵 ${pending.cursor + 1} / ${pending.queue.length}`, "保留新卡、捨棄舊卡，或直接放棄新卡；被永久捨棄的牌都會加入 Boss。")}
      <div class="lc-reward-card">${current ? cardMarkup(current) : ""}</div>
      <div class="lc-status-grid"><div><span>玩家收藏</span><strong>${v.save.player.length} / 60</strong></div><div><span>Boss 收藏</span><strong>${v.save.boss.length} 張</strong></div></div>
      <div class="lc-reward-actions">${!full ? `<button class="lc-primary" data-act="keep-reward">保留新卡 ✓</button>` : ""}<button class="lc-secondary" data-act="reject-reward">放棄新卡 → 交給 Boss</button></div>
      ${full ? `<h3 class="lc-replace-heading">收藏已滿：請選一張舊卡替換</h3><div class="lc-card-grid">${v.save.player.map(c => `<div class="lc-deck-item">${cardMarkup(c)}<button class="lc-replace-button" data-act="replace" data-id="${esc(c.id)}">換掉此牌 → Boss</button></div>`).join("")}</div>` : ""}`;
  }
  function defeatView(v) {
    return `${headline(v.save, "DEFEAT / THE FOREST REMEMBERS", `第 ${v.save.stage} 關・戰敗`, "已獲得的卡牌、等級、關卡進度與 Boss 永久收藏全部保留。")}
      <div class="lc-finish-icon">☾</div><p class="lc-finish-text">你可以從當前關卡重新挑戰，不必重打之前的關卡。</p>
      <div class="lc-actions-center"><button class="lc-primary" data-act="retry">重試第 ${v.save.stage} 關 →</button><button disabled class="lc-secondary" title="尚未開放">復活｜Spider 高階試煉 · 尚未開放</button></div>`;
  }
  function completeView(v) {
    return `${headline(v.save, "THE END / TEN CHAPTERS", "十關試煉通關", "你擊敗了同一位對手的十個稱號。那些被捨棄的牌，都成了這場旅程的一部分。")}
      <div class="lc-finish-icon">✧</div><div class="lc-status-grid"><div><span>完成關卡</span><strong>10 / 10</strong></div><div><span>最後玩家收藏</span><strong>${v.save.player.length} 張</strong></div><div><span>Boss 最終牌庫</span><strong>${v.save.boss.length} 張</strong></div></div><p class="lc-finish-text">要重新體驗不同的 30 選 15，可以按上方「重新開始」。</p>`;
  }
  function render() {
    if (!root || !window.LinCardGame) return;
    const v = window.LinCardGame.view();
    const view = {
      choose: chooseView, deck: deckView, battle: battleView,
      reward: rewardView, defeat: defeatView, complete: completeView
    }[v.save.phase] || deckView;
    document.getElementById("progress").innerHTML = stageIndicator(v.save);
    document.getElementById("chapter-count").textContent = `${v.save.completed} / 10`;
    document.getElementById("boss-count").textContent = String(v.save.boss.length);
    document.getElementById("status-message").textContent = v.notice || "卡牌牌庫不會自動洗回；行動點每場重置，但回合不重置。";
    root.innerHTML = view(v);
  }
  function flightGeometry(source, card) {
    const destination = document.querySelector(card?.type === "attack" ? ".lc-battle-boss .lc-foe" : ".lc-battle-player");
    return source && destination ? { from: source.getBoundingClientRect(), to: destination.getBoundingClientRect() } : null;
  }
  function cardFlight(source, card, geometry) {
    if (!source || !geometry || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
    if (!source.animate) return;
    const a = geometry.from;
    const b = geometry.to;
    if (!a.width || !b.width) return;
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
      const target = document.querySelector(card.type === "attack" ? ".lc-battle-boss" : ".lc-battle-player");
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
    G.playTarget(id);
    if (card && G.view().battle?.log[0] !== log) cardFlight(source, card, geometry);
  }
  function bossTurn() {
    const G = window.LinCardGame;
    const before = G.view();
    G.endTurn();
    const after = G.view();
    const changed = before.battle?.log[0] !== after.battle?.log[0];
    const foe = document.querySelector('.lc-battle-boss .lc-foe');
    if (changed && foe?.animate && !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      foe.animate([
        { transform: 'translateY(0) scale(1)', filter: 'brightness(1)' },
        { transform: 'translateY(-9px) scale(1.065)', filter: 'brightness(1.6)', offset: .5 },
        { transform: 'translateY(0) scale(1)', filter: 'brightness(1)' }
      ], { duration: 600, easing: 'ease-in-out' });
    }
  }
  root?.addEventListener("click", event => {
    const button = event.target.closest("[data-act]");
    if (!button || button.disabled) return;
    const G = window.LinCardGame;
    const act = button.dataset.act;
    const id = button.dataset.id;
    const map = {
      choose: () => G.pickInitial(id), "confirm-initial": G.confirmInitial,
      deck: () => G.toggleDeck(id), "select-all": G.selectAllDeck,
      start: G.beginBattle, hand: () => playHand(Number(button.dataset.index), button),
      "close-target": G.closeTarget, target: () => confirmTarget(id),
      "end-turn": bossTurn, discard: G.freeDiscard, concede: G.concede,
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
  document.getElementById("reset-progress")?.addEventListener("click", () => window.LinCardGame.newGame());
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
    } catch (error) { console.warn("lin_card：軍火庫背景效果不可用，使用 CSS 森林背景。", error); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", paintForest, { once: true });
  else paintForest();
  window.LinCardUI = Object.freeze({ render });
  if (document.readyState !== "loading") render();
})();
