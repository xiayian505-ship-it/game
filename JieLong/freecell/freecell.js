(() => {
  "use strict";

  const tableauElement = document.getElementById("tableau");
  const freeCellArea = document.getElementById("freeCellArea");
  const completedArea = document.getElementById("completedArea");
  const completedCountElement = document.getElementById("completedCount");
  const freeCellCountElement = document.getElementById("freeCellCount");
  const moveCountElement = document.getElementById("moveCount");
  const solvedDealCountElement = document.getElementById("solvedDealCount");
  const restartButton = document.getElementById("restartButton");
  const currentDealStats = document.getElementById("currentDealStats");
  const currentDealIdentity = document.getElementById("currentDealIdentity");
  const currentDealShortUid = document.getElementById("currentDealShortUid");
  const currentDealBest = document.getElementById("currentDealBest");
  const currentDealBestSteps = document.getElementById("currentDealBestSteps");
  const currentDealClears = document.getElementById("currentDealClears");
  const currentDealClearCount = document.getElementById("currentDealClearCount");
  const copyDealUidButton = document.getElementById("copyDealUidButton");
  const copyToastElement = document.getElementById("copyToast");

  const copyToast = copyToastElement && window.SlowlyToast?.create
    ? window.SlowlyToast.create(copyToastElement, { duration: 1400 })
    : null;

  function drawCopyIcon(canvas) {
    if (!(canvas instanceof HTMLCanvasElement)) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const button = canvas.closest("button");
    const color = button ? getComputedStyle(button).color : "#0f4567";
    const scale = Math.max(1, Number(window.devicePixelRatio) || 1);
    const cssSize = 24;

    canvas.width = Math.round(cssSize * scale);
    canvas.height = Math.round(cssSize * scale);
    canvas.style.width = `${cssSize}px`;
    canvas.style.height = `${cssSize}px`;

    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, cssSize, cssSize);
    context.strokeStyle = color;
    context.lineWidth = 1.8;
    context.lineJoin = "round";
    context.lineCap = "round";
    context.strokeRect(8.25, 4.75, 10, 11);
    context.strokeRect(5.25, 8.25, 10, 11);
  }

  function drawCopyIcons() {
    document.querySelectorAll(".copy-icon-canvas").forEach(drawCopyIcon);
  }

  async function copyDealIdentifier(uid) {
    const value = String(uid || "").trim();
    if (!value) return false;

    let copied = false;
    try {
      copied = Boolean(await window.FreeCellData?.copyUid?.(value, null));
    } catch {
      copied = false;
    }

    copyToast?.show(copied ? "已複製牌局編號" : "複製失敗");
    return copied;
  }

  window.FreeCellCopyFeedback = Object.freeze({ copy: copyDealIdentifier });
  drawCopyIcons();

  const ACTIVE_GAME_STORAGE_KEY = String(globalThis.FREECELL_ACTIVE_GAME_STORAGE_KEY || "freecell_active_game_v1");

  const CARD_PEEK_DELAY_MS = 220;

  const cardPeekState = {
    timerId: 0,
    button: null,
    active: false
  };

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

  const CLASSIC_UNSOLVABLE_DEALS = Object.freeze([
    11982, 146692, 186216, 455889,
    495505, 512118, 517776, 781948
  ]);

  const CLASSIC_HIDDEN_DEALS = Object.freeze([
    Object.freeze({ dealNumber: -1, result: "無解" }),
    Object.freeze({ dealNumber: -2, result: "無解" }),
    Object.freeze({ dealNumber: -3, result: "必勝" }),
    Object.freeze({ dealNumber: -4, result: "必勝" })
  ]);

  const MICROSOFT_DEAL_SUITS = Object.freeze(["club", "diamond", "heart", "spade"]);

  let columns = Array.from({ length: 8 }, () => []);
  let freeCells = Array(4).fill(null);
  let foundations = createEmptyFoundations();
  let moveCount = 0;
  let selection = null;
  let originalDeal = [];
  let busy = false;
  let hasStartedGame = false;
  let currentDealUid = null;
  let currentDealSource = "random";
  let currentClassicDealNumber = null;
  let currentDealBestValue = null;
  let currentDealClearValue = 0;
  let solvedDealCount = 0;

  /* ===============================
     音效｜沿用 Spider v7 現有音色
     只有點牌／錯誤／完成一次移動；沒有新增任何移牌視覺特效。
  =============================== */
  const PIANO_ATTACK_SECONDS = 0.02;
  const PIANO_RELEASE_SECONDS = 0.10;

  function playTone({
    freq = 440,
    dur = 0.08,
    type = "sine",
    gain = 0.12,
    slide = 0
  } = {}) {
    if (!globalThis.SlowlyAudioTone?.play) return;

    globalThis.SlowlyAudioTone.play({
      frequency: freq,
      duration: dur,
      type,
      gain,
      slide
    }).catch(error => {
      console.warn("[FreeCell] 音效播放失敗：", error);
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
    ) {
      return;
    }

    const notes = Array.isArray(noteIds) ? noteIds : [noteIds];
    if (!notes.length) return;

    try {
      await globalThis.SlowlyAudioContext.resume();
      const context = globalThis.SlowlyAudioContext.get();
      if (!context || context.state !== "running") return;

      const baseStart = context.currentTime + 0.005;

      notes.forEach((noteId, index) => {
        const frequency = globalThis.SlowlyAudioNoteFrequency.toFrequency(noteId);
        const oscillator = globalThis.SlowlyAudioOscillator.create(context, {
          type,
          frequency
        });
        const gainNode = globalThis.SlowlyAudioGain.create(
          context,
          globalThis.SlowlyAudioEnvelope.floor
        );

        globalThis.SlowlyAudioOscillator.connect(oscillator, gainNode);
        globalThis.SlowlyAudioGain.connect(gainNode, context.destination);

        const startAt = baseStart + Math.max(0, spacing) * index;
        const releaseAt = startAt + PIANO_ATTACK_SECONDS + Math.max(0, hold);
        const peak = Math.max(
          globalThis.SlowlyAudioEnvelope.floor,
          gain * (index === 0 ? 1 : 0.88)
        );

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
        globalThis.SlowlyAudioOscillator.stop(
          oscillator,
          releaseAt + Math.max(0.04, release) + 0.02
        );
      });
    } catch (error) {
      console.warn("[FreeCell] 鋼琴音效播放失敗：", error);
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

  const AUTO_COLLECT_NOTES = Object.freeze([
    "C5", "B4", "A4", "G4", "F4", "E4", "D4",
    "C4", "B3", "A3", "G3", "F3", "E3"
  ]);

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
    return {
      spade: [],
      heart: [],
      diamond: [],
      club: []
    };
  }

  function assertDependencies() {
    if (!window.Deck?.create) {
      throw new Error("慢慢軍火庫 Deck 載入失敗。");
    }
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

  function setNotice() {}

  function sleep(ms) {
    return new Promise(resolve => window.setTimeout(resolve, Math.max(0, ms)));
  }

  function prefersReducedMotion() {
    return Boolean(
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function clearCardPeekTimer() {
    if (cardPeekState.timerId) {
      window.clearTimeout(cardPeekState.timerId);
      cardPeekState.timerId = 0;
    }
  }

  function endCardPeek(button, { suppressClick = false } = {}) {
    clearCardPeekTimer();

    if (cardPeekState.button === button) {
      if (cardPeekState.active) {
        button.classList.remove("peeking");
        if (suppressClick) {
          button.dataset.peekSuppressClick = "true";
        }
      }

      cardPeekState.button = null;
      cardPeekState.active = false;
    }
  }

  function scheduleCardPeek(button) {
    endCardPeek(cardPeekState.button);
    cardPeekState.button = button;
    cardPeekState.active = false;
    cardPeekState.timerId = window.setTimeout(() => {
      cardPeekState.timerId = 0;
      if (cardPeekState.button !== button) return;
      cardPeekState.active = true;
      button.classList.add("peeking");
    }, CARD_PEEK_DELAY_MS);
  }

  function isValidRank(value) {
    const rank = Number(value);
    return Number.isInteger(rank) && rank >= 1 && rank <= 13;
  }

  function isValidSuit(value) {
    return SUITS.includes(String(value));
  }

  function normalizeCard(card, index = 0) {
    if (!card || !isValidRank(card.rank) || !isValidSuit(card.suit)) return null;
    return {
      id: String(card.id || `F-${card.suit}-${card.rank}-${index}`),
      rank: Number(card.rank),
      suit: String(card.suit),
      faceUp: true
    };
  }

  function serializeCard(card) {
    return {
      rank: Number(card.rank),
      suit: String(card.suit)
    };
  }

  function cloneDeal(deal) {
    if (!Array.isArray(deal)) return [];
    return deal.map((card, index) => normalizeCard(card, index)).filter(Boolean);
  }

  function createRandomCards() {
    const cards = [];
    let id = 0;

    for (const suit of SUITS) {
      for (let rank = 1; rank <= 13; rank += 1) {
        cards.push({
          id: `F-${suit}-${rank}-${id++}`,
          rank,
          suit,
          faceUp: true
        });
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
    const cards = cloneDeal(deal).reverse();
    return window.Deck.create({
      items: cards,
      recycleDiscard: false,
      shuffleOnReset: false,
      shuffleOnRecycle: false
    });
  }

  function interleaveClassicColumns(columnRanks) {
    const columns = columnRanks.map((ranks, columnIndex) => {
      const suit = MICROSOFT_DEAL_SUITS[columnIndex % 4];
      return ranks.map(rank => ({ rank, suit, faceUp: true }));
    });
    const deal = [];
    const maxRows = Math.max(...columns.map(column => column.length));

    for (let rowIndex = 0; rowIndex < maxRows; rowIndex += 1) {
      columns.forEach(column => {
        if (column[rowIndex]) deal.push(column[rowIndex]);
      });
    }

    return deal.map(serializeCard);
  }

  function createMicrosoftHiddenDeal(dealNumber) {
    const number = Math.trunc(Number(dealNumber));
    const patterns = {
      [-1]: [
        [1, 3, 5, 7, 9, 11, 13],
        [12, 10, 8, 6, 4, 2]
      ],
      [-2]: [
        [1, 13, 12, 11, 10, 9, 8],
        [7, 6, 5, 4, 3, 2]
      ],
      [-3]: [
        [13, 12, 11, 10, 9, 8, 7],
        [6, 5, 4, 3, 2, 1]
      ],
      [-4]: [
        [13, 11, 9, 7, 5, 3, 1],
        [12, 10, 8, 6, 4, 2]
      ]
    };
    const pattern = patterns[number];
    if (!pattern) return null;

    return interleaveClassicColumns([
      pattern[0], pattern[0], pattern[0], pattern[0],
      pattern[1], pattern[1], pattern[1], pattern[1]
    ]);
  }

  function createMicrosoftClassicDeal(dealNumber) {
    const number = Math.trunc(Number(dealNumber));
    if (CLASSIC_HIDDEN_DEALS.some(record => record.dealNumber === number)) {
      return createMicrosoftHiddenDeal(number);
    }
    if (!CLASSIC_UNSOLVABLE_DEALS.includes(number)) return null;

    const deck = [];
    for (let rank = 1; rank <= 13; rank += 1) {
      MICROSOFT_DEAL_SUITS.forEach(suit => {
        deck.push({ rank, suit, faceUp: true });
      });
    }

    let state = number & 0x7fffffff;
    const deal = [];

    while (deck.length) {
      state = (Math.imul(state, 214013) + 2531011) & 0x7fffffff;
      const randomValue = (state >>> 16) & 0x7fff;
      const selectedIndex = randomValue % deck.length;
      const lastIndex = deck.length - 1;
      [deck[selectedIndex], deck[lastIndex]] = [deck[lastIndex], deck[selectedIndex]];
      deal.push(deck.pop());
    }

    return deal.map(serializeCard);
  }

  function classicDealNotice(dealNumber) {
    const number = Math.trunc(Number(dealNumber));
    const hidden = CLASSIC_HIDDEN_DEALS.find(record => record.dealNumber === number);
    if (!hidden) return `已載入經典無解牌局 #${number}。`;
    if (hidden.result === "無解") return `已載入經典隱藏牌局 #${number}（無解）。`;
    return `已載入經典隱藏牌局 #${number}（必勝）。移動任一張 A 到本位回收格即可自動完成。`;
  }

  function classicDealUid(dealNumber) {
    return `freecell-classic-${Math.trunc(Number(dealNumber))}`;
  }

  function createCurrentDealUid() {
    if (window.FreeCellData?.createUid) return window.FreeCellData.createUid();
    if (window.RandomId?.create) return window.RandomId.create({ prefix: "freecell-" });
    return `freecell-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function startGame(options = {}) {
    assertDependencies();

    const knownDeal = Array.isArray(options.deal) && options.deal.length === 52
      ? cloneDeal(options.deal)
      : null;

    if (knownDeal && knownDeal.length !== 52) {
      throw new TypeError("FreeCell 牌局必須是 52 張有效牌。");
    }

    const deck = knownDeal
      ? createDeckForKnownDeal(knownDeal)
      : createDeckForRandomGame();

    originalDeal = knownDeal
      ? knownDeal.map(serializeCard)
      : deck.snapshot().drawPile.slice().reverse().map(serializeCard);

    columns = Array.from({ length: 8 }, () => []);
    freeCells = Array(4).fill(null);
    foundations = createEmptyFoundations();
    moveCount = 0;
    selection = null;
    busy = false;
    hasStartedGame = true;
    currentDealSource = String(options.source || (options.classicDealNumber ? "classic" : "random"));
    currentDealUid = String(options.uid || "").trim() || null;
    if (!currentDealUid && currentDealSource !== "classic") {
      currentDealUid = createCurrentDealUid();
    }
    currentClassicDealNumber = Number.isInteger(Number(options.classicDealNumber))
      ? Number(options.classicDealNumber)
      : null;
    currentDealBestValue = Number.isInteger(Number(options.bestSteps)) && Number(options.bestSteps) > 0 ? Number(options.bestSteps) : null;
    currentDealClearValue = Number.isInteger(Number(options.clearCount)) && Number(options.clearCount) >= 0 ? Number(options.clearCount) : 0;

    for (let index = 0; index < 52; index += 1) {
      const [card] = deck.draw(1);
      if (!card) throw new Error("FreeCell 發牌失敗。");
      card.faceUp = true;
      columns[index % 8].push(card);
    }

    setNotice(currentDealSource === "classic" && currentClassicDealNumber
      ? classicDealNotice(currentClassicDealNumber)
      : (currentDealUid ? `已載入牌局 ${window.FreeCellData?.shortUid?.(currentDealUid) || currentDealUid}。` : "點一張牌或牌串開始。"));
    render();
    saveActiveGame();
    if (currentDealSource === "random" && window.FreeCellData?.resolveDeal) {
      void window.FreeCellData.resolveDeal(originalDeal).then(record => {
        if (!record) return;
        currentDealUid = record.uid;
        currentDealBestValue = record.bestSteps || null;
        currentDealClearValue = Number(record.clearCount || 0);
        render();
        saveActiveGame();
        window.dispatchEvent(new CustomEvent("freecelldealchange", { detail: { uid: currentDealUid } }));
        setNotice(`這副隨機牌局已在玩家已解牌庫：${window.FreeCellData.shortUid(record.uid)}`);
      }).catch(() => {});
    }
  }

  function restartCurrentDeal() {
    if (busy || originalDeal.length !== 52) return false;
    startGame({
      deal: originalDeal,
      uid: currentDealUid,
      source: currentDealSource,
      classicDealNumber: currentClassicDealNumber,
      bestSteps: currentDealBestValue,
      clearCount: currentDealClearValue
    });
    setNotice("已重新開始此局。");
    return true;
  }

  function abandonCurrentDeal() {
    if (busy || !hasStartedGame || originalDeal.length !== 52 || completedCardCount() === 52) return false;
    if (currentDealSource === "classic") return false;
    const deal = cloneDeal(originalDeal);
    const uid = currentDealUid;
    void window.FreeCellData?.savePending?.({ deal, uid });
    return true;
  }

  function render() {
    renderColumns();
    renderFreeCells();
    renderFoundations();

    completedCountElement.textContent = String(completedCardCount());
    freeCellCountElement.textContent = String(freeCells.filter(Boolean).length);
    moveCountElement.textContent = String(moveCount);
    solvedDealCountElement.textContent = String(solvedDealCount);
    renderDealIdentity();
    restartButton.disabled = busy || !hasStartedGame || originalDeal.length !== 52;
  }

  function renderDealIdentity() {
    const hasUid = Boolean(currentDealUid);
    const hideUid = currentDealSource === "classic";
    currentDealIdentity.hidden = !hasUid || hideUid;
    copyDealUidButton.disabled = !hasUid;
    if (!hasUid) return;
    currentDealShortUid.textContent = window.FreeCellData?.shortUid?.(currentDealUid) || currentDealUid;
    currentDealBest.hidden = !(currentDealBestValue > 0);
    currentDealBestSteps.textContent = currentDealBestValue > 0 ? String(currentDealBestValue) : "—";
    currentDealClears.hidden = !(currentDealClearValue > 0);
    currentDealClearCount.textContent = currentDealClearValue > 0 ? String(currentDealClearValue) : "—";
    if (currentDealStats) currentDealStats.hidden = false;
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
        top += 32;
        column.appendChild(cardElement);
      });

      column.addEventListener("click", () => {
        if (busy || !selection) return;
        if (!moveSelectionToColumn(columnIndex)) {
          sfxBad();
          setNotice("這裡不能放。");
        }
      });

      tableauElement.appendChild(column);
    });
  }

  function createCardElement(card, columnIndex, cardIndex) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `card suit-${card.suit}`;
    button.dataset.cardIndex = String(cardIndex);
    button.setAttribute("aria-label", cardLabel(card));

    if (
      selection?.type === "column" &&
      selection.column === columnIndex &&
      cardIndex >= selection.index
    ) {
      button.classList.add("selected");
    }

    const rank = document.createElement("span");
    rank.className = "card-rank";
    rank.textContent = rankLabel(card.rank);

    const suit = document.createElement("span");
    suit.className = "card-suit";
    suit.textContent = suitSymbol(card.suit);

    button.append(rank, suit);

    button.addEventListener("pointerdown", event => {
      if (busy) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;

      button.dataset.peekSuppressClick = "";

      if (typeof button.setPointerCapture === "function") {
        try {
          button.setPointerCapture(event.pointerId);
        } catch (error) {
          // ignore unsupported pointer capture states
        }
      }

      scheduleCardPeek(button);
    });

    const finishPeek = () => {
      endCardPeek(button, { suppressClick: true });
    };

    const cancelPeek = () => {
      endCardPeek(button, { suppressClick: false });
    };

    button.addEventListener("pointerup", finishPeek);
    button.addEventListener("pointercancel", cancelPeek);
    button.addEventListener("lostpointercapture", cancelPeek);
    button.addEventListener("contextmenu", event => {
      if (cardPeekState.active && cardPeekState.button === button) {
        event.preventDefault();
      }
    });

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
      if (!busy) autoMoveColumnTopToFoundation(columnIndex, cardIndex);
    });

    return button;
  }

  function renderFreeCells() {
    freeCellArea.innerHTML = "";

    freeCells.forEach((card, index) => {
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = "completed-slot freecell-slot";
      slot.dataset.freeCellIndex = String(index);

      if (card) {
        slot.classList.add("occupied", `suit-${card.suit}`);
        slot.textContent = cardLabel(card);
        slot.setAttribute("aria-label", `自由格 ${index + 1}：${cardLabel(card)}`);
      } else {
        slot.textContent = "";
        slot.setAttribute("aria-label", `自由格 ${index + 1}：空`);
      }

      if (selection?.type === "freecell" && selection.index === index) {
        slot.classList.add("selected");
      }

      slot.addEventListener("click", () => {
        if (!busy) handleFreeCellClick(index);
      });

      slot.addEventListener("dblclick", event => {
        event.preventDefault();
        if (!busy) autoMoveFreeCellToFoundation(index);
      });

      freeCellArea.appendChild(slot);
    });
  }

  function renderFoundations() {
    completedArea.innerHTML = "";

    SUITS.forEach((suit, index) => {
      const pile = foundations[suit];
      const topCard = pile[pile.length - 1] || null;
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = `completed-slot foundation-slot suit-${suit}`;
      slot.dataset.foundationSuit = suit;
      slot.dataset.completedIndex = String(index);

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

    if (!isMovableRun(columns[columnIndex], cardIndex)) {
      selection = null;
      sfxBad();
      setNotice("牌串必須紅黑交錯、由大至小連續排列。");
      render();
      return;
    }

    selection = {
      type: "column",
      column: columnIndex,
      index: cardIndex
    };

    sfxCardSelect();
    const length = columns[columnIndex].length - cardIndex;
    setNotice(length > 1 ? `已選取 ${length} 張牌。` : "已選取 1 張牌。");
    render();
  }

  function handleFreeCellClick(index) {
    const card = freeCells[index];

    if (card) {
      if (selection?.type === "freecell" && selection.index === index) {
        selection = null;
        sfxCardSelect();
        setNotice("已取消選取。");
      } else {
        selection = { type: "freecell", index };
        sfxCardSelect();
        setNotice("已選取 1 張牌。");
      }
      render();
      return;
    }

    if (!selection) return;

    if (!moveSelectionToFreeCell(index)) {
      sfxBad();
      setNotice("自由格一次只能放 1 張牌。");
    }
  }

  function handleFoundationClick(suit) {
    const pile = foundations[suit];

    if (selection) {
      if (selection.type === "foundation" && selection.suit === suit) {
        selection = null;
        sfxCardSelect();
        setNotice("已取消選取。");
        render();
        return;
      }

      if (moveSelectionToFoundation(suit)) return;

      sfxBad();
      setNotice("回收區必須同花色由 A 往上排列。");
      return;
    }

    if (pile.length === 0) return;

    selection = { type: "foundation", suit };
    sfxCardSelect();
    setNotice("已選取 1 張牌。");
    render();
  }

  function isMovableRun(cards, startIndex) {
    if (startIndex < 0 || startIndex >= cards.length) return false;

    for (let index = startIndex; index < cards.length - 1; index += 1) {
      const current = cards[index];
      const next = cards[index + 1];

      if (
        current.rank !== next.rank + 1 ||
        SUIT_COLORS[current.suit] === SUIT_COLORS[next.suit]
      ) {
        return false;
      }
    }

    return true;
  }

  function selectedCards() {
    if (!selection) return [];

    if (selection.type === "column") {
      return columns[selection.column].slice(selection.index);
    }

    if (selection.type === "freecell") {
      const card = freeCells[selection.index];
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

    if (selection.type === "freecell") {
      const card = freeCells[selection.index];
      freeCells[selection.index] = null;
      return card ? [card] : [];
    }

    if (selection.type === "foundation") {
      const card = foundations[selection.suit].pop();
      return card ? [card] : [];
    }

    return [];
  }

  function canPlaceOnColumn(card, destinationTop) {
    if (!destinationTop) return true;
    return (
      destinationTop.rank === card.rank + 1 &&
      SUIT_COLORS[destinationTop.suit] !== SUIT_COLORS[card.suit]
    );
  }

  function maxMovableCardsToColumn(destinationIndex) {
    const emptyFreeCells = freeCells.filter(card => !card).length;
    let emptyColumns = columns.filter(column => column.length === 0).length;

    if (columns[destinationIndex].length === 0) {
      emptyColumns = Math.max(0, emptyColumns - 1);
    }

    return (emptyFreeCells + 1) * (2 ** emptyColumns);
  }

  function moveSelectionToColumn(destinationIndex) {
    if (!selection || busy) return false;
    if (selection.type === "column" && selection.column === destinationIndex) return false;

    const moving = selectedCards();
    if (moving.length === 0) return false;

    const destination = columns[destinationIndex];
    const destinationTop = destination[destination.length - 1] || null;

    if (!canPlaceOnColumn(moving[0], destinationTop)) return false;

    if (moving.length > 1) {
      const maximum = maxMovableCardsToColumn(destinationIndex);
      if (moving.length > maximum) {
        sfxBad();
        setNotice(`目前最多只能一起移動 ${maximum} 張牌。`);
        return false;
      }
    }

    const moved = removeSelectedCards();
    destination.push(...moved);
    finishMove("移動完成。");
    return true;
  }

  function moveSelectionToFreeCell(index) {
    if (!selection || busy || freeCells[index]) return false;

    const moving = selectedCards();
    if (moving.length !== 1) return false;

    const [card] = removeSelectedCards();
    freeCells[index] = card;
    finishMove("已移到自由格。");
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

    const [movedCard] = removeSelectedCards();
    pile.push(movedCard);
    finishMove("已移到回收區。");
    return true;
  }

  function autoMoveColumnTopToFoundation(columnIndex, cardIndex) {
    const column = columns[columnIndex];
    if (cardIndex !== column.length - 1) return;

    const card = column[cardIndex];
    selection = { type: "column", column: columnIndex, index: cardIndex };
    if (!moveSelectionToFoundation(card.suit)) {
      selection = null;
      sfxBad();
      setNotice("這張牌目前還不能進回收區。");
      render();
    }
  }

  function autoMoveFreeCellToFoundation(index) {
    const card = freeCells[index];
    if (!card) return;

    selection = { type: "freecell", index };
    if (!moveSelectionToFoundation(card.suit)) {
      selection = null;
      sfxBad();
      setNotice("這張牌目前還不能進回收區。");
      render();
    }
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

  function buildAutoCollectPlan() {
    if (!hasStartedGame || completedCardCount() >= 52) return null;

    const simulatedColumns = columns.map(column => column.slice());
    const simulatedFreeCells = freeCells.slice();
    const foundationRanks = Object.fromEntries(
      SUITS.map(suit => [suit, foundations[suit].length])
    );
    const plan = [];

    while (true) {
      let next = null;

      for (let index = 0; index < simulatedFreeCells.length; index += 1) {
        const card = simulatedFreeCells[index];
        if (card && card.rank === foundationRanks[card.suit] + 1) {
          next = { type: "freecell", index, card };
          break;
        }
      }

      if (!next) {
        for (let columnIndex = 0; columnIndex < simulatedColumns.length; columnIndex += 1) {
          const column = simulatedColumns[columnIndex];
          const card = column[column.length - 1] || null;
          if (card && card.rank === foundationRanks[card.suit] + 1) {
            next = { type: "column", columnIndex, card };
            break;
          }
        }
      }

      if (!next) break;

      plan.push({
        type: next.type,
        index: next.index,
        columnIndex: next.columnIndex,
        rank: next.card.rank,
        suit: next.card.suit
      });

      if (next.type === "freecell") {
        simulatedFreeCells[next.index] = null;
      } else {
        simulatedColumns[next.columnIndex].pop();
      }

      foundationRanks[next.card.suit] += 1;
    }

    const remaining = simulatedColumns.reduce((sum, column) => sum + column.length, 0)
      + simulatedFreeCells.filter(Boolean).length;

    return remaining === 0 && plan.length > 0 ? plan : null;
  }

  function sourceElementForAutoCollect(step) {
    if (step.type === "freecell") {
      return freeCellArea.querySelector(`.freecell-slot[data-free-cell-index="${step.index}"]`);
    }

    const column = columns[step.columnIndex];
    const cardIndex = column.length - 1;
    return tableauElement.querySelector(
      `.column[data-column-index="${step.columnIndex}"] .card[data-card-index="${cardIndex}"]`
    );
  }

  function takeAutoCollectCard(step) {
    if (step.type === "freecell") {
      const card = freeCells[step.index];
      if (!card || card.rank !== step.rank || card.suit !== step.suit) return null;
      freeCells[step.index] = null;
      return card;
    }

    const column = columns[step.columnIndex];
    const card = column[column.length - 1] || null;
    if (!card || card.rank !== step.rank || card.suit !== step.suit) return null;
    column.pop();
    return card;
  }

  async function tryAutoCollect() {
    if (busy) return false;

    const plan = buildAutoCollectPlan();
    if (!plan) return false;

    busy = true;
    selection = null;
    setNotice("自動收牌中…");
    render();

    for (let index = 0; index < plan.length; index += 1) {
      const step = plan[index];
      const sourceElement = sourceElementForAutoCollect(step);
      const targetElement = completedArea.querySelector(
        `.foundation-slot[data-foundation-suit="${step.suit}"]`
      );

      await animateExistingCardToTarget(sourceElement, targetElement, {
        duration: 92,
        arc: 20 + (index % 8) * 0.7
      });

      const card = takeAutoCollectCard(step);
      if (!card) {
        busy = false;
        setNotice("自動收牌已停止。請繼續手動整理。");
        render();
        saveActiveGame();
        return false;
      }

      foundations[card.suit].push(card);
      moveCount += 1;
      sfxAutoCollectStep(index);
      render();
      saveActiveGame();
      await sleep(prefersReducedMotion() ? 8 : 12);
    }

    busy = false;
    render();
    await checkWin();
    return true;
  }

  async function continueAfterMove() {
    const collected = await tryAutoCollect();
    if (!collected) await checkWin();
  }

  function finishMove(message) {
    selection = null;
    moveCount += 1;
    sfxMove();
    setNotice(message);
    render();
    saveActiveGame();
    void continueAfterMove();
  }

  function completedCardCount() {
    return SUITS.reduce((total, suit) => total + foundations[suit].length, 0);
  }

  async function checkWin() {
    if (completedCardCount() !== 52 || busy) return false;

    busy = true;
    render();
    clearActiveGame();

    let result = currentDealSource === "classic"
      ? { uid: null, bestSteps: null, clearCount: 0, isNew: false }
      : { uid: currentDealUid, bestSteps: currentDealBestValue, clearCount: currentDealClearValue, isNew: false };
    if (currentDealSource !== "classic" && window.FreeCellData?.handleWin) {
      try {
        result = await window.FreeCellData.handleWin({ deal: originalDeal, steps: moveCount, uid: currentDealUid });
        currentDealUid = result.uid || currentDealUid;
        currentDealBestValue = result.bestSteps || currentDealBestValue;
        currentDealClearValue = Number(result.clearCount || currentDealClearValue || 0);
        if (Number.isInteger(Number(result.totalCount))) solvedDealCount = Number(result.totalCount);
        render();
      } catch (error) {
        console.warn("FreeCell 勝利資料寫入失敗，遊戲仍照常完成。", error);
      }
    }

    try {
      if (window.FreeCellUI?.playVictory) await window.FreeCellUI.playVictory(result);
    } catch (error) {
      console.warn("FreeCell 勝利特效播放失敗，遊戲仍照常完成。", error);
    }

    busy = false;
    render();

    if (window.FreeCellUI?.showWinMessage) window.FreeCellUI.showWinMessage(moveCount, result);
    return true;
  }

  function saveActiveGame() {
    if (!hasStartedGame || completedCardCount() === 52) return;

    const payload = {
      version: 1,
      columns: columns.map(column => column.map(serializeCard)),
      freeCells: freeCells.map(card => card ? serializeCard(card) : null),
      foundations: Object.fromEntries(
        SUITS.map(suit => [suit, foundations[suit].map(serializeCard)])
      ),
      moveCount,
      originalDeal: originalDeal.map(serializeCard),
      currentDealUid,
      currentDealSource,
      currentClassicDealNumber,
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
    try {
      localStorage.removeItem(ACTIVE_GAME_STORAGE_KEY);
    } catch {}
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

    if (!parsed || !Array.isArray(parsed.columns) || parsed.columns.length !== 8) {
      clearActiveGame();
      return false;
    }

    const restoredColumns = parsed.columns.map((column, columnIndex) => {
      if (!Array.isArray(column)) return null;
      const cards = column.map((card, cardIndex) => normalizeCard(card, columnIndex * 100 + cardIndex));
      return cards.every(Boolean) ? cards : null;
    });

    if (restoredColumns.some(column => !column)) {
      clearActiveGame();
      return false;
    }

    if (!Array.isArray(parsed.freeCells) || parsed.freeCells.length !== 4) {
      clearActiveGame();
      return false;
    }

    const restoredFreeCells = parsed.freeCells.map((card, index) => (
      card ? normalizeCard(card, 1000 + index) : null
    ));

    const restoredFoundations = createEmptyFoundations();
    for (const suit of SUITS) {
      const pile = parsed.foundations?.[suit];
      if (!Array.isArray(pile)) {
        clearActiveGame();
        return false;
      }
      restoredFoundations[suit] = pile.map((card, index) => normalizeCard(card, 2000 + index));
      if (restoredFoundations[suit].some(card => !card)) {
        clearActiveGame();
        return false;
      }
    }

    const allCards = [
      ...restoredColumns.flat(),
      ...restoredFreeCells.filter(Boolean),
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
    freeCells = restoredFreeCells;
    foundations = restoredFoundations;
    moveCount = Math.max(0, Math.trunc(Number(parsed.moveCount)) || 0);
    originalDeal = restoredOriginalDeal.map(serializeCard);
    selection = null;
    busy = false;
    hasStartedGame = true;
    currentDealUid = String(parsed.currentDealUid || "").trim() || null;
    currentDealSource = String(parsed.currentDealSource || (currentDealUid?.startsWith("freecell-classic-") ? "classic" : "random"));
    currentClassicDealNumber = Number.isInteger(Number(parsed.currentClassicDealNumber))
      ? Number(parsed.currentClassicDealNumber)
      : null;
    currentDealBestValue = Number.isInteger(Number(parsed.currentDealBestValue)) && Number(parsed.currentDealBestValue) > 0 ? Number(parsed.currentDealBestValue) : null;
    currentDealClearValue = Number.isInteger(Number(parsed.currentDealClearValue)) && Number(parsed.currentDealClearValue) >= 0 ? Number(parsed.currentDealClearValue) : 0;

    setNotice("已恢復上次牌局。");
    render();
    return true;
  }

  copyDealUidButton.addEventListener("click", () => {
    if (currentDealUid) void copyDealIdentifier(currentDealUid);
  });

  window.addEventListener("pagehide", () => {
    if (!busy) saveActiveGame();
  });

  const restored = restoreActiveGame();
  if (!restored) render();

  window.FreeCellGame = Object.freeze({
    startRandomGame() { startGame({ source: "random" }); },
    startKnownGame(record) {
      if (!record?.deal) return false;
      startGame({ deal: record.deal, uid: record.uid, source: "known", bestSteps: record.bestSteps, clearCount: record.clearCount });
      return true;
    },
    startClassicGame(dealNumber) {
      const number = Math.trunc(Number(dealNumber));
      const deal = createMicrosoftClassicDeal(number);
      if (!deal) return false;
      startGame({
        deal,
        uid: classicDealUid(number),
        source: "classic",
        classicDealNumber: number
      });
      return true;
    },
    classicDealNumbers() { return CLASSIC_UNSOLVABLE_DEALS.slice(); },
    classicHiddenDeals() { return CLASSIC_HIDDEN_DEALS.map(record => ({ ...record })); },
    setSolvedDealCount(value) {
      solvedDealCount = Math.max(0, Math.trunc(Number(value)) || 0);
      render();
    },
    hasGame() { return hasStartedGame; },
    isBusy() { return busy; },
    getCurrentDealRecord() {
      if (!hasStartedGame || originalDeal.length !== 52 || !currentDealUid) return null;
      return {
        uid: currentDealUid,
        deal: cloneDeal(originalDeal),
        source: currentDealSource,
        classicDealNumber: currentClassicDealNumber,
        bestSteps: currentDealBestValue,
        clearCount: currentDealClearValue
      };
    },
    restartCurrentDeal,
    abandonCurrentDeal,
    clearSelection() { selection = null; render(); }
  });
})();
