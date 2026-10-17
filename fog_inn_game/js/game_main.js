/* =====================================================================
   game_main.js
   遊戲入口：初始化函式庫效果、切換畫面、串起「逃脫房間 → 卡牌戰 → 推理 → 結局」。
   ===================================================================== */
(function (global) {
  "use strict";

  const { ENCOUNTER_DEFINITIONS, ENDING_TEXT } = global.FogInnData;
  const { createGameState, loseLantern } = global.FogInnGameState;
  const Feedback = global.FogInnFeedback;

  let gameState = createGameState();
  let activeScreenId = "titleScreen";

  function showScreen(screenId) {
    document.querySelectorAll(".screen").forEach((screenElement) => {
      screenElement.classList.toggle("is-active", screenElement.id === screenId);
    });
    activeScreenId = screenId;
    document.getElementById("gameRoot").dataset.screen = screenId;
  }

  function changeScreen(screenId, originEvent) {
    Feedback.playScreenTransition(() => showScreen(screenId), originEvent);
  }

  function updateHud() {
    document.getElementById("lanternDisplay").textContent = "🏮".repeat(gameState.lanternCount) || "—";
    document.getElementById("clueDisplay").textContent = "🔍 " + gameState.collectedClueIds.size + " / " + global.FogInnData.GAME_RULES.requiredClueCount;
  }

  function showEnding(isVictory) {
    document.getElementById("endTitle").textContent = isVictory ? ENDING_TEXT.victoryTitle : ENDING_TEXT.defeatTitle;
    document.getElementById("endBody").textContent = isVictory ? ENDING_TEXT.victoryBody : ENDING_TEXT.defeatBody;
    changeScreen("endScreen");
    if (isVictory) global.setTimeout(Feedback.playVictoryEffect, 900);
    global.setTimeout(() => Feedback.playTitlePopEffect(document.getElementById("endTitle")), 800);
  }

  /* ---------- 戰鬥關卡 ---------- */
  function handleStartBattle(hotspot, onVictoryCallback) {
    const encounter = ENCOUNTER_DEFINITIONS[hotspot.encounterId];
    const runBattle = () => {
      global.CardBattleView.startBattle(encounter, (outcome) => {
        if (outcome === "victory") {
          showScreen("roomScreen");
          onVictoryCallback();
          return;
        }
        loseLantern(gameState);
        updateHud();
        if (gameState.lanternCount === 0) {
          showEnding(false);
        } else {
          Feedback.showToast("你被擊退了，一盞燈熄滅。重新整頓再戰！");
          runBattle();
        }
      });
    };
    Feedback.playScreenTransition(() => { showScreen("battleScreen"); runBattle(); });
  }

  /* ---------- 推理關卡 ---------- */
  function handleOpenDeduction() {
    global.DeductionBoard.start({
      onSolved: () => showEnding(true),
      onWrongAccusation: () => {
        loseLantern(gameState);
        updateHud();
        if (gameState.lanternCount === 0) global.setTimeout(() => showEnding(false), 1200);
      }
    });
    changeScreen("deductionScreen");
  }

  function startNewGame(originEvent) {
    gameState = createGameState();
    global.EscapeRoom.initialize(gameState, {
      onStartBattle: handleStartBattle,
      onOpenDeduction: handleOpenDeduction,
      onProgressChanged: updateHud
    });
    updateHud();
    changeScreen("roomScreen", originEvent);
  }

  function startAtmosphereEffects() {
    global.SlowlyCanvasFog.create({ canvas: document.getElementById("fogCanvas"), count: 20, color: "#9fb7c9", opacity: 0.55 }).start();
    global.SlowlyCanvasRain.create({ canvas: document.getElementById("rainCanvas"), count: 160, wind: 0.2, color: "#b9d6ee" }).start();
  }

  function bindButtons() {
    document.getElementById("startGameButton").addEventListener("click", startNewGame);
    document.getElementById("restartButton").addEventListener("click", startNewGame);
    document.getElementById("openNotebookButton").addEventListener("click", global.EscapeRoom.openNotebook);
    document.getElementById("backToRoomButton").addEventListener("click", (clickEvent) => changeScreen("roomScreen", clickEvent));
    document.getElementById("soundToggleButton").addEventListener("click", (clickEvent) => {
      clickEvent.currentTarget.textContent = Feedback.toggleSound() ? "🔊" : "🔇";
    });
  }

  function boot() {
    Feedback.initialize({ effectStageElement: document.getElementById("gameRoot"), toastElement: document.getElementById("toast") });
    Feedback.attachClickBurst();
    startAtmosphereEffects();
    bindButtons();
    showScreen("titleScreen");
    Feedback.playTitlePopEffect(document.getElementById("gameTitle"));
  }

  global.addEventListener("DOMContentLoaded", boot);
})(window);
