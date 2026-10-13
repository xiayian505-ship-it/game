/** 霧林之契｜卡種使用固定 cardId、實體卡使用獨立 id；改名僅更動 CARD_CATALOG。 */
(() => {
  "use strict";
  const TYPES = ["attack", "defense", "shield", "heal", "action", "special", "magic"];
  const LABELS = { attack: "攻擊", defense: "防禦", shield: "護盾", heal: "生命", action: "行動", special: "特殊", magic: "魔法" };
  const SYMBOLS = { attack: "⌁", defense: "♧", shield: "❖", heal: "☽", action: "✧", special: "✦", magic: "✺" };
  // 卡種 ID 永遠固定；不要因改名或重新排序而改動左邊的 ID。
  const CARD_CATALOG = {
    attack: [
      { cardId: "attack_01", name: "穿霧" },
      { cardId: "attack_02", name: "殘月" },
      { cardId: "attack_03", name: "林中足跡" },
      { cardId: "attack_04", name: "樹影" },
      { cardId: "attack_05", name: "霜枝" },
    ],
    defense: [
      { cardId: "defense_01", name: "林蔭" },
      { cardId: "defense_02", name: "古木" },
      { cardId: "defense_03", name: "靜守" },
      { cardId: "defense_04", name: "青苔" },
      { cardId: "defense_05", name: "松籟" },
    ],
    shield: [
      { cardId: "shield_01", name: "苔痕" },
      { cardId: "shield_02", name: "雨幕" },
      { cardId: "shield_03", name: "低語" },
      { cardId: "shield_04", name: "霧簾" },
      { cardId: "shield_05", name: "晨露" },
    ],
    heal: [
      { cardId: "heal_01", name: "雨聲" },
      { cardId: "heal_02", name: "鹿角餘音" },
      { cardId: "heal_03", name: "春芽" },
      { cardId: "heal_04", name: "林泉" },
      { cardId: "heal_05", name: "暮雨" },
    ],
    action: [
      { cardId: "action_01", name: "裂盾" },
      { cardId: "action_02", name: "穿盾" },
    ],
    special: [
      { cardId: "special_01", name: "林間微光" },
      { cardId: "special_02", name: "風息" },
      { cardId: "special_03", name: "流螢" },
      { cardId: "special_04", name: "葉脈" },
      { cardId: "special_05", name: "回聲" },
      { cardId: "special_06", name: "星露" },
      { cardId: "special_07", name: "月泉" },
      { cardId: "special_08", name: "銀蕨" },
      { cardId: "special_09", name: "夜螢" },
      { cardId: "special_10", name: "霜光" },
      { cardId: "special_11", name: "同命之契" },
    ],
    magic: [
      { cardId: "magic_01", name: "一葉歸塵" },
      { cardId: "magic_02", name: "萬葉歸根" },
      { cardId: "magic_03", name: "借影易形" },
      { cardId: "magic_04", name: "斷枝奪葉" },
      { cardId: "magic_05", name: "枯木逢春" },
      { cardId: "magic_06", name: "移花接木" },
      { cardId: "magic_07", name: "萬木共鳴" },
      { cardId: "magic_08", name: "行動封印" },
      { cardId: "magic_09", name: "行動復甦" },
    ],
  };
  const CARD_BY_ID = Object.fromEntries(TYPES.flatMap(type => CARD_CATALOG[type].map(def => [def.cardId, { ...def, type }])));
  const NAMES = Object.fromEntries(TYPES.map(type => [type, CARD_CATALOG[type].map(def => def.name)]));
  // 玩法與消耗只依 cardId 查找，不以中文名稱作為索引。
  const ACTIONS = {
    action_01: { key: "shatter", cost: 3, desc: "清除敵方全部護盾。" },
    action_02: { key: "pierce", cost: 2, desc: "下一次自己的攻擊無視護盾（不無視防禦）。" }
  };
  const SPECIALS = {
    special_01: { key: "energy", cost: 0 },
    special_02: { key: "energy", cost: 0 },
    special_03: { key: "energy", cost: 0 },
    special_04: { key: "energy", cost: 0 },
    special_05: { key: "energy", cost: 0 },
    special_06: { key: "mana", cost: 0 },
    special_07: { key: "mana", cost: 0 },
    special_08: { key: "mana", cost: 0 },
    special_09: { key: "mana", cost: 0 },
    special_10: { key: "mana", cost: 0 },
    special_11: { key: "sacrifice", cost: 0 },
  };
  const MAGICS = {
    magic_01: { key: "self_one", cost: 1, desc: "棄掉自己一張其他手牌。" },
    magic_02: { key: "self_all", cost: 2, desc: "棄掉自己剩餘的所有手牌。" },
    magic_03: { key: "swap_one", cost: 3, desc: "選自己一張手牌，與對方隨機一張交換。" },
    magic_04: { key: "foe_one", cost: 3, desc: "強制對方隨機棄一張手牌。" },
    magic_05: { key: "revive", cost: 4, desc: "從雙方任一棄牌堆取回一張卡牌至自己手牌（僅限本場）。" },
    magic_06: { key: "swap_all", cost: 5, desc: "交換雙方當前手牌，不改變永久收藏。" },
    magic_07: { key: "resonance", cost: 6, desc: "僅自己：本場所有可升級卡牌效果等級 +1（累積至 Lv.5），費用不變。" },
    magic_08: { key: "energy_seal", cost: 4, desc: "對方目前所有行動點直接歸零。" },
    magic_09: { key: "energy_restore", cost: 4, desc: "自己行動點補足至本場預設值；高於預設值時不扣除。" },
  };
  const BRANCHES = {
    attack: ["標準", "破盾", "汲取"], defense: ["標準", "堅守", "反震"],
    shield: ["標準", "凝霧", "回春"], heal: ["標準", "滋養", "蓄息"]
  };
  const LEVEL_TYPES = ["attack", "defense", "shield", "heal"];
  const BONUS_POOL = { defense: 5, shield: 5, heal: 5, action: 8, special: 9, magic: 8 };
  let serial = 0;
  function make(type, cardId, source = "reward") {
    if (CARD_BY_ID[cardId]?.type !== type) throw new Error(`不明卡種識別碼：${cardId}（${type}）`);
    serial += 1;
    return { id: `lc-${Date.now().toString(36)}-${serial.toString(36)}-${Math.random().toString(36).slice(2, 7)}`, cardId, type, level: 0, branch: "標準", source };
  }
  function cardName(card) { return CARD_BY_ID[card?.cardId]?.name || "未知卡牌"; }
  function effectOf(card) {
    if (!card) return null;
    const table = card.type === "action" ? ACTIONS : card.type === "special" ? SPECIALS : card.type === "magic" ? MAGICS : null;
    return table?.[card.cardId]?.key || null;
  }
  function isHostile(card) {
    if (!card) return false;
    if (card.type === "attack") return true;
    return ["shatter", "foe_one", "swap_one", "swap_all", "energy_seal", "sacrifice"].includes(effectOf(card));
  }
  function starterAttacks() { return CARD_CATALOG.attack.map(def => make("attack", def.cardId, "starter")); }
  function initialPool() {
    // 共 40 張；行動牌各四張；特殊牌依原有配額。
    const initialIds = {
      defense: CARD_CATALOG.defense.map(def => def.cardId),
      shield: CARD_CATALOG.shield.map(def => def.cardId),
      heal: CARD_CATALOG.heal.map(def => def.cardId),
      action: Array.from({ length: 8 }, (_, i) => CARD_CATALOG.action[i % 2].cardId),
      special: ["special_01", "special_02", "special_03", "special_06", "special_07", "special_08", "special_11", "special_11", "special_11"],
      magic: ["magic_01", "magic_03", "magic_04", "magic_05", "magic_06", "magic_07", "magic_08", "magic_09"]
    };
    return Object.entries(BONUS_POOL).flatMap(([type, count]) =>
      Array.from({ length: count }, (_, i) => make(type, initialIds[type][i], "initial")));
  }
  function bossBase() {
    return TYPES.flatMap(type => {
      let ids;
      if (type === "special") ids = [...CARD_CATALOG.special.slice(0, 10).map(def => def.cardId), ...Array(5).fill("special_11")];
      else if (type === "action") ids = Array.from({ length: 15 }, (_, i) => CARD_CATALOG.action[i % 2].cardId);
      else if (type === "magic") ids = [...CARD_CATALOG.magic.map(def => def.cardId), ...CARD_CATALOG.magic.slice(0, 4).map(def => def.cardId), "magic_07", "magic_08"];
      else ids = Array.from({ length: 15 }, (_, i) => CARD_CATALOG[type][i % CARD_CATALOG[type].length].cardId);
      return ids.map(cardId => make(type, cardId, "boss-base"));
    });
  }
  function victoryAttack() { return make("attack", CARD_CATALOG.attack[Math.floor(Math.random() * CARD_CATALOG.attack.length)].cardId, "victory-guarantee"); }
  function rewardCards(count) {
    return Array.from({ length: count }, () => {
      const type = TYPES[Math.floor(Math.random() * TYPES.length)];
      const pool = type === "special" ? [
        CARD_CATALOG.special[Math.floor(Math.random() * 5)],
        CARD_CATALOG.special[5 + Math.floor(Math.random() * 5)],
        CARD_CATALOG.special[10]
      ] : CARD_CATALOG[type];
      return make(type, pool[Math.floor(Math.random() * pool.length)].cardId);
    });
  }
  const value = level => 5 + level * (level + 1) / 2;
  const actionGain = level => level + 1;
  const resourceGain = card => 3 + Math.max(0, Math.min(5, card.level || 0));
  const effectiveLevel = (card, buff = 0) => LEVEL_TYPES.includes(card.type) ? Math.min(5, Math.max(0, (card.level || 0) + buff)) : 0;
  function cost(card) {
    if (card.type === "special") return 0;
    if (card.type === "action") return ACTIONS[card.cardId]?.cost ?? 2;
    if (card.type === "magic") return MAGICS[card.cardId]?.cost ?? 3;
    return Math.min(5, Math.max(0, card.level || 0)) + 1;
  }
  function resource(card) { return card.type === "magic" ? "mana" : card.type === "special" ? "none" : "energy"; }
  function describe(card, buff = 0) {
    if (card.type === "action") return ACTIONS[card.cardId]?.desc || "行動效果";
    if (card.type === "magic") return MAGICS[card.cardId]?.desc || "魔法效果";
    if (card.type === "special") {
      const kind = effectOf(card);
      if (kind === "energy") return `免費補充 ${resourceGain(card) + (card.branch === "聚息" ? 1 : 0)} 點行動點${card.branch === "癒息" ? "，並恢復 1 HP" : ""}`;
      if (kind === "mana") return `免費補充 ${resourceGain(card)} 點魔法點`;
      if (kind === "sacrifice") return "耗盡當下全部行動點與魔法點；無視護盾，雙方生命直接變為 1。";
      return "特殊效果";
    }
    const n = value(effectiveLevel(card, buff));
    const noun = { attack: "造成傷害", defense: "防禦下次敵方回合", shield: "獲得持續護盾", heal: "恢復生命" };
    const branch = card.branch !== "標準" ? `｜${card.branch}` : "";
    return `${noun[card.type]} ${n}${buff ? "（共鳴加成）" : ""}${branch}`;
  }
  // Boss 也擁有穩定 ID；名稱只留在此供介面顯示。
  const BOSSES = [
    { bossId: "boss_01", name: "霧中行者", health: 30 },
    { bossId: "boss_02", name: "松間觀客", health: 50 },
    { bossId: "boss_03", name: "雨幕旅人", health: 80 },
    { bossId: "boss_04", name: "林下守夜者", health: 120 },
    { bossId: "boss_05", name: "折枝者", health: 170 },
    { bossId: "boss_06", name: "未眠樵夫", health: 230 },
    { bossId: "boss_07", name: "鹿角見證人", health: 300 },
    { bossId: "boss_08", name: "暮林幽客", health: 380 },
    { bossId: "boss_09", name: "循聲而來者", health: 470 },
    { bossId: "boss_10", name: "無名守林人", health: 570 },
  ];
  const CHAPTERS = BOSSES.map(boss => boss.name);
  const HEALTH = BOSSES.map(boss => boss.health);
  const bossByStage = stage => BOSSES[stage - 1] || null;
  window.LinCardData = Object.freeze({ TYPES, LABELS, SYMBOLS, CARD_CATALOG, CARD_BY_ID, NAMES, ACTIONS, SPECIALS, MAGICS, BRANCHES,
    LEVEL_TYPES, BOSSES, CHAPTERS, HEALTH, BONUS_POOL, make, cardName, effectOf, isHostile, bossByStage,
    initialPool, bossBase, rewardCards, victoryAttack, value, actionGain, resourceGain, effectiveLevel, cost, resource, describe, starterAttacks });
})();
