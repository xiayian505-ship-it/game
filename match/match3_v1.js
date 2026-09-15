(() => {
  "use strict";

  /* =========================================================
     無限消消樂｜match3_v1

     Match3 自己保留：
     - 8x8 棋盤與交換規則
     - 3+ 配對 / 連鎖
     - 4 連條紋、5 連彩球、T/L 包裝
     - 特殊糖觸發
     - 提示 / 無步判定
     - BOM / Combo / 計分
     - 每局一次重整

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
  ========================================================= */

  const SIZE = 8;
  const COLORS = 6;

  /* ===============================
     DOM
  =============================== */
  const boardEl = document.getElementById("board");
  const scoreEl = document.getElementById("score");
  const comboEl = document.getElementById("combo");
  const timeEl = document.getElementById("time");
  const stepsEl = document.getElementById("steps");
  const stateTextEl = document.getElementById("stateText");
  const rankListEl = document.getElementById("rankList");

  const btnStart = document.getElementById("btnStart");
  const btnPause = document.getElementById("btnPause");
  const btnEnd = document.getElementById("btnEnd");
  const btnHint = document.getElementById("btnHint");
  const btnShuffle = document.getElementById("btnShuffle");
  const btnRefresh = document.getElementById("btnRefresh");
  const soundOnEl = document.getElementById("soundOn");

  const bombOverlayEl = document.getElementById("bombOverlay");
  const comboFloatEl = document.getElementById("comboFloat");

  const comboToast = SlowlyToast.create(comboFloatEl, {
    duration: 450,
    activeClass: "comboShow"
  });

  const bombToast = SlowlyToast.create(bombOverlayEl, {
    duration: 3000,
    activeClass: "show"
  });

  /* ===============================
     倉庫｜Preference
     音效開關只由宿主 checkbox 顯示；偏好保存交給軍火庫。
  =============================== */
  const soundPreference = Preference.create({
    key: "SBS_match3_v1:sound",
    defaultValue: true
  });

  soundOnEl.checked = soundPreference.get();

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
  let steps = 0;
  let elapsedMs = 0;

  const STATE = {
    IDLE: "IDLE",
    RUNNING: "RUNNING",
    PAUSED: "PAUSED",
    ENDED: "ENDED"
  };

  let gameState = STATE.IDLE;
  let nextBom = 10000;
  let bomShowing = false;
  let refreshUsed = false;

  /* ===============================
     倉庫｜Timer / Ticker
  =============================== */
  const gameTimer = Timer.create();
  const gameTicker = Ticker.create({
    interval: 250,
    callback() {
      renderElapsedTime();
    }
  });

  function resetTimer() {
    elapsedMs = 0;
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
    elapsedMs = Math.max(0, Number(gameTimer.elapsed()) || 0);
    return elapsedMs;
  }

  function renderElapsedTime() {
    timeEl.textContent = SlowlyElapsedFormat.formatHMS(syncElapsedTime());
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

    SlowlyAudioTone.play({
      frequency: freq,
      duration: dur,
      type,
      gain,
      slide
    }).catch(error => {
      console.warn("[Match3] 音效播放失敗：", error);
    });
  }

  function sfxSwap() {
    playTone({ freq: 520, dur: 0.06, type: "triangle", gain: 0.10, slide: 0.8 });
  }

  function sfxBad() {
    playTone({ freq: 180, dur: 0.10, type: "sawtooth", gain: 0.06, slide: 0.7 });
  }

  function sfxPop(n = 1) {
    const base = 520 * (1 + Math.min(12, combo) * 0.035);

    for (let i = 0; i < Math.min(6, n); i += 1) {
      window.setTimeout(() => {
        playTone({
          freq: base * (1 + i * 0.12),
          dur: 0.06,
          type: "square",
          gain: 0.07,
          slide: 0.95
        });
      }, i * 18);
    }
  }

  function sfxSpecial() {
    playTone({ freq: 780, dur: 0.10, type: "triangle", gain: 0.10, slide: 1.6 });
    window.setTimeout(() => {
      playTone({ freq: 420, dur: 0.12, type: "sine", gain: 0.08, slide: 0.7 });
    }, 25);
  }

  function sfxBomb() {
    playTone({ freq: 120, dur: 0.18, type: "sawtooth", gain: 0.07, slide: 0.55 });
    window.setTimeout(() => {
      playTone({ freq: 220, dur: 0.10, type: "triangle", gain: 0.05, slide: 0.85 });
    }, 30);
  }

  function sfxShuffle() {
    playTone({ freq: 360, dur: 0.10, type: "triangle", gain: 0.08, slide: 1.35 });
    window.setTimeout(() => {
      playTone({ freq: 540, dur: 0.08, type: "triangle", gain: 0.06, slide: 1.1 });
    }, 60);
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
     倉庫｜FictionStorage / FictionSort / FictionPaginate
     排名規則仍是 Match3 專屬：
     分數高 → 時間短 → 步數少。
     排序執行與 TOP 3 切片交給軍火庫。
  =============================== */
  const scoreStore = FictionStorage.create({
    namespace: "SBS_match3_v1"
  });

  const rankings = scoreStore.collection("top3");

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

  async function getTop3() {
    const rows = await rankings.all();
    return takeTop3(sortRankings(rows));
  }

  async function renderTop3() {
    const top3 = await getTop3();

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

      line.append(
        rank,
        document.createTextNode(
          ` ｜ 分數：${item.score} ｜ 時間：${SlowlyElapsedFormat.formatHMS(item.timeMs)} ｜ 步數：${item.steps}`
        )
      );

      rankListEl.appendChild(line);
    });
  }

  async function saveCurrentToTop3() {
    await rankings.add({
      score,
      timeMs: syncElapsedTime(),
      steps,
      at: now()
    });

    const rows = await rankings.all();
    const top3 = takeTop3(sortRankings(rows));

    await rankings.replace(top3);
    await renderTop3();
  }

  /* ===============================
     State UI
  =============================== */
  function setState(next) {
    gameState = next;

    const running = gameState === STATE.RUNNING;
    const paused = gameState === STATE.PAUSED;

    btnStart.disabled = !(gameState === STATE.IDLE || gameState === STATE.ENDED);
    btnPause.disabled = !(running || paused);
    btnEnd.disabled = !(running || paused);

    btnHint.disabled = !running;
    btnShuffle.disabled = !running;
    btnRefresh.disabled = !running || refreshUsed;

    btnPause.textContent = paused ? "繼續" : "暫停";
    stateTextEl.textContent =
      gameState === STATE.IDLE ? "待開始" :
      gameState === STATE.RUNNING ? "進行中" :
      gameState === STATE.PAUSED ? "暫停中" :
      "已結束";

    for (const el of domCells) {
      el.classList.toggle("locked", !running);
    }
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
    stepsEl.textContent = steps;
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
  function checkBOM() {
    if (bomShowing || score < nextBom) return;

    while (score >= nextBom) {
      nextBom += 10000;
    }

    bomShowing = true;
    sfxBomb();
    bombToast.show("BOM！恭喜破萬");

    window.setTimeout(() => {
      bomShowing = false;
    }, 3000);
  }

  function showComboFloat() {
    if (combo <= 1) return;

    comboFloatEl.style.fontSize = `${Math.min(64, 22 + combo * 6)}px`;

    // 先清掉上一輪顯示狀態並強制 reflow，確保連續 Combo 也會重新播放動畫。
    comboToast.hide();
    void comboFloatEl.offsetWidth;
    comboToast.show(`COMBO ×${combo}`);
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
        const el = domCells[k(r, c)];
        const candy = el.querySelector(".candy");
        if (candy) candy.classList.add("pop");

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
    const cleared = applyClear(expanded, new Set());
    score += cleared * 14 * Math.max(1, combo);

    sfxBomb();
    render();
    await sleep(160);

    dropDownAndFill();
    render();
    await sleep(120);

    checkBOM();
  }

  async function triggerClearAll() {
    const toClear = new Set();

    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        toClear.add(k(r, c));
      }
    }

    const expanded = await expandByTriggeredSpecials(toClear);
    const cleared = applyClear(expanded, new Set());
    score += cleared * 16 * Math.max(1, combo);

    sfxBomb();
    render();
    await sleep(180);

    dropDownAndFill();
    render();
    await sleep(140);

    checkBOM();
  }

  async function triggerSpecialAt(pos) {
    const originalCell = { ...grid[pos.r][pos.c] };
    if (!originalCell.sp) return;

    if (originalCell.sp === "b") {
      await triggerClearAll();
      return;
    }

    const seed = new Set([k(pos.r, pos.c)]);
    const expanded = await expandByTriggeredSpecials(seed);
    let count = 0;

    for (const key of expanded) {
      const r = Math.floor(key / SIZE);
      const c = key % SIZE;

      if (grid[r][c].c !== null || grid[r][c].sp === "b") {
        grid[r][c] = { c: null, sp: null };
        count += 1;
      }
    }

    score += count * 12 * Math.max(1, combo);

    if (originalCell.sp === "w") sfxBomb();
    else sfxSpecial();

    render();
    await sleep(140);

    dropDownAndFill();
    render();
    await sleep(120);

    checkBOM();
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
      await triggerSpecialAt(a);
      await triggerSpecialAt(b);
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
      checkBOM();
      await sleep(120);

      dropDownAndFill();
      render();
      await sleep(120);

      matches = findAllMatches();
    }
  }

  /* ===============================
     Moves / Hint / Shuffle
  =============================== */
  function findAnyMove() {
    return SlowlyGridSwapSearch.findFirst(grid, {
      isImmediate({ aCell, bCell }) {
        return aCell.sp === "b" || bCell.sp === "b";
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

  function doShuffle(fromAuto = false) {
    if (gameState !== STATE.RUNNING || busy) return;

    busy = true;
    clearHints();
    selected = null;

    SlowlyGridShuffleUntil.run(grid, {
      maxAttempts: 5,

      shuffle(values) {
        return FictionShuffle.shuffle(values);
      },

      accept() {
        return findAllMatches().groups.length === 0;
      }
    });

    sfxShuffle();
    render();

    window.setTimeout(() => {
      busy = false;
      ensurePlayableOrShuffle();
      if (fromAuto) showHint();
    }, 120);
  }

  function ensurePlayableOrShuffle() {
    if (!findAnyMove()) {
      doShuffle(true);
    }
  }

  /* ===============================
     Swap
  =============================== */
  async function trySwap(a, b) {
    if (gameState !== STATE.RUNNING || busy) return;

    busy = true;

    swapCells(a, b);
    render();
    sfxSwap();

    const specialTriggered = await maybeTriggerSpecialOnSwap(a, b);

    if (specialTriggered) {
      steps += 1;
      render();
      await resolveCascades();
      busy = false;
      ensurePlayableOrShuffle();
      return;
    }

    const matches = findAllMatches();

    if (matches.groups.length === 0) {
      swapCells(a, b);
      render();
      sfxBad();
      busy = false;
      return;
    }

    steps += 1;
    render();

    await resolveCascades(matches);
    busy = false;
    ensurePlayableOrShuffle();
  }

  /* ===============================
     Controls
  =============================== */
  function newBoard() {
    makeEmptyGrid();
    fillRandomNoMatches();
    selected = null;
    busy = false;
    render();
    ensurePlayableOrShuffle();
  }

  function resetGameValues() {
    score = 0;
    combo = 0;
    steps = 0;
    nextBom = 10000;
    bomShowing = false;
    refreshUsed = false;
    bombToast.hide();
    resetTimer();
  }

  function newGame() {
    resetGameValues();
    newBoard();
    setState(STATE.IDLE);
  }

  function startGame() {
    if (gameState !== STATE.IDLE && gameState !== STATE.ENDED) return;

    if (gameState === STATE.ENDED) {
      resetGameValues();
      newBoard();
    }

    setState(STATE.RUNNING);
    startTimer();
    render();
  }

  function togglePause() {
    if (gameState === STATE.RUNNING) {
      setState(STATE.PAUSED);
      pauseTimer();
    } else if (gameState === STATE.PAUSED) {
      setState(STATE.RUNNING);
      resumeTimer();
    }
  }

  async function endGame() {
    if (gameState !== STATE.RUNNING && gameState !== STATE.PAUSED) return;

    stopTimer();
    setState(STATE.ENDED);
    clearHints();
    selected = null;
    render();

    // Match3 專屬規則：只有手動結束才寫入 TOP3。
    try {
      await saveCurrentToTop3();
    } catch (error) {
      console.error("[Match3] 排行榜儲存失敗：", error);
    }
  }

  function refreshBoardOnce() {
    if (gameState !== STATE.RUNNING || refreshUsed) return;

    refreshUsed = true;
    btnRefresh.disabled = true;
    doShuffle(false);
  }

  /* ===============================
     Wire
  =============================== */
  btnStart.addEventListener("click", startGame);
  btnPause.addEventListener("click", togglePause);
  btnEnd.addEventListener("click", () => {
    void endGame();
  });

  btnHint.addEventListener("click", showHint);
  btnShuffle.addEventListener("click", () => doShuffle(false));
  btnRefresh.addEventListener("click", refreshBoardOnce);

  soundOnEl.addEventListener("change", () => {
    soundPreference.set(soundOnEl.checked);

    if (soundPreference.get()) {
      playTone({ freq: 660, dur: 0.08, type: "triangle", gain: 0.06, slide: 1.2 });
    }
  });

  /* ===============================
     Init
  =============================== */
  async function init() {
    createDom();

    try {
      await renderTop3();
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
