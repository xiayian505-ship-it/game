/* =====================================================================
   escape_room.js
   推理逃脫：房間切換、可調查熱點、線索簿、密碼鎖、道具與戰鬥關卡串接。
   ===================================================================== */
(function (global) {
  "use strict";

  const { ROOM_DEFINITIONS, CLUE_DEFINITIONS, GAME_RULES } = global.FogInnData;
  const Feedback = global.FogInnFeedback;

  let gameState = null;
  let hooks = null;
  let elements = null;
  let keypadHotspot = null;
  let keypadDigits = "";

  function collectElements() {
    return {
      roomName: document.getElementById("roomName"),
      roomScene: document.getElementById("roomScene"),
      hotspotLayer: document.getElementById("hotspotLayer"),
      roomTabs: document.getElementById("roomTabs"),
      storyText: document.getElementById("storyText"),
      cluePanel: document.getElementById("cluePanel"),
      clueList: document.getElementById("clueList"),
      keypadPanel: document.getElementById("keypadPanel"),
      keypadDisplay: document.getElementById("keypadDisplay"),
      keypadButtons: document.getElementById("keypadButtons")
    };
  }

  function showStory(message) {
    elements.storyText.textContent = message;
    elements.storyText.classList.remove("is-fresh");
    void elements.storyText.offsetWidth;
    elements.storyText.classList.add("is-fresh");
  }

  /* ---------- 房間與熱點 ---------- */
  function renderRoomTabs() {
    elements.roomTabs.innerHTML = "";
    Object.entries(ROOM_DEFINITIONS).forEach(([roomId, room]) => {
      const isLocked = room.requiredItemId && !gameState.collectedItemIds.has(room.requiredItemId);
      const tabButton = document.createElement("button");
      tabButton.type = "button";
      tabButton.className = "room-tab" + (roomId === gameState.currentRoomId ? " is-current" : "");
      tabButton.textContent = (isLocked ? "🔒 " : "") + room.name;
      tabButton.addEventListener("click", (clickEvent) => enterRoom(roomId, clickEvent));
      elements.roomTabs.appendChild(tabButton);
    });
  }

  function renderHotspots() {
    const room = ROOM_DEFINITIONS[gameState.currentRoomId];
    elements.hotspotLayer.innerHTML = "";

    room.hotspots.forEach((hotspot) => {
      const hotspotButton = document.createElement("button");
      hotspotButton.type = "button";
      hotspotButton.className = "hotspot";
      if (gameState.completedHotspotIds.has(hotspot.hotspotId)) hotspotButton.classList.add("is-done");
      hotspotButton.style.left = hotspot.leftPercent + "%";
      hotspotButton.style.top = hotspot.topPercent + "%";
      hotspotButton.innerHTML = '<span class="hotspot-icon">' + hotspot.icon + '</span><span class="hotspot-label">' + hotspot.label + "</span>";
      hotspotButton.addEventListener("click", () => handleHotspotClick(hotspot));
      elements.hotspotLayer.appendChild(hotspotButton);
    });
  }

  function renderRoom() {
    const room = ROOM_DEFINITIONS[gameState.currentRoomId];
    elements.roomName.textContent = room.name;
    elements.roomScene.className = "room-scene room--" + gameState.currentRoomId;
    renderRoomTabs();
    renderHotspots();
  }

  function enterRoom(roomId, originEvent) {
    const room = ROOM_DEFINITIONS[roomId];
    if (room.requiredItemId && !gameState.collectedItemIds.has(room.requiredItemId)) {
      Feedback.showToast("門鎖住了，需要找到鑰匙。");
      return;
    }
    if (roomId === gameState.currentRoomId) return;
    Feedback.playScreenTransition(() => {
      gameState.currentRoomId = roomId;
      renderRoom();
      showStory("你走進了" + room.name + "。霧氣在腳邊打轉。");
    }, originEvent);
  }

  /* ---------- 熱點行為 ---------- */
  function collectClue(clueId, hotspotId) {
    if (!gameState.collectedClueIds.has(clueId)) {
      gameState.collectedClueIds.add(clueId);
      Feedback.playClueFoundEffect();
    }
    gameState.completedHotspotIds.add(hotspotId);
    showStory("【線索】" + CLUE_DEFINITIONS[clueId].text);
    hooks.onProgressChanged();
    renderHotspots();
  }

  function handleHotspotClick(hotspot) {
    Feedback.playSound("click");
    const isDone = gameState.completedHotspotIds.has(hotspot.hotspotId);

    if (hotspot.actionType === "hint") {
      showStory(hotspot.hintText);
    } else if (hotspot.actionType === "deduction") {
      if (gameState.collectedClueIds.size < GAME_RULES.requiredClueCount) {
        showStory("大門紋風不動。線索還不夠（" + gameState.collectedClueIds.size + " / " + GAME_RULES.requiredClueCount + "）。");
      } else {
        hooks.onOpenDeduction();
      }
    } else if (isDone) {
      showStory("這裡已經調查過了。");
    } else if (hotspot.actionType === "clue") {
      collectClue(hotspot.clueId, hotspot.hotspotId);
    } else if (hotspot.actionType === "battle") {
      hooks.onStartBattle(hotspot, () => handleBattleVictory(hotspot));
    } else if (hotspot.actionType === "keypad") {
      openKeypad(hotspot);
    }
  }

  function handleBattleVictory(hotspot) {
    gameState.completedHotspotIds.add(hotspot.hotspotId);
    if (hotspot.rewardItemId) gameState.collectedItemIds.add(hotspot.rewardItemId);
    if (hotspot.rewardClueId) collectClue(hotspot.rewardClueId, hotspot.hotspotId);
    renderRoom();
    showStory(hotspot.rewardText);
    hooks.onProgressChanged();
  }

  /* ---------- 密碼鎖 ---------- */
  function openKeypad(hotspot) {
    if (!gameState.collectedClueIds.has(hotspot.needClueId)) {
      showStory(hotspot.lockedText);
      return;
    }
    keypadHotspot = hotspot;
    keypadDigits = "";
    updateKeypadDisplay();
    elements.keypadPanel.hidden = false;
  }

  function updateKeypadDisplay() {
    elements.keypadDisplay.textContent = (keypadDigits + "----").slice(0, 4).split("").join(" ");
  }

  function pressKeypadDigit(digit) {
    if (keypadDigits.length >= 4) return;
    keypadDigits += digit;
    Feedback.playSound("click");
    updateKeypadDisplay();
    if (keypadDigits.length < 4) return;

    if (keypadDigits === keypadHotspot.unlockCode) {
      elements.keypadPanel.hidden = true;
      collectClue(keypadHotspot.clueId, keypadHotspot.hotspotId);
    } else {
      Feedback.playWrongAnswerEffect();
      Feedback.showToast("喀——密碼錯誤。");
      keypadDigits = "";
      updateKeypadDisplay();
    }
  }

  function buildKeypad() {
    "1234567890".split("").forEach((digit) => {
      const digitButton = document.createElement("button");
      digitButton.type = "button";
      digitButton.textContent = digit;
      digitButton.addEventListener("click", () => pressKeypadDigit(digit));
      elements.keypadButtons.appendChild(digitButton);
    });
    document.getElementById("keypadClearButton").addEventListener("click", () => { keypadDigits = ""; updateKeypadDisplay(); });
    document.getElementById("keypadCloseButton").addEventListener("click", () => { elements.keypadPanel.hidden = true; });
  }

  /* ---------- 線索簿 ---------- */
  function openNotebook() {
    elements.clueList.innerHTML = "";
    if (gameState.collectedClueIds.size === 0) {
      elements.clueList.innerHTML = '<p class="empty-note">還沒有任何線索，去四處調查吧。</p>';
    }
    gameState.collectedClueIds.forEach((clueId) => {
      const clue = CLUE_DEFINITIONS[clueId];
      const clueCard = document.createElement("div");
      clueCard.className = "clue-card slowly-tilt-spotlight";
      clueCard.innerHTML = "<h3>" + clue.title + "</h3><p>" + clue.text + "</p>";
      elements.clueList.appendChild(clueCard);
      global.SlowlyTiltSpotlight.attach(clueCard, { angle: 10, lift: 4 });
    });
    elements.cluePanel.hidden = false;
  }

  function initialize(sharedGameState, sharedHooks) {
    gameState = sharedGameState;
    hooks = sharedHooks;
    if (!elements) {
      elements = collectElements();
      buildKeypad();
      document.getElementById("clueCloseButton").addEventListener("click", () => { elements.cluePanel.hidden = true; });
    }
    elements.keypadPanel.hidden = true;
    elements.cluePanel.hidden = true;
    renderRoom();
    showStory("霧夜，你投宿的客棧一片死寂。掌櫃倒在櫃檯後，大門被濃霧封死。四處調查，找出兇手吧。");
  }

  global.EscapeRoom = Object.freeze({ initialize, openNotebook, renderRoom });
})(window);
