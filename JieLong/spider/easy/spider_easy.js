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
  const currentDealBest = document.getElementById("currentDealBest");
  const currentDealBestSteps = document.getElementById("currentDealBestSteps");
  const currentDealClears = document.getElementById("currentDealClears");
  const currentDealClearCount = document.getElementById("currentDealClearCount");

  const randomDealButton = document.getElementById("randomDealButton");
  const solvedDealButton = document.getElementById("solvedDealButton");
  const pendingDealButton = document.getElementById("pendingDealButton");
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
  const restartCurrentButton = document.getElementById("restartCurrentButton");
  const restartConfirmButton = document.getElementById("restartConfirmButton");

  const bombOverlay = document.getElementById("bombOverlay");
  const bombText = document.getElementById("bombText");
  const bombPlus = document.getElementById("bombPlus");
  const bombSubtext = document.getElementById("bombSubtext");
  const victoryParticles = document.getElementById("victoryParticles");
  const message = document.getElementById("message");
  const messageTitle = document.getElementById("messageTitle");
  const messageText = document.getElementById("messageText");
  const messageBest = document.getElementById("messageBest");
  const messageClears = document.getElementById("messageClears");
  const messageUid = document.getElementById("messageUid");
  const messageCopyUidButton = document.getElementById("messageCopyUidButton");
  const playAgainButton = document.getElementById("playAgainButton");

  const SOLVED_DEALS_STORAGE_KEY = "spider_solved_deals_v1";
  const PENDING_DEALS_STORAGE_KEY = "spider_pending_deals_v1";
  const ACTIVE_GAME_STORAGE_KEY = "spider_active_game_v1";
  const BEST_STEPS_STORAGE_KEY = "spider_best_steps_v1";
  const LAST_VICTORY_EFFECTS_STORAGE_KEY = "spider_last_victory_effects_v1";

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
  let currentDealBestValue = null;
  let currentDealClearValue = 0;
  let busy = false;
  let areaBurst = null;
  let remoteSolvedDealCount = 0;
  let databaseReady = false;
  let contributedPage = 1;
  let contributedTotalPages = 1;
  let contributedPageRecords = [];
  let contributedLoading = false;
  let contributedMode = "solved";

  const VICTORY_EFFECTS = Object.freeze([
    "confetti",
    "gold-rain",
    "stars",
    "shockwave",
    "flash-shake",
    "jackpot-pop",
    "card-rain",
    "victory-beam",
    "classic-fireworks"
  ]);

  let lastVictoryEffectSignature = "";
  let lastVictoryEffects = (() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(LAST_VICTORY_EFFECTS_STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.filter(name => VICTORY_EFFECTS.includes(name)) : [];
    } catch {
      return [];
    }
  })();

  function sleep(ms) {
    return new Promise(resolve => window.setTimeout(resolve, Math.max(0, ms)));
  }

  function prefersReducedMotion() {
    return Boolean(
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }


  /* ===============================
     音效｜沿用消消樂既有音色
     - 點牌：Match3 sfxSwap
     - 無效：Match3 sfxBad
     - 移動：Match3 sfxShuffle
     - 發牌：Match3 Combo 鋼琴音階，逐張飛牌逐音上行
     - 收牌：同一套音色，K → A 逐張飛回完成區並一路下行
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
      console.warn("[Spider] 音效播放失敗：", error);
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
      console.warn("[Spider] 鋼琴音效播放失敗：", error);
    }
  }

  function sfxCardSelect() {
    // Match3 sfxSwap
    playTone({ freq: 520, dur: 0.06, type: "triangle", gain: 0.10, slide: 0.8 });
  }

  function sfxBad() {
    // Match3 sfxBad
    playTone({ freq: 180, dur: 0.10, type: "sine", gain: 0.05, slide: 0 });
  }

  function sfxMove() {
    // Match3 sfxShuffle
    void playPianoNotes(["D4", "A4"], {
      gain: 0.09,
      hold: 0.04,
      release: 0.11,
      spacing: 0.055,
      type: "sine"
    });
  }

  const DEAL_COMBO_NOTES = Object.freeze([
    "C4", "D4", "E4", "F4", "G4",
    "A4", "B4", "C5", "B4", "A4"
  ]);

  const COLLECT_COMBO_NOTES = Object.freeze([
    "C5", "B4", "A4", "G4", "F4", "E4", "D4",
    "C4", "B3", "A3", "G3", "F3", "E3"
  ]);

  function playCardFlightNote(noteId, gain = 0.10) {
    void playPianoNotes([noteId], {
      gain,
      hold: 0.035,
      release: 0.095,
      spacing: 0,
      type: "sine"
    });
  }

  function sfxDealStep(index) {
    const note = DEAL_COMBO_NOTES[index % DEAL_COMBO_NOTES.length];
    if (note) playCardFlightNote(note, 0.10);
  }

  function sfxCollectStep(index) {
    const note = COLLECT_COMBO_NOTES[index % COLLECT_COMBO_NOTES.length];
    if (note) playCardFlightNote(note, 0.098);
  }

  function sfxDealReducedMotion() {
    void playPianoNotes(DEAL_COMBO_NOTES, {
      gain: 0.10,
      hold: 0.04,
      release: 0.10,
      spacing: 0.06,
      type: "sine"
    });
  }

  function sfxCollectReducedMotion() {
    void playPianoNotes(COLLECT_COMBO_NOTES, {
      gain: 0.098,
      hold: 0.035,
      release: 0.095,
      spacing: 0.055,
      type: "sine"
    });
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


  function readBestStepsMap() {
    try {
      const raw = localStorage.getItem(BEST_STEPS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      console.warn("讀取最佳步數失敗。", error);
      return {};
    }
  }

  function localBestSteps(uid) {
    const value = Number(readBestStepsMap()[String(uid || "")]);
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  function saveLocalBestSteps(uid, steps) {
    const key = String(uid || "");
    const value = Number(steps);
    if (!key || !Number.isInteger(value) || value <= 0) return { bestSteps: null, isRecord: false, previousBest: null };

    const map = readBestStepsMap();
    const previous = Number(map[key]);
    const previousBest = Number.isInteger(previous) && previous > 0 ? previous : null;
    const isRecord = previousBest === null || value < previousBest;
    const bestSteps = isRecord ? value : previousBest;

    if (isRecord) {
      map[key] = value;
      try {
        localStorage.setItem(BEST_STEPS_STORAGE_KEY, JSON.stringify(map));
      } catch (error) {
        console.warn("儲存最佳步數失敗。", error);
      }
    }

    return { bestSteps, isRecord, previousBest };
  }

  function bestStepsForRecord(record) {
    const remote = Number(record?.bestSteps);
    const local = localBestSteps(record?.uid);
    if (Number.isInteger(remote) && remote > 0 && Number.isInteger(local) && local > 0) return Math.min(remote, local);
    if (Number.isInteger(remote) && remote > 0) return remote;
    return local;
  }

  function clearCountForRecord(record) {
    const value = Number(record?.clearCount);
    return Number.isInteger(value) && value >= 0 ? value : 0;
  }

  async function recordClear(uid) {
    const q = String(uid || "").trim();
    if (!q) return { clearCount: 0, cloudSaved: false };

    if (window.SpiderSolvedDealsDB?.incrementClearCount) {
      try {
        const result = await window.SpiderSolvedDealsDB.incrementClearCount(q);
        const value = Number(result?.clearCount);
        if (Number.isInteger(value) && value >= 0) {
          currentDealClearValue = value;

          const localRecord = readSolvedDeals().find(item => String(item.uid || "") === q);
          if (localRecord) saveRecordLocally({ ...localRecord, clearCount: value });

          return { clearCount: value, cloudSaved: true };
        }
      } catch (error) {
        console.warn("雲端破關次數更新失敗。", error);
      }
    }

    currentDealClearValue = Math.max(0, Number(currentDealClearValue) || 0) + 1;
    const localRecord = readSolvedDeals().find(item => String(item.uid || "") === q);
    if (localRecord) saveRecordLocally({ ...localRecord, clearCount: currentDealClearValue });
    return { clearCount: currentDealClearValue, cloudSaved: false };
  }

  async function recordBestSteps(uid, steps) {
    const localResult = saveLocalBestSteps(uid, steps);
    let cloudBest = null;

    if (window.SpiderSolvedDealsDB?.updateBestSteps) {
      try {
        const result = await window.SpiderSolvedDealsDB.updateBestSteps(uid, steps);
        const value = Number(result?.bestSteps);
        if (Number.isInteger(value) && value > 0) cloudBest = value;
      } catch (error) {
        console.warn("雲端最佳步數更新失敗，保留本機紀錄。", error);
      }
    }

    const bestSteps = cloudBest && localResult.bestSteps
      ? Math.min(cloudBest, localResult.bestSteps)
      : (cloudBest || localResult.bestSteps || Number(steps));

    return { ...localResult, bestSteps, cloudSaved: Boolean(cloudBest) };
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
      const localBest = localBestSteps(currentDealUid);
      const best = currentDealBestValue && localBest
        ? Math.min(currentDealBestValue, localBest)
        : (currentDealBestValue || localBest);
      currentDealBest.hidden = !best;
      currentDealBestSteps.textContent = best || "—";
      currentDealClears.hidden = !(currentDealClearValue > 0);
      currentDealClearCount.textContent = currentDealClearValue > 0 ? currentDealClearValue : "—";
    } else {
      currentDealBest.hidden = true;
      currentDealBestSteps.textContent = "—";
      currentDealClears.hidden = true;
      currentDealClearCount.textContent = "—";
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
        currentDealSource,
        currentDealClearValue
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
    currentDealBestValue = currentDealUid ? localBestSteps(currentDealUid) : null;
    currentDealClearValue = Math.max(0, Number(state.currentDealClearValue) || 0);
    selection = null;
    busy = false;

    clearCompletedRunsInstant();

    message.hidden = true;
    messageBest.hidden = true;
    messageBest.textContent = "";
    messageClears.hidden = true;
    messageClears.textContent = "";
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
    currentDealBestValue = Number(options.bestSteps) > 0 ? Number(options.bestSteps) : (currentDealUid ? localBestSteps(currentDealUid) : null);
    currentDealClearValue = Math.max(0, Number(options.clearCount) || 0);

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
    messageBest.hidden = true;
    messageBest.textContent = "";
    messageClears.hidden = true;
    messageClears.textContent = "";
    restartConfirm.hidden = true;
    dealPicker.hidden = true;
    contributedPanel.hidden = true;
    uidSearchPanel.hidden = true;
    uidDealButton.setAttribute("aria-expanded", "false");
    setPickerNotice("");
    setNotice(
      currentDealUid
        ? (currentDealSource === "pending"
            ? `已載入待破解牌局 ${shortUid(currentDealUid)}`
            : `已載入玩家已解牌局 ${shortUid(currentDealUid)}`)
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
    pendingDealButton.disabled = busy || contributedLoading;
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
        sfxCardSelect();
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
      sfxBad();
      setNotice("只有連續由大到小的牌串能一起移動。");
      render();
      return;
    }

    selection = {
      column: columnIndex,
      index: cardIndex
    };
    sfxCardSelect();

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
    sfxMove();
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

  function centerOfRect(rect) {
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  async function animateExistingCardToTarget(cardElement, targetElement, options = {}) {
    if (!cardElement || !targetElement || !cardElement.animate) return;

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

  async function animateDealCardToTarget(targetElement, noteIndex) {
    const sourceElement = stockButton.querySelector(".stock-icon") || stockButton;
    if (!sourceElement || !targetElement) {
      sfxDealStep(noteIndex);
      return;
    }

    const sourceRect = sourceElement.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();
    const source = centerOfRect(sourceRect);
    const target = centerOfRect(targetRect);
    const width = Math.max(18, targetRect.width);
    const height = Math.max(26, targetRect.height);

    const ghost = document.createElement("div");
    ghost.className = "spider-flying-card spider-flying-card--back";
    ghost.setAttribute("aria-hidden", "true");
    ghost.style.width = `${width}px`;
    ghost.style.height = `${height}px`;
    ghost.style.left = `${source.x - width / 2}px`;
    ghost.style.top = `${source.y - height / 2}px`;
    document.body.appendChild(ghost);

    targetElement.classList.add("deal-card-pending");

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const arc = 24 + Math.min(34, Math.abs(dx) * 0.035);

    try {
      if (ghost.animate) {
        const animation = ghost.animate(
          [
            { transform: "translate3d(0,0,0) scale(.82) rotate(-3deg)", opacity: 0.96 },
            {
              transform: `translate3d(${(dx * 0.52).toFixed(1)}px, ${(dy * 0.46 - arc).toFixed(1)}px, 0) scale(.94) rotate(2deg)`,
              opacity: 1
            },
            {
              transform: `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(1) rotate(0deg)`,
              opacity: 1
            }
          ],
          {
            duration: 118,
            easing: "cubic-bezier(.18,.72,.22,1)",
            fill: "forwards"
          }
        );
        await animation.finished.catch(() => undefined);
      }
    } finally {
      ghost.remove();
      targetElement.classList.remove("deal-card-pending");
      targetElement.classList.add("deal-card-arrived");
      sfxDealStep(noteIndex);
    }

    await sleep(18);
  }

  async function animateCollectRun(columnIndex, start) {
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

    if (prefersReducedMotion()) {
      sfxCollectReducedMotion();
      return;
    }

    for (let index = 0; index < cards.length; index += 1) {
      await animateExistingCardToTarget(cards[index], target, {
        duration: 92,
        arc: 20 + index * 0.7
      });
      sfxCollectStep(index);
      await sleep(12);
    }
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
      sfxBad();
      setNotice("還有空白欄位，先放一張牌進去才能發牌。");
      return;
    }

    busy = true;
    selection = null;
    render();

    const dealtCards = stockDeck.draw(10);
    dealtCards.forEach(card => {
      card.faceUp = true;
    });

    if (prefersReducedMotion()) {
      dealtCards.forEach((card, columnIndex) => {
        columns[columnIndex].push(card);
      });
      render();
      sfxDealReducedMotion();
    } else {
      try {
        for (let columnIndex = 0; columnIndex < dealtCards.length; columnIndex += 1) {
          const card = dealtCards[columnIndex];
          columns[columnIndex].push(card);
          render();

          const columnElement = tableauElement.querySelector(
            `.column[data-column-index="${columnIndex}"]`
          );
          const cards = columnElement
            ? Array.from(columnElement.querySelectorAll(".card"))
            : [];
          const target = cards[cards.length - 1] || null;

          await animateDealCardToTarget(target, columnIndex);
        }
      } catch (error) {
        console.warn("[Spider] 發牌動畫中斷，已直接補齊剩餘牌。", error);
        dealtCards.forEach((card, columnIndex) => {
          if (!columns[columnIndex].includes(card)) {
            columns[columnIndex].push(card);
          }
        });
        render();
      }
    }

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
    const current = readSolvedDeals();
    const previous = current.find(item => dealKeyOf(item.deal) === key) || null;
    const solvedDeals = current.filter(item => dealKeyOf(item.deal) !== key);
    const recordClear = clearCountForRecord(record);
    const previousClear = clearCountForRecord(previous);
    solvedDeals.push({
      uid: record.uid,
      deal: record.deal.slice(),
      solvedAt: record.solvedAt || previous?.solvedAt || "",
      bestSteps: bestStepsForRecord(record) || bestStepsForRecord(previous) || null,
      clearCount: Math.max(recordClear, previousClear)
    });
    return writeSolvedDeals(solvedDeals);
  }

  function readPendingDeals() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PENDING_DEALS_STORAGE_KEY) || "[]");
      return Array.isArray(parsed)
        ? parsed.filter(item =>
            item &&
            typeof item.uid === "string" &&
            Array.isArray(item.deal) &&
            item.deal.length === 104 &&
            Boolean(dealKeyOf(item.deal))
          )
        : [];
    } catch (error) {
      console.warn("讀取待破解牌局失敗。", error);
      return [];
    }
  }

  function writePendingDeals(records) {
    try {
      localStorage.setItem(PENDING_DEALS_STORAGE_KEY, JSON.stringify(records));
      return true;
    } catch (error) {
      console.warn("儲存待破解牌局失敗。", error);
      return false;
    }
  }

  function savePendingRecordLocally(record) {
    if (!record?.uid || !Array.isArray(record.deal) || record.deal.length !== 104) return false;
    const key = dealKeyOf(record.deal);
    if (!key) return false;

    const records = readPendingDeals();
    const previous = records.find(item => dealKeyOf(item.deal) === key) || null;
    const next = records.filter(item => dealKeyOf(item.deal) !== key);
    const deal = record.deal;
    next.push({
      uid: record.uid,
      deal: deal.slice(),
      addedAt: record.addedAt || previous?.addedAt || "",
      attemptCount: Math.max(1, Number(record.attemptCount || previous?.attemptCount) || 1)
    });
    return writePendingDeals(next);
  }

  function removePendingRecordLocally(deal, uid = "") {
    const key = dealKeyOf(deal);
    const q = String(uid || "").trim();
    if (!key && !q) return false;

    const records = readPendingDeals();
    const next = records.filter(item => {
      if (key && dealKeyOf(item.deal) === key) return false;
      if (q && String(item.uid || "") === q) return false;
      return true;
    });
    return next.length === records.length ? false : writePendingDeals(next);
  }

  function findLocalPendingByKey(key) {
    if (!key) return null;
    return readPendingDeals().find(item => dealKeyOf(item.deal) === key) || null;
  }

  function getLocalPendingDealsSorted() {
    return readPendingDeals()
      .slice()
      .sort((a, b) => String(b.addedAt || "").localeCompare(String(a.addedAt || "")));
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
      console.warn("讀取雲端玩家已解牌局數量失敗，改用本機牌庫。", error);
      return false;
    }
  }

  async function promotePendingRecord(record) {
    if (!record?.uid || !Array.isArray(record.deal) || record.deal.length !== 104) return false;

    removePendingRecordLocally(record.deal, record.uid);

    if (!window.SpiderPendingDealsDB?.promote) return false;

    try {
      return await window.SpiderPendingDealsDB.promote(record.uid, record.deal);
    } catch (error) {
      console.warn("待破解牌局移轉失敗。", error);
      return false;
    }
  }

  async function savePendingDeal(deal, uid = null) {
    const key = dealKeyOf(deal);
    if (!key || !Array.isArray(deal) || deal.length !== 104) return null;

    const localSolved = findLocalDealByKey(key);
    if (localSolved) {
      removePendingRecordLocally(deal, uid);
      return null;
    }

    let record = findLocalPendingByKey(key);
    if (!record) {
      record = {
        uid: String(uid || "").trim() || createSolvedDealUid(),
        deal: deal.slice(),
        addedAt: window.Timestamp?.create ? window.Timestamp.create() : String(Date.now()),
        attemptCount: 1
      };
    }
    savePendingRecordLocally(record);

    if (window.SpiderSolvedDealsDB?.findByDeal) {
      try {
        const solved = await window.SpiderSolvedDealsDB.findByDeal(deal);
        if (solved) {
          saveRecordLocally(solved);
          removePendingRecordLocally(deal, record.uid);
          await promotePendingRecord(solved);
          return null;
        }
      } catch (error) {
        console.warn("待破解牌局比對已解牌庫失敗。", error);
      }
    }

    if (window.SpiderPendingDealsDB?.save) {
      try {
        const result = await window.SpiderPendingDealsDB.save(record);
        if (result?.solved) {
          removePendingRecordLocally(deal, record.uid);
          return null;
        }
        if (result?.record) {
          record = result.record;
          savePendingRecordLocally(record);
        }
      } catch (error) {
        console.warn("待破解牌局寫入雲端失敗，已保留本機紀錄。", error);
      }
    }

    return record;
  }

  async function markPendingAttempt(record) {
    if (!record?.uid || !Array.isArray(record.deal) || record.deal.length !== 104) return record || null;

    const localRecord = {
      ...record,
      attemptCount: Math.max(1, Number(record.attemptCount) || 1) + 1
    };

    if (window.SpiderPendingDealsDB?.incrementAttempt) {
      try {
        const value = await window.SpiderPendingDealsDB.incrementAttempt(record.uid);
        if (Number.isInteger(Number(value)) && Number(value) >= 1) {
          localRecord.attemptCount = Number(value);
        }
      } catch (error) {
        console.warn("待破解挑戰次數更新失敗，保留本機次數。", error);
      }
    }

    savePendingRecordLocally(localRecord);
    return localRecord;
  }

  async function syncLocalPendingDealsToDatabase() {
    const records = readPendingDeals();
    for (const record of records) {
      try {
        await savePendingDeal(record.deal, record.uid);
      } catch (error) {
        console.warn("本機待破解牌局同步至雲端失敗。", error);
        break;
      }
    }
  }

  function abandonCurrentDeal() {
    if (
      busy ||
      completed >= 8 ||
      !Array.isArray(originalDeal) ||
      originalDeal.length !== 104
    ) {
      return false;
    }

    const deal = originalDeal.slice();
    const uid = currentDealUid;
    void savePendingDeal(deal, uid);
    return true;
  }

  async function syncLocalSolvedDealsToDatabase() {
    if (!window.SpiderSolvedDealsDB?.save) return;

    const localDeals = readSolvedDeals();
    for (const record of localDeals) {
      try {
        const result = await window.SpiderSolvedDealsDB.save(record);
        if (result?.record) {
          saveRecordLocally(result.record);
          await promotePendingRecord(result.record);
        }
      } catch (error) {
        console.warn("本機可解牌局同步至雲端失敗。", error);
        break;
      }
    }

    await refreshRemoteSolvedDealCount();
  }

  async function initializeDatabase() {
    const online = await refreshRemoteSolvedDealCount();
    if (online) {
      await syncLocalSolvedDealsToDatabase();
      await syncLocalPendingDealsToDatabase();
    }
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
    currentDealSource = "solved";
    currentDealBestValue = bestStepsForRecord(record);
    currentDealClearValue = clearCountForRecord(record);
    saveActiveGame();
    render();
    setNotice(`這副隨機牌局已在玩家已解牌庫：${shortUid(record.uid)}`);
    return record;
  }

  async function saveSolvedDeal() {
    if (!Array.isArray(originalDeal) || originalDeal.length !== 104) {
      return { uid: null, isNew: false, cloudSaved: false };
    }

    const key = dealKeyOf(originalDeal);
    const existing = findLocalDealByKey(key);
    const localWasNew = !existing;
    let pending = existing ? null : findLocalPendingByKey(key);

    if (!existing && !pending && window.SpiderPendingDealsDB?.findByDeal) {
      try {
        pending = await window.SpiderPendingDealsDB.findByDeal(originalDeal);
        if (pending) savePendingRecordLocally(pending);
      } catch (error) {
        console.warn("比對待破解牌局 UID 失敗。", error);
      }
    }

    const record = existing || {
      uid: currentDealUid || pending?.uid || createSolvedDealUid(),
      deal: originalDeal.slice(),
      solvedAt: window.Timestamp?.create ? window.Timestamp.create() : String(Date.now())
    };

    saveRecordLocally(record);
    removePendingRecordLocally(record.deal, record.uid);
    currentDealUid = record.uid;

    if (!window.SpiderSolvedDealsDB?.save) {
      return { uid: record.uid, isNew: localWasNew, cloudSaved: false, bestSteps: bestStepsForRecord(record), clearCount: clearCountForRecord(record) };
    }

    try {
      const result = await window.SpiderSolvedDealsDB.save(record);
      const canonical = result?.record || record;
      saveRecordLocally(canonical);
      currentDealUid = canonical.uid;
      await promotePendingRecord(canonical);
      await refreshRemoteSolvedDealCount();

      return {
        uid: canonical.uid,
        isNew: Boolean(result?.isNew),
        cloudSaved: true,
        bestSteps: bestStepsForRecord(canonical),
        clearCount: clearCountForRecord(canonical)
      };
    } catch (error) {
      console.warn("可解牌局寫入雲端失敗，已保留本機紀錄。", error);
      return { uid: record.uid, isNew: localWasNew, cloudSaved: false, bestSteps: bestStepsForRecord(record), clearCount: clearCountForRecord(record) };
    }
  }

  const VICTORY_CARD_RAIN_ITEMS = Object.freeze(["♠", "A♠", "K♠", "Q♠", "J♠", "10♠"]);

  function clearVictoryEffect(api, target) {
    if (!api?.clear || !target) return;
    try {
      api.clear(target);
    } catch (error) {
      console.warn("[Spider] 勝利特效清理失敗：", error);
    }
  }

  function clearVictoryParticles() {
    clearVictoryEffect(window.SlowlyConfettiBurst, victoryParticles);
    clearVictoryEffect(window.SlowlyGoldRain, victoryParticles);
    clearVictoryEffect(window.SlowlyStarExplosion, victoryParticles);
    clearVictoryEffect(window.SlowlyShockwave, victoryParticles);
    clearVictoryEffect(window.SlowlyFlashShake, victoryParticles);
    clearVictoryEffect(window.SlowlyJackpotPop, bombPlus);
    clearVictoryEffect(window.SlowlyCardRain, victoryParticles);
    clearVictoryEffect(window.SlowlyVictoryBeam, victoryParticles);
    clearVictoryEffect(window.SlowlyClassicFireworks, victoryParticles);

    // 軍火庫未載入或播放途中被中止時，仍確保勝利層乾淨。
    if (victoryParticles) victoryParticles.innerHTML = "";
  }

  function pickVictoryEffects() {
    if (prefersReducedMotion()) return ["jackpot-pop"];

    function shuffledPool() {
      const pool = VICTORY_EFFECTS.slice();
      for (let i = pool.length - 1; i > 0; i -= 1) {
        const k = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[k]] = [pool[k], pool[i]];
      }
      return pool;
    }

    function visualDifference(a, b) {
      const left = new Set(a);
      const right = new Set(b);
      let changed = 0;
      VICTORY_EFFECTS.forEach(name => {
        if (left.has(name) !== right.has(name)) changed += 1;
      });
      return changed;
    }

    let selected = [];
    let signature = "";

    // 重抽到「肉眼真的不同」：至少有 4 個開關狀態改變。
    // 上一局也存 localStorage，所以重新整理後仍不會立刻撞同一套。
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const pool = shuffledPool();
      const count = 4 + Math.floor(Math.random() * 3);
      const candidate = pool.slice(0, count);
      const candidateSignature = candidate.slice().sort().join("|");

      if (
        candidateSignature !== lastVictoryEffectSignature &&
        (lastVictoryEffects.length === 0 || visualDifference(candidate, lastVictoryEffects) >= 4)
      ) {
        selected = candidate;
        signature = candidateSignature;
        break;
      }
    }

    if (selected.length === 0) {
      selected = shuffledPool().slice(0, 4);
      signature = selected.slice().sort().join("|");
    }

    lastVictoryEffectSignature = signature;
    lastVictoryEffects = selected.slice();
    try {
      localStorage.setItem(LAST_VICTORY_EFFECTS_STORAGE_KEY, JSON.stringify(lastVictoryEffects));
    } catch {}

    return selected;
  }

  function playVictoryEffect(api, target, options) {
    if (!api?.play || !target) return;

    void api.play(target, options).catch(error => {
      console.warn("[Spider] 勝利特效播放失敗：", error);
    });
  }

  function activateVictoryEffects(selectedEffects) {
    clearVictoryParticles();

    if (selectedEffects.includes("confetti")) {
      playVictoryEffect(window.SlowlyConfettiBurst, victoryParticles);
    }
    if (selectedEffects.includes("gold-rain")) {
      playVictoryEffect(window.SlowlyGoldRain, victoryParticles);
    }
    if (selectedEffects.includes("stars")) {
      playVictoryEffect(window.SlowlyStarExplosion, victoryParticles);
    }
    if (selectedEffects.includes("shockwave")) {
      playVictoryEffect(window.SlowlyShockwave, victoryParticles);
    }
    if (selectedEffects.includes("flash-shake")) {
      playVictoryEffect(window.SlowlyFlashShake, victoryParticles, { shakeTarget: gameShell });
    }
    if (selectedEffects.includes("jackpot-pop")) {
      playVictoryEffect(window.SlowlyJackpotPop, bombPlus);
    }
    if (selectedEffects.includes("card-rain")) {
      playVictoryEffect(window.SlowlyCardRain, victoryParticles, { items: VICTORY_CARD_RAIN_ITEMS });
    }
    if (selectedEffects.includes("victory-beam")) {
      playVictoryEffect(window.SlowlyVictoryBeam, victoryParticles);
    }
    if (selectedEffects.includes("classic-fireworks")) {
      playVictoryEffect(window.SlowlyClassicFireworks, victoryParticles);
    }
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
      ? "恭喜解出此牌局"
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
    const score = saved.uid
      ? await recordBestSteps(saved.uid, moveCount)
      : { bestSteps: moveCount, isRecord: false, previousBest: null, cloudSaved: false };
    const clears = saved.uid
      ? await recordClear(saved.uid)
      : { clearCount: 0, cloudSaved: false };
    currentDealBestValue = score.bestSteps || saved.bestSteps || null;
    currentDealClearValue = clears.clearCount || saved.clearCount || 0;
    clearActiveGame();
    render();
    await playBOM({ isNew: saved.isNew });

    // 勝利流程結束後解除操作鎖。
    // 否則「選擇下一局」雖然能打開牌局選擇視窗，
    // 但三個牌局來源按鈕仍會因 busy=true 而維持 disabled。
    busy = false;
    render();

    if (saved.isNew) {
      messageTitle.textContent = "恭喜解出此牌局";
      messageText.textContent = saved.cloudSaved
        ? `完成！共用了 ${moveCount} 步。這副牌已加入玩家可解牌庫。`
        : `完成！共用了 ${moveCount} 步。牌局已先保存在這台裝置，雲端目前未同步。`;
    } else {
      messageTitle.textContent = "牌局完成";
      messageText.textContent = `完成！共用了 ${moveCount} 步。這副牌原本就在玩家可解牌庫。`;
    }

    if (saved.uid && score.bestSteps) {
      if (score.isRecord && score.previousBest) {
        messageBest.textContent = `新紀錄！原最佳 ${score.previousBest} 步 → ${score.bestSteps} 步`;
      } else if (score.isRecord) {
        messageBest.textContent = `最佳紀錄：${score.bestSteps} 步`;
      } else {
        messageBest.textContent = `本局 ${moveCount} 步｜最佳紀錄 ${score.bestSteps} 步`;
      }
      messageBest.hidden = false;
    } else {
      messageBest.hidden = true;
      messageBest.textContent = "";
    }

    if (saved.uid && currentDealClearValue > 0) {
      messageClears.textContent = `這副牌已成功破關 ${currentDealClearValue} 次`;
      messageClears.hidden = false;
    } else {
      messageClears.hidden = true;
      messageClears.textContent = "";
    }

    messageUid.textContent = saved.uid ? shortUid(saved.uid) : "UID 建立失敗";
    messageCopyUidButton.hidden = !saved.uid;
    messageCopyUidButton.dataset.uid = saved.uid || "";
    message.hidden = false;
    return true;
  }

  function isPendingMode() {
    return contributedMode === "pending";
  }

  function currentPoolLabel() {
    return isPendingMode() ? "待破解牌局" : "玩家已解牌局";
  }

  function renderContributedPage(records, totalCount, page, totalPages) {
    contributedPageRecords = Array.isArray(records) ? records.slice() : [];
    contributedPage = Math.max(1, Number(page) || 1);
    contributedTotalPages = Math.max(1, Number(totalPages) || 1);

    if (!isPendingMode()) {
      remoteSolvedDealCount = Math.max(remoteSolvedDealCount, Number(totalCount) || 0);
    }

    contributedList.innerHTML = "";

    if (contributedPageRecords.length === 0) {
      const empty = document.createElement("p");
      empty.className = "contributed-empty";
      empty.textContent = isPendingMode() ? "目前還沒有待破解牌局。" : "目前還沒有玩家已解牌局。";
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

        const bestText = document.createElement("span");
        bestText.className = "contributed-best";

        if (isPendingMode()) {
          bestText.textContent = `挑戰 ${Math.max(1, Number(record.attemptCount) || 1)} 次`;
        } else {
          const best = bestStepsForRecord(record);
          const clearCount = clearCountForRecord(record);
          bestText.textContent = best
            ? `最佳 ${best} 步｜破關 ${clearCount} 次`
            : `尚無步數紀錄｜破關 ${clearCount} 次`;
        }
        button.appendChild(bestText);

        button.addEventListener("click", () => {
          if (busy || contributedLoading) return;
          abandonCurrentDeal();
          const pending = isPendingMode();
          startGame({
            deal: record.deal,
            uid: record.uid,
            source: pending ? "pending" : "contributed",
            bestSteps: pending ? null : bestStepsForRecord(record),
            clearCount: pending ? 0 : clearCountForRecord(record)
          });
          if (pending) void markPendingAttempt(record);
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

    const pending = isPendingMode();
    const label = currentPoolLabel();
    setPickerNotice(`正在讀取${label}…`);

    try {
      const remote = pending ? window.SpiderPendingDealsDB : window.SpiderSolvedDealsDB;

      if (remote?.listPage) {
        const result = await remote.listPage(page, 5);
        if (!pending) {
          databaseReady = true;
          remoteSolvedDealCount = Number(result.totalCount || 0);
        }

        (result.records || []).forEach(record => {
          if (pending) savePendingRecordLocally(record);
          else saveRecordLocally(record);
        });

        renderContributedPage(
          result.records || [],
          result.totalCount || 0,
          result.page || page,
          result.totalPages || 1
        );
        setPickerNotice(result.totalCount > 0 ? `共有 ${result.totalCount} 副${label}。` : `目前還沒有${label}。`);
        return;
      }

      throw new Error("雲端分頁功能尚未載入。");
    } catch (error) {
      console.warn(`讀取${label}分頁失敗，改用本機牌庫。`, error);

      const localDeals = pending ? getLocalPendingDealsSorted() : getLocalSolvedDealsSorted();
      const totalCount = localDeals.length;
      const totalPages = Math.max(1, Math.ceil(totalCount / 5));
      const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
      const start = (safePage - 1) * 5;
      const records = localDeals.slice(start, start + 5);

      renderContributedPage(records, totalCount, safePage, totalPages);
      setPickerNotice(totalCount > 0 ? `目前使用這台裝置上的${label}。` : `目前還沒有${label}。`);
    } finally {
      contributedLoading = false;
      render();
    }
  }

  async function openContributedPanel(mode = "solved") {
    if (busy) return;

    contributedMode = mode === "pending" ? "pending" : "solved";
    contributedPanel.hidden = false;
    contributedPanel.setAttribute("aria-label", currentPoolLabel());
    randomContributedButton.textContent = isPendingMode()
      ? "從待破解牌局隨機抽一局"
      : "從已解牌局隨機抽一局";
    uidSearchPanel.hidden = true;
    uidDealButton.setAttribute("aria-expanded", "false");
    uidInput.value = "";
    await loadContributedPage(1);
  }

  async function loadRandomSolvedDeal() {
    if (busy || contributedLoading) return;

    contributedLoading = true;
    render();

    const pending = isPendingMode();
    const label = currentPoolLabel();
    setPickerNotice(`正在從${label}隨機抽一副…`);

    try {
      let record = null;
      const remote = pending ? window.SpiderPendingDealsDB : window.SpiderSolvedDealsDB;

      if (remote?.random) {
        record = await remote.random();
        if (!pending) databaseReady = true;
      }

      if (!record) {
        const localDeals = pending ? getLocalPendingDealsSorted() : getLocalSolvedDealsSorted();
        if (localDeals.length > 0) {
          record = localDeals[Math.floor(Math.random() * localDeals.length)];
        }
      }

      if (!record) {
        setPickerNotice(pending ? "目前還沒有待破解牌局。" : "目前還沒有玩家已解牌局。先解出第一副吧。");
        return;
      }

      abandonCurrentDeal();
      startGame({
        deal: record.deal,
        uid: record.uid,
        source: pending ? "pending" : "contributed-random",
        bestSteps: pending ? null : bestStepsForRecord(record),
        clearCount: pending ? 0 : clearCountForRecord(record)
      });
      if (pending) void markPendingAttempt(record);
    } catch (error) {
      console.warn(`隨機讀取${label}失敗。`, error);
      setPickerNotice(`${label}目前讀取失敗，請稍後再試。`);
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

    const pending = isPendingMode();
    let record = (pending ? readPendingDeals() : readSolvedDeals()).find(item =>
      String(item.uid || "").toLowerCase() === q.toLowerCase()
    ) || null;

    const remote = pending ? window.SpiderPendingDealsDB : window.SpiderSolvedDealsDB;

    if (!record && remote?.findByUid) {
      try {
        record = await remote.findByUid(q);
        if (record) {
          if (pending) savePendingRecordLocally(record);
          else {
            databaseReady = true;
            saveRecordLocally(record);
          }
        }
      } catch (error) {
        console.warn("UID 查詢失敗。", error);
      }
    }

    if (!record) {
      setPickerNotice("找不到這個完整 UID。");
      return;
    }

    abandonCurrentDeal();
    startGame({
      deal: record.deal,
      uid: record.uid,
      source: pending ? "pending" : "uid",
      bestSteps: pending ? null : bestStepsForRecord(record),
      clearCount: pending ? 0 : clearCountForRecord(record)
    });
    if (pending) void markPendingAttempt(record);
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

  function restartCurrentDeal() {
    if (busy || !Array.isArray(originalDeal) || originalDeal.length !== 104) return;

    const deal = originalDeal.slice();
    const uid = currentDealUid;
    const source = currentDealSource;
    const bestSteps = currentDealBestValue;
    const clearCount = currentDealClearValue;

    restartConfirm.hidden = true;
    startGame({ deal, uid, source, bestSteps, clearCount });
    setNotice(uid ? `已重新開始牌局 ${shortUid(uid)}。` : "已重新開始此局。");
  }

  // 牌桌核心事件仍由核心處理；其餘按鈕與彈窗事件交給 _style.js。
  stockButton.addEventListener("click", () => void dealFromStock());
  window.SpiderEmpireUI = Object.freeze({
    openRestartConfirm,
    restartCurrentDeal,
    hideRestartConfirm: () => { restartConfirm.hidden = true; },
    selectOtherDeal: () => { restartConfirm.hidden = true; showDealPicker({ canReturn: true }); },
    hideDealPicker,
    selectRandomDeal: () => { if (!busy) { abandonCurrentDeal(); startGame({ source: "random" }); } },
    openContributedPanel,
    loadRandomSolvedDeal,
    previousPage: () => { if (contributedPage > 1) return loadContributedPage(contributedPage - 1); },
    nextPage: () => { if (contributedPage < contributedTotalPages) return loadContributedPage(contributedPage + 1); },
    toggleUidSearch,
    loadDealByUid,
    copyCurrentUid: () => copyUid(currentDealUid, copyDealUidButton),
    copyMessageUid: () => copyUid(messageCopyUidButton.dataset.uid, messageCopyUidButton),
    chooseNextDeal: () => showDealPicker({ canReturn: false })
  });

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
