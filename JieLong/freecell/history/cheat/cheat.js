/*
 * FreeCell 歷史作弊模擬器｜獨立遊戲核心
 *
 * 功能：微軟牌局編號發牌、移牌、自由寄放格、回收格、作弊結果模擬。
 * 不引用接龍帝國正式 FreeCell 的腳本、資料庫或玩家記錄。
 * 以 Claude 提供的獨立模擬器為原型，拆分並整理為可維護程式。
 */
(() => {
  "use strict";

  const SUITS = ["♣", "♦", "♥", "♠"];
  const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const MAX_DEAL = 1_000_000;

  const topCellsElement = document.querySelector("#topCells");
  const tableauElement = document.querySelector("#tableau");
  const dealNumberInput = document.querySelector("#dealNumber");
  const moveCountElement = document.querySelector("#moveCount");
  const tableElement = document.querySelector("#classicTable");

  const game = {
    columns: Array.from({ length: 8 }, () => []),
    freeCells: [null, null, null, null],
    foundations: [0, 0, 0, 0],
    selected: null,
    dealNumber: 1,
    moves: 0,
    cheatMode: null,
    isFinished: false,
    isAnimating: false,
    modalOpen: false,
    animationTimer: null
  };

  // 整副牌以數字 0～51 編碼：牌點為 card >> 2，花色為 card & 3。
  function getSuit(card) {
    return card & 3;
  }

  function getRank(card) {
    return card >> 2;
  }

  function isRed(card) {
    return getSuit(card) === 1 || getSuit(card) === 2;
  }

  function labelCard(card) {
    return `${RANKS[getRank(card)]}${SUITS[getSuit(card)]}`;
  }

  function randomDeal() {
    return Math.floor(Math.random() * MAX_DEAL) + 1;
  }

  function normaliseDealNumber(value) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 1 || number > MAX_DEAL) return null;
    return number;
  }

  // 微軟舊版 FreeCell 的 32 位元亂數更新公式；每次選取剩餘牌中的一張。
  // 與原型相同，這裡僅在本模擬器內建立牌局，與正式百萬牌局完全分離。
  function createDeal(number) {
    const deck = Array.from({ length: 52 }, (_, index) => index);
    const dealt = [];
    let seed = number & 0x7fffffff;

    while (deck.length > 0) {
      seed = (Math.imul(seed, 214013) + 2531011) & 0x7fffffff;
      const random = (seed >>> 16) & 0x7fff;
      const selectedIndex = random % deck.length;
      const lastIndex = deck.length - 1;
      [deck[selectedIndex], deck[lastIndex]] = [deck[lastIndex], deck[selectedIndex]];
      dealt.push(deck.pop());
    }

    return Array.from({ length: 8 }, (_, columnIndex) =>
      dealt.filter((_, position) => position % 8 === columnIndex)
    );
  }

  function notify(name, detail = {}) {
    document.dispatchEvent(new CustomEvent(`freecell-cheat:${name}`, { detail }));
  }

  function clearAnimation() {
    if (game.animationTimer !== null) {
      window.clearInterval(game.animationTimer);
      game.animationTimer = null;
    }
  }

  function newDeal(number = randomDeal()) {
    const validNumber = normaliseDealNumber(number);
    if (validNumber === null) {
      notify("invalid-deal");
      return false;
    }

    clearAnimation();
    game.columns = createDeal(validNumber);
    game.freeCells = [null, null, null, null];
    game.foundations = [0, 0, 0, 0];
    game.selected = null;
    game.dealNumber = validNumber;
    game.moves = 0;
    game.cheatMode = null;
    game.isFinished = false;
    game.isAnimating = false;
    game.modalOpen = false;

    dealNumberInput.value = String(validNumber);
    render();
    notify("reset");
    return true;
  }

  function buildCardMarkup(card, { selected = false } = {}) {
    const selectedClass = selected ? " is-selected" : "";
    const redClass = isRed(card) ? " is-red" : "";
    return `<span class="classic-card${redClass}${selectedClass}" aria-hidden="true">` +
      `<span class="card-corner">${labelCard(card)}</span>` +
      `<span class="card-suit">${SUITS[getSuit(card)]}</span>` +
      `</span>`;
  }

  function renderTopCells() {
    const freeCells = game.freeCells.map((card, index) => {
      const selected = game.selected?.zone === "free" && game.selected.index === index;
      const content = card === null
        ? `<span class="empty-symbol">◯</span>`
        : buildCardMarkup(card, { selected });
      return `<button type="button" class="classic-slot" data-zone="free" data-index="${index}" aria-label="自由寄放格 ${index + 1}${card === null ? '，空' : '，' + labelCard(card)}">${content}</button>`;
    });

    const foundations = game.foundations.map((count, index) => {
      const lastCard = count ? (count - 1) * 4 + index : null;
      const content = lastCard === null
        ? `<span class="empty-symbol">${SUITS[index]}</span>`
        : buildCardMarkup(lastCard);
      return `<button type="button" class="classic-slot is-foundation" data-zone="foundation" data-index="${index}" aria-label="${SUITS[index]}本位回收格${count ? '，' + labelCard(lastCard) : '，空'}">${content}</button>`;
    });

    topCellsElement.innerHTML = [...freeCells, ...foundations].join("");
  }

  function renderColumns() {
    const columnGap = Math.max(17, Math.min(33, tableElement.clientWidth / 23));
    // 依牌桌寬度計算牌尺寸，確保手機版每張牌仍可單獨點擊。
    const columnWidth = tableauElement.clientWidth
      ? (tableauElement.clientWidth - 7 * parseFloat(getComputedStyle(tableauElement).columnGap || 4)) / 8
      : Math.max(30, tableElement.clientWidth / 8 - 7);
    const cardHeight = Math.max(42, columnWidth / 0.72);

    tableauElement.innerHTML = game.columns.map((column, index) => {
      const height = cardHeight + Math.max(column.length - 1, 0) * columnGap + 9;
      const cards = column.map((card, cardIndex) => {
        const selected = game.selected?.zone === "column" &&
          game.selected.index === index && cardIndex >= game.selected.cardIndex;
        const redClass = isRed(card) ? " is-red" : "";
        const selectedClass = selected ? " is-selected" : "";

        return `<button type="button" class="classic-card${redClass}${selectedClass}"` +
          ` data-card-index="${cardIndex}" aria-label="第 ${index + 1} 欄，${labelCard(card)}"` +
          ` style="top:${(cardIndex * columnGap).toFixed(1)}px;z-index:${cardIndex + 1};">` +
          `<span class="card-corner">${labelCard(card)}</span>` +
          `<span class="card-suit">${SUITS[getSuit(card)]}</span></button>`;
      }).join("");

      return `<div class="classic-column" data-zone="column" data-index="${index}"` +
        ` style="height:${Math.ceil(height)}px;" aria-label="第 ${index + 1} 欄">${cards}</div>`;
    }).join("");
  }

  function render() {
    renderTopCells();
    renderColumns();
    moveCountElement.textContent = String(game.moves);
  }

  function selectedCards() {
    if (!game.selected) return [];
    if (game.selected.zone === "free") return [game.freeCells[game.selected.index]];
    return game.columns[game.selected.index].slice(game.selected.cardIndex);
  }

  function isDescendingAlternating(cards) {
    return cards.every((card, index) => index === cards.length - 1 ||
      (getRank(card) === getRank(cards[index + 1]) + 1 &&
       isRed(card) !== isRed(cards[index + 1])));
  }

  function selectCard(zone, index, cardIndex) {
    if (zone === "free") {
      if (game.freeCells[index] === null) return;
      game.selected = { zone, index };
      return;
    }

    if (zone !== "column") return;
    const cards = game.columns[index];
    if (!cards.length) return;
    const firstIndex = cardIndex ?? cards.length - 1;
    if (!isDescendingAlternating(cards.slice(firstIndex))) {
      notify("invalid-move");
      return;
    }
    game.selected = { zone, index, cardIndex: firstIndex };
  }

  function maxMoveCount(destinationIsEmpty) {
    const emptyFreeCells = game.freeCells.filter((card) => card === null).length;
    const emptyColumns = game.columns.filter((column) => column.length === 0).length;
    return (emptyFreeCells + 1) * (2 ** Math.max(0, emptyColumns - (destinationIsEmpty ? 1 : 0)));
  }

  function mayMoveTo(zone, index, moving) {
    if (!moving.length) return false;
    const firstCard = moving[0];

    if (zone === "foundation") {
      return moving.length === 1 && getSuit(firstCard) === index &&
        getRank(firstCard) === game.foundations[index];
    }

    if (zone === "free") {
      return moving.length === 1 && game.freeCells[index] === null;
    }

    if (zone !== "column") return false;
    if (game.selected.zone === "column" && game.selected.index === index) return false;

    const destination = game.columns[index];
    const topCard = destination[destination.length - 1];
    if (topCard === undefined) return moving.length <= maxMoveCount(true);

    return moving.length <= maxMoveCount(false) &&
      getRank(topCard) === getRank(firstCard) + 1 &&
      isRed(topCard) !== isRed(firstCard);
  }

  function removeSelection() {
    const selection = game.selected;
    if (selection.zone === "free") {
      game.freeCells[selection.index] = null;
    } else {
      game.columns[selection.index].splice(selection.cardIndex);
    }
  }

  function moveSelectionTo(zone, index) {
    if (!game.selected) return false;
    const cards = selectedCards();
    if (!mayMoveTo(zone, index, cards)) return false;

    removeSelection();
    if (zone === "foundation") {
      game.foundations[index]++;
    } else if (zone === "free") {
      game.freeCells[index] = cards[0];
    } else {
      game.columns[index].push(...cards);
    }

    game.selected = null;
    game.moves++;
    // 作弊必須等「真正成功移動一手牌」才可生效，選牌與非法移牌不計。
    const cheatMode = game.cheatMode;
    game.cheatMode = null;
    render();
    notify("moved", { moves: game.moves });

    if (cheatMode === "win") {
      animateCheatWin();
    } else if (cheatMode === "lose") {
      finish("lose", true);
    } else if (game.foundations.every((count) => count === 13)) {
      finish("win", false);
    }
    return true;
  }

  function trySingleCardShortcut() {
    const moving = selectedCards();
    if (moving.length !== 1) return false;
    const targetSuit = getSuit(moving[0]);
    if (moveSelectionTo("foundation", targetSuit)) return true;
    if (game.selected?.zone !== "column") return false;

    for (let index = 0; index < 4; index++) {
      if (game.freeCells[index] === null && moveSelectionTo("free", index)) return true;
    }
    return false;
  }

  function handleBoardClick(event) {
    if (game.isFinished || game.isAnimating || game.modalOpen) return;

    const target = event.target.closest("[data-zone]");
    if (!target || !tableElement.contains(target)) return;

    const zone = target.dataset.zone;
    const index = Number(target.dataset.index);
    const cardElement = event.target.closest("[data-card-index]");
    const cardIndex = cardElement ? Number(cardElement.dataset.cardIndex) : undefined;

    if (game.selected) {
      if (moveSelectionTo(zone, index)) return;

      // 再次點選同一張牌，模擬舊版的快速回收 / 放入空寄放格。
      const samePosition = game.selected.zone === zone && game.selected.index === index;
      const sameCard = zone !== "column" ||
        cardIndex === undefined || cardIndex === game.selected.cardIndex;
      if (samePosition && sameCard) {
        if (trySingleCardShortcut()) return;
        game.selected = null;
        render();
        return;
      }
      game.selected = null;
    }

    selectCard(zone, index, cardIndex);
    render();
  }

  function finish(result, cheated) {
    clearAnimation();
    game.isFinished = true;
    game.isAnimating = false;
    game.selected = null;
    render();
    notify("finished", { result, cheated });
  }

  function animateCheatWin() {
    game.isAnimating = true;
    game.selected = null;
    notify("animating");

    const remaining = [];
    for (let rank = 0; rank < 13; rank++) {
      for (let suit = 0; suit < 4; suit++) {
        if (rank >= game.foundations[suit]) remaining.push(rank * 4 + suit);
      }
    }

    // 有卡片已在回收格時從當前進度繼續，不倒退基礎堆疊。
    game.animationTimer = window.setInterval(() => {
      const card = remaining.shift();
      if (card === undefined) {
        finish("win", true);
        return;
      }

      for (const column of game.columns) {
        const cardIndex = column.indexOf(card);
        if (cardIndex !== -1) {
          column.splice(cardIndex, 1);
          break;
        }
      }
      game.freeCells = game.freeCells.map((value) => value === card ? null : value);
      game.foundations[getSuit(card)] = getRank(card) + 1;
      render();
      // 通知界面播放原版逐張收牌音效；遊戲核心不負責聲音與特效。
      notify("cheat-card", { card, remaining: remaining.length });
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 8 : 55);
  }

  function setCheatMode(mode) {
    if (game.isFinished || game.isAnimating) return false;
    if (mode !== null && mode !== "win" && mode !== "lose") return false;
    game.cheatMode = mode;
    notify("mode", { mode });
    return true;
  }

  function setModalOpen(isOpen) {
    game.modalOpen = Boolean(isOpen);
  }

  document.querySelector("#dealButton")?.addEventListener("click", () => {
    newDeal(dealNumberInput.value);
  });
  dealNumberInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      newDeal(dealNumberInput.value);
      dealNumberInput.blur();
    }
  });
  tableElement?.addEventListener("click", handleBoardClick);
  window.addEventListener("resize", () => {
    if (game.columns.length) render();
  });

  window.FreeCellCheatSimulator = Object.freeze({
    newDeal,
    randomDeal,
    isFinished: () => game.isFinished || game.isAnimating,
    setCheatMode,
    setModalOpen
  });

  newDeal(randomDeal());
})();
