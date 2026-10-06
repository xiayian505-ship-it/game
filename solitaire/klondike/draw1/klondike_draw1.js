(() => {
  "use strict";

  const tableauElement = document.getElementById("tableau");
  const stockButton = document.getElementById("stockButton");
  const wasteButton = document.getElementById("wasteButton");
  const completedArea = document.getElementById("completedArea");
  const completedCountElement = document.getElementById("completedCount");
  const stockCountElement = document.getElementById("stockCount");
  const moveCountElement = document.getElementById("moveCount");
  const solvedDealCountElement = document.getElementById("solvedDealCount");
  const noticeElement = document.getElementById("notice");
  const restartButton = document.getElementById("restartButton");
  const currentDealIdentity = document.getElementById("currentDealIdentity");
  const currentDealShortUid = document.getElementById("currentDealShortUid");
  const currentDealBest = document.getElementById("currentDealBest");
  const currentDealBestSteps = document.getElementById("currentDealBestSteps");
  const currentDealClears = document.getElementById("currentDealClears");
  const currentDealClearCount = document.getElementById("currentDealClearCount");
  const copyDealUidButton = document.getElementById("copyDealUidButton");

  const ACTIVE_GAME_STORAGE_KEY = "klondike_draw1_active_game_v1";
  const CARD_PEEK_DELAY_MS = 220;

  const RANK_LABELS = Object.freeze({
    1: "A",
    11: "J",
    12: "Q",
    13: "K"
  });

  const SUITS = Object.freeze(["spade", "heart", "diamond", "club"]);
  const SUIT_SYMBOLS = Object.freeze({
    spade: "♠",
    heart: "♥",
    diamond: "♦",
    club: "♣"
  });
  const SUIT_COLORS = Object.freeze({
    spade: "black",
    club: "black",
    heart: "red",
    diamond: "red"
  });

  const cardPeekState = {
    timerId: 0,
    button: null,
    active: false
  };

  let columns = Array.from({ length: 7 }, () => []);
  let stock = [];
  let waste = [];
  let foundations = createEmptyFoundations();
  let moveCount = 0;
  let selection = null;
  let originalDeal = [];
  let busy = false;
  let hasStartedGame = false;
  let solvedDealCount = 0;
  let currentDealUid = null;
  let currentDealBestValue = null;
  let currentDealClearValue = 0;

  const PIANO_ATTACK_SECONDS = 0.02;
  const PIANO_RELEASE_SECONDS = 0.10;

  const AUTO_COLLECT_NOTES = Object.freeze([
    "C5", "B4", "A4", "G4", "F4", "E4", "D4",
    "C4", "B3", "A3", "G3", "F3", "E3"
  ]);

  function sleep(ms) {
    return new Promise(resolve => window.setTimeout(resolve, Math.max(0, ms)));
  }

  function prefersReducedMotion() {
    return Boolean(
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function playTone({ freq = 440, dur = 0.08, type = "sine", gain = 0.12, slide = 0 } = {}) {
    if (!globalThis.SlowlyAudioTone?.play) return;
    globalThis.SlowlyAudioTone.play({ frequency: freq, duration: dur, type, gain, slide }).catch(error => {
      console.warn("[Klondike Draw 1] 音效播放失敗：", error);
    });
  }

  async function playPianoNotes(noteIds, {
    gain = 0.12,
    hold = 0.055,
    release = PIANO_RELEASE_SECONDS,
    spacing = 0,
    type = "sine"
  } = {}) {
    if (
      !globalThis.SlowlyAudioContext?.resume ||
      !globalThis.SlowlyAudioContext?.get ||
      !globalThis.SlowlyAudioNoteFrequency?.toFrequency ||
      !globalThis.SlowlyAudioOscillator?.create ||
      !globalThis.SlowlyAudioGain?.create ||
      !globalThis.SlowlyAudioEnvelope
    ) return;

    const notes = Array.isArray(noteIds) ? noteIds : [noteIds];
    if (!notes.length) return;

    try {
      await globalThis.SlowlyAudioContext.resume();
      const context = globalThis.SlowlyAudioContext.get();
      if (!context || context.state !== "running") return;
      const baseStart = context.currentTime + 0.005;

      notes.forEach((noteId, index) => {
        const frequency = globalThis.SlowlyAudioNoteFrequency.toFrequency(noteId);
        const oscillator = globalThis.SlowlyAudioOscillator.create(context, { type, frequency });
        const gainNode = globalThis.SlowlyAudioGain.create(context, globalThis.SlowlyAudioEnvelope.floor);
        globalThis.SlowlyAudioOscillator.connect(oscillator, gainNode);
        globalThis.SlowlyAudioGain.connect(gainNode, context.destination);

        const startAt = baseStart + Math.max(0, spacing) * index;
        const releaseAt = startAt + PIANO_ATTACK_SECONDS + Math.max(0, hold);
        const peak = Math.max(globalThis.SlowlyAudioEnvelope.floor, gain * (index === 0 ? 1 : 0.88));

        globalThis.SlowlyAudioEnvelope.attack(gainNode.gain, {
          startAt,
          duration: PIANO_ATTACK_SECONDS,
          from: globalThis.SlowlyAudioEnvelope.floor,
          to: peak,
          curve: "linear"
        });
        globalThis.SlowlyAudioEnvelope.release(gainNode.gain, {
          startAt: releaseAt,
          duration: Math.max(0.04, release),
          from: peak,
          to: globalThis.SlowlyAudioEnvelope.floor,
          curve: "linear"
        });
        globalThis.SlowlyAudioOscillator.start(oscillator, startAt);
        globalThis.SlowlyAudioOscillator.stop(oscillator, releaseAt + Math.max(0.04, release) + 0.02);
      });
    } catch (error) {
      console.warn("[Klondike Draw 1] 鋼琴音效播放失敗：", error);
    }
  }

  function sfxCardSelect() {
    playTone({ freq: 520, dur: 0.06, type: "triangle", gain: 0.10, slide: 0.8 });
  }

  function sfxBad() {
    playTone({ freq: 180, dur: 0.10, type: "sine", gain: 0.05, slide: 0 });
  }

  function sfxMove() {
    void playPianoNotes(["D4", "A4"], {
      gain: 0.09,
      hold: 0.04,
      release: 0.11,
      spacing: 0.055,
      type: "sine"
    });
  }

  function sfxAutoCollectStep(index) {
    const note = AUTO_COLLECT_NOTES[index % AUTO_COLLECT_NOTES.length];
    if (!note) return;
    void playPianoNotes([note], {
      gain: 0.098,
      hold: 0.035,
      release: 0.095,
      spacing: 0,
      type: "sine"
    });
  }

  function createEmptyFoundations() {
    return { spade: [], heart: [], diamond: [], club: [] };
  }

  function assertDependencies() {
    if (!window.Deck?.create) throw new Error("慢慢軍火庫 Deck 載入失敗。");
  }

  function rankLabel(rank) {
    return RANK_LABELS[rank] || String(rank);
  }

  function suitSymbol(suit) {
    return SUIT_SYMBOLS[suit] || "?";
  }

  function cardLabel(card) {
    return `${rankLabel(card.rank)}${suitSymbol(card.suit)}`;
  }

  function setNotice(text) {
    noticeElement.textContent = String(text || "");
  }

  function isValidRank(value) {
    const rank = Number(value);
    return Number.isInteger(rank) && rank >= 1 && rank <= 13;
  }

  function isValidSuit(value) {
    return SUITS.includes(String(value));
  }

  function normalizeCard(card, index = 0, defaultFaceUp = false) {
    if (!card || !isValidRank(card.rank) || !isValidSuit(card.suit)) return null;
    return {
      id: String(card.id || `K1-${card.suit}-${card.rank}-${index}`),
      rank: Number(card.rank),
      suit: String(card.suit),
      faceUp: typeof card.faceUp === "boolean" ? card.faceUp : defaultFaceUp
    };
  }

  function serializeDealCard(card) {
    return { rank: Number(card.rank), suit: String(card.suit) };
  }

  function serializeStateCard(card) {
    return { rank: Number(card.rank), suit: String(card.suit), faceUp: Boolean(card.faceUp) };
  }

  function cloneDeal(deal) {
    if (!Array.isArray(deal)) return [];
    return deal.map((card, index) => normalizeCard(card, index, false)).filter(Boolean);
  }

  function createRandomCards() {
    const cards = [];
    let id = 0;
    for (const suit of SUITS) {
      for (let rank = 1; rank <= 13; rank += 1) {
        cards.push({ id: `K1-${suit}-${rank}-${id++}`, rank, suit, faceUp: false });
      }
    }
    return cards;
  }

  function createDeckForRandomGame() {
    return window.Deck.create({
      items: createRandomCards(),
      recycleDiscard: false,
      shuffleOnReset: true,
      shuffleOnRecycle: false
    });
  }

  function createDeckForKnownDeal(deal) {
    return window.Deck.create({
      items: cloneDeal(deal).reverse(),
      recycleDiscard: false,
      shuffleOnReset: false,
      shuffleOnRecycle: false
    });
  }

  function dealInitialTableau(deck) {
    columns = Array.from({ length: 7 }, () => []);

    for (let row = 0; row < 7; row += 1) {
      for (let columnIndex = row; columnIndex < 7; columnIndex += 1) {
        const [card] = deck.draw(1);
        if (!card) throw new Error("接龍發牌失敗。");
        card.faceUp = false;
        columns[columnIndex].push(card);
      }
    }

    columns.forEach(column => {
      if (column.length) column[column.length - 1].faceUp = true;
    });
  }

  function startGame(options = {}) {
    assertDependencies();

    const knownDeal = Array.isArray(options.deal) && options.deal.length === 52
      ? cloneDeal(options.deal)
      : null;

    if (knownDeal && knownDeal.length !== 52) {
      throw new TypeError("接龍牌局必須是 52 張有效牌。");
    }

    const deck = knownDeal ? createDeckForKnownDeal(knownDeal) : createDeckForRandomGame();

    originalDeal = knownDeal
      ? knownDeal.map(serializeDealCard)
      : deck.snapshot().drawPile.slice().reverse().map(serializeDealCard);

    foundations = createEmptyFoundations();
    waste = [];
    moveCount = 0;
    selection = null;
    busy = false;
    hasStartedGame = true;
    currentDealUid = String(options.uid || "").trim() || null;
    currentDealBestValue = Number.isInteger(Number(options.bestSteps)) && Number(options.bestSteps) > 0 ? Number(options.bestSteps) : null;
    currentDealClearValue = Number.isInteger(Number(options.clearCount)) && Number(options.clearCount) >= 0 ? Number(options.clearCount) : 0;

    dealInitialTableau(deck);

    stock = [];
    while (true) {
      const [card] = deck.draw(1);
      if (!card) break;
      card.faceUp = false;
      stock.unshift(card);
    }

    setNotice("翻牌或移動牌開始。空欄只能放 K。");
    render();
    saveActiveGame();
  }

  function restartCurrentDeal() {
    if (busy || originalDeal.length !== 52) return false;
    startGame({ deal: originalDeal, uid: currentDealUid, bestSteps: currentDealBestValue, clearCount: currentDealClearValue });
    setNotice("已重新開始此局。");
    return true;
  }

  function clearCardPeekTimer() {
    if (!cardPeekState.timerId) return;
    window.clearTimeout(cardPeekState.timerId);
    cardPeekState.timerId = 0;
  }

  function endCardPeek(button, { suppressClick = false } = {}) {
    clearCardPeekTimer();
    if (cardPeekState.button !== button) return;

    if (cardPeekState.active) {
      button.classList.remove("peeking");
      if (suppressClick) button.dataset.peekSuppressClick = "true";
    }

    cardPeekState.button = null;
    cardPeekState.active = false;
  }

  function scheduleCardPeek(button) {
    endCardPeek(cardPeekState.button);
    cardPeekState.button = button;
    cardPeekState.active = false;
    cardPeekState.timerId = window.setTimeout(() => {
      cardPeekState.timerId = 0;
      if (cardPeekState.button !== button || button.classList.contains("face-down")) return;
      cardPeekState.active = true;
      button.classList.add("peeking");
    }, CARD_PEEK_DELAY_MS);
  }

  function render() {
    renderColumns();
    renderStock();
    renderWaste();
    renderFoundations();

    completedCountElement.textContent = String(completedCardCount());
    stockCountElement.textContent = String(stock.length);
    moveCountElement.textContent = String(moveCount);
    solvedDealCountElement.textContent = String(solvedDealCount);
    renderDealIdentity();
    restartButton.disabled = busy || !hasStartedGame || originalDeal.length !== 52;
  }

  function renderDealIdentity() {
    const hasUid = Boolean(currentDealUid);
    currentDealIdentity.hidden = !hasUid;
    copyDealUidButton.disabled = !hasUid;
    if (!hasUid) return;
    currentDealShortUid.textContent = window.KlondikeDraw1Data?.shortUid?.(currentDealUid) || currentDealUid;
    currentDealBest.hidden = !(currentDealBestValue > 0);
    currentDealBestSteps.textContent = currentDealBestValue > 0 ? String(currentDealBestValue) : "—";
    currentDealClears.hidden = !(currentDealClearValue > 0);
    currentDealClearCount.textContent = currentDealClearValue > 0 ? String(currentDealClearValue) : "—";
  }

  function cardOffset(card) {
    return card.faceUp ? 32 : 19;
  }

  function renderColumns() {
    tableauElement.innerHTML = "";

    columns.forEach((cards, columnIndex) => {
      const column = document.createElement("div");
      column.className = `column${cards.length === 0 ? " empty" : ""}`;
      column.dataset.columnIndex = String(columnIndex);
      column.setAttribute("aria-label", `第 ${columnIndex + 1} 欄`);

      let top = 0;
      cards.forEach((card, cardIndex) => {
        const cardElement = createCardElement(card, columnIndex, cardIndex);
        cardElement.style.top = `${top}px`;
        top += cardOffset(card);
        column.appendChild(cardElement);
      });

      column.addEventListener("click", () => {
        if (busy || !selection) return;
        if (!moveSelectionToColumn(columnIndex)) {
          sfxBad();
          setNotice(columns[columnIndex].length === 0 ? "空欄只能放 K。" : "這裡不能放。");
        }
      });

      tableauElement.appendChild(column);
    });
  }

  function createCardElement(card, columnIndex, cardIndex) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `card suit-${card.suit}${card.faceUp ? "" : " face-down"}`;
    button.dataset.cardIndex = String(cardIndex);
    button.setAttribute("aria-label", card.faceUp ? cardLabel(card) : "蓋牌");

    if (
      card.faceUp &&
      selection?.type === "column" &&
      selection.column === columnIndex &&
      cardIndex >= selection.index
    ) {
      button.classList.add("selected");
    }

    const rank = document.createElement("span");
    rank.className = "card-rank";
    rank.textContent = card.faceUp ? rankLabel(card.rank) : "";

    const suit = document.createElement("span");
    suit.className = "card-suit";
    suit.textContent = card.faceUp ? suitSymbol(card.suit) : "";

    button.append(rank, suit);

    if (card.faceUp) {
      button.addEventListener("pointerdown", event => {
        if (busy) return;
        if (event.pointerType === "mouse" && event.button !== 0) return;
        button.dataset.peekSuppressClick = "";
        if (typeof button.setPointerCapture === "function") {
          try { button.setPointerCapture(event.pointerId); } catch {}
        }
        scheduleCardPeek(button);
      });

      button.addEventListener("pointerup", () => endCardPeek(button, { suppressClick: true }));
      button.addEventListener("pointercancel", () => endCardPeek(button));
      button.addEventListener("lostpointercapture", () => endCardPeek(button));
      button.addEventListener("contextmenu", event => {
        if (cardPeekState.active && cardPeekState.button === button) event.preventDefault();
      });
    }

    button.addEventListener("click", event => {
      event.stopPropagation();
      if (button.dataset.peekSuppressClick === "true") {
        button.dataset.peekSuppressClick = "";
        event.preventDefault();
        return;
      }
      if (!busy) handleColumnCardClick(columnIndex, cardIndex);
    });

    button.addEventListener("dblclick", event => {
      event.preventDefault();
      event.stopPropagation();
      if (!busy && card.faceUp) autoMoveColumnTopToFoundation(columnIndex, cardIndex);
    });

    return button;
  }

  function renderStock() {
    stockButton.className = "completed-slot klondike-slot stock-slot";
    stockButton.textContent = "";

    if (stock.length > 0) {
      stockButton.classList.add("has-cards");
      stockButton.setAttribute("aria-label", `牌庫，剩 ${stock.length} 張`);
      return;
    }

    if (waste.length > 0) {
      stockButton.classList.add("recycle-ready");
      stockButton.textContent = "↻";
      stockButton.setAttribute("aria-label", "牌庫已空，點擊收回棄牌區重新翻牌");
      return;
    }

    stockButton.classList.add("empty-stock");
    stockButton.setAttribute("aria-label", "牌庫已空");
  }

  function renderWaste() {
    wasteButton.className = "completed-slot klondike-slot waste-slot";
    const card = waste[waste.length - 1] || null;

    if (!card) {
      wasteButton.textContent = "";
      wasteButton.setAttribute("aria-label", "棄牌區：空");
      return;
    }

    wasteButton.classList.add("occupied", `suit-${card.suit}`);
    if (selection?.type === "waste") wasteButton.classList.add("selected");
    wasteButton.textContent = cardLabel(card);
    wasteButton.setAttribute("aria-label", `棄牌區：${cardLabel(card)}`);
  }

  function renderFoundations() {
    completedArea.innerHTML = "";

    SUITS.forEach(suit => {
      const pile = foundations[suit];
      const topCard = pile[pile.length - 1] || null;
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = `completed-slot foundation-slot suit-${suit}`;
      slot.dataset.foundationSuit = suit;

      if (topCard) {
        slot.classList.add("occupied", "done");
        slot.textContent = cardLabel(topCard);
        slot.setAttribute("aria-label", `${suitSymbol(suit)} 回收區：${cardLabel(topCard)}`);
      } else {
        slot.textContent = suitSymbol(suit);
        slot.setAttribute("aria-label", `${suitSymbol(suit)} 回收區：空`);
      }

      if (selection?.type === "foundation" && selection.suit === suit) {
        slot.classList.add("selected");
      }

      slot.addEventListener("click", () => {
        if (!busy) handleFoundationClick(suit);
      });

      completedArea.appendChild(slot);
    });
  }

  function handleColumnCardClick(columnIndex, cardIndex) {
    const column = columns[columnIndex];
    const card = column[cardIndex];

    if (!card.faceUp) {
      sfxBad();
      setNotice("這張牌還沒翻開。");
      return;
    }

    if (selection) {
      if (
        selection.type === "column" &&
        selection.column === columnIndex &&
        selection.index === cardIndex
      ) {
        selection = null;
        sfxCardSelect();
        setNotice("已取消選取。");
        render();
        return;
      }

      if (!(selection.type === "column" && selection.column === columnIndex)) {
        if (moveSelectionToColumn(columnIndex)) return;
      }
    }

    if (!isMovableRun(column, cardIndex)) {
      selection = null;
      sfxBad();
      setNotice("牌串必須紅黑交錯、由大至小連續排列。");
      render();
      return;
    }

    selection = { type: "column", column: columnIndex, index: cardIndex };
    sfxCardSelect();
    setNotice(column.length - cardIndex > 1 ? `已選取 ${column.length - cardIndex} 張牌。` : `已選取 ${cardLabel(card)}。`);
    render();
  }

  function handleWasteClick() {
    const card = waste[waste.length - 1] || null;
    if (!card) return;

    if (selection?.type === "waste") {
      selection = null;
      sfxCardSelect();
      setNotice("已取消選取。");
      render();
      return;
    }

    selection = { type: "waste" };
    sfxCardSelect();
    setNotice(`已選取 ${cardLabel(card)}。`);
    render();
  }

  function handleFoundationClick(suit) {
    if (selection) {
      if (selection.type === "foundation" && selection.suit === suit) {
        selection = null;
        sfxCardSelect();
        setNotice("已取消選取。");
        render();
        return;
      }

      if (moveSelectionToFoundation(suit)) return;
    }

    const pile = foundations[suit];
    if (!pile.length) {
      sfxBad();
      setNotice("這個回收區目前沒有牌。");
      return;
    }

    selection = { type: "foundation", suit };
    sfxCardSelect();
    setNotice(`已選取 ${cardLabel(pile[pile.length - 1])}。`);
    render();
  }

  function handleStockClick() {
    if (busy) return;
    selection = null;

    if (stock.length > 0) {
      const card = stock.pop();
      card.faceUp = true;
      waste.push(card);
      moveCount += 1;
      sfxMove();
      setNotice(`翻出 ${cardLabel(card)}。`);
      render();
      saveActiveGame();
      return;
    }

    if (waste.length > 0) {
      stock = waste.slice().reverse();
      stock.forEach(card => { card.faceUp = false; });
      waste = [];
      moveCount += 1;
      sfxMove();
      setNotice("已將棄牌區收回牌庫。");
      render();
      saveActiveGame();
      return;
    }

    sfxBad();
    setNotice("牌庫已經空了。");
  }

  function isMovableRun(column, startIndex) {
    if (!Array.isArray(column) || startIndex < 0 || startIndex >= column.length) return false;
    if (!column[startIndex]?.faceUp) return false;

    for (let index = startIndex; index < column.length - 1; index += 1) {
      const upper = column[index];
      const lower = column[index + 1];
      if (!lower.faceUp) return false;
      if (upper.rank !== lower.rank + 1) return false;
      if (SUIT_COLORS[upper.suit] === SUIT_COLORS[lower.suit]) return false;
    }
    return true;
  }

  function selectedCards() {
    if (!selection) return [];
    if (selection.type === "column") return columns[selection.column].slice(selection.index);
    if (selection.type === "waste") {
      const card = waste[waste.length - 1];
      return card ? [card] : [];
    }
    if (selection.type === "foundation") {
      const pile = foundations[selection.suit];
      const card = pile[pile.length - 1];
      return card ? [card] : [];
    }
    return [];
  }

  function removeSelectedCards() {
    if (!selection) return [];

    if (selection.type === "column") {
      return columns[selection.column].splice(selection.index);
    }

    if (selection.type === "waste") {
      const card = waste.pop();
      return card ? [card] : [];
    }

    if (selection.type === "foundation") {
      const card = foundations[selection.suit].pop();
      return card ? [card] : [];
    }

    return [];
  }

  function canPlaceOnColumn(card, destinationTop) {
    if (!card) return false;
    if (!destinationTop) return card.rank === 13;
    if (!destinationTop.faceUp) return false;
    return destinationTop.rank === card.rank + 1 && SUIT_COLORS[destinationTop.suit] !== SUIT_COLORS[card.suit];
  }

  function revealExposedTopCard(columnIndex) {
    if (!Number.isInteger(columnIndex) || columnIndex < 0 || columnIndex >= columns.length) return false;
    const column = columns[columnIndex];
    const top = column[column.length - 1];
    if (!top || top.faceUp) return false;
    top.faceUp = true;
    return true;
  }

  function moveSelectionToColumn(destinationIndex) {
    if (!selection || busy) return false;

    const moving = selectedCards();
    if (!moving.length) return false;

    const destination = columns[destinationIndex];
    const destinationTop = destination[destination.length - 1] || null;
    if (!canPlaceOnColumn(moving[0], destinationTop)) return false;

    const sourceColumn = selection.type === "column" ? selection.column : null;
    const moved = removeSelectedCards();
    destination.push(...moved);
    revealExposedTopCard(sourceColumn);
    finishMove("移動完成。");
    return true;
  }

  function moveSelectionToFoundation(suit) {
    if (!selection || busy) return false;

    const moving = selectedCards();
    if (moving.length !== 1) return false;

    const card = moving[0];
    const pile = foundations[suit];
    const expectedRank = pile.length + 1;
    if (card.suit !== suit || card.rank !== expectedRank) return false;

    const sourceColumn = selection.type === "column" ? selection.column : null;
    const [movedCard] = removeSelectedCards();
    pile.push(movedCard);
    revealExposedTopCard(sourceColumn);
    finishMove("已移到回收區。");
    return true;
  }

  function autoMoveColumnTopToFoundation(columnIndex, cardIndex) {
    const column = columns[columnIndex];
    if (cardIndex !== column.length - 1) return;
    const card = column[cardIndex];
    if (!card?.faceUp) return;

    selection = { type: "column", column: columnIndex, index: cardIndex };
    if (!moveSelectionToFoundation(card.suit)) {
      selection = null;
      sfxBad();
      setNotice("這張牌目前還不能進回收區。");
      render();
    }
  }

  function autoMoveWasteToFoundation() {
    const card = waste[waste.length - 1];
    if (!card) return;
    selection = { type: "waste" };
    if (!moveSelectionToFoundation(card.suit)) {
      selection = null;
      sfxBad();
      setNotice("這張牌目前還不能進回收區。");
      render();
    }
  }

  function finishMove(message) {
    selection = null;
    moveCount += 1;
    sfxMove();
    setNotice(message);
    render();
    saveActiveGame();
    void maybeAutoCollect();
  }

  function centerOfRect(rect) {
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  async function animateExistingCardToTarget(cardElement, targetElement, options = {}) {
    if (!cardElement || !targetElement || !cardElement.animate || prefersReducedMotion()) return;

    const sourceRect = cardElement.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();
    const source = centerOfRect(sourceRect);
    const target = centerOfRect(targetRect);
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const arc = Number.isFinite(options.arc) ? options.arc : 26;
    const duration = Number.isFinite(options.duration) ? options.duration : 105;

    cardElement.classList.add("is-flying-card");

    const animation = cardElement.animate(
      [
        { transform: "translate3d(0,0,0) scale(1) rotate(0deg)", opacity: 1 },
        {
          transform: `translate3d(${(dx * 0.55).toFixed(1)}px, ${(dy * 0.48 - arc).toFixed(1)}px, 0) scale(.76) rotate(-2deg)`,
          opacity: 1
        },
        {
          transform: `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(.32) rotate(2deg)`,
          opacity: 0.16
        }
      ],
      {
        duration,
        easing: "cubic-bezier(.2,.74,.24,1)",
        fill: "forwards"
      }
    );

    await animation.finished.catch(() => undefined);
  }

  function autoCollectReady() {
    if (busy || !hasStartedGame) return false;
    if (stock.length > 0 || waste.length > 0) return false;
    if (completedCardCount() >= 52) return false;
    return columns.every(column => column.every(card => card.faceUp));
  }

  function findAutoCollectCandidate() {
    const candidates = [];

    columns.forEach((column, columnIndex) => {
      const card = column[column.length - 1] || null;
      if (!card?.faceUp) return;
      const expectedRank = foundations[card.suit].length + 1;
      if (card.rank !== expectedRank) return;
      candidates.push({ columnIndex, cardIndex: column.length - 1, card });
    });

    candidates.sort((a, b) => a.card.rank - b.card.rank || a.columnIndex - b.columnIndex);
    return candidates[0] || null;
  }

  async function maybeAutoCollect() {
    if (completedCardCount() === 52) {
      await checkWin();
      return true;
    }

    if (!autoCollectReady()) {
      await checkWin();
      return false;
    }

    busy = true;
    selection = null;
    setNotice("自動收牌中…");
    render();

    let stepIndex = 0;

    while (completedCardCount() < 52) {
      const candidate = findAutoCollectCandidate();
      if (!candidate) break;

      const columnElement = tableauElement.querySelector(
        `.column[data-column-index="${candidate.columnIndex}"]`
      );
      const cardElement = columnElement?.querySelector(
        `.card[data-card-index="${candidate.cardIndex}"]`
      );
      const targetElement = completedArea.querySelector(
        `.foundation-slot[data-foundation-suit="${candidate.card.suit}"]`
      );

      await animateExistingCardToTarget(cardElement, targetElement, {
        duration: 96,
        arc: 20 + (stepIndex % 5) * 2
      });

      const movedCard = columns[candidate.columnIndex].pop();
      if (!movedCard) break;
      foundations[movedCard.suit].push(movedCard);
      moveCount += 1;
      sfxAutoCollectStep(stepIndex);
      stepIndex += 1;

      render();
      saveActiveGame();
      await sleep(prefersReducedMotion() ? 18 : 24);
    }

    busy = false;
    render();

    if (completedCardCount() === 52) {
      setNotice("自動收牌完成。");
      await checkWin();
      return true;
    }

    setNotice("自動收牌暫停，仍需手動整理牌面。");
    saveActiveGame();
    return false;
  }

  function completedCardCount() {
    return SUITS.reduce((total, suit) => total + foundations[suit].length, 0);
  }

  async function checkWin() {
    if (completedCardCount() !== 52 || busy) return false;

    busy = true;
    render();
    clearActiveGame();

    let result = { uid: currentDealUid, bestSteps: currentDealBestValue, clearCount: currentDealClearValue, isNew: false };
    if (window.KlondikeDraw1Data?.handleWin) {
      try {
        result = await window.KlondikeDraw1Data.handleWin({ deal: originalDeal, steps: moveCount, uid: currentDealUid });
        currentDealUid = result.uid || currentDealUid;
        currentDealBestValue = result.bestSteps || currentDealBestValue;
        currentDealClearValue = Number(result.clearCount || currentDealClearValue || 0);
        if (Number.isInteger(Number(result.totalCount))) solvedDealCount = Number(result.totalCount);
        render();
      } catch (error) {
        console.warn("Klondike Draw 1 勝利資料寫入失敗，遊戲仍照常完成。", error);
      }
    }

    try {
      if (window.KlondikeDraw1UI?.playVictory) await window.KlondikeDraw1UI.playVictory(result);
    } catch (error) {
      console.warn("接龍勝利特效播放失敗，遊戲仍照常完成。", error);
    }

    busy = false;
    render();
    window.KlondikeDraw1UI?.showWinMessage?.(moveCount, result);
    return true;
  }

  function saveActiveGame() {
    if (!hasStartedGame || completedCardCount() === 52) return;

    const payload = {
      version: 1,
      columns: columns.map(column => column.map(serializeStateCard)),
      stock: stock.map(serializeStateCard),
      waste: waste.map(serializeStateCard),
      foundations: Object.fromEntries(SUITS.map(suit => [suit, foundations[suit].map(serializeStateCard)])),
      moveCount,
      originalDeal: originalDeal.map(serializeDealCard),
      currentDealUid,
      currentDealBestValue,
      currentDealClearValue
    };

    try {
      localStorage.setItem(ACTIVE_GAME_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn("儲存目前牌局失敗。", error);
    }
  }

  function clearActiveGame() {
    try { localStorage.removeItem(ACTIVE_GAME_STORAGE_KEY); } catch {}
  }

  function restoreCardList(list, startIndex = 0) {
    if (!Array.isArray(list)) return null;
    const restored = list.map((card, index) => normalizeCard(card, startIndex + index, Boolean(card?.faceUp)));
    return restored.every(Boolean) ? restored : null;
  }

  function restoreActiveGame() {
    let parsed;
    try {
      const raw = localStorage.getItem(ACTIVE_GAME_STORAGE_KEY);
      if (!raw) return false;
      parsed = JSON.parse(raw);
    } catch {
      clearActiveGame();
      return false;
    }

    if (!parsed || !Array.isArray(parsed.columns) || parsed.columns.length !== 7) {
      clearActiveGame();
      return false;
    }

    const restoredColumns = parsed.columns.map((column, index) => restoreCardList(column, index * 100));
    const restoredStock = restoreCardList(parsed.stock, 1000);
    const restoredWaste = restoreCardList(parsed.waste, 2000);
    if (restoredColumns.some(column => !column) || !restoredStock || !restoredWaste) {
      clearActiveGame();
      return false;
    }

    const restoredFoundations = createEmptyFoundations();
    for (const suit of SUITS) {
      const pile = restoreCardList(parsed.foundations?.[suit], 3000 + SUITS.indexOf(suit) * 100);
      if (!pile) {
        clearActiveGame();
        return false;
      }
      restoredFoundations[suit] = pile;
    }

    const allCards = [
      ...restoredColumns.flat(),
      ...restoredStock,
      ...restoredWaste,
      ...SUITS.flatMap(suit => restoredFoundations[suit])
    ];

    if (allCards.length !== 52) {
      clearActiveGame();
      return false;
    }

    const restoredOriginalDeal = cloneDeal(parsed.originalDeal || []);
    if (restoredOriginalDeal.length !== 52) {
      clearActiveGame();
      return false;
    }

    columns = restoredColumns;
    stock = restoredStock;
    waste = restoredWaste;
    foundations = restoredFoundations;
    moveCount = Math.max(0, Number(parsed.moveCount) || 0);
    originalDeal = restoredOriginalDeal.map(serializeDealCard);
    selection = null;
    busy = false;
    hasStartedGame = true;
    currentDealUid = String(parsed.currentDealUid || "").trim() || null;
    currentDealBestValue = Number.isInteger(Number(parsed.currentDealBestValue)) && Number(parsed.currentDealBestValue) > 0 ? Number(parsed.currentDealBestValue) : null;
    currentDealClearValue = Number.isInteger(Number(parsed.currentDealClearValue)) && Number(parsed.currentDealClearValue) >= 0 ? Number(parsed.currentDealClearValue) : 0;

    setNotice("已恢復上次未完成的牌局。");
    render();
    return true;
  }

  stockButton.addEventListener("click", handleStockClick);
  wasteButton.addEventListener("click", () => {
    if (!busy) handleWasteClick();
  });
  wasteButton.addEventListener("dblclick", event => {
    event.preventDefault();
    if (!busy) autoMoveWasteToFoundation();
  });

  copyDealUidButton.addEventListener("click", () => {
    if (currentDealUid) void window.KlondikeDraw1Data?.copyUid?.(currentDealUid, copyDealUidButton);
  });

  window.addEventListener("pagehide", saveActiveGame);

  window.KlondikeDraw1Game = Object.freeze({
    startRandomGame() {
      startGame({});
      return true;
    },
    startKnownGame(record) {
      if (!record?.deal || !Array.isArray(record.deal) || record.deal.length !== 52) return false;
      startGame({ deal: record.deal, uid: record.uid, bestSteps: record.bestSteps, clearCount: record.clearCount });
      return true;
    },
    restartCurrentDeal,
    hasGame() {
      return hasStartedGame;
    },
    isBusy() {
      return busy;
    },
    setSolvedDealCount(value) {
      solvedDealCount = Math.max(0, Number(value) || 0);
      render();
    }
  });

  try {
    assertDependencies();
    restoreActiveGame();
  } catch (error) {
    console.error(error);
    setNotice(error?.message || "遊戲載入失敗。");
  }
})();
