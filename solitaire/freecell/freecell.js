(() => {
  "use strict";

  const tableauElement = document.getElementById("tableau");
  const freeCellArea = document.getElementById("freeCellArea");
  const completedArea = document.getElementById("completedArea");
  const completedCountElement = document.getElementById("completedCount");
  const freeCellCountElement = document.getElementById("freeCellCount");
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

  const ACTIVE_GAME_STORAGE_KEY = "freecell_active_game_v1";

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

  let columns = Array.from({ length: 8 }, () => []);
  let freeCells = Array(4).fill(null);
  let foundations = createEmptyFoundations();
  let moveCount = 0;
  let selection = null;
  let originalDeal = [];
  let busy = false;
  let hasStartedGame = false;
  let currentDealUid = null;
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
    currentDealUid = String(options.uid || "").trim() || null;
    currentDealBestValue = Number.isInteger(Number(options.bestSteps)) && Number(options.bestSteps) > 0 ? Number(options.bestSteps) : null;
    currentDealClearValue = Number.isInteger(Number(options.clearCount)) && Number(options.clearCount) >= 0 ? Number(options.clearCount) : 0;

    for (let index = 0; index < 52; index += 1) {
      const [card] = deck.draw(1);
      if (!card) throw new Error("FreeCell 發牌失敗。");
      card.faceUp = true;
      columns[index % 8].push(card);
    }

    setNotice(currentDealUid ? `已載入牌局 ${window.FreeCellData?.shortUid?.(currentDealUid) || currentDealUid}。` : "點一張牌或牌串開始。");
    render();
    saveActiveGame();
    if (!currentDealUid && window.FreeCellData?.resolveDeal) {
      void window.FreeCellData.resolveDeal(originalDeal).then(record => {
        if (!record || currentDealUid) return;
        currentDealUid = record.uid;
        currentDealBestValue = record.bestSteps || null;
        currentDealClearValue = Number(record.clearCount || 0);
        render();
        saveActiveGame();
        setNotice(`這副隨機牌局已在玩家已解牌庫：${window.FreeCellData.shortUid(record.uid)}`);
      }).catch(() => {});
    }
  }

  function restartCurrentDeal() {
    if (busy || originalDeal.length !== 52) return false;
    startGame({ deal: originalDeal, uid: currentDealUid, bestSteps: currentDealBestValue, clearCount: currentDealClearValue });
    setNotice("已重新開始此局。");
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
    currentDealIdentity.hidden = !hasUid;
    copyDealUidButton.disabled = !hasUid;
    if (!hasUid) return;
    currentDealShortUid.textContent = window.FreeCellData?.shortUid?.(currentDealUid) || currentDealUid;
    currentDealBest.hidden = !(currentDealBestValue > 0);
    currentDealBestSteps.textContent = currentDealBestValue > 0 ? String(currentDealBestValue) : "—";
    currentDealClears.hidden = !(currentDealClearValue > 0);
    currentDealClearCount.textContent = currentDealClearValue > 0 ? String(currentDealClearValue) : "—";
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

    button.addEventListener("click", event => {
      event.stopPropagation();
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

  function finishMove(message) {
    selection = null;
    moveCount += 1;
    sfxMove();
    setNotice(message);
    render();
    saveActiveGame();
    void checkWin();
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
    if (window.FreeCellData?.handleWin) {
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

    if (window.FreeCellUI?.playVictory) await window.FreeCellUI.playVictory(result);
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
    currentDealBestValue = Number.isInteger(Number(parsed.currentDealBestValue)) && Number(parsed.currentDealBestValue) > 0 ? Number(parsed.currentDealBestValue) : null;
    currentDealClearValue = Number.isInteger(Number(parsed.currentDealClearValue)) && Number(parsed.currentDealClearValue) >= 0 ? Number(parsed.currentDealClearValue) : 0;

    setNotice("已恢復上次牌局。");
    render();
    return true;
  }

  copyDealUidButton.addEventListener("click", () => {
    if (currentDealUid) void window.FreeCellData?.copyUid?.(currentDealUid, copyDealUidButton);
  });

  window.addEventListener("pagehide", () => {
    if (!busy) saveActiveGame();
  });

  const restored = restoreActiveGame();
  if (!restored) render();

  window.FreeCellGame = Object.freeze({
    startRandomGame() { startGame({}); },
    startKnownGame(record) {
      if (!record?.deal) return false;
      startGame({ deal: record.deal, uid: record.uid, bestSteps: record.bestSteps, clearCount: record.clearCount });
      return true;
    },
    setSolvedDealCount(value) {
      solvedDealCount = Math.max(0, Math.trunc(Number(value)) || 0);
      render();
    },
    hasGame() { return hasStartedGame; },
    isBusy() { return busy; },
    restartCurrentDeal,
    clearSelection() { selection = null; render(); }
  });
})();
