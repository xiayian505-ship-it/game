"use strict";

(() => {
  const ROWS = 5;
  const COLS = 4;

  /*
    經典華容道關卡。
    r / c = 左上角格座標
    h / w = 佔用格數

    選單顯示的「經典最佳」採連步算法；
    本頁 moveCount 仍維持原本「每移一格 +1」的逐格計數，不改規則。
  */
  const LEVELS = Object.freeze({
    qianhuhouyong: Object.freeze({
      label:"前呼後擁",
      pieces:Object.freeze([
        { id:"zhang", name:"張飛", r:1, c:0, h:1, w:2, type:"general" },
        { id:"cao",   name:"曹操", r:0, c:2, h:2, w:2, type:"cao" },
        { id:"zhao",  name:"趙雲", r:2, c:0, h:1, w:2, type:"general" },
        { id:"ma",    name:"馬超", r:2, c:2, h:1, w:2, type:"general" },
        { id:"guan",  name:"關羽", r:3, c:0, h:1, w:2, type:"guan" },
        { id:"huang", name:"黃忠", r:3, c:2, h:1, w:2, type:"general" },
        { id:"s1", name:"兵", r:0, c:0, h:1, w:1, type:"soldier" },
        { id:"s2", name:"兵", r:0, c:1, h:1, w:1, type:"soldier" },
        { id:"s3", name:"兵", r:4, c:2, h:1, w:1, type:"soldier" },
        { id:"s4", name:"兵", r:4, c:3, h:1, w:1, type:"soldier" }
      ])
    }),

    biyihengkong: Object.freeze({
      label:"比翼橫空",
      pieces:Object.freeze([
        { id:"zhang", name:"張飛", r:3, c:3, h:2, w:1, type:"general" },
        { id:"cao",   name:"曹操", r:0, c:2, h:2, w:2, type:"cao" },
        { id:"zhao",  name:"趙雲", r:0, c:0, h:1, w:2, type:"general" },
        { id:"ma",    name:"馬超", r:1, c:0, h:1, w:2, type:"general" },
        { id:"guan",  name:"關羽", r:2, c:0, h:1, w:2, type:"guan" },
        { id:"huang", name:"黃忠", r:2, c:2, h:1, w:2, type:"general" },
        { id:"s1", name:"兵", r:3, c:0, h:1, w:1, type:"soldier" },
        { id:"s2", name:"兵", r:3, c:2, h:1, w:1, type:"soldier" },
        { id:"s3", name:"兵", r:4, c:0, h:1, w:1, type:"soldier" },
        { id:"s4", name:"兵", r:4, c:2, h:1, w:1, type:"soldier" }
      ])
    }),

    jiezuxiandeng: Object.freeze({
      label:"捷足先登",
      pieces:Object.freeze([
        { id:"zhang", name:"張飛", r:3, c:0, h:2, w:1, type:"general" },
        { id:"cao",   name:"曹操", r:0, c:1, h:2, w:2, type:"cao" },
        { id:"zhao",  name:"趙雲", r:3, c:1, h:2, w:1, type:"general" },
        { id:"ma",    name:"馬超", r:3, c:2, h:2, w:1, type:"general" },
        { id:"guan",  name:"關羽", r:2, c:1, h:1, w:2, type:"guan" },
        { id:"huang", name:"黃忠", r:3, c:3, h:2, w:1, type:"general" },
        { id:"s1", name:"兵", r:0, c:0, h:1, w:1, type:"soldier" },
        { id:"s2", name:"兵", r:0, c:3, h:1, w:1, type:"soldier" },
        { id:"s3", name:"兵", r:1, c:0, h:1, w:1, type:"soldier" },
        { id:"s4", name:"兵", r:1, c:3, h:1, w:1, type:"soldier" }
      ])
    }),

    yongchuangwuguan: Object.freeze({
      label:"勇闖五關",
      pieces:Object.freeze([
        { id:"zhang", name:"張飛", r:2, c:0, h:1, w:2, type:"general" },
        { id:"cao",   name:"曹操", r:0, c:1, h:2, w:2, type:"cao" },
        { id:"zhao",  name:"趙雲", r:2, c:2, h:1, w:2, type:"general" },
        { id:"ma",    name:"馬超", r:3, c:0, h:1, w:2, type:"general" },
        { id:"guan",  name:"關羽", r:3, c:2, h:1, w:2, type:"guan" },
        { id:"huang", name:"黃忠", r:4, c:1, h:1, w:2, type:"general" },
        { id:"s1", name:"兵", r:0, c:0, h:1, w:1, type:"soldier" },
        { id:"s2", name:"兵", r:0, c:3, h:1, w:1, type:"soldier" },
        { id:"s3", name:"兵", r:1, c:0, h:1, w:1, type:"soldier" },
        { id:"s4", name:"兵", r:1, c:3, h:1, w:1, type:"soldier" }
      ])
    }),

    yilushunfeng: Object.freeze({
      label:"一路順風",
      pieces:Object.freeze([
        { id:"zhang", name:"張飛", r:0, c:0, h:2, w:1, type:"general" },
        { id:"cao",   name:"曹操", r:0, c:1, h:2, w:2, type:"cao" },
        { id:"zhao",  name:"趙雲", r:2, c:0, h:2, w:1, type:"general" },
        { id:"ma",    name:"馬超", r:2, c:3, h:2, w:1, type:"general" },
        { id:"guan",  name:"關羽", r:2, c:1, h:1, w:2, type:"guan" },
        { id:"huang", name:"黃忠", r:3, c:2, h:2, w:1, type:"general" },
        { id:"s1", name:"兵", r:0, c:3, h:1, w:1, type:"soldier" },
        { id:"s2", name:"兵", r:1, c:3, h:1, w:1, type:"soldier" },
        { id:"s3", name:"兵", r:3, c:1, h:1, w:1, type:"soldier" },
        { id:"s4", name:"兵", r:4, c:1, h:1, w:1, type:"soldier" }
      ])
    }),

    hengdao: Object.freeze({
      label:"橫刀立馬",
      pieces:Object.freeze([
        { id:"zhang", name:"張飛", r:0, c:0, h:2, w:1, type:"general" },
        { id:"cao",   name:"曹操", r:0, c:1, h:2, w:2, type:"cao" },
        { id:"zhao",  name:"趙雲", r:0, c:3, h:2, w:1, type:"general" },
        { id:"ma",    name:"馬超", r:2, c:0, h:2, w:1, type:"general" },
        { id:"guan",  name:"關羽", r:2, c:1, h:1, w:2, type:"guan" },
        { id:"huang", name:"黃忠", r:2, c:3, h:2, w:1, type:"general" },
        { id:"s1", name:"兵", r:3, c:1, h:1, w:1, type:"soldier" },
        { id:"s2", name:"兵", r:3, c:2, h:1, w:1, type:"soldier" },
        { id:"s3", name:"兵", r:4, c:0, h:1, w:1, type:"soldier" },
        { id:"s4", name:"兵", r:4, c:3, h:1, w:1, type:"soldier" }
      ])
    })
  });

  function normalizedLevel(value){
    return Object.prototype.hasOwnProperty.call(LEVELS, value)
      ? value
      : "qianhuhouyong";
  }

  const DIRS = Object.freeze({
    up:    { dr:-1, dc:0 },
    down:  { dr:1, dc:0 },
    left:  { dr:0, dc:-1 },
    right: { dr:0, dc:1 }
  });

  const boardEl = document.getElementById("board");
  const selectedNameEl = document.getElementById("selectedName");
  const moveCountEl = document.getElementById("moveCount");
  const gameModeEl = document.getElementById("gameMode");
  const gameSubEl = document.getElementById("gameSub");
  const undoBtn = document.getElementById("undoBtn");
  const resetBtn = document.getElementById("resetBtn");
  const resetConfirmEl = document.getElementById("resetConfirm");
  const resetConfirmTextEl = document.getElementById("resetConfirmText");
  const cancelResetBtn = document.getElementById("cancelResetBtn");
  const confirmResetBtn = document.getElementById("confirmResetBtn");
  const dirButtons = [...document.querySelectorAll("[data-dir]")];
  const viewTabs = [...document.querySelectorAll("[data-view-target]")];
  const viewPanels = [...document.querySelectorAll("[data-view-panel]")];
  const rankModeTabs = [...document.querySelectorAll("[data-rank-level]")];

  const toast = window.SlowlyToast?.create
    ? window.SlowlyToast.create("#toast", { duration:1500 })
    : { show(message){ console.log("[Toast]", message); } };

  let activeLevel = normalizedLevel(gameModeEl?.value);
  let activeRankLevel = activeLevel;
  let pieces = [];
  let selectedId = null;
  let history = [];
  let moves = 0;
  let won = false;
  let resetConfirmOpen = false;
  let activeView = "game";

  function showView(viewName){
    activeView = viewName;

    for(const tab of viewTabs){
      tab.setAttribute(
        "aria-selected",
        tab.dataset.viewTarget === viewName ? "true" : "false"
      );
    }

    for(const panel of viewPanels){
      panel.hidden = panel.dataset.viewPanel !== viewName;
    }
  }

  function openResetConfirm(){
    resetConfirmOpen = true;
    resetConfirmTextEl.textContent =
      `目前 ${moves} 步的進度會全部清空。`;
    resetConfirmEl.hidden = false;
    cancelResetBtn.focus();
  }

  function closeResetConfirm(){
    resetConfirmOpen = false;
    resetConfirmEl.hidden = true;
    resetBtn.focus();
  }

  function updateLevelLabels(){
    if(gameSubEl){
      gameSubEl.textContent = `華容道・${LEVELS[activeLevel].label}`;
    }
  }

  function setRankLevel(levelName){
    activeRankLevel = normalizedLevel(levelName);

    for(const tab of rankModeTabs){
      tab.setAttribute(
        "aria-selected",
        tab.dataset.rankLevel === activeRankLevel ? "true" : "false"
      );
    }
  }

  function reset(){
    pieces = LEVELS[activeLevel].pieces.map(piece => ({ ...piece }));
    selectedId = null;
    history = [];
    moves = 0;
    won = false;
    updateLevelLabels();
    render();
  }

  function snapshot(){
    return {
      pieces: pieces.map(piece => ({ ...piece })),
      selectedId,
      moves,
      won
    };
  }

  function restore(data){
    pieces = data.pieces.map(piece => ({ ...piece }));
    selectedId = data.selectedId;
    moves = data.moves;
    won = data.won;
  }

  function occupancy(ignoreId = null){
    const grid = Array.from(
      { length: ROWS },
      () => Array(COLS).fill(null)
    );

    for(const piece of pieces){
      if(piece.id === ignoreId) continue;

      for(let rr = piece.r; rr < piece.r + piece.h; rr += 1){
        for(let cc = piece.c; cc < piece.c + piece.w; cc += 1){
          grid[rr][cc] = piece.id;
        }
      }
    }

    return grid;
  }

  function canMove(piece, dir){
    const nr = piece.r + dir.dr;
    const nc = piece.c + dir.dc;

    if(
      nr < 0 ||
      nc < 0 ||
      nr + piece.h > ROWS ||
      nc + piece.w > COLS
    ){
      return false;
    }

    const grid = occupancy(piece.id);

    for(let rr = nr; rr < nr + piece.h; rr += 1){
      for(let cc = nc; cc < nc + piece.w; cc += 1){
        if(grid[rr][cc] !== null){
          return false;
        }
      }
    }

    return true;
  }

  function moveSelected(dirName){
    if(activeView !== "game" || resetConfirmOpen || won || !selectedId) return;

    const piece = pieces.find(item => item.id === selectedId);
    const dir = DIRS[dirName];

    if(!piece || !dir) return;

    if(!canMove(piece, dir)){
      return;
    }

    history.push(snapshot());

    if(history.length > 300){
      history.shift();
    }

    piece.r += dir.dr;
    piece.c += dir.dc;
    moves += 1;

    checkWin();
    render();
  }

  function checkWin(){
    const cao = pieces.find(piece => piece.id === "cao");

    if(cao.r === 3 && cao.c === 1){
      won = true;

      window.setTimeout(() => {
        toast.show(`曹操到出口了！共 ${moves} 步 🎉`, {
          duration:2600
        });
      }, 100);
    }
  }

  function undo(){
    if(activeView !== "game" || !history.length) return;

    const previous = history.pop();
    restore(previous);
    render();
  }

  function selectPiece(id){
    if(activeView !== "game") return;
    selectedId = selectedId === id ? null : id;
    render();
  }

  function render(){
    boardEl.innerHTML = "";

    const styles = getComputedStyle(document.documentElement);
    const cell = parseFloat(styles.getPropertyValue("--cell")) || 70;
    const gap = parseFloat(styles.getPropertyValue("--gap")) || 4;
    const pad = 8;

    for(const piece of pieces){
      const button = document.createElement("button");
      button.type = "button";
      button.className = [
        "piece",
        piece.type,
        piece.id === selectedId ? "is-selected" : ""
      ].filter(Boolean).join(" ");

      button.textContent = piece.name;
      button.setAttribute("aria-label", piece.name);

      button.style.left = `${pad + piece.c * (cell + gap)}px`;
      button.style.top = `${pad + piece.r * (cell + gap)}px`;
      button.style.width = `${piece.w * cell + (piece.w - 1) * gap}px`;
      button.style.height = `${piece.h * cell + (piece.h - 1) * gap}px`;

      button.addEventListener("click", () => {
        selectPiece(piece.id);
      });

      boardEl.appendChild(button);
    }

    const selected = pieces.find(piece => piece.id === selectedId);

    selectedNameEl.textContent = selected
      ? selected.name
      : "尚未選擇";

    moveCountEl.textContent = moves;
    undoBtn.disabled = history.length === 0;

    for(const button of dirButtons){
      const dir = DIRS[button.dataset.dir];
      button.disabled =
        won ||
        !selected ||
        !canMove(selected, dir);
    }
  }

  viewTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      showView(tab.dataset.viewTarget);
    });
  });

  gameModeEl?.addEventListener("change", () => {
    activeLevel = normalizedLevel(gameModeEl.value);
    setRankLevel(activeLevel);
    reset();
    toast.show(`已切換：${LEVELS[activeLevel].label}`);
  });

  rankModeTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      setRankLevel(tab.dataset.rankLevel);
    });
  });

  dirButtons.forEach(button => {
    button.addEventListener("click", () => {
      moveSelected(button.dataset.dir);
    });
  });

  undoBtn.addEventListener("click", undo);

  resetBtn.addEventListener("click", () => {
    if(activeView !== "game") return;
    if(moves > 0){
      openResetConfirm();
      return;
    }

    reset();
    toast.show("已重新開始！");
  });

  cancelResetBtn.addEventListener("click", () => {
    closeResetConfirm();
  });

  confirmResetBtn.addEventListener("click", () => {
    closeResetConfirm();
    reset();
    toast.show("已重新開始！");
  });

  document.addEventListener("keydown", event => {
    if(activeView !== "game" && !resetConfirmOpen) return;
    if(resetConfirmOpen){
      if(event.key === "Escape"){
        event.preventDefault();
        closeResetConfirm();
      }
      return;
    }

    if(event.key === "z" || event.key === "Z"){
      event.preventDefault();
      undo();
      return;
    }

    const map = {
      ArrowUp:"up",
      ArrowDown:"down",
      ArrowLeft:"left",
      ArrowRight:"right",
      w:"up", W:"up",
      s:"down", S:"down",
      a:"left", A:"left",
      d:"right", D:"right"
    };

    const dirName = map[event.key];
    if(!dirName) return;

    event.preventDefault();
    moveSelected(dirName);
  });

  window.addEventListener("resize", render);

  showView("game");
  setRankLevel(activeRankLevel);
  reset();
})();
