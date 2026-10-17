/* =====================================================================
   game_state.js
   整場遊戲的進度狀態：燈籠（生命）、線索、道具、已完成的熱點、目前房間。
   只存資料與簡單查詢，不碰畫面。
   ===================================================================== */
(function (global) {
  "use strict";

  const { GAME_RULES } = global.FogInnData;

  function createGameState() {
    return {
      lanternCount: GAME_RULES.startingLanternCount,
      collectedClueIds: new Set(),
      collectedItemIds: new Set(),
      completedHotspotIds: new Set(),
      currentRoomId: "lobby"
    };
  }

  function hasAllRequiredClues(gameState) {
    return gameState.collectedClueIds.size >= GAME_RULES.requiredClueCount;
  }

  function loseLantern(gameState) {
    gameState.lanternCount = Math.max(0, gameState.lanternCount - 1);
    return gameState.lanternCount;
  }

  global.FogInnGameState = Object.freeze({ createGameState, hasAllRequiredClues, loseLantern });
})(window);
