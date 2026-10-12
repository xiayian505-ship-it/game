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
      this.freeDiscardUsed = false;
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
      return { key, hp, maxHP: hp, shield: 0, guard: 0, energy: startingEnergy, mana: 5,
        buff: 0, pierceNext: false, counter: false,
        deck: window.Deck.create({ items: cards.map(x => ({ ...x })), handSize: 4, recycleDiscard: false }) };
    }
    note(message) { this.log.unshift(message); if (this.log.length > 35) this.log.length = 35; }
    actor(side) { return side === "boss" ? this.boss : this.player; }
    enemy(side) { return side === "boss" ? this.player : this.boss; }
    state() {
      const pack = who => ({ hp: who.hp, maxHP: who.maxHP, shield: who.shield, guard: who.guard,
        energy: who.energy, mana: who.mana, buff: who.buff, pierceNext: who.pierceNext, ...cardList(who) });
      return { stage: this.stage, round: this.round, turn: this.turn, outcome: this.outcome,
        player: pack(this.player), boss: pack(this.boss), log: [...this.log], freeDiscardUsed: this.freeDiscardUsed };
    }
    valid(who, index) {
      const card = cardList(who).hand[index];
      if (!card) return false;
      const fee = D().cost(card);
      if (D().resource(card) === "mana" ? who.mana < fee : who.energy < fee) return false;
      const foe = this.enemy(who.key);
      if (card.type === "action" && D().ACTIONS[card.name]?.key === "shatter") return foe.shield > 0;
      if (card.type === "special") {
        return D().SPECIALS[card.name]?.key !== "sacrifice" || who.energy + who.mana > 0;
      }
      if (card.type !== "magic") return true;
      const own = cardList(who), theirs = cardList(foe);
      const kind = D().MAGICS[card.name]?.key;
      if (["self_one", "self_all"].includes(kind)) return own.hand.length >= 2;
      if (kind === "swap_one") return own.hand.length >= 2 && theirs.hand.length >= 1;
      if (kind === "swap_all") return own.hand.length >= 2 || theirs.hand.length >= 1;
      if (kind === "foe_one") return theirs.hand.length >= 1;
      if (kind === "revive") return own.discardPile.length >= 1;
      if (kind === "resonance") return own.hand.length >= 1; // 本場可重複施放；全牌已 Lv5 則不再強化。
      return false;
    }
    targets(index) {
      const card = cardList(this.player).hand[index];
      if (!card || card.type !== "magic") return null;
      const kind = D().MAGICS[card.name]?.key;
      if (kind === "self_one" || kind === "swap_one") {
        return { type: "hand", cards: cardList(this.player).hand.filter((_, i) => i !== index),
          label: kind === "swap_one" ? "選擇自己要交換的手牌（對方隨機）" : "選擇自己要棄掉的手牌" };
      }
      if (kind === "revive") return { type: "discard", cards: cardList(this.player).discardPile, label: "選擇從棄牌堆取回的卡牌" };
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
          const kind = D().ACTIONS[card.name]?.key;
          if (kind === "shatter") { const n = foe.shield; foe.shield = 0; detail = `擊碎敵方全部 ${n} 點護盾`; }
          else if (kind === "pierce") { who.pierceNext = true; detail = "下一次自己的攻擊無視護盾"; }
          break;
        }
        case "special": {
          const kind = D().SPECIALS[card.name]?.key;
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
      this.note(`${action}使用「${card.name}」：${detail}。`);
      this.checkHP();
      if (!this.outcome && side === "player") this.checkExhaustion();
      return true;
    }
    cast(card, who, foe, choiceId) {
      const type = D().MAGICS[card.name]?.key;
      const hand = cardList(who).hand;
      if (type === "self_one") {
        const i = hand.findIndex(c => c.id === (choiceId || pick(hand).id));
        if (i < 0) return "無牌可棄";
        const gone = takeHand(who, i); discard(who, gone);
        return `棄掉自己「${gone.name}」`;
      }
      if (type === "self_all") { const dropped = who.deck.discardAll(); return `棄掉自己其餘 ${dropped.length} 張手牌`; }
      if (type === "foe_one") {
        const gone = takeHand(foe, Math.floor(Math.random() * cardList(foe).hand.length));
        discard(foe, gone);
        return `對方被迫棄掉「${gone.name}」`;
      }
      if (type === "swap_one") {
        const mine = cardList(who).hand;
        const ownIndex = who.key === "player" ? mine.findIndex(c => c.id === choiceId) : Math.floor(Math.random() * mine.length);
        const theirIndex = Math.floor(Math.random() * cardList(foe).hand.length);
        const mineCard = takeHand(who, ownIndex), theirCard = takeHand(foe, theirIndex);
        appendHand(who, theirCard); appendHand(foe, mineCard);
        return `交換「${mineCard.name}」與「${theirCard.name}」`;
      }
      if (type === "swap_all") {
        const my = cardList(who).hand, their = cardList(foe).hand;
        resetHand(who.deck, their); resetHand(foe.deck, my);
        return `交換雙方手牌（${my.length} ⇄ ${their.length}）`;
      }
      if (type === "revive") {
        const snap = who.deck.snapshot();
        const idx = who.key === "player" ? snap.discardPile.findIndex(c => c.id === choiceId) : Math.floor(Math.random() * snap.discardPile.length);
        const [revived] = snap.discardPile.splice(idx, 1);
        snap.hand.push(revived); who.deck.restore(snap);
        return `從棄牌堆取回「${revived.name}」`;
      }
      if (type === "resonance") { who.buff += 1; return `本場自己的可升級卡牌效果等級 +1（累積加成 ${who.buff}，最高 Lv.5；費用不變）`; }
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
    freeDiscard(index) {
      if (this.outcome || this.turn !== "player" || this.freeDiscardUsed) return false;
      if (index < 0 || index >= cardList(this.player).hand.length) return false;
      const card = this.player.deck.discardAt(index);
      this.freeDiscardUsed = true;
      this.note(`整理手牌：你放下「${card.name}」（僅進本場棄牌堆）。`);
      this.checkExhaustion();
      return true;
    }
    endTurn() {
      if (this.outcome || this.turn !== "player") return false;
      this.turn = "boss";
      this.boss.guard = 0; this.boss.counter = false;
      this.boss.deck.drawToHand(4);
      const before = cardList(this.boss).hand;
      const legal = before.map((_, i) => i).filter(i => this.valid(this.boss, i));
      if (legal.length) this.play("boss", pick(legal));
      else if (before.length) {
        const gone = this.boss.deck.discardAt(Math.floor(Math.random() * before.length));
        this.note(`Boss 暫無可用牌，整理手牌「${gone.name}」。`);
      } else if (cardList(this.boss).drawPile.length === 0) this.win("Boss 牌庫已耗盡");
      this.checkHP();
      if (this.outcome) return true;
      this.turn = "player"; this.round += 1;
      this.freeDiscardUsed = false;
      this.player.guard = 0; this.player.counter = false;
      this.player.deck.drawToHand(4);
      this.checkExhaustion();
      return true;
    }
  }
  window.LinCardBattle = Object.freeze({ Battle });
})();
