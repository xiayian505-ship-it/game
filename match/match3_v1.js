(() => {
  "use strict";

  /* =========================================================
     消消樂｜match3_v1

     Match3 自己保留：
     - 8x8 棋盤與交換規則
     - 3+ 配對 / 連鎖
     - 4 連條紋、5 連彩球、T/L 包裝
     - 特殊糖觸發
     - 提示 / 無步判定
     - BOM / Combo / 計分
     - 無限 / 3 分鐘計時 / 30 步計步
     - 模式別道具次數與排行榜

     慢慢的倉庫接管：
     - Timer / Ticker
     - FictionStorage
     - FictionSort / FictionPaginate
     - SlowlyRandom
     - FictionShuffle
     - Preference
     - SlowlyAudioTone
     - SlowlyGridLineMatch
     - SlowlyGridGravity
     - SlowlyGridSwapSearch / SlowlyGridShuffleUntil / SlowlyGridChainExpand
     - SlowlySweepLine
     - SlowlyAreaBurst
     - Shine Text（CSS Effects）
  ========================================================= */

  const SIZE = 8;
  const COLORS = 6;

  const GAME_MODE = Object.freeze({
    infinite: Object.freeze({ label: "無限", durationMs: null, moveLimit: null, limitedTools: false }),
    timed: Object.freeze({ label: "計時", durationMs: 3 * 60 * 1000, moveLimit: null, limitedTools: true }),
    moves: Object.freeze({ label: "計步", durationMs: null, moveLimit: 30, limitedTools: true })
  });

  function normalizedGameMode(value) {
    return Object.prototype.hasOwnProperty.call(GAME_MODE, value)
      ? value
      : "infinite";
  }

  /* ===============================
     DOM
  =============================== */
  const boardEl = document.getElementById("board");
  const scoreEl = document.getElementById("score");
  const comboEl = document.getElementById("combo");
  const timeEl = document.getElementById("time");
  const timeLabelEl = document.getElementById("timeLabel");
  const stepsEl = document.getElementById("steps");
  const stepsLabelEl = document.getElementById("stepsLabel");
  const rankListEl = document.getElementById("rankList");
  const rankModeTabs = document.querySelectorAll("[data-rank-mode]");

  const btnStart = document.getElementById("btnStart");
  const btnPause = document.getElementById("btnPause");
  const btnEnd = document.getElementById("btnEnd");

  const toolSingle = document.getElementById("toolSingle");
  const toolRow = document.getElementById("toolRow");
  const toolColumn = document.getElementById("toolColumn");
  const toolSwap = document.getElementById("toolSwap");
  const toolRefresh = document.getElementById("toolRefresh");
  const toolColor = document.getElementById("toolColor");
  const soundOnEl = document.getElementById("soundOn");
  const volumeLevelEl = document.getElementById("volumeLevel");
  const gameModeEl = document.getElementById("gameMode");

  const bombOverlayEl = document.getElementById("bombOverlay");
  const bombTextEl = document.getElementById("bombText");
  const bombTitleTextEl = document.getElementById("bombTitleText");
  const bombMilestoneTextEl = document.getElementById("bombMilestoneText");
  const comboFloatEl = document.getElementById("comboFloat");
  const comboShineTextEl = document.getElementById("comboShineText");

  // 同一支 HTML 內切換「遊戲 / 排行榜」；只切畫面，不改遊戲狀態。
  const viewTabs = document.querySelectorAll("[data-view-target]");
  const viewPanels = document.querySelectorAll("[data-view-panel]");

  function showView(viewName) {
    viewTabs.forEach(tab => {
      tab.setAttribute(
        "aria-selected",
        tab.dataset.viewTarget === viewName ? "true" : "false"
      );
    });

    viewPanels.forEach(panel => {
      panel.hidden = panel.dataset.viewPanel !== viewName;
    });
  }

  /* ===============================
     倉庫｜Preference
     設定頁只決定 Match3 自己的偏好語意；保存交給軍火庫。
  =============================== */
  const soundPreference = Preference.create({
    key: "SBS_match3_v1:sound",
    defaultValue: true
  });

  const volumePreference = Preference.create({
    key: "SBS_match3_v1:volume",
    defaultValue: "strong"
  });


  const VOLUME_MULTIPLIER = Object.freeze({
    mute: 0,
    weak: 0.4,
    medium: 0.7,
    strong: 1
  });

  function normalizedVolumeLevel(value) {
    return Object.prototype.hasOwnProperty.call(VOLUME_MULTIPLIER, value)
      ? value
      : "strong";
  }

  function currentVolumeMultiplier() {
    return VOLUME_MULTIPLIER[normalizedVolumeLevel(volumePreference.get())];
  }

  soundOnEl.checked = Boolean(soundPreference.get());
  volumeLevelEl.value = normalizedVolumeLevel(volumePreference.get());

  // 軍火庫 Custom Select：原生 select 保留作資料欄位，畫面交給 SlowlySelect。
  SlowlySelect.createAll("select[data-slowly-select]");

  /* ===============================
     Model / State
  =============================== */
  // cell: { c: 0..COLORS-1 | null, sp: null|"sh"|"sv"|"w"|"b" }
  let grid = [];
  let domCells = [];
  let selected = null;
  let busy = false;

  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let steps = 0;

  const STATE = {
    IDLE: "IDLE",
    RUNNING: "RUNNING",
    PAUSED: "PAUSED",
    ENDED: "ENDED"
  };

  let gameState = STATE.IDLE;
  let activeGameMode = "infinite";
  let activeRankingMode = "infinite";
  let pendingAutoEnd = false;
  let nextBom = 10000;
  let bomShowing = false;
  let activeTool = null;
  let toolSwapFirst = null;
  let toolUsed = createToolUsageState();

  /* ===============================
     倉庫｜Timer / Ticker
  =============================== */
  const gameTimer = Timer.create();
  const gameTicker = Ticker.create({
    interval: 250,
    callback() {
      renderElapsedTime();
      checkModeEndCondition();
    }
  });

  function resetTimer() {
    gameTimer.reset();
    gameTicker.reset();
    renderElapsedTime();
  }

  function startTimer() {
    gameTimer.start();
    gameTicker.start();
    renderElapsedTime();
  }

  function pauseTimer() {
    gameTimer.pause();
    gameTicker.pause();
    renderElapsedTime();
  }

  function resumeTimer() {
    gameTimer.resume();
    gameTicker.resume();
    renderElapsedTime();
  }

  function stopTimer() {
    gameTimer.stop();
    gameTicker.stop();
    renderElapsedTime();
  }

  function syncElapsedTime() {
    return Math.max(0, Number(gameTimer.elapsed()) || 0);
  }

  function displayTimeMs() {
    const config = GAME_MODE[activeGameMode];

    if (config.durationMs !== null) {
      return Math.max(0, config.durationMs - syncElapsedTime());
    }

    return syncElapsedTime();
  }

  function renderElapsedTime() {
    timeLabelEl.textContent = activeGameMode === "timed" ? "剩餘" : "時間";
    timeEl.textContent = SlowlyElapsedFormat.formatHMS(displayTimeMs());
  }

  function renderSteps() {
    const config = GAME_MODE[activeGameMode];

    if (config.moveLimit !== null) {
      stepsLabelEl.textContent = "剩餘";
      stepsEl.textContent = Math.max(0, config.moveLimit - steps);
      return;
    }

    stepsLabelEl.textContent = "步數";
    stepsEl.textContent = steps;
  }

  /* ===============================
     倉庫｜Audio adapter
     保留原本 SFX 呼叫格式，底層交給 SlowlyAudioTone。
  =============================== */
  function playTone({
    freq = 440,
    dur = 0.08,
    type = "sine",
    gain = 0.12,
    slide = 0
  } = {}) {
    if (!soundPreference.get()) return;

    const volumeMultiplier = currentVolumeMultiplier();
    if (volumeMultiplier <= 0) return;

    SlowlyAudioTone.play({
      frequency: freq,
      duration: dur,
      type,
      gain: gain * volumeMultiplier,
      slide
    }).catch(error => {
      console.warn("[Match3] 音效播放失敗：", error);
    });
  }

  /* ===============================
     倉庫｜Piano-like SFX
     沿用 Slowly Piano 的組法：
     Note Frequency → Oscillator → Gain → Envelope。

     這不是錄音取樣，而是軍火庫的合成鋼琴鍵感；
     Match3 只決定要彈哪個音、多久放開。
  =============================== */
  const PIANO_ATTACK_SECONDS = 0.02;
  const PIANO_RELEASE_SECONDS = 0.10;

  async function playPianoNotes(noteIds, {
    gain = 0.12,
    hold = 0.055,
    release = PIANO_RELEASE_SECONDS,
    spacing = 0,
    type = "sine"
  } = {}) {
    if (!soundPreference.get()) return;

    const volumeMultiplier = currentVolumeMultiplier();
    if (volumeMultiplier <= 0) return;

    const notes = Array.isArray(noteIds) ? noteIds : [noteIds];
    if (!notes.length) return;

    try {
      await SlowlyAudioContext.resume();
      const context = SlowlyAudioContext.get();
      if (!context || context.state !== "running") return;

      const baseStart = context.currentTime + 0.005;

      notes.forEach((noteId, index) => {
        const frequency = SlowlyAudioNoteFrequency.toFrequency(noteId);
        const oscillator = SlowlyAudioOscillator.create(context, {
          type,
          frequency
        });

        const gainNode = SlowlyAudioGain.create(
          context,
          SlowlyAudioEnvelope.floor
        );

        SlowlyAudioOscillator.connect(oscillator, gainNode);
        SlowlyAudioGain.connect(gainNode, context.destination);

        const startAt = baseStart + Math.max(0, spacing) * index;
        const releaseAt = startAt + PIANO_ATTACK_SECONDS + Math.max(0, hold);
        const peak = Math.max(
          SlowlyAudioEnvelope.floor,
          gain * volumeMultiplier * (index === 0 ? 1 : 0.88)
        );

        SlowlyAudioEnvelope.attack(gainNode.gain, {
          startAt,
          duration: PIANO_ATTACK_SECONDS,
          from: SlowlyAudioEnvelope.floor,
          to: peak,
          curve: "linear"
        });

        SlowlyAudioEnvelope.release(gainNode.gain, {
          startAt: releaseAt,
          duration: Math.max(0.04, release),
          from: peak,
          to: SlowlyAudioEnvelope.floor,
          curve: "linear"
        });

        SlowlyAudioOscillator.start(oscillator, startAt);
        SlowlyAudioOscillator.stop(
          oscillator,
          releaseAt + Math.max(0.04, release) + 0.02
        );
      });
    } catch (error) {
      console.warn("[Match3] 鋼琴音效播放失敗：", error);
    }
  }

  function sfxSwap() {
    playTone({ freq: 520, dur: 0.06, type: "triangle", gain: 0.10, slide: 0.8 });
  }

  function sfxBad() {
    playTone({ freq: 180, dur: 0.10, type: "sine", gain: 0.05, slide: 0 });
  }

  // Combo 音階：Do → Re → Mi → Fa → Sol → La → Si → 高音 Do，
  // 抵達高音 Do 後再沿原路下降；低音 Do 後重新往上。
  // 改用音名，交給軍火庫 Note Frequency 算 Hz。
  const COMBO_SCALE = Object.freeze([
    "C4", // Do
    "D4", // Re
    "E4", // Mi
    "F4", // Fa
    "G4", // Sol
    "A4", // La
    "B4", // Si
    "C5"  // 高音 Do
  ]);

  function comboNoteId(level) {
    const topIndex = COMBO_SCALE.length - 1;
    const period = topIndex * 2;
    const step = Math.max(0, Number(level) - 1) % period;
    const noteIndex = step <= topIndex ? step : period - step;
    return COMBO_SCALE[noteIndex];
  }

  function sfxPop(n = 1) {
    playPianoNotes(comboNoteId(combo), {
      gain: Math.min(0.15, 0.10 + Math.min(6, n) * 0.006),
      hold: 0.055,
      release: 0.12,
      type: "sine"
    });
  }

  function sfxSpecial() {
    // 亮一點的上行純五度：乾淨、有「特殊球成立」的感覺，沒有滑音。
    playPianoNotes(["G5", "D6"], {
      gain: 0.105,
      hold: 0.045,
      release: 0.12,
      spacing: 0.045,
      type: "sine"
    });
  }

  function sfxBomb() {
    // 低音八度作為爆破提示；不用 sawtooth / slide，避免壞電器感。
    playPianoNotes(["C3", "C4"], {
      gain: 0.10,
      hold: 0.045,
      release: 0.16,
      spacing: 0,
      type: "sine"
    });
  }

  function sfxShuffle() {
    playPianoNotes(["D4", "A4"], {
      gain: 0.09,
      hold: 0.04,
      release: 0.11,
      spacing: 0.055,
      type: "sine"
    });
  }

  /* ===============================
     Helpers
  =============================== */
  const inBounds = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  const k = (r, c) => r * SIZE + c;
  const randColor = () => SlowlyRandom.int(0, COLORS - 1);
  const now = () => Date.now();

  function sleep(ms) {
    return new Promise(resolve => window.setTimeout(resolve, ms));
  }

  /* ===============================
     Clear presentation
     宿主只決定演出順序與 Match3 語意：
     Sweep Line → 短停 → Area Burst → 再清除棋盤。
  =============================== */
  const CLEAR_BEAM_MS = 300;
  const CLEAR_HOLD_MS = 120;
  const CLEAR_BLOCK_MS = 220;
  const SPECIAL_BLOCK_MS = 340;

  const clearSweep = SlowlySweepLine.create(boardEl, {
    duration: CLEAR_BEAM_MS,
    size: 8,
    length: "22%",
    zIndex: 6
  });

  const clearBurst = SlowlyAreaBurst.create(boardEl, {
    duration: CLEAR_BLOCK_MS,
    zIndex: 6,
    type: "block"
  });

  const NORMAL_SWEEP_STYLE = Object.freeze({
    color: "rgba(255,244,218,.76)",
    glow1: "rgba(255,248,232,.72)",
    glow2: "rgba(255,226,184,.58)",
    glow3: "rgba(198,146,88,.42)"
  });

  const SPECIAL_SWEEP_STYLE = Object.freeze({
    size: 11,
    color: "rgba(255,232,192,.82)",
    glow1: "rgba(255,244,224,.78)",
    glow2: "rgba(242,202,148,.66)",
    glow3: "rgba(180,124,68,.48)"
  });

  const NORMAL_BURST_STYLE = Object.freeze({
    fill: "rgba(255,255,255,.78)",
    border: "rgba(255,255,255,.76)",
    glow: "rgba(255,255,255,.95)",
    innerGlow: "rgba(255,255,255,.8)",
    blendMode: "screen"
  });

  const SPECIAL_BLOCK_STYLE = Object.freeze({
    duration: SPECIAL_BLOCK_MS,
    fill: "rgba(255,236,202,.88)",
    glow: "rgba(255,255,255,1)",
    innerGlow: "rgba(255,255,255,.95)"
  });

  function clearPresentationEffects() {
    clearSweep.clear();
    clearBurst.clear();
    domCells.forEach(el => el.classList.remove("effect-target"));
  }

  function targetElements(positions) {
    return positions
      .filter(pos => inBounds(pos.r, pos.c))
      .map(pos => domCells[k(pos.r, pos.c)])
      .filter(Boolean);
  }

  function rowPositions(r) {
    return Array.from({ length: SIZE }, (_, c) => ({ r, c }));
  }

  function columnPositions(c) {
    return Array.from({ length: SIZE }, (_, r) => ({ r, c }));
  }

  function areaPositions(centerR, centerC, radius = 1) {
    const positions = [];

    for (let dr = -radius; dr <= radius; dr += 1) {
      for (let dc = -radius; dc <= radius; dc += 1) {
        const r = centerR + dr;
        const c = centerC + dc;
        if (inBounds(r, c)) positions.push({ r, c });
      }
    }

    return positions;
  }

  function specialCellsIn(expandedSet) {
    const specials = [];

    for (const key of expandedSet) {
      const r = Math.floor(key / SIZE);
      const c = key % SIZE;
      const cell = grid[r]?.[c];
      if (cell?.sp) specials.push({ r, c, sp: cell.sp });
    }

    return specials;
  }

  function markTargetColor(targetColor, expandedSet) {
    if (targetColor === null || targetColor === undefined) return;

    for (const key of expandedSet) {
      const r = Math.floor(key / SIZE);
      const c = key % SIZE;
      const cell = grid[r]?.[c];

      if (cell && cell.sp !== "b" && cell.c === targetColor) {
        domCells[k(r, c)]?.classList.add("effect-target");
      }
    }
  }

  function matchSweepEffects(matches) {
    if (!matches?.groups) return [];

    return matches.groups.map(group => ({
      targets: targetElements(group.cells),
      direction: group.type === "h" ? "horizontal" : "vertical"
    }));
  }

  function specialSweepEffects(specials, forceBoardBlast) {
    const effects = [];

    for (const special of specials) {
      if (special.sp === "sh") {
        effects.push({
          targets: targetElements(rowPositions(special.r)),
          direction: "horizontal",
          ...SPECIAL_SWEEP_STYLE
        });
      } else if (special.sp === "sv") {
        effects.push({
          targets: targetElements(columnPositions(special.c)),
          direction: "vertical",
          ...SPECIAL_SWEEP_STYLE
        });
      } else if (special.sp === "w") {
        effects.push({
          targets: targetElements(areaPositions(special.r, special.c, 1)),
          directions: ["horizontal", "vertical"],
          ...SPECIAL_SWEEP_STYLE
        });
      }
    }

    if (forceBoardBlast) {
      effects.push({
        targets: boardEl,
        directions: ["horizontal", "vertical"],
        ...SPECIAL_SWEEP_STYLE
      });
    }

    return effects;
  }

  function matchBurstEffects(matches) {
    if (!matches?.groups) return [];

    return matches.groups.map(group => ({
      targets: targetElements(group.cells),
      type: "block",
      duration: CLEAR_BLOCK_MS
    }));
  }

  function specialBurstEffects(specials, forceBoardBlast) {
    const effects = [];

    for (const special of specials) {
      if (special.sp === "sh") {
        effects.push({
          targets: targetElements(rowPositions(special.r)),
          type: "block",
          className: "match3-special-burst",
          ...SPECIAL_BLOCK_STYLE
        });
      } else if (special.sp === "sv") {
        effects.push({
          targets: targetElements(columnPositions(special.c)),
          type: "block",
          className: "match3-special-burst",
          ...SPECIAL_BLOCK_STYLE
        });
      } else if (special.sp === "w") {
        effects.push({
          targets: targetElements(areaPositions(special.r, special.c, 1)),
          type: "radial",
          duration: SPECIAL_BLOCK_MS
        });
      }
    }

    if (forceBoardBlast) {
      effects.push({
        targets: boardEl,
        type: "radial",
        duration: SPECIAL_BLOCK_MS,
        radialCore: "rgba(255,255,255,1)",
        radialMid: "rgba(255,229,180,.84)",
        radialSoft: "rgba(255,255,255,.54)",
        glow: "rgba(255,255,255,.98)"
      });
    }

    return effects;
  }

  async function playClearPresentation({
    matches = null,
    expandedSet,
    targetColor = null,
    forceBoardBlast = false
  }) {
    clearPresentationEffects();

    const specials = specialCellsIn(expandedSet);
    if (specials.some(special => special.sp === "b")) {
      forceBoardBlast = true;
    }

    // 第一拍：Sweep Line 只負責方向掃線；Match3 決定哪些範圍要掃。
    const sweepEffects = [
      ...matchSweepEffects(matches),
      ...specialSweepEffects(specials, forceBoardBlast)
    ];

    // 彩球先讓目標色醒來；這仍是 Match3 自己的語意。
    markTargetColor(targetColor, expandedSet);

    await clearSweep.play(sweepEffects, {
      duration: CLEAR_BEAM_MS,
      ...NORMAL_SWEEP_STYLE
    });

    // 兩顆零件彼此不知道對方；中間節奏由宿主自己決定。
    await sleep(CLEAR_HOLD_MS);

    // 第二拍：Area Burst 只負責實際消除範圍爆亮。
    const burstEffects = [
      ...matchBurstEffects(matches),
      ...specialBurstEffects(specials, forceBoardBlast)
    ];

    await clearBurst.play(burstEffects, {
      duration: CLEAR_BLOCK_MS,
      type: "block",
      ...NORMAL_BURST_STYLE
    });

    return () => clearPresentationEffects();
  }

  /* ===============================
     倉庫｜FictionStorage / FictionSort / FictionPaginate
     三種模式各自保存 TOP 3；舊版 top3 保留作「無限」排行榜。
  =============================== */
  const scoreStore = FictionStorage.create({
    namespace: "SBS_match3_v1"
  });

  const rankingCollections = Object.freeze({
    infinite: scoreStore.collection("top3"),
    timed: scoreStore.collection("top3_timed"),
    moves: scoreStore.collection("top3_moves")
  });

  function rankingComparator(a, b) {
    if (Number(b.score) !== Number(a.score)) {
      return Number(b.score) - Number(a.score);
    }

    if (Number(a.timeMs) !== Number(b.timeMs)) {
      return Number(a.timeMs) - Number(b.timeMs);
    }

    return Number(a.steps) - Number(b.steps);
  }

  function sortRankings(items) {
    return FictionSort.sort(items, {
      direction: "asc",
      compare: rankingComparator
    });
  }

  function takeTop3(items) {
    return FictionPaginate.paginate(items, {
      page: 1,
      pageSize: 3
    }).data;
  }

  function rankingCollection(mode) {
    return rankingCollections[normalizedGameMode(mode)];
  }

  async function getTop3(mode = activeRankingMode) {
    const rows = await rankingCollection(mode).all();
    return takeTop3(sortRankings(rows));
  }

  function syncRankingTabs() {
    rankModeTabs.forEach(tab => {
      tab.setAttribute(
        "aria-selected",
        tab.dataset.rankMode === activeRankingMode ? "true" : "false"
      );
    });
  }

  async function renderTop3(mode = activeRankingMode) {
    activeRankingMode = normalizedGameMode(mode);
    syncRankingTabs();

    const top3 = await getTop3(activeRankingMode);

    rankListEl.replaceChildren();

    if (top3.length === 0) {
      const empty = document.createElement("div");
      empty.className = "rankLine";
      empty.textContent = "—";
      rankListEl.appendChild(empty);
      return;
    }

    top3.forEach((item, index) => {
      const line = document.createElement("div");
      line.className = "rankLine";

      const rank = document.createElement("b");
      rank.textContent = `TOP ${index + 1}`;

      const stats = document.createElement("div");
      stats.className = "rankStats";

      const statEntries = [
        ["分數", item.score ?? "—"],
        ["步數", item.steps ?? "—"],
        ["連鎖", item.maxCombo ?? "—"],
        ["時間", SlowlyElapsedFormat.formatHMS(item.timeMs)]
      ];

      for (const [label, value] of statEntries) {
        const stat = document.createElement("span");
        stat.className = "rankStat";

        const labelEl = document.createElement("span");
        labelEl.className = "rankStatLabel";
        labelEl.textContent = label;

        const valueEl = document.createElement("strong");
        valueEl.className = "rankStatValue";
        valueEl.textContent = value;

        stat.append(labelEl, valueEl);
        stats.appendChild(stat);
      }

      line.append(rank, stats);
      rankListEl.appendChild(line);
    });
  }

  async function saveCurrentToTop3(mode = activeGameMode) {
    const normalizedMode = normalizedGameMode(mode);
    const collection = rankingCollection(normalizedMode);

    const config = GAME_MODE[normalizedMode];
    const resultTimeMs = config.durationMs !== null
      ? Math.min(syncElapsedTime(), config.durationMs)
      : syncElapsedTime();

    await collection.add({
      mode: normalizedMode,
      score,
      steps,
      maxCombo,
      timeMs: resultTimeMs,
      at: now()
    });

    const rows = await collection.all();
    const top3 = takeTop3(sortRankings(rows));

    await collection.replace(top3);

    activeRankingMode = normalizedMode;
    await renderTop3(normalizedMode);
  }

  /* ===============================
     State UI
  =============================== */
  function createToolUsageState() {
    return {
      single: false,
      row: false,
      column: false,
      swap: false,
      refresh: false,
      color: false
    };
  }

  function modeHasLimitedTools() {
    return GAME_MODE[activeGameMode].limitedTools;
  }

  function canUseTool(name) {
    return !modeHasLimitedTools() || !toolUsed[name];
  }

  function markToolUsed(name) {
    if (!modeHasLimitedTools()) return;
    toolUsed[name] = true;
    syncToolButtons();
    syncInteractionState();
  }

  function syncInteractionState() {
    const running = gameState === STATE.RUNNING;
    const paused = gameState === STATE.PAUSED;
    const interactive = running && !busy;

    btnStart.disabled = busy || !(gameState === STATE.IDLE || gameState === STATE.ENDED);
    btnPause.disabled = busy || !(running || paused);
    btnEnd.disabled = busy || !(running || paused);

    for (const [name, button] of Object.entries(ALL_TOOL_BUTTONS)) {
      button.disabled = !interactive || !canUseTool(name);
    }

    btnPause.textContent = paused ? "繼續" : "暫停";

    for (const el of domCells) {
      el.classList.toggle("locked", !interactive);
    }
  }

  function setBusy(next) {
    busy = Boolean(next);
    syncInteractionState();

    if (!busy) {
      queueMicrotask(checkModeEndCondition);
    }
  }

  function setState(next) {
    gameState = next;
    syncInteractionState();
  }

  /* ===============================
     Board build / render
  =============================== */
  function makeEmptyGrid() {
    grid = Array.from(
      { length: SIZE },
      () => Array.from({ length: SIZE }, () => ({ c: null, sp: null }))
    );
  }

  function createDom() {
    boardEl.innerHTML = "";
    domCells = [];

    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        const cell = document.createElement("div");
        cell.className = "cell locked";
        cell.dataset.r = r;
        cell.dataset.c = c;
        cell.tabIndex = 0;
        cell.addEventListener("pointerdown", onCellDown);
        cell.addEventListener("keydown", event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onCellDown(event);
          }
        });

        boardEl.appendChild(cell);
        domCells.push(cell);
      }
    }
  }

  function render() {
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        const el = domCells[k(r, c)];
        const cell = grid[r][c];

        el.classList.toggle(
          "selected",
          Boolean(selected) && selected.r === r && selected.c === c
        );
        el.classList.remove("hint");
        el.innerHTML = "";

        if (cell.c === null && cell.sp !== "b") continue;

        const candy = document.createElement("div");
        candy.className = "candy";

        if (cell.sp === "b") {
          candy.classList.add("colorbomb");
        } else {
          candy.classList.add(`t${cell.c}`);
          if (cell.sp === "sh") candy.classList.add("striped-h");
          if (cell.sp === "sv") candy.classList.add("striped-v");
          if (cell.sp === "w") candy.classList.add("wrapped");
        }

        if (cell.sp) {
          const badge = document.createElement("div");
          badge.className = "badge";
          badge.textContent =
            cell.sp === "sh" ? "—" :
            cell.sp === "sv" ? "|" :
            cell.sp === "w" ? "✚" :
            cell.sp === "b" ? "★" : "";
          candy.appendChild(badge);
        }

        el.appendChild(candy);
      }
    }

    scoreEl.textContent = score;
    comboEl.textContent = combo;
    renderSteps();
    renderElapsedTime();
  }

  /* ===============================
     Init board with no immediate matches
  =============================== */
  function createsMatchAt(r, c) {
    const cell = grid[r][c];
    if (cell.sp === "b") return false;

    const color = cell.c;

    if (c >= 2) {
      const a = grid[r][c - 1];
      const b = grid[r][c - 2];
      if (a.sp !== "b" && b.sp !== "b" && a.c === color && b.c === color) {
        return true;
      }
    }

    if (r >= 2) {
      const a = grid[r - 1][c];
      const b = grid[r - 2][c];
      if (a.sp !== "b" && b.sp !== "b" && a.c === color && b.c === color) {
        return true;
      }
    }

    return false;
  }

  function fillRandomNoMatches() {
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        let tries = 0;

        while (true) {
          grid[r][c] = { c: randColor(), sp: null };
          tries += 1;

          if (!createsMatchAt(r, c)) break;
          if (tries > 50) break;
        }
      }
    }
  }

  /* ===============================
     BOM / Combo
  =============================== */
  const BOM_SPREAD_MS = 620;
  const BOM_SHINE_MS = 620;
  const BOM_SHINE_GAP_MS = 140;
  const BOM_HOLD_MS = 160;
  const BOM_FADE_MS = 420;

  let comboFloatAnimation = null;

  function formatBOMMilestone(value) {
    return `${Math.round(value / 1000)}K`;
  }

  function resetBOMPresentation() {
    bombOverlayEl.classList.remove("is-active", "is-leaving");
    bombTextEl.classList.remove("is-active");
    bombTitleTextEl.classList.remove("slowly-shine-text");
    bombMilestoneTextEl.classList.remove("slowly-shine-text");
    bombOverlayEl.setAttribute("aria-hidden", "true");
  }

  async function playBOMPresentation(milestone) {
    const timerWasRunning = gameState === STATE.RUNNING;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    bomShowing = true;
    sfxBomb();

    if (timerWasRunning) pauseTimer();

    try {
      resetBOMPresentation();
      bombTitleTextEl.textContent = "BOM！";
      bombMilestoneTextEl.textContent = `${formatBOMMilestone(milestone)}！`;
      bombOverlayEl.setAttribute("aria-hidden", "false");

      // 第一拍：BOM + 里程碑一起出現；不再額外拉開字距。
      bombOverlayEl.classList.add("is-active");
      void bombOverlayEl.offsetWidth;
      bombTextEl.classList.add("is-active");
      await sleep(reducedMotion ? 30 : BOM_SPREAD_MS);

      // 第二拍：直接使用 Shine Text 預設漸層，只由宿主控制播放節奏。
      if (!reducedMotion) {
        for (let pass = 0; pass < 3; pass += 1) {
          bombTitleTextEl.classList.remove("slowly-shine-text");
          bombMilestoneTextEl.classList.remove("slowly-shine-text");
          void bombTitleTextEl.offsetWidth;
          bombTitleTextEl.classList.add("slowly-shine-text");
          bombMilestoneTextEl.classList.add("slowly-shine-text");
          await sleep(BOM_SHINE_MS);
          bombTitleTextEl.classList.remove("slowly-shine-text");
          bombMilestoneTextEl.classList.remove("slowly-shine-text");

          if (pass < 2) {
            await sleep(BOM_SHINE_GAP_MS);
          }
        }
      }

      await sleep(reducedMotion ? 30 : BOM_HOLD_MS);

      // 最後整個 BOM 舞台淡掉，露回原本棋盤。
      bombOverlayEl.classList.add("is-leaving");
      await sleep(reducedMotion ? 30 : BOM_FADE_MS);
    } finally {
      resetBOMPresentation();
      bomShowing = false;

      if (timerWasRunning && gameState === STATE.RUNNING) {
        resumeTimer();
      }
    }
  }

  async function checkBOM() {
    if (bomShowing || score < nextBom) return false;

    const crossedMilestones = [];

    while (score >= nextBom) {
      crossedMilestones.push(nextBom);
      nextBom += 10000;
    }

    // 一次大連鎖跨過多個萬分門檻時，里程碑依序補播，不吞掉中間那一萬。
    for (const milestone of crossedMilestones) {
      await playBOMPresentation(milestone);
    }

    return crossedMilestones.length > 0;
  }

  function showComboFloat() {
    if (combo <= 1) return;

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    comboFloatEl.style.fontSize = `${Math.min(64, 22 + combo * 6)}px`;
    comboShineTextEl.textContent = `COMBO ×${combo}`;

    // 每次 Combo 都從 Shine Text 預設漸層的第一幀重新開始。
    comboShineTextEl.classList.remove("slowly-shine-text");
    void comboShineTextEl.offsetWidth;
    comboShineTextEl.classList.add("slowly-shine-text");

    comboFloatAnimation?.cancel();

    if (reducedMotion || typeof comboFloatEl.animate !== "function") {
      comboFloatEl.classList.remove("comboShow");
      void comboFloatEl.offsetWidth;
      comboFloatEl.classList.add("comboShow");
      window.setTimeout(() => comboFloatEl.classList.remove("comboShow"), 720);
      return;
    }

    comboFloatAnimation = comboFloatEl.animate(
      [
        { opacity: 0, transform: "translate(-50%, -50%) scale(.85)" },
        { opacity: 1, transform: "translate(-50%, -55%) scale(1.08)", offset: 0.38 },
        { opacity: 1, transform: "translate(-50%, -58%) scale(1.04)", offset: 0.72 },
        { opacity: 0, transform: "translate(-50%, -64%) scale(1.02)" }
      ],
      { duration: 720, easing: "ease-out" }
    );

    comboFloatAnimation.finished
      .catch(() => undefined)
      .finally(() => {
        comboFloatAnimation = null;
      });
  }

  /* ===============================
     Input
  =============================== */
  function onCellDown(event) {
    if (gameState !== STATE.RUNNING || busy) return;

    const el = event.currentTarget;
    const r = Number(el.dataset.r);
    const c = Number(el.dataset.c);

    if (grid[r][c].c === null && grid[r][c].sp !== "b") return;

    if (activeTool) {
      void useToolAt({ r, c });
      return;
    }

    if (!selected) {
      selected = { r, c };
      render();
      return;
    }

    if (selected.r === r && selected.c === c) {
      selected = null;
      render();
      return;
    }

    if (Math.abs(selected.r - r) + Math.abs(selected.c - c) !== 1) {
      selected = { r, c };
      render();
      return;
    }

    const a = selected;
    const b = { r, c };
    selected = null;
    void trySwap(a, b);
  }

  /* ===============================
     Match finding
  =============================== */
  function findAllMatches() {
    return SlowlyGridLineMatch.find(grid, {
      minLength: 3,
      getValue(cell) {
        return cell.c;
      },
      isBlocked(cell) {
        return !cell || cell.sp === "b" || cell.c === null;
      }
    });
  }

  function computeSpecialCreations(matches) {
    const creations = [];
    const used = new Set();
    const belong = new Map();

    matches.groups.forEach((group, index) => {
      group.cells.forEach(pos => {
        const key = k(pos.r, pos.c);
        if (!belong.has(key)) belong.set(key, []);
        belong.get(key).push(index);
      });
    });

    // T/L => wrapped
    for (const [key, indexes] of belong.entries()) {
      if (indexes.length < 2) continue;

      const r = Math.floor(key / SIZE);
      const c = key % SIZE;
      const cell = grid[r][c];
      if (cell.sp === "b") continue;

      let hasH = false;
      let hasV = false;

      for (const index of indexes) {
        const group = matches.groups[index];
        if (group.type === "h") hasH = true;
        if (group.type === "v") hasV = true;
      }

      if (hasH && hasV && !used.has(key)) {
        creations.push({ r, c, sp: "w", color: cell.c });
        used.add(key);
      }
    }

    // 5 => color bomb, 4 => striped
    for (const group of matches.groups) {
      if (group.len >= 5) {
        const mid = group.cells[Math.floor(group.cells.length / 2)];
        const key = k(mid.r, mid.c);
        if (used.has(key)) continue;

        creations.push({
          r: mid.r,
          c: mid.c,
          sp: "b",
          color: grid[mid.r][mid.c].c
        });
        used.add(key);
      } else if (group.len === 4) {
        const mid = group.cells[1];
        const key = k(mid.r, mid.c);
        if (used.has(key)) continue;

        creations.push({
          r: mid.r,
          c: mid.c,
          sp: group.type === "h" ? "sh" : "sv",
          color: grid[mid.r][mid.c].c
        });
        used.add(key);
      }
    }

    return creations;
  }

  /* ===============================
     Clear / Apply
  =============================== */
  async function expandByTriggeredSpecials(toClear) {
    const seeds = Array.from(toClear, key => ({
      r: Math.floor(key / SIZE),
      c: key % SIZE
    }));

    const result = SlowlyGridChainExpand.expand(grid, seeds, {
      maxWaves: 12,

      expandAt({ r, c, cell }) {
        if (!cell || !cell.sp) return [];

        if (cell.sp === "b") {
          const positions = [];

          for (let rr = 0; rr < SIZE; rr += 1) {
            for (let cc = 0; cc < SIZE; cc += 1) {
              positions.push({ r: rr, c: cc });
            }
          }

          return positions;
        }

        if (cell.sp === "sh") {
          return Array.from(
            { length: SIZE },
            (_, cc) => ({ r, c: cc })
          );
        }

        if (cell.sp === "sv") {
          return Array.from(
            { length: SIZE },
            (_, rr) => ({ r: rr, c })
          );
        }

        if (cell.sp === "w") {
          const positions = [];

          for (let dr = -1; dr <= 1; dr += 1) {
            for (let dc = -1; dc <= 1; dc += 1) {
              positions.push({ r: r + dr, c: c + dc });
            }
          }

          return positions;
        }

        return [];
      }
    });

    return new Set(
      result.positions.map(pos => k(pos.r, pos.c))
    );
  }

  function applyClear(toClearSet, preserveSet) {
    let count = 0;

    for (const key of toClearSet) {
      if (preserveSet.has(key)) continue;

      const r = Math.floor(key / SIZE);
      const c = key % SIZE;

      if (grid[r][c].c !== null || grid[r][c].sp === "b") {
        grid[r][c] = { c: null, sp: null };
        count += 1;
      }
    }

    return count;
  }

  function dropDownAndFill() {
    SlowlyGridGravity.down(grid, {
      isEmpty(cell) {
        return !cell || (cell.c === null && cell.sp !== "b");
      },

      createCell() {
        return { c: randColor(), sp: null };
      }
    });
  }

  function swapCells(a, b) {
    const tmp = grid[a.r][a.c];
    grid[a.r][a.c] = grid[b.r][b.c];
    grid[b.r][b.c] = tmp;
  }

  /* ===============================
     Specials triggered on swap
  =============================== */
  async function triggerColorBombAt(bombPos, targetColor) {
    const toClear = new Set();

    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        const cell = grid[r][c];
        if (cell.sp === "b") continue;
        if (cell.c === targetColor) toClear.add(k(r, c));
      }
    }

    toClear.add(k(bombPos.r, bombPos.c));

    const expanded = await expandByTriggeredSpecials(toClear);
    const clearPresentation = await playClearPresentation({
      expandedSet: expanded,
      targetColor,
      forceBoardBlast: true
    });
    const cleared = applyClear(expanded, new Set());
    score += cleared * 14 * Math.max(1, combo);

    sfxBomb();
    render();
    clearPresentation();
    await sleep(100);

    dropDownAndFill();
    render();
    await sleep(120);

    await checkBOM();
  }

  async function triggerClearAll() {
    const toClear = new Set();

    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        toClear.add(k(r, c));
      }
    }

    const expanded = await expandByTriggeredSpecials(toClear);
    const clearPresentation = await playClearPresentation({
      expandedSet: expanded,
      forceBoardBlast: true
    });
    const cleared = applyClear(expanded, new Set());
    score += cleared * 16 * Math.max(1, combo);

    sfxBomb();
    render();
    clearPresentation();
    await sleep(110);

    dropDownAndFill();
    render();
    await sleep(140);

    await checkBOM();
  }

  async function triggerSpecialPair(a, b) {
    const first = { ...grid[a.r][a.c] };
    const second = { ...grid[b.r][b.c] };

    const seeds = new Set([k(a.r, a.c), k(b.r, b.c)]);
    const expanded = await expandByTriggeredSpecials(seeds);
    const clearPresentation = await playClearPresentation({
      expandedSet: expanded
    });
    const count = applyClear(expanded, new Set());

    score += count * 12 * Math.max(1, combo);

    if (first.sp === "w" || second.sp === "w") sfxBomb();
    else sfxSpecial();

    render();
    clearPresentation();
    await sleep(100);

    dropDownAndFill();
    render();
    await sleep(120);

    await checkBOM();
  }

  async function maybeTriggerSpecialOnSwap(a, b) {
    const ca = grid[a.r][a.c];
    const cb = grid[b.r][b.c];

    if (ca.sp === "b" && cb.sp === "b") {
      await triggerClearAll();
      return true;
    }

    if (ca.sp === "b" && cb.sp !== "b") {
      await triggerColorBombAt(a, cb.c);
      return true;
    }

    if (cb.sp === "b" && ca.sp !== "b") {
      await triggerColorBombAt(b, ca.c);
      return true;
    }

    if (ca.sp && cb.sp && ca.sp !== "b" && cb.sp !== "b") {
      await triggerSpecialPair(a, b);
      return true;
    }

    return false;
  }

  /* ===============================
     Cascades
  =============================== */
  async function resolveCascades(initialMatches = null) {
    combo = 0;
    let matches = initialMatches || findAllMatches();

    while (matches.groups.length > 0) {
      combo += 1;
      maxCombo = Math.max(maxCombo, combo);
      showComboFloat();

      const specialsToCreate = computeSpecialCreations(matches);
      const toClear = new Set();

      for (const group of matches.groups) {
        for (const pos of group.cells) {
          toClear.add(k(pos.r, pos.c));
        }
      }

      const expanded = await expandByTriggeredSpecials(toClear);
      const preserve = new Set(
        specialsToCreate.map(special => k(special.r, special.c))
      );

      const clearPresentation = await playClearPresentation({
        matches,
        expandedSet: expanded
      });
      const clearedCount = applyClear(expanded, preserve);

      for (const special of specialsToCreate) {
        grid[special.r][special.c] = {
          c: special.color,
          sp: special.sp
        };
      }

      score += clearedCount * 10 * combo;

      sfxPop(Math.min(6, clearedCount));
      if (specialsToCreate.length > 0) sfxSpecial();

      render();
      clearPresentation();
      await checkBOM();
      await sleep(90);

      dropDownAndFill();
      render();

      // 連鎖越深，讓新盤面多停一拍再進下一輪消除。
      // Combo 1 = 120ms、2 = 200ms、3 = 280ms……最高 440ms。
      const cascadeSettleMs = Math.min(440, 120 + (combo - 1) * 80);
      await sleep(cascadeSettleMs);

      matches = findAllMatches();
    }
  }

  /* ===============================
     Tools
     無限模式不限次數；計時 / 計步模式每種道具每場一次。
  =============================== */
  const TARGET_TOOL_BUTTONS = Object.freeze({
    single: toolSingle,
    row: toolRow,
    column: toolColumn,
    swap: toolSwap,
    color: toolColor
  });

  const ALL_TOOL_BUTTONS = Object.freeze({
    ...TARGET_TOOL_BUTTONS,
    refresh: toolRefresh
  });

  function syncToolButtons() {
    for (const [name, button] of Object.entries(ALL_TOOL_BUTTONS)) {
      const selectable = Object.prototype.hasOwnProperty.call(TARGET_TOOL_BUTTONS, name);
      if (selectable) {
        button.setAttribute("aria-pressed", activeTool === name ? "true" : "false");
      }
      button.classList.toggle("is-used", modeHasLimitedTools() && toolUsed[name]);
    }
  }

  function cancelTool() {
    activeTool = null;
    toolSwapFirst = null;
    selected = null;
    syncToolButtons();
    render();
  }

  function toggleTool(name) {
    if (gameState !== STATE.RUNNING || busy || !canUseTool(name)) return;

    if (activeTool === name) {
      cancelTool();
      return;
    }

    activeTool = name;
    toolSwapFirst = null;
    selected = null;
    clearHints();
    syncToolButtons();
    render();
  }

  async function settleToolClear(toClear) {
    if (!toClear || toClear.size === 0) return false;

    setBusy(true);
    combo = 0;
    clearHints();
    selected = null;

    let shouldEnsurePlayable = false;

    try {
      const clearPresentation = await playClearPresentation({
        expandedSet: toClear
      });
      const cleared = applyClear(toClear, new Set());

      if (cleared <= 0) {
        clearPresentation();
        return false;
      }

      sfxSpecial();
      render();
      clearPresentation();
      await sleep(90);

      dropDownAndFill();
      render();
      await sleep(120);

      await resolveCascades();
      shouldEnsurePlayable = true;
      return true;
    } finally {
      setBusy(false);

      if (shouldEnsurePlayable && gameState === STATE.RUNNING) {
        ensurePlayableOrShuffle();
      }
    }
  }

  async function useFreeSwap(first, second) {
    setBusy(true);
    combo = 0;
    clearHints();
    selected = null;

    let shouldEnsurePlayable = false;

    try {
      swapCells(first, second);
      sfxSwap();
      render();
      await sleep(100);

      const matches = findAllMatches();
      if (matches.groups.length > 0) {
        await resolveCascades(matches);
      }

      shouldEnsurePlayable = true;
    } finally {
      setBusy(false);

      if (shouldEnsurePlayable && gameState === STATE.RUNNING) {
        ensurePlayableOrShuffle();
      }
    }
  }

  async function useToolAt(pos) {
    if (gameState !== STATE.RUNNING || busy || !activeTool) return;

    const cell = grid[pos.r][pos.c];

    if (activeTool === "swap") {
      if (!toolSwapFirst) {
        toolSwapFirst = { ...pos };
        selected = { ...pos };
        render();
        return;
      }

      if (toolSwapFirst.r === pos.r && toolSwapFirst.c === pos.c) {
        toolSwapFirst = null;
        selected = null;
        render();
        return;
      }

      const first = toolSwapFirst;
      activeTool = null;
      toolSwapFirst = null;
      selected = null;
      syncToolButtons();
      await useFreeSwap(first, pos);
      markToolUsed("swap");
      return;
    }

    const toClear = new Set();

    if (activeTool === "single") {
      toClear.add(k(pos.r, pos.c));
    } else if (activeTool === "row") {
      for (let c = 0; c < SIZE; c += 1) {
        toClear.add(k(pos.r, c));
      }
    } else if (activeTool === "column") {
      for (let r = 0; r < SIZE; r += 1) {
        toClear.add(k(r, pos.c));
      }
    } else if (activeTool === "color") {
      if (cell.c === null) {
        sfxBad();
        return;
      }

      for (let r = 0; r < SIZE; r += 1) {
        for (let c = 0; c < SIZE; c += 1) {
          if (grid[r][c].c === cell.c) {
            toClear.add(k(r, c));
          }
        }
      }
    }

    const usedTool = activeTool;
    activeTool = null;
    toolSwapFirst = null;
    selected = null;
    syncToolButtons();

    const used = await settleToolClear(toClear);
    if (used) markToolUsed(usedTool);
  }

  /* ===============================
     Moves / Hint / Shuffle
  =============================== */
  function findAnyMove() {
    return SlowlyGridSwapSearch.findFirst(grid, {
      isImmediate({ aCell, bCell }) {
        return (
          aCell.sp === "b" ||
          bCell.sp === "b" ||
          Boolean(aCell.sp && bCell.sp)
        );
      },

      testAfterSwap() {
        return findAllMatches().groups.length > 0;
      }
    });
  }

  function clearHints() {
    for (const el of domCells) {
      el.classList.remove("hint");
    }
  }

  function showHint() {
    if (gameState !== STATE.RUNNING || busy) return;

    clearHints();
    const move = findAnyMove();

    if (!move) {
      doShuffle(true);
      return;
    }

    for (const pos of move) {
      domCells[k(pos.r, pos.c)].classList.add("hint");
    }

    playTone({ freq: 620, dur: 0.08, type: "triangle", gain: 0.06, slide: 1.12 });
  }

  function restoreGridLayout(snapshot) {
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        grid[r][c] = snapshot[r][c];
      }
    }
  }

  function shuffleGridUntilPlayable(maxAttempts = 200) {
    const snapshot = grid.map(row => row.slice());

    try {
      const result = SlowlyGridShuffleUntil.run(grid, {
        maxAttempts,

        shuffle(values) {
          return FictionShuffle.shuffle(values);
        },

        accept() {
          return (
            findAllMatches().groups.length === 0 &&
            Boolean(findAnyMove())
          );
        }
      });

      if (!result.accepted) {
        restoreGridLayout(snapshot);
      }

      return result.accepted;
    } catch (error) {
      restoreGridLayout(snapshot);
      throw error;
    }
  }

  function doShuffle(fromAuto = false) {
    if (gameState !== STATE.RUNNING || busy) return false;

    setBusy(true);
    clearHints();
    selected = null;

    let accepted = false;

    try {
      accepted = shuffleGridUntilPlayable();

      // 理論上 200 次已非常充裕；自動救盤若仍失敗，改建一盤可玩的新盤面，
      // 不留下「有現成三連」或「完全無步」的盤。
      if (!accepted && fromAuto) {
        accepted = buildRandomPlayableBoard();
      }
    } catch (error) {
      setBusy(false);
      throw error;
    }

    if (!accepted) {
      console.warn("[Match3] 洗牌在上限內找不到合法盤面，已還原原盤。");
      render();
      setBusy(false);
      return false;
    }

    sfxShuffle();
    render();

    window.setTimeout(() => {
      setBusy(false);
      if (fromAuto) showHint();
    }, 120);

    return true;
  }

  function ensurePlayableOrShuffle() {
    if (gameState !== STATE.RUNNING || busy) return;

    if (!findAnyMove()) {
      doShuffle(true);
    }
  }

  /* ===============================
     Swap
  =============================== */
  async function playSwapMotion(a, b, duration = 180) {
    const cellA = domCells[k(a.r, a.c)];
    const cellB = domCells[k(b.r, b.c)];
    const candyA = cellA?.querySelector(".candy");
    const candyB = cellB?.querySelector(".candy");

    if (!candyA || !candyB) {
      await sleep(duration);
      return;
    }

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      await sleep(50);
      return;
    }

    const rectA = cellA.getBoundingClientRect();
    const rectB = cellB.getBoundingClientRect();
    const dx = rectB.left - rectA.left;
    const dy = rectB.top - rectA.top;

    if (typeof candyA.animate !== "function" || typeof candyB.animate !== "function") {
      await sleep(duration);
      return;
    }

    const easing = "cubic-bezier(.2,.8,.2,1)";
    const animations = [
      candyA.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: "translate(0, 0)" }
        ],
        { duration, easing }
      ),
      candyB.animate(
        [
          { transform: `translate(${-dx}px, ${-dy}px)` },
          { transform: "translate(0, 0)" }
        ],
        { duration, easing }
      )
    ];

    await Promise.all(
      animations.map(animation => animation.finished.catch(() => undefined))
    );
  }

  async function trySwap(a, b) {
    if (gameState !== STATE.RUNNING || busy) return;

    setBusy(true);
    let shouldEnsurePlayable = false;

    try {
      // Combo 只屬於這一次玩家操作造成的 cascade；新操作先歸零，
      // 避免上一手殘留倍率污染彩球或特殊糖直觸發計分。
      combo = 0;

      swapCells(a, b);
      render();
      sfxSwap();
      await playSwapMotion(a, b);

      const specialTriggered = await maybeTriggerSpecialOnSwap(a, b);

      if (specialTriggered) {
        steps += 1;
        render();
        await resolveCascades();
        shouldEnsurePlayable = true;
        return;
      }

      const matches = findAllMatches();

      if (matches.groups.length === 0) {
        // 讓玩家先看清楚「交換已發生」，再把無效交換退回。
        await sleep(180);

        swapCells(a, b);
        render();
        sfxBad();
        await playSwapMotion(a, b, 160);
        return;
      }

      steps += 1;
      render();

      await resolveCascades(matches);
      shouldEnsurePlayable = true;
    } finally {
      setBusy(false);

      if (shouldEnsurePlayable && gameState === STATE.RUNNING) {
        ensurePlayableOrShuffle();
      }
    }
  }

  /* ===============================
     Controls
  =============================== */
  function buildRandomPlayableBoard(maxAttempts = 200) {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      makeEmptyGrid();
      fillRandomNoMatches();

      if (
        findAllMatches().groups.length === 0 &&
        findAnyMove()
      ) {
        return true;
      }
    }

    return false;
  }

  function newBoard() {
    const built = buildRandomPlayableBoard();

    if (!built) {
      console.warn("[Match3] 初始盤面在上限內找不到可走步，保留最後一盤。");
    }

    selected = null;
    busy = false;
    render();
  }

  function resetGameValues() {
    score = 0;
    combo = 0;
    maxCombo = 0;
    steps = 0;
    nextBom = 10000;
    bomShowing = false;
    pendingAutoEnd = false;
    activeTool = null;
    toolSwapFirst = null;
    toolUsed = createToolUsageState();
    selected = null;
    syncToolButtons();
    resetBOMPresentation();
    resetTimer();
  }

  function newGame() {
    resetGameValues();
    newBoard();
    setState(STATE.IDLE);
  }

  function selectedGameMode() {
    return normalizedGameMode(gameModeEl.value);
  }

  function syncModePreview() {
    if (gameState !== STATE.IDLE) return;
    activeGameMode = selectedGameMode();
    renderSteps();
    renderElapsedTime();
    syncToolButtons();
    syncInteractionState();
  }

  function modeLimitReached() {
    const config = GAME_MODE[activeGameMode];

    if (config.durationMs !== null && syncElapsedTime() >= config.durationMs) {
      return "time";
    }

    if (config.moveLimit !== null && steps >= config.moveLimit) {
      return "moves";
    }

    return null;
  }

  function checkModeEndCondition() {
    if (gameState !== STATE.RUNNING) {
      pendingAutoEnd = false;
      return;
    }

    const reason = modeLimitReached();
    if (!reason) {
      pendingAutoEnd = false;
      return;
    }

    if (busy) {
      pendingAutoEnd = true;
      return;
    }

    pendingAutoEnd = false;
    void endGame(reason);
  }

  function startGame() {
    if (busy) return;
    if (gameState !== STATE.IDLE && gameState !== STATE.ENDED) return;

    activeGameMode = selectedGameMode();

    if (gameState === STATE.ENDED) {
      resetGameValues();
      newBoard();
    } else {
      resetTimer();
      render();
    }

    setState(STATE.RUNNING);
    startTimer();
    render();
  }

  function togglePause() {
    if (busy) return;

    if (gameState === STATE.RUNNING) {
      cancelTool();
      setState(STATE.PAUSED);
      pauseTimer();
    } else if (gameState === STATE.PAUSED) {
      setState(STATE.RUNNING);
      resumeTimer();
      checkModeEndCondition();
    }
  }

  async function endGame(reason = "manual") {
    if (busy) {
      if (reason !== "manual") pendingAutoEnd = true;
      return;
    }
    if (gameState !== STATE.RUNNING && gameState !== STATE.PAUSED) return;

    stopTimer();
    pendingAutoEnd = false;
    activeTool = null;
    toolSwapFirst = null;
    syncToolButtons();
    setState(STATE.ENDED);
    clearHints();
    selected = null;
    render();

    try {
      await saveCurrentToTop3(activeGameMode);
    } catch (error) {
      console.error("[Match3] 排行榜儲存失敗：", error);
    }
  }

  function refreshBoard() {
    if (gameState !== STATE.RUNNING || busy || !canUseTool("refresh")) return;

    const shuffled = doShuffle(false);
    if (!shuffled) return;

    markToolUsed("refresh");
    syncInteractionState();
  }

  /* ===============================
     Wire
  =============================== */
  viewTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      showView(tab.dataset.viewTarget);
    });
  });

  rankModeTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      void renderTop3(tab.dataset.rankMode);
    });
  });

  btnStart.addEventListener("click", startGame);
  btnPause.addEventListener("click", togglePause);
  btnEnd.addEventListener("click", () => {
    void endGame("manual");
  });

  toolSingle.addEventListener("click", () => toggleTool("single"));
  toolRow.addEventListener("click", () => toggleTool("row"));
  toolColumn.addEventListener("click", () => toggleTool("column"));
  toolSwap.addEventListener("click", () => toggleTool("swap"));
  toolColor.addEventListener("click", () => toggleTool("color"));
  toolRefresh.addEventListener("click", refreshBoard);

  soundOnEl.addEventListener("change", () => {
    soundPreference.set(soundOnEl.checked);

    if (soundPreference.get()) {
      playTone({ freq: 660, dur: 0.08, type: "triangle", gain: 0.06, slide: 1.2 });
    }
  });

  volumeLevelEl.addEventListener("change", () => {
    const level = normalizedVolumeLevel(volumeLevelEl.value);
    volumePreference.set(level);
    volumeLevelEl.value = level;

    if (level !== "mute") {
      playTone({ freq: 600, dur: 0.08, type: "triangle", gain: 0.06, slide: 1.08 });
    }
  });

  gameModeEl.addEventListener("change", () => {
    if (gameState === STATE.RUNNING || gameState === STATE.PAUSED) {
      gameModeEl.value = activeGameMode;
      return;
    }

    syncModePreview();
  });


  /* ===============================
     Init
  =============================== */
  async function init() {
    createDom();
    activeGameMode = selectedGameMode();
    activeRankingMode = activeGameMode;

    try {
      await renderTop3(activeRankingMode);
    } catch (error) {
      console.error("[Match3] 排行榜初始化失敗：", error);
      rankListEl.textContent = "—";
    }

    newGame();
  }

  void init();

  window.addEventListener("beforeunload", () => {
    gameTicker.stop();
    gameTimer.stop();
  });
})();
