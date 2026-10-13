/** lin_card｜戰鬥規則：雙資源、七類卡牌、共鳴與犧牲。
 * 抽牌／手牌／棄牌仍直接引用慢慢軍火庫的 Deck HTTPS 模組。
 */
(() => {
  "use strict";
  const D = () => window.LinCardData;
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const cardList = who => who.deck.snapshot();
  function takeHand(who, index) {
    const snap = who.deck.snapshot();
    const [card] = snap.hand.splice(index, 1);
    who.deck.restore(snap);
    return card;
  }
  function appendHand(who, card) { const snap = who.deck.snapshot(); snap.hand.push(card); who.deck.restore(snap); }
  function discard(who, card) { const snap = who.deck.snapshot(); snap.discardPile.push(card); who.deck.restore(snap); }
  function resetHand(deck, hand) { const snap = deck.snapshot(); snap.hand = hand; deck.restore(snap); }

  class Battle {
    constructor(playerCards, bossCards, stage, playerStartingEnergy = 5) {
      if (!window.Deck?.create) throw new Error("慢慢軍火庫 Deck 未載入；請連線後重新整理。");
      this.stage = stage;
      this.round = 1;
      this.outcome = null;
      this.turn = "player";
      this.log = [];
      this.lastBossAction = null; // 相容舊 UI；最新一次的 Boss 實際出牌。
      this.lastBossActions = []; // 供 UI 依序播放，本身不參與戰鬥判定。
      this.freeDiscardUsed = false;
      this.openingExchangeAvailable = true; // 回合開始免費換牌：出牌或整理後就失效。
      const hp = D().HEALTH[stage - 1];
      this.player = this.createSide("player", hp, playerCards, playerStartingEnergy);
      this.boss = this.createSide("boss", hp / 2, bossCards.map(card => card.source === "boss-base" && D().LEVEL_TYPES.includes(card.type)
        ? { ...card, level: Math.min(3, stage - 1) } : { ...card }), 5);
      this.player.deck.drawToHand(4);
      this.boss.deck.drawToHand(4);
      this.note(`第 ${stage} 關：玩家行動點 ${this.player.energy}、魔法點 5；Boss 行動點 5、魔法點 5。`);
      this.checkExhaustion();
    }
    createSide(key, hp, cards, startingEnergy = 5) {
      return { key, hp, maxHP: hp, shield: 0, guard: 0, energy: startingEnergy, baseEnergy: startingEnergy, mana: 5,
        buff: 0, pierceNext: false, counter: false,
        deck: window.Deck.create({ items: cards.map(x => ({ ...x })), handSize: 4, recycleDiscard: false }) };
    }
    note(message) { this.log.unshift(message); if (this.log.length > 35) this.log.length = 35; }
    actor(side) { return side === "boss" ? this.boss : this.player; }
    enemy(side) { return side === "boss" ? this.player : this.boss; }
    state() {
      const pack = who => ({ hp: who.hp, maxHP: who.maxHP, shield: who.shield, guard: who.guard,
        energy: who.energy, baseEnergy: who.baseEnergy, mana: who.mana, buff: who.buff, pierceNext: who.pierceNext, ...cardList(who) });
      return { stage: this.stage, round: this.round, turn: this.turn, outcome: this.outcome,
        player: pack(this.player), boss: pack(this.boss), log: [...this.log],
        freeDiscardUsed: this.freeDiscardUsed, openingExchangeAvailable: this.openingExchangeAvailable };
    }
    valid(who, index) {
      const card = cardList(who).hand[index];
      if (!card) return false;
      const fee = D().cost(card);
      if (D().resource(card) === "mana" ? who.mana < fee : who.energy < fee) return false;
      const foe = this.enemy(who.key);
      if (card.type === "action" && D().effectOf(card) === "shatter") return foe.shield > 0;
      if (card.type === "special") {
        return D().effectOf(card) !== "sacrifice" || who.energy + who.mana > 0;
      }
      if (card.type !== "magic") return true;
      const own = cardList(who), theirs = cardList(foe);
      const kind = D().effectOf(card);
      if (["self_one", "self_all"].includes(kind)) return own.hand.length >= 2;
      if (kind === "swap_one") return own.hand.length >= 2 && theirs.hand.length >= 1;
      if (kind === "swap_all") return own.hand.length >= 2 || theirs.hand.length >= 1;
      if (kind === "foe_one") return theirs.hand.length >= 1;
      if (kind === "revive") return own.discardPile.length + theirs.discardPile.length >= 1;
      if (kind === "resonance") return own.hand.length >= 1; // 本場可重複施放；全牌已 Lv5 則不再強化。
      if (kind === "energy_seal") return foe.energy > 0;
      if (kind === "energy_restore") return who.energy < who.baseEnergy;
      return false;
    }
    targets(index) {
      const card = cardList(this.player).hand[index];
      if (!card || card.type !== "magic") return null;
      const kind = D().effectOf(card);
      if (kind === "self_one" || kind === "swap_one") {
        return { type: "hand", cards: cardList(this.player).hand.filter((_, i) => i !== index),
          label: kind === "swap_one" ? "選擇自己要交換的手牌（對方隨機）" : "選擇自己要棄掉的手牌" };
      }
      if (kind === "revive") {
        const mine = cardList(this.player).discardPile;
        const theirs = cardList(this.boss).discardPile;
        return { type: "discard", cards: [...mine, ...theirs],
          piles: [{ owner: "player", label: "自己的棄牌堆", cards: mine },
                  { owner: "boss", label: "Boss 的棄牌堆", cards: theirs }],
          label: "選擇從哪一方棄牌堆取回卡牌" };
      }
      return null;
    }
    damage(from, target, amount, branch = "標準", ignoreShield = false) {
      let remain = amount + (branch === "破盾" && target.shield ? 2 : 0);
      const blocked = Math.min(target.guard, remain);
      target.guard -= blocked; remain -= blocked;
      let shielded = 0;
      if (!ignoreShield) { shielded = Math.min(target.shield, remain); target.shield -= shielded; remain -= shielded; }
      target.hp = Math.max(0, target.hp - remain);
      if (blocked > 0 && target.counter) {
        from.hp = Math.max(0, from.hp - 1);
        this.note(`${target.key === "player" ? "玩家" : "Boss"} 反震造成 1 點傷害。`);
      }
      if (branch === "汲取" && remain > 0) from.hp = Math.min(from.maxHP, from.hp + 1);
      return Math.max(0, remain);
    }
    play(side, index, choiceId = null) {
      if (this.outcome || this.turn !== side) return false;
      const who = this.actor(side), foe = this.enemy(side);
      if (!this.valid(who, index)) return false;
      const targetInfo = side === "player" ? this.targets(index) : null;
      if (targetInfo && !targetInfo.cards.some(c => c.id === choiceId)) return false;
      if (side === "player") this.openingExchangeAvailable = false;
      const card = takeHand(who, index);
      const fee = D().cost(card);
      if (D().resource(card) === "mana") who.mana -= fee;
      else who.energy -= fee;
      const action = side === "player" ? "你" : "Boss";
      const number = D().value(D().effectiveLevel(card, who.buff));
      let detail = "";
      switch (card.type) {
        case "attack": {
          const bypass = who.pierceNext;
          who.pierceNext = false;
          const hurt = this.damage(who, foe, number, card.branch, bypass);
          detail = `攻擊 ${number}${bypass ? "（穿透護盾）" : ""}，造成 ${hurt} 點生命傷害`;
          break;
        }
        case "defense": {
          const strength = number + (card.branch === "堅守" ? 2 : 0);
          who.guard += strength;
          if (card.branch === "反震") who.counter = true;
          detail = `獲得 ${strength} 點當回合防禦`;
          break;
        }
        case "shield": {
          const strength = number + (card.branch === "凝霧" ? 2 : 0);
          who.shield += strength;
          if (card.branch === "回春") who.hp = Math.min(who.maxHP, who.hp + 1);
          detail = `累積 ${strength} 點護盾`;
          break;
        }
        case "heal": {
          const heal = number + (card.branch === "滋養" ? 2 : 0);
          who.hp = Math.min(who.maxHP, who.hp + heal);
          if (card.branch === "蓄息") who.energy += 1;
          detail = `恢復 ${heal} 點生命`;
          break;
        }
        case "action": {
          const kind = D().effectOf(card);
          if (kind === "shatter") { const n = foe.shield; foe.shield = 0; detail = `擊碎敵方全部 ${n} 點護盾`; }
          else if (kind === "pierce") { who.pierceNext = true; detail = "下一次自己的攻擊無視護盾"; }
          break;
        }
        case "special": {
          const kind = D().effectOf(card);
          if (kind === "energy") { const n = D().resourceGain(card) + (card.branch === "聚息" ? 1 : 0); who.energy += n; if (card.branch === "癒息") who.hp = Math.min(who.maxHP, who.hp + 1); detail = `免費補充 ${n} 點行動點${card.branch === "癒息" ? "，恢復 1 點生命" : ""}`; }
          else if (kind === "mana") { const n = D().resourceGain(card); who.mana += n; detail = `免費補充 ${n} 點魔法點`; }
          else if (kind === "sacrifice") {
            who.energy = 0; who.mana = 0;
            who.hp = 1; foe.hp = 1;
            detail = "耗盡自身全部行動／魔法點，無視護盾，雙方生命直接變為 1";
          }
          break;
        }
        case "magic": detail = this.cast(card, who, foe, choiceId); break;
      }
      discard(who, card);
      this.note(`${action}使用「${D().cardName(card)}」：${detail}。`);
      this.checkHP();
      if (!this.outcome && side === "player") this.checkExhaustion();
      return true;
    }
    cast(card, who, foe, choiceId) {
      const type = D().effectOf(card);
      const hand = cardList(who).hand;
      if (type === "self_one") {
        const i = hand.findIndex(c => c.id === (choiceId || pick(hand).id));
        if (i < 0) return "無牌可棄";
        const gone = takeHand(who, i); discard(who, gone);
        return `棄掉自己「${D().cardName(gone)}」`;
      }
      if (type === "self_all") { const dropped = who.deck.discardAll(); return `棄掉自己其餘 ${dropped.length} 張手牌`; }
      if (type === "foe_one") {
        const gone = takeHand(foe, Math.floor(Math.random() * cardList(foe).hand.length));
        discard(foe, gone);
        return `對方被迫棄掉「${D().cardName(gone)}」`;
      }
      if (type === "swap_one") {
        const mine = cardList(who).hand;
        const ownIndex = who.key === "player" ? mine.findIndex(c => c.id === choiceId) : Math.floor(Math.random() * mine.length);
        const theirIndex = Math.floor(Math.random() * cardList(foe).hand.length);
        const mineCard = takeHand(who, ownIndex), theirCard = takeHand(foe, theirIndex);
        appendHand(who, theirCard); appendHand(foe, mineCard);
        return `交換「${D().cardName(mineCard)}」與「${D().cardName(theirCard)}」`;
      }
      if (type === "swap_all") {
        const my = cardList(who).hand, their = cardList(foe).hand;
        resetHand(who.deck, their); resetHand(foe.deck, my);
        return `交換雙方手牌（${my.length} ⇄ ${their.length}）`;
      }
      if (type === "revive") {
        // 雙方棄牌堆都能取回。轉入施法者手牌僅限本場，不修改永久收藏。
        const own = who.deck.snapshot();
        const enemy = foe.deck.snapshot();
        const candidates = [...own.discardPile, ...enemy.discardPile];
        const chosenId = who.key === "player" ? choiceId : pick(candidates)?.id;
        const ownIndex = own.discardPile.findIndex(c => c.id === chosenId);
        const enemyIndex = enemy.discardPile.findIndex(c => c.id === chosenId);
        if (ownIndex < 0 && enemyIndex < 0) return "沒有可取回的卡牌";
        const fromEnemy = ownIndex < 0;
        const [revived] = fromEnemy ? enemy.discardPile.splice(enemyIndex, 1) : own.discardPile.splice(ownIndex, 1);
        own.hand.push(revived);
        who.deck.restore(own);
        if (fromEnemy) foe.deck.restore(enemy);
        return `從${fromEnemy ? "對方" : "自己"}的棄牌堆取回「${D().cardName(revived)}」（僅限本場）`;
      }
      if (type === "resonance") { who.buff += 1; return `本場自己的可升級卡牌效果等級 +1（累積加成 ${who.buff}，最高 Lv.5；費用不變）`; }
      if (type === "energy_seal") {
        const removed = foe.energy;
        foe.energy = 0;
        return `封印對方全部 ${removed} 點行動點，降為 0`;
      }
      if (type === "energy_restore") {
        const gained = Math.max(0, who.baseEnergy - who.energy);
        who.energy += gained;
        return `補充 ${gained} 點行動點，恢復至本場預設 ${who.baseEnergy} 點`;
      }
      return "魔法效果已發動";
    }
    checkHP() {
      if (this.outcome) return;
      if (this.player.hp <= 0) this.lose("玩家生命值歸零");
      else if (this.boss.hp <= 0) this.win("Boss 生命值歸零");
    }
    checkExhaustion() {
      if (this.outcome) return;
      const p = cardList(this.player);
      if (p.drawPile.length > 0) return;
      if (p.hand.length === 0) return this.lose("玩家已無手牌，抽牌堆也已耗盡");
      if (!p.hand.some((_, i) => this.valid(this.player, i))) this.lose("玩家抽牌堆已耗盡，剩餘手牌均無法使用");
    }
    win(reason) { if (this.outcome) return; this.outcome = "win"; this.turn = "done"; this.note(`勝利：${reason}`); }
    lose(reason) { if (this.outcome) return; this.outcome = "lose"; this.turn = "done"; this.note(`戰敗：${reason}`); }
    concede() { if (this.outcome || this.turn !== "player") return false; this.lose("玩家主動認輸"); return true; }
    openingExchange(index) {
      // 玩家限定：每回合開始最多一次，需仍有抽牌；交換本身不消耗點數，
      // 不佔原本「整理手牌」次數；兩者分別計算。
      if (this.outcome || this.turn !== "player" || !this.openingExchangeAvailable) return false;
      const before = cardList(this.player);
      if (!Number.isInteger(index) || index < 0 || index >= before.hand.length || before.drawPile.length === 0) return false;
      const discarded = this.player.deck.discardAt(index);
      const [drawn] = this.player.deck.draw(1);
      this.openingExchangeAvailable = false;
      this.note(`回合開始換牌：你棄掉「${D().cardName(discarded)}」，從抽牌堆抽到「${D().cardName(drawn)}」（不消耗點數）。`);
      this.checkExhaustion();
      return true;
    }
    freeDiscard(index) {
      if (this.outcome || this.turn !== "player" || this.freeDiscardUsed) return false;
      if (index < 0 || index >= cardList(this.player).hand.length) return false;
      const card = this.player.deck.discardAt(index);
      this.openingExchangeAvailable = false;
      this.freeDiscardUsed = true;
      this.note(`整理手牌：你放下「${D().cardName(card)}」（僅進本場棄牌堆）。`);
      this.checkExhaustion();
      return true;
    }
    bossPlayLimit() {
      // 1～3 關最多 1 張、4～7 關最多 2 張、8～10 關最多 3 張。
      return this.stage <= 3 ? 1 : this.stage <= 7 ? 2 : 3;
    }
    beginBossTurn() {
      if (this.outcome || this.turn !== "player") return false;
      this.openingExchangeAvailable = false;
      this.turn = "boss";
      this.lastBossAction = null;
      this.lastBossActions = [];
      this.bossPlaysThisTurn = 0;
      this.boss.guard = 0;
      this.boss.counter = false;
      this.boss.deck.drawToHand(4);
      return true;
    }
    bossStep() {
      if (this.turn !== "boss" || this.outcome || this.bossPlaysThisTurn >= this.bossPlayLimit()) return null;
      const beforeHand = cardList(this.boss).hand;
      const legal = beforeHand.map((_, index) => index).filter(index => this.valid(this.boss, index));
      if (!legal.length) {
        // 本回合至少打過一張就直接收手，不因出完一張才沒牌而額外棄牌。
        if (this.bossPlaysThisTurn === 0) {
          if (beforeHand.length) {
            const gone = this.boss.deck.discardAt(Math.floor(Math.random() * beforeHand.length));
            this.note(`Boss 暫無可用牌，整理手牌「${D().cardName(gone)}」。`);
          } else if (cardList(this.boss).drawPile.length === 0) this.win("Boss 牌庫已耗盡");
        }
        return null;
      }
      const index = pick(legal);
      const playedCard = { ...beforeHand[index] };
      const before = this.state();
      const worked = this.play("boss", index); // 每一張都使用 v0.8 原本的判定方法。
      if (!worked) return null;
      this.bossPlaysThisTurn += 1;
      const action = { card: playedCard, description: this.log[0] || "", before, after: this.state() };
      this.lastBossAction = action;
      this.lastBossActions.push(action);
      return action;
    }
    finishBossTurn() {
      if (this.turn !== "boss" && !this.outcome) return false;
      this.checkHP();
      if (this.outcome) return true;
      this.turn = "player";
      this.round += 1;
      this.freeDiscardUsed = false;
      this.player.guard = 0;
      this.player.counter = false;
      this.player.deck.drawToHand(4);
      this.openingExchangeAvailable = true;
      this.checkExhaustion();
      return true;
    }
    endTurn() {
      // 非動畫呼叫也會完整執行此回合（UI 會用分步 API 逐張播放）。
      if (!this.beginBossTurn()) return false;
      while (!this.outcome && this.bossPlaysThisTurn < this.bossPlayLimit()) {
        if (!this.bossStep()) break;
      }
      return this.finishBossTurn();
    }
  }
  window.LinCardBattle = Object.freeze({ Battle });
})();
