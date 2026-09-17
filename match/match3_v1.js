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
     - 無限 / 3 分鐘計時 / 30 步步數
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
    moves: Object.freeze({ label: "步數", durationMs: null, moveLimit: 30, limitedTools: true })
  });

  const GAME_MODE_DESCRIPTION = Object.freeze({
    infinite: "不限時間、步數與道具次數；排行榜獨立保存本機 TOP 3，手動結束時結算。",
    timed: "每場從 03:00 倒數至 00:00；六種道具每場各可使用一次。排行榜獨立保存本機 TOP 3，時間到或手動結束時結算。",
    moves: "每場 30 次有效交換；交換失敗與使用道具不扣步，六種道具每場各可使用一次。排行榜獨立保存本機 TOP 3，步數用完或手動結束時結算。"
  });

  function normalizedGameMode(value) {
    return Object.prototype.hasOwnProperty.call(GAME_MODE, value)
      ? value
      : "infinite";
  }

  /* ===============================
     DOM
  =============================== */
  const particleBgCanvas = document.getElementById("match3ParticleBg");
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
  const btnStartIconCanvas = document.getElementById("btnStartIcon");
  const btnPauseIconCanvas = document.getElementById("btnPauseIcon");
  const btnEndIconCanvas = document.getElementById("btnEndIcon");

  const toolSingle = document.getElementById("toolSingle");
  const toolRow = document.getElementById("toolRow");
  const toolSingleIconCanvas = document.getElementById("toolSingleIcon");
  const toolColumn = document.getElementById("toolColumn");
  const toolSwap = document.getElementById("toolSwap");
  const toolRefresh = document.getElementById("toolRefresh");
  const toolColor = document.getElementById("toolColor");
  const toolRowIconCanvas = document.getElementById("toolRowIcon");
  const toolColumnIconCanvas = document.getElementById("toolColumnIcon");
  const toolSwapIconCanvas = document.getElementById("toolSwapIcon");
  const toolRefreshIconCanvas = document.getElementById("toolRefreshIcon");
  const toolColorIconCanvas = document.getElementById("toolColorIcon");

  const guideToolSingleIconCanvas = document.getElementById("guideToolSingleIcon");
  const guideToolRowIconCanvas = document.getElementById("guideToolRowIcon");
  const guideToolColumnIconCanvas = document.getElementById("guideToolColumnIcon");
  const guideToolSwapIconCanvas = document.getElementById("guideToolSwapIcon");
  const guideToolRefreshIconCanvas = document.getElementById("guideToolRefreshIcon");
  const guideToolColorIconCanvas = document.getElementById("guideToolColorIcon");

  const guideSpecialStripedHIconCanvas = document.getElementById("guideSpecialStripedHIcon");
  const guideSpecialStripedVIconCanvas = document.getElementById("guideSpecialStripedVIcon");
  const guideSpecialWrappedIconCanvas = document.getElementById("guideSpecialWrappedIcon");
  const guideSpecialColorIconCanvas = document.getElementById("guideSpecialColorIcon");

  const soundOnEl = document.getElementById("soundOn");
  const volumeLevelEl = document.getElementById("volumeLevel");
  const gameModeEl = document.getElementById("gameMode");
  const gameModeNoteEl = document.getElementById("gameModeNote");

  const bombOverlayEl = document.getElementById("bombOverlay");
  const bombTextEl = document.getElementById("bombText");
  const bombTitleTextEl = document.getElementById("bombTitleText");
  const bombMilestoneTextEl = document.getElementById("bombMilestoneText");
  const comboFloatEl = document.getElementById("comboFloat");
  const comboShineTextEl = document.getElementById("comboShineText");

  const instructionsGuideEl = document.getElementById("instructionsGuide");
  const scoreGuideEl = document.getElementById("scoreGuide");
  const scoreBasicCandyCanvases = document.querySelectorAll("[data-score-basic-candy]");
  const scoreToolCanvases = document.querySelectorAll("[data-score-tool]");
  const scoreSpecialStripedHIconCanvas = document.getElementById("scoreSpecialStripedHIcon");
  const scoreSpecialStripedVIconCanvas = document.getElementById("scoreSpecialStripedVIcon");
  const scoreSpecialWrappedIconCanvas = document.getElementById("scoreSpecialWrappedIcon");
  const scoreSpecialColorIconCanvas = document.getElementById("scoreSpecialColorIcon");
  const scoreComboDemoTextEl = document.getElementById("scoreComboDemoText");
  const scoreBomTitleTextEl = document.getElementById("scoreBomTitleText");
  const scoreBomMilestoneTextEl = document.getElementById("scoreBomMilestoneText");

  // 同一支 HTML 內切換「遊戲 / 排行榜」；只切畫面，不改遊戲狀態。
  const viewTabs = document.querySelectorAll("[data-view-target]");
  const viewPanels = document.querySelectorAll("[data-view-panel]");

  function getToolIconSize(button) {
    const fallback = 28;
    if (!button) return fallback;
    return Math.max(22, Math.min(30, Math.round((button.clientHeight || 40) - 12)));
  }

  function prepareToolIconCanvas(canvas, size) {
    if (!canvas) return null;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    return ctx;
  }

  function drawArrowHead(ctx, x, y, angle, length, spread = Math.PI / 5.3) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - Math.cos(angle - spread) * length, y - Math.sin(angle - spread) * length);
    ctx.moveTo(x, y);
    ctx.lineTo(x - Math.cos(angle + spread) * length, y - Math.sin(angle + spread) * length);
    ctx.stroke();
  }

  function drawRecordDotIcon(canvas, color = "#c4874d") {
    const size = getToolIconSize(canvas?.parentElement);
    const ctx = prepareToolIconCanvas(canvas, size);
    if (!ctx) return;

    const r = size * 0.22;
    const x = size / 2;
    const y = size / 2;
    const fill = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.25, x, y, r);
    fill.addColorStop(0, "rgba(255,255,255,.72)");
    fill.addColorStop(0.2, color);
    fill.addColorStop(1, color);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(63,85,83,.18)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawDoubleArrowSymbol(ctx, size, orientation = "horizontal", color = "#3f5553") {
    if (!ctx) return;

    const mid = size / 2;
    const pad = size * 0.15;
    const arrowLen = size * 0.23;
    const stroke = Math.max(2.4, size * 0.11);
    ctx.strokeStyle = color;
    ctx.lineWidth = stroke;

    if (orientation === "horizontal") {
      ctx.beginPath();
      ctx.moveTo(pad + arrowLen, mid);
      ctx.lineTo(size - pad - arrowLen, mid);
      ctx.stroke();
      drawArrowHead(ctx, pad, mid, Math.PI, arrowLen);
      drawArrowHead(ctx, size - pad, mid, 0, arrowLen);
      return;
    }

    ctx.beginPath();
    ctx.moveTo(mid, pad + arrowLen);
    ctx.lineTo(mid, size - pad - arrowLen);
    ctx.stroke();
    drawArrowHead(ctx, mid, pad, -Math.PI / 2, arrowLen);
    drawArrowHead(ctx, mid, size - pad, Math.PI / 2, arrowLen);
  }

  function drawDoubleArrowIcon(canvas, orientation = "horizontal", color = "#3f5553") {
    const size = getToolIconSize(canvas?.parentElement);
    const ctx = prepareToolIconCanvas(canvas, size);
    if (!ctx) return;
    drawDoubleArrowSymbol(ctx, size, orientation, color);
  }

  function drawRightLeftStackIcon(canvas, color = "#111111") {
    const size = getToolIconSize(canvas?.parentElement);
    const ctx = prepareToolIconCanvas(canvas, size);
    if (!ctx) return;

    const pad = size * 0.2;
    const arrowLen = size * 0.2;
    const stroke = Math.max(2.5, size * 0.12);
    const topY = size * 0.36;
    const bottomY = size * 0.66;

    ctx.strokeStyle = color;
    ctx.lineWidth = stroke;

    ctx.beginPath();
    ctx.moveTo(pad, topY);
    ctx.lineTo(size - pad, topY);
    ctx.stroke();
    drawArrowHead(ctx, size - pad, topY, 0, arrowLen, Math.PI / 4.8);

    ctx.beginPath();
    ctx.moveTo(size - pad, bottomY);
    ctx.lineTo(pad, bottomY);
    ctx.stroke();
    drawArrowHead(ctx, pad, bottomY, Math.PI, arrowLen, Math.PI / 4.8);
  }

  function drawRepeatIcon(canvas, color = "#111111") {
    const size = getToolIconSize(canvas?.parentElement);
    const ctx = prepareToolIconCanvas(canvas, size);
    if (!ctx) return;

    const pad = size * 0.23;
    const left = pad;
    const right = size - pad;
    const top = size * 0.34;
    const bottom = size * 0.68;
    const radius = size * 0.12;
    const arrowLen = size * 0.18;
    const stroke = Math.max(2.4, size * 0.105);

    ctx.strokeStyle = color;
    ctx.lineWidth = stroke;

    ctx.beginPath();
    ctx.moveTo(left + radius, bottom);
    ctx.lineTo(right - radius, bottom);
    ctx.quadraticCurveTo(right, bottom, right, bottom - radius);
    ctx.lineTo(right, top + radius);
    ctx.quadraticCurveTo(right, top, right - radius, top);
    ctx.lineTo(left + arrowLen, top);
    ctx.stroke();
    drawArrowHead(ctx, right, top, 0, arrowLen, Math.PI / 4.8);

    ctx.beginPath();
    ctx.moveTo(right - arrowLen, bottom);
    ctx.lineTo(left + radius, bottom);
    ctx.quadraticCurveTo(left, bottom, left, bottom - radius);
    ctx.lineTo(left, top + radius);
    ctx.quadraticCurveTo(left, top, left + radius, top);
    ctx.lineTo(left + arrowLen, top);
    ctx.stroke();
    drawArrowHead(ctx, left, bottom, Math.PI, arrowLen, Math.PI / 4.8);
  }

  function drawCandyCircle(ctx, x, y, r, topColor, bottomColor) {
    const fill = ctx.createLinearGradient(x, y - r, x, y + r);
    fill.addColorStop(0, topColor);
    fill.addColorStop(1, bottomColor);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(63,85,83,.18)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - r * 0.24, y - r * 0.3, r * 0.46, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,.62)";
    ctx.fill();
  }

  const SPECIAL_GUIDE_PALETTES = Object.freeze([
    ["#c57b86", "#ad606d"],
    ["#cd9765", "#b97840"],
    ["#7fa8b8", "#628899"],
    ["#91ab90", "#718e70"],
    ["#a092b4", "#806f98"],
    ["#d1c19d", "#b9a681"]
  ]);


  function prepareSpecialCanvas(canvas, logicalSize = 64, fixedCssSize = null) {
    if (!canvas) return null;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.round(logicalSize * dpr);
    canvas.height = Math.round(logicalSize * dpr);
    canvas.style.width = fixedCssSize ? `${fixedCssSize}px` : "100%";
    canvas.style.height = fixedCssSize ? `${fixedCssSize}px` : "100%";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, logicalSize, logicalSize);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    return ctx;
  }

  function drawSpecialMark(ctx, kind, size) {
    if (!ctx || !kind) return;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = "rgba(255,255,255,.28)";
    ctx.shadowBlur = size * 0.08;

    if (kind === "sh" || kind === "sv") {
      // 特殊糖直接沿用下方「橫列 / 直列」道具的雙箭頭語言。
      ctx.shadowColor = "rgba(255,255,255,.72)";
      ctx.shadowBlur = size * 0.10;
      drawDoubleArrowSymbol(
        ctx,
        size,
        kind === "sh" ? "horizontal" : "vertical",
        kind === "sh" ? "#6f93a4" : "#7f9a7d"
      );

      ctx.restore();
      return;
    }

    if (kind === "w") {
      ctx.strokeStyle = "rgba(255,255,255,.92)";
      ctx.lineWidth = Math.max(3, size * 0.095);
      ctx.beginPath();
      ctx.moveTo(size * 0.5, size * 0.17);
      ctx.lineTo(size * 0.5, size * 0.83);
      ctx.moveTo(size * 0.17, size * 0.5);
      ctx.lineTo(size * 0.83, size * 0.5);
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,.88)";
      ctx.beginPath();
      ctx.moveTo(size * 0.5, size * 0.37);
      ctx.lineTo(size * 0.63, size * 0.5);
      ctx.lineTo(size * 0.5, size * 0.63);
      ctx.lineTo(size * 0.37, size * 0.5);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
      return;
    }

    if (kind === "b") {
      // 彩球直接沿用下方「同色」道具的六色花花符號。
      ctx.shadowColor = "rgba(255,255,255,.58)";
      ctx.shadowBlur = size * 0.07;
      drawColorPaletteSymbol(ctx, size);
    }

    ctx.restore();
  }

  function drawSpecialCandyMark(canvas, kind) {
    const logicalSize = 64;
    const ctx = prepareSpecialCanvas(canvas, logicalSize);
    if (!ctx) return;
    drawSpecialMark(ctx, kind, logicalSize);
  }

  function drawSpecialGuideCandy(canvas, kind, colorIndex = 2) {
    const size = 48;
    const ctx = prepareSpecialCanvas(canvas, size, 44);
    if (!ctx) return;

    const [topColor, bottomColor] = SPECIAL_GUIDE_PALETTES[colorIndex % SPECIAL_GUIDE_PALETTES.length];
    const radius = size * 0.23;
    const x = size / 2;
    const y = size / 2;
    const fill = ctx.createLinearGradient(0, size * 0.12, 0, size * 0.88);
    fill.addColorStop(0, topColor);
    fill.addColorStop(1, bottomColor);

    ctx.beginPath();
    ctx.roundRect(size * 0.08, size * 0.08, size * 0.84, size * 0.84, radius);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = "rgba(8,14,20,.16)";
    ctx.lineWidth = 1;
    ctx.stroke();

    const shine = ctx.createRadialGradient(size * 0.31, size * 0.27, 1, size * 0.31, size * 0.27, size * 0.3);
    shine.addColorStop(0, "rgba(255,255,255,.42)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.beginPath();
    ctx.arc(size * 0.31, size * 0.27, size * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = shine;
    ctx.fill();

    drawSpecialMark(ctx, kind, size);
  }

  function renderSpecialGuideIcons() {
    // 說明區、計分區與棋盤共用同一套特殊糖圖示。
    drawSpecialGuideCandy(guideSpecialStripedHIconCanvas, "sh", 2);
    drawSpecialGuideCandy(guideSpecialStripedVIconCanvas, "sv", 3);
    drawSpecialGuideCandy(guideSpecialWrappedIconCanvas, "w", 4);
    drawSpecialGuideCandy(guideSpecialColorIconCanvas, "b", 1);

    drawSpecialGuideCandy(scoreSpecialStripedHIconCanvas, "sh", 2);
    drawSpecialGuideCandy(scoreSpecialStripedVIconCanvas, "sv", 3);
    drawSpecialGuideCandy(scoreSpecialWrappedIconCanvas, "w", 4);
    drawSpecialGuideCandy(scoreSpecialColorIconCanvas, "b", 1);

    scoreBasicCandyCanvases.forEach(canvas => {
      const colorIndex = Number(canvas.dataset.scoreBasicCandy);
      drawSpecialGuideCandy(canvas, null, Number.isFinite(colorIndex) ? colorIndex : 0);
    });
  }

  function drawColorPaletteSymbol(ctx, size) {
    if (!ctx) return;

    // 六色花花糖果：與「同色」道具共用，同時作為彩球的識別符號。
    const r = size * 0.145;
    const positions = [
      [size * 0.5,  size * 0.23, "#c88a92", "#b86b75"], // dusty rose
      [size * 0.68, size * 0.34, "#d9a777", "#c4874d"], // sand
      [size * 0.68, size * 0.56, "#86a9b7", "#6f93a4"], // dusty blue
      [size * 0.5,  size * 0.69, "#9db39b", "#7f9a7d"], // sage
      [size * 0.32, size * 0.56, "#a89bb5", "#8e7fa0"], // mauve
      [size * 0.32, size * 0.34, "#e4d6bd", "#cdbb9c"]  // oat
    ];

    const halo = ctx.createRadialGradient(
      size * 0.5, size * 0.46, size * 0.08,
      size * 0.5, size * 0.46, size * 0.34
    );
    halo.addColorStop(0, "rgba(255,255,255,.18)");
    halo.addColorStop(1, "rgba(255,255,255,0)");
    ctx.beginPath();
    ctx.arc(size * 0.5, size * 0.46, size * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = halo;
    ctx.fill();

    for (const [x, y, topColor, bottomColor] of positions) {
      drawCandyCircle(ctx, x, y, r, topColor, bottomColor);
    }
  }

  function drawColorPaletteIcon(canvas) {
    const size = getToolIconSize(canvas?.parentElement);
    const ctx = prepareToolIconCanvas(canvas, size);
    if (!ctx) return;
    drawColorPaletteSymbol(ctx, size);
  }

  function drawPlaybackIcon(canvas, kind, color) {
    const size = Math.max(24, Math.min(32, Math.round((canvas?.parentElement?.clientHeight || 40) - 10)));
    const ctx = prepareToolIconCanvas(canvas, size);
    if (!ctx) return;

    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2.4, size * 0.11);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (kind === "play") {
      const left = size * 0.35;
      const top = size * 0.24;
      const bottom = size * 0.76;
      const right = size * 0.75;
      ctx.beginPath();
      ctx.moveTo(left, top);
      ctx.lineTo(right, size / 2);
      ctx.lineTo(left, bottom);
      ctx.closePath();
      ctx.fill();
      return;
    }

    if (kind === "pause") {
      const w = size * 0.16;
      const h = size * 0.5;
      const y = (size - h) / 2;
      ctx.fillRect(size * 0.32, y, w, h);
      ctx.fillRect(size * 0.52, y, w, h);
      return;
    }

    if (kind === "stop") {
      const side = size * 0.46;
      const xy = (size - side) / 2;
      ctx.fillRect(xy, xy, side, side);
    }
  }

  function renderControlIcons() {
    drawPlaybackIcon(btnStartIconCanvas, "play", "#7f9a7d");   // sage
    drawPlaybackIcon(
      btnPauseIconCanvas,
      gameState === STATE.PAUSED ? "play" : "pause",
      "#6f93a4"
    );
    drawPlaybackIcon(btnEndIconCanvas, "stop", "#b86b75");     // dusty rose
  }

  function renderToolIcons() {
    // 遊戲列與說明區共用同一套 Canvas 畫法，避免圖示與文字對不上。
    drawRecordDotIcon(toolSingleIconCanvas, "#c4874d");                 // sand
    drawDoubleArrowIcon(toolRowIconCanvas, "horizontal", "#6f93a4");   // dusty blue
    drawDoubleArrowIcon(toolColumnIconCanvas, "vertical", "#7f9a7d");  // sage
    drawRightLeftStackIcon(toolSwapIconCanvas, "#b86b75");             // dusty rose
    drawRepeatIcon(toolRefreshIconCanvas, "#8e7fa0");                  // mauve
    drawColorPaletteIcon(toolColorIconCanvas);

    drawRecordDotIcon(guideToolSingleIconCanvas, "#c4874d");
    drawDoubleArrowIcon(guideToolRowIconCanvas, "horizontal", "#6f93a4");
    drawDoubleArrowIcon(guideToolColumnIconCanvas, "vertical", "#7f9a7d");
    drawRightLeftStackIcon(guideToolSwapIconCanvas, "#b86b75");
    drawRepeatIcon(guideToolRefreshIconCanvas, "#8e7fa0");
    drawColorPaletteIcon(guideToolColorIconCanvas);

    scoreToolCanvases.forEach(canvas => {
      switch (canvas.dataset.scoreTool) {
        case "single":
          drawRecordDotIcon(canvas, "#c4874d");
          break;
        case "row":
          drawDoubleArrowIcon(canvas, "horizontal", "#6f93a4");
          break;
        case "column":
          drawDoubleArrowIcon(canvas, "vertical", "#7f9a7d");
          break;
        case "swap":
          drawRightLeftStackIcon(canvas, "#b86b75");
          break;
        case "refresh":
          drawRepeatIcon(canvas, "#8e7fa0");
          break;
        case "color":
          drawColorPaletteIcon(canvas);
          break;
      }
    });

    renderSpecialGuideIcons();
    renderControlIcons();
  }

  function replayScoreGuideTextEffects() {
    if (!scoreGuideEl?.open) return;

    [scoreComboDemoTextEl, scoreBomTitleTextEl, scoreBomMilestoneTextEl].forEach((el, index) => {
      if (!el) return;
      el.classList.remove("slowly-shine-text");
      void el.offsetWidth;
      window.setTimeout(() => el.classList.add("slowly-shine-text"), index * 90);
    });
  }

  instructionsGuideEl?.addEventListener("toggle", () => {
    if (!instructionsGuideEl.open) return;
    renderToolIcons();
  });

  function showView(viewName) {
    scoreGuideEl?.addEventListener("toggle", () => {
    if (!scoreGuideEl.open) return;
    renderToolIcons();
    replayScoreGuideTextEffects();
  });

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
     軍火庫｜Particle Network 背景
     使用獨立 Canvas，不碰遊戲 / 道具 / 控制鍵的 Canvas。
  =============================== */
  let particleBackground = null;

  function initParticleBackground() {
    if (!particleBgCanvas) return;

    if (!window.SlowlyParticleNetwork?.create) {
      console.warn("[Match3] Particle Network 未載入，保留靜態星空備援。");
      return;
    }

    try {
      // 只把這一張背景 canvas 交給 Particle Network。
      // 使用者提供的軍火庫 API 為 options object；宿主只調星空密度與淡度。
      particleBackground = window.SlowlyParticleNetwork.create({
        canvas: particleBgCanvas,
        pointer: false,
        mobileCount: 30,
        maxCount: 72,
        density: 22000,
        linkDistance: 116,
        friction: 0.982,
        lineColor: "188,205,224",
        lineAlpha: 0.13,
        lineWidth: 0.5,
        maxDpr: 2,
        respectReducedMotion: true
      });
      particleBackground?.start?.();
    } catch (error) {
      console.warn("[Match3] Particle Network 初始化失敗，改用靜態星空：", error);
      particleBackground = null;
    }
  }

  /* ===============================
     Model / State
  =============================== */
  // cell: { c: 0..COLORS-1 | null, sp: null|"sh"|"sv"|"w"|"b" }
  let grid = [];
  let domCells = [];
  let selected = null;
  let busy = false;
  const pendingSpecialReveal = new Set();

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
  let pendingAutoPause = false;
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
    timeLabelEl.textContent = activeGameMode === "timed" ? "倒數" : "時間";
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
    forceBoardBlast = false,
    extraSweepEffects = [],
    extraBurstEffects = []
  }) {
    clearPresentationEffects();

    const specials = specialCellsIn(expandedSet);
    if (specials.some(special => special.sp === "b")) {
      forceBoardBlast = true;
    }

    // 第一拍：Sweep Line 只負責方向掃線；Match3 決定哪些範圍要掃。
    // 組合技可以額外提供自己的掃線範圍，不改軍火庫零件本體。
    const sweepEffects = [
      ...matchSweepEffects(matches),
      ...specialSweepEffects(specials, forceBoardBlast),
      ...extraSweepEffects
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
      ...specialBurstEffects(specials, forceBoardBlast),
      ...extraBurstEffects
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
     三種模式各自保存 TOP 3；排行榜使用獨立新版 namespace。
  =============================== */
  const scoreStore = FictionStorage.create({
    namespace: "SBS_match3_rank_v2"
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
    const requestedMode = normalizedGameMode(mode);
    activeRankingMode = requestedMode;
    syncRankingTabs();

    const top3 = await getTop3(requestedMode);

    // 切換模式期間，較早發出的讀取若晚回來，不准覆蓋目前模式。
    if (requestedMode !== activeRankingMode) return;

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

    const pauseLabel = paused ? "繼續" : "暫停";
    btnPause.setAttribute("aria-label", pauseLabel);
    btnPause.title = pauseLabel;
    renderControlIcons();

    for (const el of domCells) {
      el.classList.toggle("locked", !interactive);
    }
  }

  function setBusy(next) {
    busy = Boolean(next);
    syncInteractionState();

    if (!busy) {
      checkModeEndCondition();

      if (pendingAutoPause && gameState === STATE.RUNNING) {
        pendingAutoPause = false;
        pauseRunningGame();
      }
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
        el.classList.remove(
          "hint",
          "slowly-glow",
          "is-active",
          "glow-t0",
          "glow-t1",
          "glow-t2",
          "glow-t3",
          "glow-t4",
          "glow-t5",
          "glow-bomb"
        );
        el.innerHTML = "";

        if (cell.c === null && cell.sp !== "b") continue;

        // 外部柔光交給軍火庫 Basic Glow；
        // Glow 放在 cell，避免覆蓋 candy 自己的立體 box-shadow。
        el.classList.add("slowly-glow", "is-active");
        if (cell.sp === "b") {
          el.classList.add("glow-bomb");
        } else {
          el.classList.add(`glow-t${cell.c}`);
        }

        const candy = document.createElement("div");
        candy.className = "candy";
        candy.classList.add(`t${cell.c}`);

        if (cell.sp) {
          const markCanvas = document.createElement("canvas");
          markCanvas.className = "special-mark-canvas";
          markCanvas.setAttribute("aria-hidden", "true");

          if (pendingSpecialReveal.has(k(r, c))) {
            markCanvas.classList.add("is-new-special");
          }

          candy.appendChild(markCanvas);
          drawSpecialCandyMark(markCanvas, cell.sp);
        }

        el.appendChild(candy);
      }
    }

    pendingSpecialReveal.clear();

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

      // 第一拍：BOM + 里程碑兩排一起出現。
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
          void bombMilestoneTextEl.offsetWidth;
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

      if (timerWasRunning && gameState === STATE.RUNNING && !pendingAutoPause) {
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

     組合技：
     - 條紋 + 條紋：一整排 + 一整列
     - 條紋 + 包裝：3 排 + 3 列
     - 包裝 + 包裝：5x5
     - 彩球 + 條紋：同色普通糖先變條紋，再一起觸發
     - 彩球 + 包裝：同色普通糖先變包裝，再一起觸發
     - 彩球 + 彩球：全盤清除
  =============================== */
  const isStripedSpecial = sp => sp === "sh" || sp === "sv";

  function addPositionsToSet(targetSet, positions) {
    for (const pos of positions) {
      if (inBounds(pos.r, pos.c)) targetSet.add(k(pos.r, pos.c));
    }
  }

  function comboCenter(a, b) {
    // 交換完成後以玩家第二個落點作為組合技中心；兩顆本身仍都會被清掉。
    return { r: b.r, c: b.c };
  }

  function comboLineEffects(center, rowRadius = 0, columnRadius = 0) {
    const sweepEffects = [];
    const burstEffects = [];

    for (let dr = -rowRadius; dr <= rowRadius; dr += 1) {
      const r = center.r + dr;
      if (!inBounds(r, center.c)) continue;
      const targets = targetElements(rowPositions(r));
      sweepEffects.push({
        targets,
        direction: "horizontal",
        ...SPECIAL_SWEEP_STYLE
      });
      burstEffects.push({
        targets,
        type: "block",
        className: "match3-special-burst",
        ...SPECIAL_BLOCK_STYLE
      });
    }

    for (let dc = -columnRadius; dc <= columnRadius; dc += 1) {
      const c = center.c + dc;
      if (!inBounds(center.r, c)) continue;
      const targets = targetElements(columnPositions(c));
      sweepEffects.push({
        targets,
        direction: "vertical",
        ...SPECIAL_SWEEP_STYLE
      });
      burstEffects.push({
        targets,
        type: "block",
        className: "match3-special-burst",
        ...SPECIAL_BLOCK_STYLE
      });
    }

    return { sweepEffects, burstEffects };
  }

  async function finishSpecialClear({
    toClear,
    scoreMultiplier = 12,
    targetColor = null,
    forceBoardBlast = false,
    extraSweepEffects = [],
    extraBurstEffects = [],
    sound = "special"
  }) {
    const expanded = await expandByTriggeredSpecials(toClear);
    const clearPresentation = await playClearPresentation({
      expandedSet: expanded,
      targetColor,
      forceBoardBlast,
      extraSweepEffects,
      extraBurstEffects
    });
    const cleared = applyClear(expanded, new Set());
    score += cleared * scoreMultiplier * Math.max(1, combo);

    if (sound === "bomb") sfxBomb();
    else sfxSpecial();

    render();
    clearPresentation();
    await sleep(110);

    dropDownAndFill();
    render();
    await sleep(140);

    await checkBOM();
  }

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

  async function triggerStripedStriped(a, b) {
    const center = comboCenter(a, b);
    const toClear = new Set([k(a.r, a.c), k(b.r, b.c)]);
    addPositionsToSet(toClear, rowPositions(center.r));
    addPositionsToSet(toClear, columnPositions(center.c));

    // 組合後不要再讓這兩顆各自追加一次原本的單顆效果。
    grid[a.r][a.c].sp = null;
    grid[b.r][b.c].sp = null;

    const effects = comboLineEffects(center, 0, 0);
    await finishSpecialClear({
      toClear,
      scoreMultiplier: 14,
      extraSweepEffects: effects.sweepEffects,
      extraBurstEffects: effects.burstEffects,
      sound: "special"
    });
  }

  async function triggerStripedWrapped(a, b) {
    const center = comboCenter(a, b);
    const toClear = new Set([k(a.r, a.c), k(b.r, b.c)]);

    for (let dr = -1; dr <= 1; dr += 1) {
      const r = center.r + dr;
      if (inBounds(r, center.c)) addPositionsToSet(toClear, rowPositions(r));
    }
    for (let dc = -1; dc <= 1; dc += 1) {
      const c = center.c + dc;
      if (inBounds(center.r, c)) addPositionsToSet(toClear, columnPositions(c));
    }

    grid[a.r][a.c].sp = null;
    grid[b.r][b.c].sp = null;

    const effects = comboLineEffects(center, 1, 1);
    await finishSpecialClear({
      toClear,
      scoreMultiplier: 16,
      extraSweepEffects: effects.sweepEffects,
      extraBurstEffects: effects.burstEffects,
      sound: "bomb"
    });
  }

  async function triggerWrappedWrapped(a, b) {
    const center = comboCenter(a, b);
    const toClear = new Set([k(a.r, a.c), k(b.r, b.c)]);
    const area = areaPositions(center.r, center.c, 2);
    addPositionsToSet(toClear, area);

    grid[a.r][a.c].sp = null;
    grid[b.r][b.c].sp = null;

    await finishSpecialClear({
      toClear,
      scoreMultiplier: 16,
      extraBurstEffects: [{
        targets: targetElements(area),
        type: "radial",
        duration: SPECIAL_BLOCK_MS,
        radialCore: "rgba(255,255,255,1)",
        radialMid: "rgba(255,229,180,.84)",
        radialSoft: "rgba(255,255,255,.54)",
        glow: "rgba(255,255,255,.98)"
      }],
      sound: "bomb"
    });
  }

  async function triggerColorBombSpecial(bombPos, specialPos, specialKind, targetColor) {
    const toClear = new Set([k(bombPos.r, bombPos.c), k(specialPos.r, specialPos.c)]);
    const converted = [];

    // 彩球本身先失去「全盤爆」語意，避免後面的 ChainExpand 把整盤誤清。
    grid[bombPos.r][bombPos.c].sp = null;

    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        const cell = grid[r][c];
        if (!cell || cell.c !== targetColor) continue;

        // 彩球本身沒有顏色語意；資料裡殘留的 c 不參與「同色變身」。
        if (cell.sp === "b") continue;

        const key = k(r, c);

        // 搭配的那顆特殊糖保留自己，並一起作為起爆點。
        if (r === specialPos.r && c === specialPos.c) {
          toClear.add(key);
          continue;
        }

        // 規格：只把同色「普通糖」轉成對應特殊糖；既有特殊糖維持原能力。
        if (!cell.sp) {
          cell.sp = specialKind === "striped"
            ? (SlowlyRandom.int(0, 1) === 0 ? "sh" : "sv")
            : "w";
          converted.push({ r, c });
          pendingSpecialReveal.add(key);
        }

        toClear.add(key);
      }
    }

    // 先讓玩家看到「同色糖全部變身」，再一起爆。
    render();
    if (converted.length > 0) await sleep(300);

    await finishSpecialClear({
      toClear,
      scoreMultiplier: specialKind === "striped" ? 18 : 20,
      targetColor,
      sound: specialKind === "wrapped" ? "bomb" : "special"
    });
  }

  async function triggerSpecialPair(a, b) {
    const first = { ...grid[a.r][a.c] };
    const second = { ...grid[b.r][b.c] };

    if (isStripedSpecial(first.sp) && isStripedSpecial(second.sp)) {
      await triggerStripedStriped(a, b);
      return;
    }

    if (
      (isStripedSpecial(first.sp) && second.sp === "w") ||
      (first.sp === "w" && isStripedSpecial(second.sp))
    ) {
      await triggerStripedWrapped(a, b);
      return;
    }

    if (first.sp === "w" && second.sp === "w") {
      await triggerWrappedWrapped(a, b);
    }
  }

  async function maybeTriggerSpecialOnSwap(a, b) {
    const ca = grid[a.r][a.c];
    const cb = grid[b.r][b.c];

    if (ca.sp === "b" && cb.sp === "b") {
      await triggerClearAll();
      return true;
    }

    if (ca.sp === "b" && isStripedSpecial(cb.sp)) {
      await triggerColorBombSpecial(a, b, "striped", cb.c);
      return true;
    }

    if (cb.sp === "b" && isStripedSpecial(ca.sp)) {
      await triggerColorBombSpecial(b, a, "striped", ca.c);
      return true;
    }

    if (ca.sp === "b" && cb.sp === "w") {
      await triggerColorBombSpecial(a, b, "wrapped", cb.c);
      return true;
    }

    if (cb.sp === "b" && ca.sp === "w") {
      await triggerColorBombSpecial(b, a, "wrapped", ca.c);
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
        pendingSpecialReveal.add(k(special.r, special.c));
      }

      // 基本消除：形成特殊糖時，被保留下來的那一顆仍算進這次配對分數。
      // 例如 4 連就是 4 顆、5 連就是 5 顆，不會因為留下一顆特殊糖而少算。
      const matchedBaseCount = clearedCount + specialsToCreate.length;
      score += matchedBaseCount * 10 * combo;

      // 特殊糖成立獎勵：固定加分，不再乘 Combo。
      // 條紋 +40、包裝 +80、彩球 +120。
      const specialCreationBonus = specialsToCreate.reduce((total, special) => {
        if (special.sp === "sh" || special.sp === "sv") return total + 40;
        if (special.sp === "w") return total + 80;
        if (special.sp === "b") return total + 120;
        return total;
      }, 0);
      score += specialCreationBonus;

      sfxPop(Math.min(6, matchedBaseCount));
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
     無限模式不限次數；計時 / 步數模式每種道具每場一次。
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
    const hasActiveTool = Boolean(activeTool);

    for (const [name, button] of Object.entries(ALL_TOOL_BUTTONS)) {
      const selectable = Object.prototype.hasOwnProperty.call(TARGET_TOOL_BUTTONS, name);
      if (selectable) {
        button.setAttribute("aria-pressed", activeTool === name ? "true" : "false");
      }

      button.classList.toggle("is-muted-by-tool", hasActiveTool && activeTool !== name);
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

      // 道具直接清除只吃基本分：每顆 10 分，不套 Combo 倍率。
      score += cleared * 10;

      sfxSpecial();
      render();
      clearPresentation();
      await checkBOM();
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
    pendingSpecialReveal.clear();
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

  function renderModeDescription(mode = selectedGameMode()) {
    if (!gameModeNoteEl) return;
    const normalizedMode = normalizedGameMode(mode);
    gameModeNoteEl.textContent = GAME_MODE_DESCRIPTION[normalizedMode];
  }

  function syncModePreview() {
    if (gameState !== STATE.IDLE) return;
    activeGameMode = selectedGameMode();
    renderModeDescription(activeGameMode);
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
    pendingAutoPause = false;

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

  function pauseRunningGame() {
    if (gameState !== STATE.RUNNING) return;
    cancelTool();
    setState(STATE.PAUSED);
    pauseTimer();
  }

  function requestAutoPause() {
    if (gameState !== STATE.RUNNING) return;

    if (busy) {
      pendingAutoPause = true;
      pauseTimer();
      return;
    }

    pauseRunningGame();
  }

  function togglePause() {
    if (busy) return;

    if (gameState === STATE.RUNNING) {
      pauseRunningGame();
    } else if (gameState === STATE.PAUSED) {
      pendingAutoPause = false;
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
    pendingAutoPause = false;
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
      const nextView = tab.dataset.viewTarget;
      if (nextView !== "game") requestAutoPause();
      showView(nextView);
    });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) requestAutoPause();
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
      renderModeDescription(activeGameMode);
      return;
    }

    syncModePreview();
  });


  /* ===============================
     Init
  =============================== */
  async function init() {
    initParticleBackground();
    renderToolIcons();
    createDom();
    activeGameMode = selectedGameMode();
    activeRankingMode = activeGameMode;
    renderModeDescription(activeGameMode);

    try {
      await renderTop3(activeRankingMode);
    } catch (error) {
      console.error("[Match3] 排行榜初始化失敗：", error);
      rankListEl.textContent = "—";
    }

    newGame();
  }

  void init();

  window.addEventListener("resize", renderToolIcons);

  window.addEventListener("beforeunload", () => {
    particleBackground?.destroy?.();
    gameTicker.stop();
    gameTimer.stop();
  });
})();
