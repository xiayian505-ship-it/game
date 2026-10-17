/* =====================================================================
   game_data.js
   遊戲資料中心：規則數值、卡牌、敵人、房間熱點、線索、推理題、結局文字。
   想改劇情、平衡或新增卡牌，只需要改這個檔案，不必碰其他程式。
   ===================================================================== */
(function (global) {
  "use strict";

  const GAME_RULES = Object.freeze({
    startingLanternCount: 5,
    playerMaxHealth: 32,
    spiritPerTurn: 3,
    handSize: 5,
    requiredClueCount: 6
  });

  /* ---------- 策略卡牌：effectKey 對應 card_battle_engine.js 登記的效果 ---------- */
  const CARD_DEFINITIONS = Object.freeze([
    { cardId: "slash_talisman",   name: "斬鬼符", icon: "🗡️", cost: 1, effectKey: "deal_damage",   power: 5, description: "對單一目標造成 5 傷害" },
    { cardId: "thunder_talisman", name: "五雷符", icon: "⚡",  cost: 2, effectKey: "deal_damage",   power: 10, description: "對單一目標造成 10 傷害" },
    { cardId: "ward_talisman",    name: "護身符", icon: "🛡️", cost: 1, effectKey: "gain_block",    power: 6, description: "獲得 6 點護盾" },
    { cardId: "mending_prayer",   name: "回魂訣", icon: "💚", cost: 2, effectKey: "heal_player",   power: 8, description: "回復 8 點生命" },
    { cardId: "gather_spirit",    name: "聚靈",   icon: "🔮", cost: 0, effectKey: "gain_spirit",   power: 1, description: "免費，獲得 1 點靈力" },
    { cardId: "binding_rope",     name: "縛鬼索", icon: "🪢", cost: 1, effectKey: "stun_enemy",    power: 1, description: "令目標下回合無法行動" },
    { cardId: "sweeping_bell",    name: "破煞鈴", icon: "🔔", cost: 2, effectKey: "damage_all",    power: 4, description: "對所有敵人造成 4 傷害" }
  ]);

  const STARTER_DECK_RECIPE = Object.freeze({
    slash_talisman: 3, thunder_talisman: 2, ward_talisman: 2, mending_prayer: 1,
    gather_spirit: 2, binding_rope: 1, sweeping_bell: 1
  });

  /* ---------- 遭遇戰：敵人的 attackPattern 會依序循環 ---------- */
  const ENCOUNTER_DEFINITIONS = Object.freeze({
    paper_guard_fight: {
      title: "紙人守衛攔路",
      enemies: [{ name: "紙人守衛", icon: "👹", maxHealth: 14, attackPattern: [4, 5, 7] }]
    },
    four_eyed_spirit_fight: {
      title: "井底的四目鬼",
      enemies: [
        { name: "四目鬼", icon: "👁️", maxHealth: 30, attackPattern: [5, 7, 10] },
        { name: "紙人侍從", icon: "🎎", maxHealth: 8, attackPattern: [3] },
        { name: "紙人侍從", icon: "🎎", maxHealth: 8, attackPattern: [3] }
      ]
    }
  });

  /* ---------- 線索 ---------- */
  const CLUE_DEFINITIONS = Object.freeze({
    watch_time:   { title: "停擺的懷錶", text: "櫃檯下的懷錶停在 8 點 45 分，錶面有裂痕——這就是案發時刻。" },
    poison_tea:   { title: "發綠的殘茶", text: "掌櫃的茶杯殘茶泛綠，銀簪一探立刻發黑。死因不是外傷，是茶裡有毒。" },
    alibi_story:  { title: "說書場次單", text: "客房桌上的場次單：8 點到 9 點，柳先生在後廳說書，十幾位客人簽名作證。" },
    alibi_cook:   { title: "米糧送貨單", text: "灶台旁的送貨單：8 點 40 分到 9 點，韓婆都在與送米夥計核對米袋，有簽名。" },
    deed_changed: { title: "改名的地契", text: "抽屜裡的地契三天前改成了「阿墨」名下，簽字筆跡顫抖——有人逼掌櫃簽的。" },
    sleeve_stain: { title: "染綠的袖口", text: "四目鬼身上掉出一截染著綠茶漬的袖口，繡著「墨」字。這是阿墨的衣料。" }
  });

  /* ---------- 房間與熱點（leftPercent / topPercent 為在房間畫面中的位置） ---------- */
  const ROOM_DEFINITIONS = Object.freeze({
    lobby: {
      name: "大廳", requiredItemId: null,
      hotspots: [
        { hotspotId: "counter_watch", icon: "🕰️", label: "櫃檯", leftPercent: 24, topPercent: 58, actionType: "clue", clueId: "watch_time" },
        { hotspotId: "notice_board",  icon: "📜", label: "告示", leftPercent: 52, topPercent: 30, actionType: "hint",
          hintText: "「七盞燈已滅六盞。天亮前說出真相，大門才會開。」——紙背寫著：「後院的門，鑰匙在紙人手裡。」" },
        { hotspotId: "paper_guard",   icon: "👹", label: "紙人守衛", leftPercent: 76, topPercent: 60, actionType: "battle",
          encounterId: "paper_guard_fight", rewardItemId: "yard_key", rewardText: "紙人化為灰燼，掉出一把生鏽的「後院鑰匙」。" },
        { hotspotId: "front_gate",    icon: "🚪", label: "大門", leftPercent: 50, topPercent: 78, actionType: "deduction" }
      ]
    },
    guest_room: {
      name: "客房", requiredItemId: null,
      hotspots: [
        { hotspotId: "tea_cup",     icon: "🍵", label: "茶杯", leftPercent: 30, topPercent: 62, actionType: "clue", clueId: "poison_tea" },
        { hotspotId: "story_sheet", icon: "📖", label: "說書稿", leftPercent: 62, topPercent: 40, actionType: "clue", clueId: "alibi_story" },
        { hotspotId: "locked_drawer", icon: "🗄️", label: "上鎖抽屜", leftPercent: 78, topPercent: 66, actionType: "keypad",
          unlockCode: "0845", needClueId: "watch_time", clueId: "deed_changed",
          lockedText: "抽屜上了四位數密碼鎖。你還沒找到任何和「時間」有關的東西……" }
      ]
    },
    back_yard: {
      name: "後院", requiredItemId: "yard_key",
      hotspots: [
        { hotspotId: "kitchen_stove", icon: "🔥", label: "灶台", leftPercent: 28, topPercent: 58, actionType: "clue", clueId: "alibi_cook" },
        { hotspotId: "old_well", icon: "🕳️", label: "古井", leftPercent: 68, topPercent: 60, actionType: "battle",
          encounterId: "four_eyed_spirit_fight", rewardClueId: "sleeve_stain",
          rewardText: "四目鬼發出一聲長嘯，化作黑霧散去，井邊留下一截袖口。" }
      ]
    }
  });

  /* ---------- 最終推理題 ---------- */
  const DEDUCTION_QUESTIONS = Object.freeze([
    { questionId: "culprit", prompt: "誰是兇手？", correctOptionId: "amo",
      options: [{ optionId: "amo", label: "掌櫃之子 阿墨" }, { optionId: "han", label: "廚娘 韓婆" }, { optionId: "liu", label: "說書人 柳先生" }] },
    { questionId: "method", prompt: "兇手用什麼手法？", correctOptionId: "poison",
      options: [{ optionId: "poison", label: "茶中下毒" }, { optionId: "rope", label: "麻繩勒斃" }, { optionId: "lamp", label: "銅燈重擊" }] },
    { questionId: "motive", prompt: "為了什麼動機？", correctOptionId: "inheritance",
      options: [{ optionId: "inheritance", label: "搶奪地契家產" }, { optionId: "debt", label: "還不出賭債" }, { optionId: "silence", label: "滅口保密" }] }
  ]);

  const ENDING_TEXT = Object.freeze({
    victoryTitle: "真相大白",
    victoryBody: "阿墨在茶中下毒，逼父親改了地契，又扮成「四目鬼」嚇走旅客。你說出真相的瞬間，最後一盞燈亮起，客棧大門緩緩開啟——天亮了。",
    defeatTitle: "燈盡人散",
    defeatBody: "五盞引路燈全數熄滅，濃霧吞沒了客棧。你成了下一位「失蹤的旅客」……"
  });

  global.FogInnData = Object.freeze({
    GAME_RULES, CARD_DEFINITIONS, STARTER_DECK_RECIPE, ENCOUNTER_DEFINITIONS,
    CLUE_DEFINITIONS, ROOM_DEFINITIONS, DEDUCTION_QUESTIONS, ENDING_TEXT
  });
})(window);
