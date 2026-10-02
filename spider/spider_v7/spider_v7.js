(() => {
  "use strict";

  const gameShell = document.getElementById("gameShell");
  const tableauElement = document.getElementById("tableau");
  const stockButton = document.getElementById("stockButton");
  const completedArea = document.getElementById("completedArea");
  const completedCountElement = document.getElementById("completedCount");
  const dealCountElement = document.getElementById("dealCount");
  const moveCountElement = document.getElementById("moveCount");
  const solvedDealCountElement = document.getElementById("solvedDealCount");
  const noticeElement = document.getElementById("notice");
  const restartButton = document.getElementById("restartButton");
  const currentDealIdentity = document.getElementById("currentDealIdentity");
  const currentDealShortUid = document.getElementById("currentDealShortUid");
  const copyDealUidButton = document.getElementById("copyDealUidButton");

  const randomDealButton = document.getElementById("randomDealButton");
  const solvedDealButton = document.getElementById("solvedDealButton");
  const contributedPanel = document.getElementById("contributedPanel");
  const contributedList = document.getElementById("contributedList");
  const randomContributedButton = document.getElementById("randomContributedButton");
  const contributedPrevButton = document.getElementById("contributedPrevButton");
  const contributedNextButton = document.getElementById("contributedNextButton");
  const contributedPageInfo = document.getElementById("contributedPageInfo");
  const uidDealButton = document.getElementById("uidDealButton");
  const uidSearchPanel = document.getElementById("uidSearchPanel");
  const uidInput = document.getElementById("uidInput");
  const uidSearchButton = document.getElementById("uidSearchButton");
  const dealPicker = document.getElementById("dealPicker");
  const dealPickerNotice = document.getElementById("dealPickerNotice");
  const dealPickerBackButton = document.getElementById("dealPickerBackButton");

  const restartConfirm = document.getElementById("restartConfirm");
  const restartCancelButton = document.getElementById("restartCancelButton");
  const restartConfirmButton = document.getElementById("restartConfirmButton");

  const bombOverlay = document.getElementById("bombOverlay");
  const bombText = document.getElementById("bombText");
  const bombPlus = document.getElementById("bombPlus");
  const bombSubtext = document.getElementById("bombSubtext");
  const victoryParticles = document.getElementById("victoryParticles");
  const message = document.getElementById("message");
  const messageTitle = document.getElementById("messageTitle");
  const messageText = document.getElementById("messageText");
  const messageUid = document.getElementById("messageUid");
  const messageCopyUidButton = document.getElementById("messageCopyUidButton");
  const playAgainButton = document.getElementById("playAgainButton");

  const SOLVED_DEALS_STORAGE_KEY = "spider_solved_deals_v1";
  const ACTIVE_GAME_STORAGE_KEY = "spider_active_game_v1";

  const RANK_LABELS = {
    1: "A",
    11: "J",
    12: "Q",
    13: "K"
  };

  let columns = [];
  let stockDeck = null;
  let completed = 0;
  let moveCount = 0;
  let selection = null;
  let originalDeal = [];
  let currentDealUid = null;
  let currentDealSource = "random";
  let busy = false;
  let areaBurst = null;
  let remoteSolvedDealCount = 0;
  let databaseReady = false;
  let contributedPage = 1;
  let contributedTotalPages = 1;
  let contributedPageRecords = [];
  let contributedLoading = false;

  const VICTORY_EFFECTS = Object.freeze([
    "confetti",
    "gold-rain",
    "stars",
    "shockwave",
    "flash-shake",
    "jackpot-pop",
    "card-rain",
    "victory-beam"
  ]);

  let lastVictoryEffectSignature = "";

  function sleep(ms) {
    return new Promise(resolve => window.setTimeout(resolve, Math.max(0, ms)));
  }

  function prefersReducedMotion() {
    return Boolean(
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function initializeEffects() {
    if (window.SlowlyAreaBurst?.create) {
      areaBurst = window.SlowlyAreaBurst.create(gameShell, {
        type: "radial",
        duration: 260,
        zIndex: 40
      });
    }
  }

  function createDeckCardsFromRanks(ranks) {
    return ranks.map((rank, index) => ({
      id: `S-${index}-${rank}`,
      rank,
      faceUp: false
    }));
  }

  function createRandomCards() {
    const cards = [];
    let id = 0;

    for (let set = 0; set < 8; set += 1) {
      for (let rank = 1; rank <= 13; rank += 1) {
        cards.push({
          id: `S-${set}-${rank}-${id++}`,
          rank,
          faceUp: false
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
    // Deck.draw() 由 drawPile 尾端抽牌，所以要反轉，才能讓 deal[0] 成為第一張。
    const cards = createDeckCardsFromRanks(deal).reverse();

    return window.Deck.create({
      items: cards,
      recycleDiscard: false,
      shuffleOnReset: false,
      shuffleOnRecycle: false
    });
  }

  function assertDependencies() {
    if (!window.Deck?.create) {
      throw new Error("慢慢軍火庫 Deck 載入失敗。");
    }
  }


  function serializeCard(card) {
    return {
      rank: Number(card?.rank),
      faceUp: Boolean(card?.faceUp)
    };
  }

  function isValidRank(value) {
    const rank = Number(value);
    return Number.isInteger(rank) && rank >= 1 && rank <= 13;
  }

  function shortUid(uid) {
    const raw = String(uid || "")
      .replace(/^spider-/i, "")
      .replace(/[^a-z0-9]/gi, "")
      .toUpperCase();

    return raw ? `E-${raw.slice(0, 8)}` : "E-────────";
  }

  function findLocalDealByKey(key) {
    if (!key) return null;
    return readSolvedDeals().find(item => dealKeyOf(item.deal) === key) || null;
  }

  function renderDealIdentity() {
    const hasUid = Boolean(currentDealUid);
    currentDealIdentity.hidden = !hasUid;
    copyDealUidButton.disabled = !hasUid;

    if (hasUid) {
      currentDealShortUid.textContent = shortUid(currentDealUid);
    }
  }

  async function copyUid(uid, button = null) {
    const value = String(uid || "").trim();
    if (!value) return false;

    let copied = false;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        copied = true;
      }
    } catch (error) {
      console.warn("Clipboard API 複製失敗，改用備援方式。", error);
    }

    if (!copied) {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        copied = document.execCommand("copy");
        textarea.remove();
      } catch (error) {
        console.warn("UID 備援複製失敗。", error);
      }
    }

    if (button) {
      const original = button.textContent;
      button.textContent = copied ? "已複製" : "複製失敗";
      window.setTimeout(() => {
        button.textContent = original;
      }, 1200);
    }

    if (copied) {
      setNotice(`已複製牌局 UID：${shortUid(value)}`);
    }

    return copied;
  }

  function saveActiveGame() {
    if (!stockDeck || completed >= 8 || originalDeal.length !== 104) return false;

    try {
      const state = {
        version: 1,
        savedAt: window.Timestamp?.create ? window.Timestamp.create() : String(Date.now()),
        columns: columns.map(column => column.map(serializeCard)),
        stock: stockDeck.snapshot().drawPile.map(card => Number(card.rank)),
        completed,
        moveCount,
        originalDeal: originalDeal.slice(),
        currentDealUid,
        currentDealSource
      };

      localStorage.setItem(ACTIVE_GAME_STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      console.warn("儲存進行中牌局失敗。", error);
      return false;
    }
  }

  function clearActiveGame() {
    try {
      localStorage.removeItem(ACTIVE_GAME_STORAGE_KEY);
    } catch (error) {
      console.warn("清除進行中牌局失敗。", error);
    }
  }

  function readActiveGame() {
    try {
      const raw = localStorage.getItem(ACTIVE_GAME_STORAGE_KEY);
      if (!raw) return null;

      const state = JSON.parse(raw);
      if (!state || typeof state !== "object") return null;
      if (!Array.isArray(state.columns) || state.columns.length !== 10) return null;
      if (!Array.isArray(state.stock) || state.stock.length > 50 || state.stock.length % 10 !== 0) return null;
      if (!Array.isArray(state.originalDeal) || state.originalDeal.length !== 104) return null;
      if (!state.originalDeal.every(isValidRank) || !state.stock.every(isValidRank)) return null;

      const validColumns = state.columns.every(column =>
        Array.isArray(column) && column.every(card => card && isValidRank(card.rank))
      );
      if (!validColumns) return null;

      const nextCompleted = Number(state.completed);
      const nextMoveCount = Number(state.moveCount);
      if (!Number.isInteger(nextCompleted) || nextCompleted < 0 || nextCompleted > 8) return null;
      if (!Number.isInteger(nextMoveCount) || nextMoveCount < 0) return null;

      return state;
    } catch (error) {
      console.warn("讀取進行中牌局失敗。", error);
      return null;
    }
  }

  function restoreActiveGame() {
    const state = readActiveGame();
    if (!state) return false;

    assertDependencies();

    stockDeck = window.Deck.create({
      items: createDeckCardsFromRanks(state.stock),
      recycleDiscard: false,
      shuffleOnReset: false,
      shuffleOnRecycle: false
    });

    columns = state.columns.map((column, columnIndex) =>
      column.map((card, cardIndex) => ({
        id: `R-${columnIndex}-${cardIndex}-${card.rank}`,
        rank: Number(card.rank),
        faceUp: Boolean(card.faceUp)
      }))
    );

    completed = Number(state.completed);
    moveCount = Number(state.moveCount);
    originalDeal = state.originalDeal.map(Number);
    currentDealUid = state.currentDealUid || null;
    currentDealSource = state.currentDealSource || "random";
    selection = null;
    busy = false;

    clearCompletedRunsInstant();

    message.hidden = true;
    restartConfirm.hidden = true;
    dealPicker.hidden = true;
    contributedPanel.hidden = true;
    uidSearchPanel.hidden = true;
    uidDealButton.setAttribute("aria-expanded", "false");

    setNotice("已恢復上次牌局。");
    render();

    if (completed >= 8) {
      busy = true;
      render();
      window.setTimeout(() => void checkWin(), 0);
    } else {
      saveActiveGame();
      if (!currentDealUid && currentDealSource === "random") {
        void resolveCurrentDealIdentity();
      }
    }

    return true;
  }

  function startGame(options = {}) {
    assertDependencies();

    const knownDeal = Array.isArray(options.deal) && options.deal.length === 104
      ? options.deal.slice()
      : null;

    stockDeck = knownDeal
      ? createDeckForKnownDeal(knownDeal)
      : createDeckForRandomGame();

    originalDeal = knownDeal
      ? knownDeal.slice()
      : stockDeck
          .snapshot()
          .drawPile
          .slice()
          .reverse()
          .map(card => card.rank);

    currentDealUid = options.uid || null;
    currentDealSource = options.source || (knownDeal ? "solved" : "random");

    columns = Array.from({ length: 10 }, () => []);
    completed = 0;
    moveCount = 0;
    selection = null;
    busy = false;

    for (let columnIndex = 0; columnIndex < 10; columnIndex += 1) {
      const count = columnIndex < 4 ? 6 : 5;

      for (let i = 0; i < count; i += 1) {
        const [card] = stockDeck.draw(1);
        columns[columnIndex].push(card);
      }

      columns[columnIndex][columns[columnIndex].length - 1].faceUp = true;
    }

    message.hidden = true;
    restartConfirm.hidden = true;
    dealPicker.hidden = true;
    contributedPanel.hidden = true;
    uidSearchPanel.hidden = true;
    uidDealButton.setAttribute("aria-expanded", "false");
    setPickerNotice("");
    setNotice(
      currentDealUid
        ? `已載入玩家貢獻牌局 ${shortUid(currentDealUid)}`
        : "點一張牌或牌串開始。"
    );
    render();
    saveActiveGame();

    if (!currentDealUid && currentDealSource === "random") {
      void resolveCurrentDealIdentity();
    }
  }

  function render() {
    renderColumns();
    renderCompleted();

    const stockCount = stockDeck
      ? stockDeck.snapshot().drawPile.length
      : 0;

    completedCountElement.textContent = completed;
    dealCountElement.textContent = stockCount / 10;
    moveCountElement.textContent = moveCount;
    solvedDealCountElement.textContent = Math.max(remoteSolvedDealCount, readSolvedDeals().length);
    renderDealIdentity();

    stockButton.disabled = busy || stockCount === 0;
    restartButton.disabled = busy;
    randomDealButton.disabled = busy;
    solvedDealButton.disabled = busy || contributedLoading;
    randomContributedButton.disabled = busy || contributedLoading;
    uidDealButton.disabled = busy || contributedLoading;
    uidSearchButton.disabled = busy || contributedLoading;
    contributedPrevButton.disabled = busy || contributedLoading || contributedPage <= 1;
    contributedNextButton.disabled = busy || contributedLoading || contributedPage >= contributedTotalPages;
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
        const gap = card.faceUp ? 32 : 15;

        cardElement.style.top = `${top}px`;
        top += gap;
        column.appendChild(cardElement);
      });

      column.addEventListener("click", () => {
        if (busy || !selection) return;

        if (moveSelectionToColumn(columnIndex)) {
          void completeMove();
        } else {
          setNotice("這裡不能放。");
        }
      });

      tableauElement.appendChild(column);
    });
  }

  function createCardElement(card, columnIndex, cardIndex) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `card${card.faceUp ? "" : " face-down"}`;
    button.dataset.cardIndex = String(cardIndex);

    const isSelected =
      selection &&
      selection.column === columnIndex &&
      cardIndex >= selection.index;

    if (isSelected) {
      button.classList.add("selected");
    }

    if (!card.faceUp) {
      button.setAttribute("aria-label", "背面牌");
      button.disabled = true;
      return button;
    }

    button.setAttribute("aria-label", `${rankLabel(card.rank)}♠`);

    const rank = document.createElement("span");
    rank.className = "card-rank";
    rank.textContent = rankLabel(card.rank);

    const suit = document.createElement("span");
    suit.className = "card-suit";
    suit.textContent = "♠";

    button.append(rank, suit);

    button.addEventListener("click", event => {
      event.stopPropagation();
      if (!busy) handleCardClick(columnIndex, cardIndex);
    });

    return button;
  }

  function renderCompleted() {
    completedArea.innerHTML = "";

    for (let i = 0; i < 8; i += 1) {
      const slot = document.createElement("div");
      slot.className = `completed-slot${i < completed ? " done" : ""}`;
      slot.dataset.completedIndex = String(i);
      slot.textContent = i < completed ? "K♠" : "♠";
      completedArea.appendChild(slot);
    }
  }

  function handleCardClick(columnIndex, cardIndex) {
    if (selection) {
      if (
        selection.column === columnIndex &&
        selection.index === cardIndex
      ) {
        selection = null;
        setNotice("已取消選取。");
        render();
        return;
      }

      if (selection.column !== columnIndex) {
        if (moveSelectionToColumn(columnIndex)) {
          void completeMove();
          return;
        }
      }
    }

    if (!isMovableRun(columns[columnIndex], cardIndex)) {
      selection = null;
      setNotice("只有連續由大到小的牌串能一起移動。");
      render();
      return;
    }

    selection = {
      column: columnIndex,
      index: cardIndex
    };

    const length = columns[columnIndex].length - cardIndex;
    setNotice(length > 1 ? `已選取 ${length} 張牌。` : "已選取 1 張牌。");
    render();
  }

  function moveSelectionToColumn(destinationIndex) {
    if (!selection) return false;
    if (selection.column === destinationIndex) return false;

    const source = columns[selection.column];
    const moving = source.slice(selection.index);

    if (moving.length === 0) return false;

    const destination = columns[destinationIndex];
    const movingTop = moving[0];
    const destinationTop =
      destination.length > 0 ? destination[destination.length - 1] : null;

    if (
      destinationTop &&
      (!destinationTop.faceUp || destinationTop.rank !== movingTop.rank + 1)
    ) {
      return false;
    }

    source.splice(selection.index);
    destination.push(...moving);

    flipTopCard(selection.column);
    return true;
  }

  function isMovableRun(cards, startIndex) {
    if (
      startIndex < 0 ||
      startIndex >= cards.length ||
      !cards[startIndex].faceUp
    ) {
      return false;
    }

    for (let i = startIndex; i < cards.length - 1; i += 1) {
      const current = cards[i];
      const next = cards[i + 1];

      if (!next.faceUp || current.rank !== next.rank + 1) {
        return false;
      }
    }

    return true;
  }

  function flipTopCard(columnIndex) {
    const column = columns[columnIndex];
    if (column.length === 0) return;

    const topCard = column[column.length - 1];
    if (!topCard.faceUp) topCard.faceUp = true;
  }

  function findCompletedRun() {
    for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
      const column = columns[columnIndex];
      if (column.length < 13) continue;

      const start = column.length - 13;
      const run = column.slice(start);
      const valid = run.every((card, index) =>
        card.faceUp && card.rank === 13 - index
      );

      if (valid) {
        return { columnIndex, start };
      }
    }

    return null;
  }


  function clearCompletedRunsInstant() {
    let found = findCompletedRun();

    while (found) {
      columns[found.columnIndex].splice(found.start, 13);
      completed += 1;
      flipTopCard(found.columnIndex);
      found = findCompletedRun();
    }
  }

  async function animateCollectRun(columnIndex, start) {
    if (prefersReducedMotion()) return;

    const columnElement = tableauElement.querySelector(
      `.column[data-column-index="${columnIndex}"]`
    );
    const target = completedArea.querySelector(
      `.completed-slot[data-completed-index="${completed}"]`
    );

    if (!columnElement || !target) return;

    const cards = Array.from(columnElement.querySelectorAll(".card"))
      .slice(start, start + 13);

    if (cards.length !== 13) return;

    const targetRect = target.getBoundingClientRect();
    const targetX = targetRect.left + targetRect.width / 2;
    const targetY = targetRect.top + targetRect.height / 2;

    const animations = cards.map((card, index) => {
      const rect = card.getBoundingClientRect();
      const cardX = rect.left + rect.width / 2;
      const cardY = rect.top + rect.height / 2;
      const dx = targetX - cardX;
      const dy = targetY - cardY;

      const animation = card.animate(
        [
          { transform: "translate(0, 0) scale(1)", opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) scale(.34)`, opacity: 0.15 }
        ],
        {
          duration: 330,
          delay: index * 18,
          easing: "cubic-bezier(.2,.75,.25,1)",
          fill: "forwards"
        }
      );

      return animation.finished.catch(() => undefined);
    });

    await Promise.all(animations);
  }

  async function burstCompletedSlot(index) {
    const target = completedArea.querySelector(
      `.completed-slot[data-completed-index="${index}"]`
    );

    if (!target || !areaBurst) return;

    await areaBurst.play({
      targets: target,
      type: "radial",
      duration: 260,
      radialCore: "rgba(255,255,255,.98)",
      radialMid: "rgba(226,207,164,.9)",
      radialSoft: "rgba(255,255,255,.5)",
      glow: "rgba(255,244,207,.92)"
    });
  }

  async function clearCompletedRunsAnimated() {
    let found = findCompletedRun();

    while (found) {
      await animateCollectRun(found.columnIndex, found.start);

      columns[found.columnIndex].splice(found.start, 13);
      completed += 1;
      flipTopCard(found.columnIndex);
      render();
      saveActiveGame();
      await burstCompletedSlot(completed - 1);

      found = findCompletedRun();
    }
  }

  async function completeMove() {
    if (busy) return;

    busy = true;
    selection = null;
    moveCount += 1;
    render();
    saveActiveGame();

    await clearCompletedRunsAnimated();
    setNotice("移動完成。");
    render();
    saveActiveGame();
    await checkWin();

    if (completed !== 8) {
      busy = false;
      render();
    }
  }

  async function dealFromStock() {
    if (busy) return;
    if (!stockDeck || stockDeck.snapshot().drawPile.length < 10) return;

    if (columns.some(column => column.length === 0)) {
      setNotice("還有空白欄位，先放一張牌進去才能補牌。");
      return;
    }

    busy = true;
    selection = null;

    const dealtCards = stockDeck.draw(10);
    dealtCards.forEach((card, columnIndex) => {
      card.faceUp = true;
      columns[columnIndex].push(card);
    });

    moveCount += 1;
    render();
    saveActiveGame();

    await clearCompletedRunsAnimated();
    setNotice("已補一排牌。");
    render();
    saveActiveGame();
    await checkWin();

    if (completed !== 8) {
      busy = false;
      render();
    }
  }

  function readSolvedDeals() {
    try {
      const raw = localStorage.getItem(SOLVED_DEALS_STORAGE_KEY);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      let migrated = false;

      parsed.forEach(item => {
        if (
          item &&
          Array.isArray(item.deal) &&
          item.deal.length === 104 &&
          !item.uid
        ) {
          item.uid = createSolvedDealUid();
          migrated = true;
        }
      });

      if (migrated) {
        localStorage.setItem(
          SOLVED_DEALS_STORAGE_KEY,
          JSON.stringify(parsed)
        );
      }

      return parsed.filter(item =>
        item &&
        typeof item.uid === "string" &&
        Array.isArray(item.deal) &&
        item.deal.length === 104
      );
    } catch (error) {
      console.warn("讀取可解牌局失敗。", error);
      return [];
    }
  }

  function createSolvedDealUid() {
    if (window.RandomId?.create) {
      return window.RandomId.create({ prefix: "spider-" });
    }

    return `spider-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function writeSolvedDeals(solvedDeals) {
    try {
      localStorage.setItem(
        SOLVED_DEALS_STORAGE_KEY,
        JSON.stringify(solvedDeals)
      );
      return true;
    } catch (error) {
      console.warn("儲存可解牌局失敗。", error);
      return false;
    }
  }

  function dealKeyOf(deal) {
    return Array.isArray(deal) ? deal.join(",") : "";
  }

  function saveRecordLocally(record) {
    if (!record || !record.uid || !Array.isArray(record.deal)) return false;

    const key = dealKeyOf(record.deal);
    const solvedDeals = readSolvedDeals().filter(item => dealKeyOf(item.deal) !== key);
    solvedDeals.push({
      uid: record.uid,
      deal: record.deal.slice(),
      solvedAt: record.solvedAt || ""
    });
    return writeSolvedDeals(solvedDeals);
  }

  function getLocalSolvedDealsSorted() {
    return readSolvedDeals()
      .slice()
      .sort((a, b) => String(b.solvedAt || "").localeCompare(String(a.solvedAt || "")));
  }

  async function refreshRemoteSolvedDealCount() {
    if (!window.SpiderSolvedDealsDB?.count) return false;

    try {
      remoteSolvedDealCount = await window.SpiderSolvedDealsDB.count();
      databaseReady = true;
      render();
      return true;
    } catch (error) {
      databaseReady = false;
      console.warn("讀取雲端玩家貢獻牌局數量失敗，改用本機牌庫。", error);
      return false;
    }
  }

  async function syncLocalSolvedDealsToDatabase() {
    if (!window.SpiderSolvedDealsDB?.save) return;

    const localDeals = readSolvedDeals();
    for (const record of localDeals) {
      try {
        const result = await window.SpiderSolvedDealsDB.save(record);
        if (result?.record) saveRecordLocally(result.record);
      } catch (error) {
        console.warn("本機可解牌局同步至雲端失敗。", error);
        break;
      }
    }

    await refreshRemoteSolvedDealCount();
  }

  async function initializeDatabase() {
    const online = await refreshRemoteSolvedDealCount();
    if (online) await syncLocalSolvedDealsToDatabase();
  }

  async function resolveCurrentDealIdentity() {
    if (!Array.isArray(originalDeal) || originalDeal.length !== 104) return null;

    const key = dealKeyOf(originalDeal);
    const expectedKey = key;
    let record = findLocalDealByKey(key);

    if (!record && window.SpiderSolvedDealsDB?.findByDeal) {
      try {
        record = await window.SpiderSolvedDealsDB.findByDeal(originalDeal);
        if (record) saveRecordLocally(record);
      } catch (error) {
        console.warn("比對隨機牌局 UID 失敗。", error);
      }
    }

    if (!record || dealKeyOf(originalDeal) !== expectedKey || currentDealUid) {
      return record || null;
    }

    currentDealUid = record.uid;
    saveActiveGame();
    render();
    setNotice(`這副隨機牌局已在玩家貢獻牌庫：${shortUid(record.uid)}`);
    return record;
  }

  async function saveSolvedDeal() {
    if (!Array.isArray(originalDeal) || originalDeal.length !== 104) {
      return { uid: null, isNew: false, cloudSaved: false };
    }

    const key = dealKeyOf(originalDeal);
    const existing = findLocalDealByKey(key);
    const localWasNew = !existing;

    const record = existing || {
      uid: currentDealUid || createSolvedDealUid(),
      deal: originalDeal.slice(),
      solvedAt: window.Timestamp?.create ? window.Timestamp.create() : String(Date.now())
    };

    saveRecordLocally(record);
    currentDealUid = record.uid;

    if (!window.SpiderSolvedDealsDB?.save) {
      return { uid: record.uid, isNew: localWasNew, cloudSaved: false };
    }

    try {
      const result = await window.SpiderSolvedDealsDB.save(record);
      const canonical = result?.record || record;
      saveRecordLocally(canonical);
      currentDealUid = canonical.uid;
      await refreshRemoteSolvedDealCount();

      return {
        uid: canonical.uid,
        isNew: Boolean(result?.isNew),
        cloudSaved: true
      };
    } catch (error) {
      console.warn("可解牌局寫入雲端失敗，已保留本機紀錄。", error);
      return { uid: record.uid, isNew: localWasNew, cloudSaved: false };
    }
  }

  function clearVictoryParticles() {
    if (victoryParticles) victoryParticles.innerHTML = "";
    gameShell.classList.remove("victory-shake");
    VICTORY_EFFECTS.forEach(effectName => {
      bombOverlay.classList.remove(`fx-${effectName}`);
    });
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function pickVictoryEffects() {
    if (prefersReducedMotion()) return ["jackpot-pop"];

    const pool = VICTORY_EFFECTS.slice();
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // 每局抽 4～6 種，所有特效都在池裡輪流出現。
    const count = 4 + Math.floor(Math.random() * 3);
    let selected = pool.slice(0, count);
    let signature = selected.slice().sort().join("|");

    // 盡量不要連續兩場抽到完全相同的組合。
    if (signature === lastVictoryEffectSignature) {
      const replacement = pool.find(name => !selected.includes(name));
      if (replacement) {
        selected[selected.length - 1] = replacement;
        signature = selected.slice().sort().join("|");
      }
    }

    lastVictoryEffectSignature = signature;
    return selected;
  }

  function addVictoryNode(className, text = "") {
    if (!victoryParticles) return null;

    const node = document.createElement("span");
    node.className = className;
    node.textContent = text;
    victoryParticles.appendChild(node);
    return node;
  }

  function spawnConfettiBurst() {
    const count = 30;

    for (let i = 0; i < count; i += 1) {
      const node = addVictoryNode("vfx-confetti");
      if (!node) continue;

      const angle = randomBetween(-Math.PI * 0.94, -Math.PI * 0.06);
      const distance = randomBetween(150, 440);
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance + randomBetween(-10, 95);

      node.dataset.tone = String(i % 5);
      node.style.setProperty("--vfx-x", `${x.toFixed(1)}px`);
      node.style.setProperty("--vfx-y", `${y.toFixed(1)}px`);
      node.style.setProperty("--vfx-rot", `${Math.round(randomBetween(220, 920))}deg`);
      node.style.setProperty("--vfx-size", `${randomBetween(6, 13).toFixed(1)}px`);
      node.style.setProperty("--vfx-delay", `${Math.round(randomBetween(0, 160))}ms`);
      node.style.setProperty("--vfx-duration", `${Math.round(randomBetween(900, 1450))}ms`);
    }
  }

  function spawnGoldRain() {
    const count = 26;

    for (let i = 0; i < count; i += 1) {
      const node = addVictoryNode("vfx-gold-drop");
      if (!node) continue;

      node.style.left = `${randomBetween(2, 98).toFixed(1)}%`;
      node.style.setProperty("--vfx-drift", `${randomBetween(-70, 70).toFixed(1)}px`);
      node.style.setProperty("--vfx-size", `${randomBetween(3.5, 8.5).toFixed(1)}px`);
      node.style.setProperty("--vfx-delay", `${Math.round(randomBetween(0, 420))}ms`);
      node.style.setProperty("--vfx-duration", `${Math.round(randomBetween(900, 1550))}ms`);
    }
  }

  function spawnStarExplosion() {
    const glyphs = ["★", "✦", "✧", "✶"];
    const count = 20;

    for (let i = 0; i < count; i += 1) {
      const node = addVictoryNode("vfx-star", glyphs[i % glyphs.length]);
      if (!node) continue;

      const angle = (Math.PI * 2 * i) / count + randomBetween(-0.2, 0.2);
      const distance = randomBetween(125, 360);

      node.style.setProperty("--vfx-x", `${(Math.cos(angle) * distance).toFixed(1)}px`);
      node.style.setProperty("--vfx-y", `${(Math.sin(angle) * distance).toFixed(1)}px`);
      node.style.setProperty("--vfx-size", `${randomBetween(12, 27).toFixed(1)}px`);
      node.style.setProperty("--vfx-delay", `${Math.round(randomBetween(0, 130))}ms`);
      node.style.setProperty("--vfx-duration", `${Math.round(randomBetween(800, 1280))}ms`);
    }
  }

  function spawnShockwaves() {
    for (let i = 0; i < 3; i += 1) {
      const node = addVictoryNode("vfx-shockwave");
      if (!node) continue;
      node.style.setProperty("--vfx-delay", `${i * 135}ms`);
    }
  }

  function spawnScreenFlash() {
    addVictoryNode("vfx-screen-flash");
    gameShell.classList.remove("victory-shake");
    void gameShell.offsetWidth;
    gameShell.classList.add("victory-shake");
  }

  function spawnCardRain() {
    const cardFaces = ["♠", "A♠", "K♠", "Q♠", "J♠", "10♠"];
    const count = 18;

    for (let i = 0; i < count; i += 1) {
      const node = addVictoryNode("vfx-card", cardFaces[i % cardFaces.length]);
      if (!node) continue;

      node.style.left = `${randomBetween(2, 96).toFixed(1)}%`;
      node.style.setProperty("--vfx-drift", `${randomBetween(-90, 90).toFixed(1)}px`);
      node.style.setProperty("--vfx-rot", `${Math.round(randomBetween(-260, 260))}deg`);
      node.style.setProperty("--vfx-delay", `${Math.round(randomBetween(0, 520))}ms`);
      node.style.setProperty("--vfx-duration", `${Math.round(randomBetween(1150, 1850))}ms`);
    }
  }

  function spawnVictoryBeams() {
    const count = 7;

    for (let i = 0; i < count; i += 1) {
      const node = addVictoryNode("vfx-beam");
      if (!node) continue;

      node.style.setProperty("--vfx-angle", `${-62 + i * 21 + randomBetween(-5, 5)}deg`);
      node.style.setProperty("--vfx-delay", `${Math.round(i * 42 + randomBetween(0, 70))}ms`);
    }
  }

  function activateVictoryEffects(selectedEffects) {
    clearVictoryParticles();

    selectedEffects.forEach(effectName => {
      bombOverlay.classList.add(`fx-${effectName}`);
    });

    if (selectedEffects.includes("confetti")) spawnConfettiBurst();
    if (selectedEffects.includes("gold-rain")) spawnGoldRain();
    if (selectedEffects.includes("stars")) spawnStarExplosion();
    if (selectedEffects.includes("shockwave")) spawnShockwaves();
    if (selectedEffects.includes("flash-shake")) spawnScreenFlash();
    if (selectedEffects.includes("card-rain")) spawnCardRain();
    if (selectedEffects.includes("victory-beam")) spawnVictoryBeams();
  }

  function flashCompletedArea() {
    completedArea.classList.remove("victory-flash");
    void completedArea.offsetWidth;
    completedArea.classList.add("victory-flash");
  }

  async function playBOM(options = {}) {
    const reduced = prefersReducedMotion();
    const isNew = options.isNew !== false;
    const selectedEffects = pickVictoryEffects();

    bombText.textContent = isNew
      ? "恭喜玩家貢獻可解牌局"
      : "牌局完成";
    bombPlus.textContent = isNew ? "+1" : "CLEAR";
    bombSubtext.textContent = isNew
      ? "這副牌已加入玩家可解牌庫"
      : "這副牌原本就在玩家可解牌庫";

    bombText.classList.remove("slowly-shine-text");
    void bombText.offsetWidth;
    bombText.classList.add("slowly-shine-text");

    flashCompletedArea();
    activateVictoryEffects(selectedEffects);

    bombOverlay.setAttribute("aria-hidden", "false");
    bombOverlay.classList.add("is-active");

    console.info("Spider victory FX:", selectedEffects.join(", "));

    await sleep(reduced ? 220 : 1780);

    bombOverlay.classList.remove("is-active");
    await sleep(reduced ? 60 : 380);
    bombOverlay.setAttribute("aria-hidden", "true");
    completedArea.classList.remove("victory-flash");
    clearVictoryParticles();
  }

  async function checkWin() {
    if (completed !== 8) return false;

    const saved = await saveSolvedDeal();
    clearActiveGame();
    render();
    await playBOM({ isNew: saved.isNew });

    // 勝利流程結束後解除操作鎖。
    // 否則「選擇下一局」雖然能打開牌局選擇視窗，
    // 但三個牌局來源按鈕仍會因 busy=true 而維持 disabled。
    busy = false;
    render();

    if (saved.isNew) {
      messageTitle.textContent = "恭喜玩家貢獻可解牌局";
      messageText.textContent = saved.cloudSaved
        ? `完成！共用了 ${moveCount} 步。這副牌已加入玩家可解牌庫。`
        : `完成！共用了 ${moveCount} 步。牌局已先保存在這台裝置，雲端目前未同步。`;
    } else {
      messageTitle.textContent = "牌局完成";
      messageText.textContent = `完成！共用了 ${moveCount} 步。這副牌原本就在玩家可解牌庫。`;
    }

    messageUid.textContent = saved.uid ? shortUid(saved.uid) : "UID 建立失敗";
    messageCopyUidButton.hidden = !saved.uid;
    messageCopyUidButton.dataset.uid = saved.uid || "";
    message.hidden = false;
    return true;
  }

  function renderContributedPage(records, totalCount, page, totalPages) {
    contributedPageRecords = Array.isArray(records) ? records.slice() : [];
    contributedPage = Math.max(1, Number(page) || 1);
    contributedTotalPages = Math.max(1, Number(totalPages) || 1);
    remoteSolvedDealCount = Math.max(remoteSolvedDealCount, Number(totalCount) || 0);

    contributedList.innerHTML = "";

    if (contributedPageRecords.length === 0) {
      const empty = document.createElement("p");
      empty.className = "contributed-empty";
      empty.textContent = "目前還沒有玩家貢獻牌局。";
      contributedList.appendChild(empty);
    } else {
      contributedPageRecords.forEach(record => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "contributed-deal-row";
        button.dataset.uid = record.uid;

        const code = document.createElement("span");
        code.className = "contributed-code";
        code.textContent = shortUid(record.uid);
        button.appendChild(code);

        button.addEventListener("click", () => {
          if (busy || contributedLoading) return;
          startGame({
            deal: record.deal,
            uid: record.uid,
            source: "contributed"
          });
        });

        contributedList.appendChild(button);
      });
    }

    contributedPageInfo.textContent = `${contributedPage} / ${contributedTotalPages}`;
    render();
  }

  async function loadContributedPage(page = 1) {
    if (contributedLoading) return;

    contributedLoading = true;
    render();
    setPickerNotice("正在讀取玩家貢獻牌局…");

    try {
      if (window.SpiderSolvedDealsDB?.listPage) {
        const result = await window.SpiderSolvedDealsDB.listPage(page, 10);
        databaseReady = true;
        remoteSolvedDealCount = Number(result.totalCount || 0);
        renderContributedPage(
          result.records || [],
          result.totalCount || 0,
          result.page || page,
          result.totalPages || 1
        );
        setPickerNotice(result.totalCount > 0 ? `共有 ${result.totalCount} 副玩家貢獻牌局。` : "目前還沒有玩家貢獻牌局。");
        return;
      }

      throw new Error("雲端分頁功能尚未載入。");
    } catch (error) {
      console.warn("讀取玩家貢獻牌局分頁失敗，改用本機牌庫。", error);

      const localDeals = getLocalSolvedDealsSorted();
      const totalCount = localDeals.length;
      const totalPages = Math.max(1, Math.ceil(totalCount / 10));
      const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
      const start = (safePage - 1) * 10;
      const records = localDeals.slice(start, start + 10);

      renderContributedPage(records, totalCount, safePage, totalPages);
      setPickerNotice(totalCount > 0 ? "目前使用這台裝置上的玩家貢獻牌局。" : "目前還沒有玩家貢獻牌局。");
    } finally {
      contributedLoading = false;
      render();
    }
  }

  async function openContributedPanel() {
    if (busy) return;

    contributedPanel.hidden = false;
    uidSearchPanel.hidden = true;
    uidDealButton.setAttribute("aria-expanded", "false");
    uidInput.value = "";
    await loadContributedPage(1);
  }

  async function loadRandomSolvedDeal() {
    if (busy || contributedLoading) return;

    contributedLoading = true;
    render();
    setPickerNotice("正在從玩家貢獻牌局隨機抽一副…");

    try {
      let record = null;

      if (window.SpiderSolvedDealsDB?.random) {
        record = await window.SpiderSolvedDealsDB.random();
        databaseReady = true;
      }

      if (!record) {
        const localDeals = getLocalSolvedDealsSorted();
        if (localDeals.length > 0) {
          record = localDeals[Math.floor(Math.random() * localDeals.length)];
        }
      }

      if (!record) {
        setPickerNotice("目前還沒有玩家貢獻牌局。先去貢獻第一副吧。");
        return;
      }

      startGame({
        deal: record.deal,
        uid: record.uid,
        source: "contributed-random"
      });
    } catch (error) {
      console.warn("隨機讀取玩家貢獻牌局失敗。", error);
      setPickerNotice("玩家貢獻牌局目前讀取失敗，請稍後再試。");
    } finally {
      contributedLoading = false;
      render();
    }
  }

  async function loadDealByUid() {
    if (busy || contributedLoading) return;

    const q = String(uidInput.value || "").trim();
    if (!q) {
      setPickerNotice("貼上完整 UID 後再載入。");
      return;
    }

    let record = readSolvedDeals().find(item =>
      String(item.uid || "").toLowerCase() === q.toLowerCase()
    ) || null;

    if (!record && window.SpiderSolvedDealsDB?.findByUid) {
      try {
        record = await window.SpiderSolvedDealsDB.findByUid(q);
        if (record) {
          databaseReady = true;
          saveRecordLocally(record);
        }
      } catch (error) {
        console.warn("UID 查詢失敗。", error);
      }
    }

    if (!record) {
      setPickerNotice("找不到這個完整 UID。");
      return;
    }

    startGame({
      deal: record.deal,
      uid: record.uid,
      source: "uid"
    });
  }

  function toggleUidSearch() {
    const willOpen = uidSearchPanel.hidden;
    uidSearchPanel.hidden = !willOpen;
    uidDealButton.setAttribute("aria-expanded", String(willOpen));

    if (willOpen) {
      uidInput.focus();
    }
  }

  function rankLabel(rank) {
    return RANK_LABELS[rank] || String(rank);
  }

  function setNotice(text) {
    noticeElement.textContent = text;
  }

  function setPickerNotice(text) {
    dealPickerNotice.textContent = String(text || "");
  }

  function showDealPicker(options = {}) {
    const canReturn = options.canReturn !== false;
    restartConfirm.hidden = true;
    message.hidden = true;
    dealPickerBackButton.hidden = !canReturn;
    contributedPanel.hidden = true;
    uidSearchPanel.hidden = true;
    uidDealButton.setAttribute("aria-expanded", "false");
    uidInput.value = "";
    contributedList.innerHTML = "";
    contributedPage = 1;
    contributedTotalPages = 1;
    contributedPageRecords = [];
    contributedPageInfo.textContent = "1 / 1";
    setPickerNotice("");
    dealPicker.hidden = false;
  }

  function hideDealPicker() {
    dealPicker.hidden = true;
    contributedPanel.hidden = true;
    uidSearchPanel.hidden = true;
    uidDealButton.setAttribute("aria-expanded", "false");
    setPickerNotice("");
  }

  function openRestartConfirm() {
    if (busy) return;
    restartConfirm.hidden = false;
  }

  stockButton.addEventListener("click", () => void dealFromStock());
  restartButton.addEventListener("click", openRestartConfirm);
  restartCancelButton.addEventListener("click", () => {
    restartConfirm.hidden = true;
  });
  restartConfirmButton.addEventListener("click", () => {
    restartConfirm.hidden = true;
    showDealPicker({ canReturn: true });
  });
  dealPickerBackButton.addEventListener("click", hideDealPicker);

  randomDealButton.addEventListener("click", () => {
    if (!busy) startGame({ source: "random" });
  });
  solvedDealButton.addEventListener("click", () => void openContributedPanel());
  randomContributedButton.addEventListener("click", () => void loadRandomSolvedDeal());
  contributedPrevButton.addEventListener("click", () => {
    if (contributedPage > 1) void loadContributedPage(contributedPage - 1);
  });
  contributedNextButton.addEventListener("click", () => {
    if (contributedPage < contributedTotalPages) void loadContributedPage(contributedPage + 1);
  });
  uidDealButton.addEventListener("click", toggleUidSearch);
  uidSearchButton.addEventListener("click", () => void loadDealByUid());
  uidInput.addEventListener("keydown", event => {
    if (event.key === "Enter") void loadDealByUid();
  });
  copyDealUidButton.addEventListener("click", () => void copyUid(currentDealUid, copyDealUidButton));
  messageCopyUidButton.addEventListener("click", () => {
    void copyUid(messageCopyUidButton.dataset.uid, messageCopyUidButton);
  });
  playAgainButton.addEventListener("click", () => showDealPicker({ canReturn: false }));

  window.addEventListener("pagehide", () => {
    if (completed < 8) saveActiveGame();
  });

  initializeEffects();
  render();

  if (!restoreActiveGame()) {
    showDealPicker({ canReturn: false });
  }

  void initializeDatabase();
})();
