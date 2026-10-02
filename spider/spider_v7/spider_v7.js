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

  const randomDealButton = document.getElementById("randomDealButton");
  const solvedDealButton = document.getElementById("solvedDealButton");
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
  const message = document.getElementById("message");
  const messageTitle = document.getElementById("messageTitle");
  const messageText = document.getElementById("messageText");
  const messageUid = document.getElementById("messageUid");
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
  let remoteSolvedDeals = [];
  let databaseReady = false;

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
    uidSearchPanel.hidden = true;
    uidDealButton.setAttribute("aria-expanded", "false");
    setPickerNotice("");
    setNotice(
      currentDealUid
        ? `已載入牌局 ${currentDealUid}`
        : "點一張牌或牌串開始。"
    );
    render();
    saveActiveGame();
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
    solvedDealCountElement.textContent = getAvailableSolvedDeals().length;

    stockButton.disabled = busy || stockCount === 0;
    restartButton.disabled = busy;
    randomDealButton.disabled = busy;
    solvedDealButton.disabled = busy;
    uidDealButton.disabled = busy;
    uidSearchButton.disabled = busy;
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

  function mergeSolvedDeals(...groups) {
    const byDeal = new Map();

    groups.flat().forEach(item => {
      if (!item || !Array.isArray(item.deal) || item.deal.length !== 104) return;
      const key = dealKeyOf(item.deal);
      if (!key) return;
      byDeal.set(key, {
        uid: String(item.uid || ""),
        deal: item.deal.slice(),
        solvedAt: String(item.solvedAt || "")
      });
    });

    return Array.from(byDeal.values()).filter(item => item.uid);
  }

  function getAvailableSolvedDeals() {
    return mergeSolvedDeals(readSolvedDeals(), remoteSolvedDeals);
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

  async function refreshRemoteSolvedDeals() {
    if (!window.SpiderSolvedDealsDB?.list) return false;

    try {
      remoteSolvedDeals = await window.SpiderSolvedDealsDB.list();
      databaseReady = true;

      remoteSolvedDeals.forEach(record => saveRecordLocally(record));
      render();
      return true;
    } catch (error) {
      databaseReady = false;
      console.warn("讀取雲端可解牌局失敗，改用本機牌庫。", error);
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

    await refreshRemoteSolvedDeals();
  }

  async function initializeDatabase() {
    const online = await refreshRemoteSolvedDeals();
    if (online) await syncLocalSolvedDealsToDatabase();
  }

  async function saveSolvedDeal() {
    if (!Array.isArray(originalDeal) || originalDeal.length !== 104) {
      return { uid: null, isNew: false, cloudSaved: false };
    }

    const key = dealKeyOf(originalDeal);
    const available = getAvailableSolvedDeals();
    const existing = available.find(item => dealKeyOf(item.deal) === key);
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
      await refreshRemoteSolvedDeals();

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

  async function playBOM() {
    const reduced = prefersReducedMotion();

    bombText.classList.remove("slowly-shine-text");
    void bombText.offsetWidth;
    bombText.classList.add("slowly-shine-text");

    bombOverlay.setAttribute("aria-hidden", "false");
    bombOverlay.classList.add("is-active");

    await sleep(reduced ? 80 : 820);

    bombOverlay.classList.remove("is-active");
    await sleep(reduced ? 20 : 330);
    bombOverlay.setAttribute("aria-hidden", "true");
  }

  async function checkWin() {
    if (completed !== 8) return false;

    const saved = await saveSolvedDeal();
    clearActiveGame();
    render();
    await playBOM();

    if (saved.isNew) {
      messageTitle.textContent = "恭喜玩家貢獻可解牌局";
      messageText.textContent = saved.cloudSaved
        ? `完成！共用了 ${moveCount} 步。這副牌已加入玩家可解牌庫。`
        : `完成！共用了 ${moveCount} 步。牌局已先保存在這台裝置，雲端目前未同步。`;
    } else {
      messageTitle.textContent = "牌局完成";
      messageText.textContent = `完成！共用了 ${moveCount} 步。這副牌原本就在玩家可解牌庫。`;
    }

    messageUid.textContent = saved.uid || "UID 建立失敗";
    message.hidden = false;
    return true;
  }

  async function loadRandomSolvedDeal() {
    if (busy) return;

    if (!databaseReady) await refreshRemoteSolvedDeals();
    const solvedDeals = getAvailableSolvedDeals();

    if (solvedDeals.length === 0) {
      setPickerNotice("目前還沒有玩家已解牌局。先去貢獻第一副吧。");
      return;
    }

    const index = Math.floor(Math.random() * solvedDeals.length);
    const record = solvedDeals[index];

    startGame({
      deal: record.deal,
      uid: record.uid,
      source: "solved"
    });
  }

  function findDealByUid(keyword) {
    const solvedDeals = getAvailableSolvedDeals();
    const q = String(keyword || "").trim();
    if (!q) return null;

    let matches = solvedDeals;

    if (window.FictionSearch?.search) {
      matches = window.FictionSearch.search(solvedDeals, q, ["uid"]);
    } else {
      matches = solvedDeals.filter(item =>
        String(item.uid || "").toLowerCase().includes(q.toLowerCase())
      );
    }

    const exact = matches.find(item =>
      String(item.uid).toLowerCase() === q.toLowerCase()
    );

    return exact || (matches.length === 1 ? matches[0] : null);
  }

  async function loadDealByUid() {
    if (busy) return;

    if (!databaseReady) await refreshRemoteSolvedDeals();
    const record = findDealByUid(uidInput.value);

    if (!record) {
      setPickerNotice("找不到這個 UID，或搜尋結果不只一副。請輸入完整 UID。");
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
    uidSearchPanel.hidden = true;
    uidDealButton.setAttribute("aria-expanded", "false");
    uidInput.value = "";
    setPickerNotice("");
    dealPicker.hidden = false;
  }

  function hideDealPicker() {
    dealPicker.hidden = true;
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
  solvedDealButton.addEventListener("click", () => void loadRandomSolvedDeal());
  uidDealButton.addEventListener("click", toggleUidSearch);
  uidSearchButton.addEventListener("click", () => void loadDealByUid());
  uidInput.addEventListener("keydown", event => {
    if (event.key === "Enter") void loadDealByUid();
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
