/* =====================================================================
   card_battle_engine.js
   策略卡牌戰鬥「純邏輯」，不碰 DOM。所有核心積木都是呼叫函式庫，沒有複製：
     - Deck                  牌庫 / 手牌 / 棄牌
     - CardInstanceIdentity  建立有唯一 id 的實體卡
     - CardResourcePool      靈力資源（檢查、扣除）
     - CardTurnOrder         玩家 / 敵人輪流與回合數
     - CardEffectRegistry    卡牌效果登記與執行
     - CardTargetSelection   收集與選取敵方目標
   ===================================================================== */
(function (global) {
  "use strict";

  const { GAME_RULES, CARD_DEFINITIONS, STARTER_DECK_RECIPE } = global.FogInnData;
  const TARGETED_EFFECT_KEYS = new Set(["deal_damage", "stun_enemy"]);

  /* ---------- 建立起始牌組（每張都有唯一 instance id） ---------- */
  function buildStarterDeckInstances() {
    const definitionsByCardId = new Map(CARD_DEFINITIONS.map((definition) => [definition.cardId, definition]));
    const cardInstances = [];
    let instanceCounter = 0;

    Object.entries(STARTER_DECK_RECIPE).forEach(([cardId, copyCount]) => {
      for (let copyIndex = 0; copyIndex < copyCount; copyIndex += 1) {
        instanceCounter += 1;
        cardInstances.push(
          global.CardInstanceIdentity.createCardInstance(
            definitionsByCardId.get(cardId),
            "card_instance_" + instanceCounter
          )
        );
      }
    });
    return cardInstances;
  }

  /* ---------- 效果：每個 effectKey 一個函式，execute 回傳給畫面用的結果 ---------- */
  function damageEnemy(enemy, amount) {
    const healthBefore = enemy.health;
    enemy.health = Math.max(0, enemy.health - amount);
    return { enemyId: enemy.id, amount: healthBefore - enemy.health, defeated: enemy.health === 0 };
  }

  function createEffectRegistry() {
    const registry = global.CardEffectRegistry.createRegistry();

    registry.registerEffect("deal_damage", {
      canRun: (context) => Boolean(context.target) && context.target.health > 0,
      execute: (context) => ({ kind: "damage", hits: [damageEnemy(context.target, context.card.power)] })
    });

    registry.registerEffect("damage_all", {
      execute: (context) => ({
        kind: "damage_all",
        hits: context.battle.enemies.filter((enemy) => enemy.health > 0).map((enemy) => damageEnemy(enemy, context.card.power))
      })
    });

    registry.registerEffect("stun_enemy", {
      canRun: (context) => Boolean(context.target) && context.target.health > 0,
      execute: (context) => {
        context.target.isStunned = true;
        return { kind: "stun", enemyId: context.target.id };
      }
    });

    registry.registerEffect("gain_block", {
      execute: (context) => {
        context.battle.playerBlock += context.card.power;
        return { kind: "block", amount: context.card.power };
      }
    });

    registry.registerEffect("heal_player", {
      execute: (context) => {
        const battle = context.battle;
        const healthBefore = battle.playerHealth;
        battle.playerHealth = Math.min(battle.playerMaxHealth, battle.playerHealth + context.card.power);
        return { kind: "heal", amount: battle.playerHealth - healthBefore };
      }
    });

    registry.registerEffect("gain_spirit", {
      execute: (context) => {
        context.battle.spiritPool.addAmount("spirit", context.card.power);
        return { kind: "spirit", amount: context.card.power };
      }
    });

    return registry;
  }

  /* ---------- 建立一場戰鬥 ---------- */
  function createBattle(encounterDefinition) {
    const battle = {
      playerMaxHealth: GAME_RULES.playerMaxHealth,
      playerHealth: GAME_RULES.playerMaxHealth,
      playerBlock: 0,
      enemies: encounterDefinition.enemies.map((enemyDefinition, enemyIndex) => ({
        id: "enemy_" + enemyIndex,
        name: enemyDefinition.name,
        icon: enemyDefinition.icon,
        health: enemyDefinition.maxHealth,
        maxHealth: enemyDefinition.maxHealth,
        attackPattern: enemyDefinition.attackPattern,
        patternIndex: 0,
        isStunned: false
      })),
      deck: global.Deck.create({ items: buildStarterDeckInstances(), handSize: GAME_RULES.handSize }),
      spiritPool: global.CardResourcePool.createPool({ spirit: GAME_RULES.spiritPerTurn }),
      turnOrder: global.CardTurnOrder.createTurnOrder(["player", "enemy"], { currentPhase: "player" }),
      effectRegistry: createEffectRegistry()
    };
    battle.deck.drawToHand();
    return battle;
  }

  /* ---------- 查詢 ---------- */
  function getHand(battle) {
    return battle.deck.snapshot().hand;
  }

  function getTargetCandidates(battle) {
    return global.CardTargetSelection.collectCandidates(
      [{ owner: "enemy", zone: "field", cards: battle.enemies }],
      (candidate) => candidate.card.health > 0
    );
  }

  function cardRequiresTarget(card) {
    return TARGETED_EFFECT_KEYS.has(card.effectKey);
  }

  function canAffordCard(battle, card) {
    return battle.spiritPool.canAfford({ spirit: card.cost });
  }

  function getEnemyIntent(enemy) {
    return enemy.attackPattern[enemy.patternIndex % enemy.attackPattern.length];
  }

  function getBattleOutcome(battle) {
    if (battle.playerHealth <= 0) return "defeat";
    if (battle.enemies.every((enemy) => enemy.health <= 0)) return "victory";
    return "ongoing";
  }

  /* ---------- 出牌 ---------- */
  function playCard(battle, card, targetEnemyId) {
    if (battle.turnOrder.getSnapshot().currentPhase !== "player") return { ok: false, reason: "not_player_turn" };
    if (!canAffordCard(battle, card)) return { ok: false, reason: "not_enough_spirit" };

    let target = null;
    if (cardRequiresTarget(card)) {
      const chosenCandidate = global.CardTargetSelection.findCandidate(
        getTargetCandidates(battle),
        (candidate) => candidate.card.id === targetEnemyId
      );
      target = chosenCandidate ? chosenCandidate.card : null;
    }

    const effectContext = { battle, card, target };
    const eligibility = battle.effectRegistry.checkEffect(card.effectKey, effectContext);
    if (!eligibility.ok) return { ok: false, reason: eligibility.reason };

    battle.spiritPool.spend({ spirit: card.cost });
    const execution = battle.effectRegistry.executeEffect(card.effectKey, effectContext);
    battle.deck.discardItem(card);
    return { ok: true, effectResult: execution.value, targetEnemyId: target ? target.id : null };
  }

  /* ---------- 回合：玩家結束 → 敵人行動 → 新的玩家回合 ---------- */
  function resolveEnemyPhase(battle) {
    battle.turnOrder.advanceTurn();
    battle.turnOrder.setCurrentPhase("enemy");
    const enemyActions = [];

    battle.enemies.filter((enemy) => enemy.health > 0).forEach((enemy) => {
      if (enemy.isStunned) {
        enemy.isStunned = false;
        enemyActions.push({ enemyId: enemy.id, wasStunned: true, damageDealt: 0, damageBlocked: 0 });
        return;
      }
      const incomingDamage = getEnemyIntent(enemy);
      enemy.patternIndex += 1;
      const blockedDamage = Math.min(battle.playerBlock, incomingDamage);
      battle.playerBlock -= blockedDamage;
      const damageDealt = incomingDamage - blockedDamage;
      battle.playerHealth = Math.max(0, battle.playerHealth - damageDealt);
      enemyActions.push({ enemyId: enemy.id, wasStunned: false, damageDealt, damageBlocked: blockedDamage });
    });
    return enemyActions;
  }

  function startNextPlayerTurn(battle) {
    battle.turnOrder.advanceTurn();
    battle.turnOrder.setCurrentPhase("player");
    battle.playerBlock = 0;
    battle.spiritPool.setAmount("spirit", GAME_RULES.spiritPerTurn);
    battle.deck.discardAll();
    battle.deck.drawToHand();
  }

  global.CardBattleEngine = Object.freeze({
    createBattle, getHand, getTargetCandidates, cardRequiresTarget, canAffordCard,
    getEnemyIntent, getBattleOutcome, playCard, resolveEnemyPhase, startNextPlayerTurn
  });
})(window);
