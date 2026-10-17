/* =====================================================================
   card_battle_view.js
   策略卡牌戰鬥的畫面與操作：手牌扇形、敵人列、選目標、結束回合動畫。
   規則運算全部交給 CardBattleEngine；扇形排版交給 SlowlyHandFanLayout；
   特效與音效交給 FogInnFeedback。
   ===================================================================== */
(function (global) {
  "use strict";

  const Engine = global.CardBattleEngine;
  const Feedback = global.FogInnFeedback;

  let activeBattle = null;
  let handFanLayout = null;
  let pendingTargetCard = null;
  let isInputLocked = false;
  let onBattleFinished = null;
  let elements = null;

  const sleep = (milliseconds) => new Promise((resolve) => global.setTimeout(resolve, milliseconds));

  function collectElements() {
    return {
      title: document.getElementById("battleTitle"),
      enemyRow: document.getElementById("enemyRow"),
      hint: document.getElementById("battleHint"),
      health: document.getElementById("playerHealthText"),
      healthBar: document.getElementById("playerHealthBar"),
      block: document.getElementById("playerBlockText"),
      spirit: document.getElementById("spiritText"),
      round: document.getElementById("roundText"),
      handFan: document.getElementById("handFan"),
      endTurnButton: document.getElementById("endTurnButton"),
      stage: document.getElementById("gameRoot")
    };
  }

  /* ---------- 畫面渲染 ---------- */
  function renderEnemies() {
    elements.enemyRow.innerHTML = "";
    const isTargeting = Boolean(pendingTargetCard);

    activeBattle.enemies.forEach((enemy) => {
      const enemyElement = document.createElement("button");
      enemyElement.type = "button";
      enemyElement.className = "enemy-card";
      enemyElement.dataset.enemyId = enemy.id;
      if (enemy.health <= 0) enemyElement.classList.add("is-defeated");
      if (isTargeting && enemy.health > 0) enemyElement.classList.add("is-targetable", "slowly-electric-border", "with-glow", "is-active");

      const intentText = enemy.isStunned ? "💤 暈眩" : "⚔ " + Engine.getEnemyIntent(enemy);
      const healthPercent = Math.round((enemy.health / enemy.maxHealth) * 100);
      enemyElement.innerHTML =
        '<span class="enemy-icon">' + enemy.icon + "</span>" +
        '<span class="enemy-name">' + enemy.name + "</span>" +
        '<span class="stat-bar"><i style="width:' + healthPercent + '%"></i></span>' +
        '<span class="enemy-health">' + enemy.health + " / " + enemy.maxHealth + "</span>" +
        (enemy.health > 0 ? '<span class="enemy-intent">' + intentText + "</span>" : "");
      enemyElement.addEventListener("click", () => handleEnemyClick(enemy.id));
      elements.enemyRow.appendChild(enemyElement);
    });
  }

  function renderPlayerStatus() {
    const turnSnapshot = activeBattle.turnOrder.getSnapshot();
    elements.health.textContent = activeBattle.playerHealth + " / " + activeBattle.playerMaxHealth;
    elements.healthBar.style.width = (activeBattle.playerHealth / activeBattle.playerMaxHealth) * 100 + "%";
    elements.block.textContent = "🛡️ " + activeBattle.playerBlock;
    elements.spirit.textContent = "🔮 " + activeBattle.spiritPool.getAmount("spirit");
    elements.round.textContent = "第 " + turnSnapshot.currentRound + " 回合";
  }

  function renderHand() {
    const handCards = Engine.getHand(activeBattle);
    elements.handFan.innerHTML = "";

    handCards.forEach((card) => {
      const cardElement = document.createElement("button");
      cardElement.type = "button";
      cardElement.className = "battle-card";
      cardElement.setAttribute("data-hand-fan-card", "");
      cardElement.dataset.instanceId = card.id;
      if (!Engine.canAffordCard(activeBattle, card)) cardElement.classList.add("is-unaffordable");
      cardElement.innerHTML =
        '<span class="card-cost">' + card.cost + "</span>" +
        '<span class="card-icon">' + card.icon + "</span>" +
        '<span class="card-name">' + card.name + "</span>" +
        '<span class="card-text">' + card.description + "</span>";
      cardElement.addEventListener("click", () => handleCardClick(card));
      elements.handFan.appendChild(cardElement);
    });

    handFanLayout.refresh();
    const selectedIndex = pendingTargetCard ? handCards.findIndex((card) => card.id === pendingTargetCard.id) : -1;
    handFanLayout.setSelected(selectedIndex >= 0 ? selectedIndex : null);
  }

  function renderAll() {
    renderEnemies();
    renderPlayerStatus();
    renderHand();
  }

  /* ---------- 飄字與特效位置 ---------- */
  function floatText(anchorElement, text, extraClass) {
    const stageBox = elements.stage.getBoundingClientRect();
    const anchorBox = anchorElement.getBoundingClientRect();
    const floating = document.createElement("div");
    floating.className = "floating-number " + (extraClass || "");
    floating.textContent = text;
    floating.style.left = anchorBox.left - stageBox.left + anchorBox.width / 2 + "px";
    floating.style.top = anchorBox.top - stageBox.top + 10 + "px";
    elements.stage.appendChild(floating);
    global.setTimeout(() => floating.remove(), 1100);
  }

  function getEnemyElement(enemyId) {
    return elements.enemyRow.querySelector('[data-enemy-id="' + enemyId + '"]');
  }

  function getOriginPercent(targetElement) {
    const stageBox = elements.stage.getBoundingClientRect();
    const targetBox = targetElement.getBoundingClientRect();
    return {
      x: ((targetBox.left + targetBox.width / 2 - stageBox.left) / stageBox.width) * 100,
      y: ((targetBox.top + targetBox.height / 2 - stageBox.top) / stageBox.height) * 100
    };
  }

  function playFeedbackForEffect(card, effectResult) {
    if (effectResult.kind === "damage" || effectResult.kind === "damage_all") {
      effectResult.hits.forEach((hit) => {
        const enemyElement = getEnemyElement(hit.enemyId);
        const origin = getOriginPercent(enemyElement);
        floatText(enemyElement, "-" + hit.amount, "is-damage");
        if (card.cardId === "thunder_talisman" || effectResult.kind === "damage_all") {
          Feedback.playThunderEffect(origin.x, origin.y);
        } else {
          Feedback.playEnemyHitEffect(origin.x, origin.y);
        }
      });
    } else if (effectResult.kind === "block") {
      Feedback.playWardEffect();
    } else if (effectResult.kind === "heal") {
      Feedback.playHealEffect();
      floatText(elements.health, "+" + effectResult.amount, "is-heal");
    } else if (effectResult.kind === "stun") {
      Feedback.playEnemyHitEffect(50, 30);
      floatText(getEnemyElement(effectResult.enemyId), "暈眩", "is-status");
    } else {
      Feedback.playSound("click");
    }
  }

  /* ---------- 操作：選牌 / 選目標 / 出牌 ---------- */
  function handleCardClick(card) {
    if (isInputLocked) return;
    if (!Engine.canAffordCard(activeBattle, card)) {
      Feedback.showToast("靈力不足！");
      return;
    }
    if (Engine.cardRequiresTarget(card)) {
      const candidates = Engine.getTargetCandidates(activeBattle);
      if (candidates.length > 1) {
        pendingTargetCard = pendingTargetCard && pendingTargetCard.id === card.id ? null : card;
        elements.hint.textContent = pendingTargetCard ? "選擇要攻擊的目標" : "點選手牌出牌";
        renderAll();
        return;
      }
      commitCard(card, candidates[0].card.id);
      return;
    }
    commitCard(card, null);
  }

  function handleEnemyClick(enemyId) {
    if (isInputLocked || !pendingTargetCard) return;
    const chosenCandidate = global.CardTargetSelection.findCandidate(
      Engine.getTargetCandidates(activeBattle),
      (candidate) => candidate.card.id === enemyId
    );
    if (chosenCandidate) commitCard(pendingTargetCard, enemyId);
  }

  function commitCard(card, targetEnemyId) {
    const playResult = Engine.playCard(activeBattle, card, targetEnemyId);
    if (!playResult.ok) return;
    pendingTargetCard = null;
    elements.hint.textContent = "點選手牌出牌";
    renderAll();
    playFeedbackForEffect(card, playResult.effectResult);
    if (Engine.getBattleOutcome(activeBattle) === "victory") finishBattle("victory");
  }

  async function handleEndTurn() {
    if (isInputLocked) return;
    isInputLocked = true;
    pendingTargetCard = null;
    elements.hint.textContent = "敵人行動中……";
    renderAll();

    const enemyActions = Engine.resolveEnemyPhase(activeBattle);
    for (const action of enemyActions) {
      const enemyElement = getEnemyElement(action.enemyId);
      enemyElement.classList.add("is-attacking");
      await sleep(420);
      enemyElement.classList.remove("is-attacking");
      if (action.wasStunned) {
        floatText(enemyElement, "暈眩中", "is-status");
        continue;
      }
      if (action.damageBlocked > 0) floatText(elements.health, "擋 " + action.damageBlocked, "is-heal");
      if (action.damageDealt > 0) {
        floatText(elements.health, "-" + action.damageDealt, "is-damage");
        Feedback.playPlayerHurtEffect();
      }
      await sleep(260);
    }

    if (Engine.getBattleOutcome(activeBattle) === "defeat") {
      renderAll();
      finishBattle("defeat");
      return;
    }
    Engine.startNextPlayerTurn(activeBattle);
    elements.hint.textContent = "點選手牌出牌";
    renderAll();
    isInputLocked = false;
  }

  async function finishBattle(outcome) {
    isInputLocked = true;
    if (outcome === "victory") Feedback.playVictoryEffect();
    await sleep(outcome === "victory" ? 2000 : 700);
    onBattleFinished(outcome);
  }

  /* ---------- 對外：開始一場戰鬥 ---------- */
  function startBattle(encounterDefinition, onFinishedCallback) {
    elements = elements || collectElements();
    onBattleFinished = onFinishedCallback;
    activeBattle = Engine.createBattle(encounterDefinition);
    pendingTargetCard = null;
    isInputLocked = false;

    elements.title.textContent = encounterDefinition.title;
    elements.hint.textContent = "點選手牌出牌";
    handFanLayout = handFanLayout || global.SlowlyHandFanLayout.create(elements.handFan, { maxFanAngle: 26, selectedLift: 30 });
    elements.endTurnButton.onclick = handleEndTurn;
    renderAll();
  }

  global.CardBattleView = Object.freeze({ startBattle });
})(window);
