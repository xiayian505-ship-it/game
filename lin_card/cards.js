/** lin_card｜卡片資料與新版七大類規則；外觀完全由宿主 UI 控制。 */
(() => {
  "use strict";
  const TYPES = ["attack", "defense", "shield", "heal", "action", "special", "magic"];
  const LABELS = { attack: "攻擊", defense: "防禦", shield: "護盾", heal: "生命", action: "行動", special: "特殊", magic: "魔法" };
  const SYMBOLS = { attack: "⌁", defense: "♧", shield: "❖", heal: "☽", action: "✧", special: "✦", magic: "✺" };
  const NAMES = {
    attack: ["穿霧", "殘月", "林中足跡", "樹影", "霜枝"],
    defense: ["林蔭", "古木", "靜守", "青苔", "松籟"],
    shield: ["苔痕", "雨幕", "低語", "霧簾", "晨露"],
    heal: ["雨聲", "鹿角餘音", "春芽", "林泉", "暮雨"],
    action: ["裂盾", "穿盾"],
    special: ["林間微光", "風息", "流螢", "葉脈", "回聲", "星露", "月泉", "銀蕨", "夜螢", "霜光", "同命之契"],
    magic: ["一葉歸塵", "萬葉歸根", "借影易形", "斷枝奪葉", "枯木逢春", "移花接木", "萬木共鳴"]
  };
  const ACTIONS = {
    "裂盾": { key: "shatter", cost: 3, desc: "清除敵方全部護盾。" },
    "穿盾": { key: "pierce", cost: 2, desc: "下一次自己的攻擊無視護盾（不無視防禦）。" }
  };
  const SPECIALS = Object.fromEntries([
    ...NAMES.special.slice(0, 5).map(name => [name, { key: "energy", cost: 0 }]),
    ...NAMES.special.slice(5, 10).map(name => [name, { key: "mana", cost: 0 }]),
    ["同命之契", { key: "sacrifice", cost: 0 }]
  ]);
  const MAGICS = {
    "一葉歸塵": { key: "self_one", cost: 1, desc: "棄掉自己一張其他手牌。" },
    "萬葉歸根": { key: "self_all", cost: 2, desc: "棄掉自己剩餘的所有手牌。" },
    "借影易形": { key: "swap_one", cost: 3, desc: "選自己一張手牌，與對方隨機一張交換。" },
    "斷枝奪葉": { key: "foe_one", cost: 3, desc: "強制對方隨機棄一張手牌。" },
    "枯木逢春": { key: "revive", cost: 4, desc: "從本場棄牌堆取回一張卡牌。" },
    "移花接木": { key: "swap_all", cost: 5, desc: "交換雙方當前手牌，不改變永久收藏。" },
    "萬木共鳴": { key: "resonance", cost: 6, desc: "僅自己：本場所有可升級卡牌效果等級 +1（累積至 Lv.5），費用不變。" }
  };
  const BRANCHES = {
    attack: ["標準", "破盾", "汲取"], defense: ["標準", "堅守", "反震"],
    shield: ["標準", "凝霧", "回春"], heal: ["標準", "滋養", "蓄息"]
  };
  const LEVEL_TYPES = ["attack", "defense", "shield", "heal"];
  let serial = 0;
  function make(type, name, source = "reward") {
    serial += 1;
    return { id: `lc-${Date.now().toString(36)}-${serial.toString(36)}-${Math.random().toString(36).slice(2, 7)}`, type, name, level: 0, branch: "標準", source };
  }
  function starterAttacks() { return NAMES.attack.map(name => make("attack", name, "starter")); }
  const BONUS_POOL = { defense: 5, shield: 5, heal: 5, action: 8, special: 9, magic: 8 };
  function initialPool() {
    // 共 40 張；行動牌裂盾／穿盾各四張；特殊牌三種各三張。
    const initialNames = {
      defense: NAMES.defense, shield: NAMES.shield, heal: NAMES.heal,
      action: ["裂盾", "穿盾", "裂盾", "穿盾", "裂盾", "穿盾", "裂盾", "穿盾"],
      special: ["林間微光", "風息", "流螢", "星露", "月泉", "銀蕨", "同命之契", "同命之契", "同命之契"],
      magic: [...NAMES.magic, "萬木共鳴"]
    };
    return Object.entries(BONUS_POOL).flatMap(([type, count]) =>
      Array.from({ length: count }, (_, i) => make(type, initialNames[type][i], "initial")));
  }
  function bossBase() {
    return TYPES.flatMap(type => {
      let names;
      if (type === "special") {
        // 行動補充、魔法補充、犧牲：各五張。
        names = [...NAMES.special.slice(0, 5), ...NAMES.special.slice(5, 10), ...Array(5).fill("同命之契")];
      } else if (type === "action") names = Array.from({ length: 15 }, (_, i) => NAMES.action[i % 2]);
      else if (type === "magic") names = [...NAMES.magic, ...NAMES.magic, "萬木共鳴"];
      else names = Array.from({ length: 15 }, (_, i) => NAMES[type][i % NAMES[type].length]);
      return names.map(name => make(type, name, "boss-base"));
    });
  }
  function victoryAttack() { return make("attack", NAMES.attack[Math.floor(Math.random() * NAMES.attack.length)], "victory-guarantee"); }
  function rewardCards(count) {
    return Array.from({ length: count }, () => {
      const type = TYPES[Math.floor(Math.random() * TYPES.length)];
      let names = NAMES[type];
      // 特殊牌按三種效果等機率抽取，避免資源補充與犧牲失衡。
      if (type === "special") names = [NAMES.special[Math.floor(Math.random() * 5)], NAMES.special[5 + Math.floor(Math.random() * 5)], "同命之契"];
      return make(type, names[Math.floor(Math.random() * names.length)]);
    });
  }
  const value = level => 5 + level * (level + 1) / 2;
  const actionGain = level => level + 1;
  const resourceGain = card => 3 + Math.max(0, Math.min(5, card.level || 0)); // 舊行動牌轉入特殊牌，保留原等級的額外效果。
  const effectiveLevel = (card, buff = 0) => LEVEL_TYPES.includes(card.type) ? Math.min(5, Math.max(0, (card.level || 0) + buff)) : 0;
  function cost(card) {
    if (card.type === "special") return 0;
    if (card.type === "action") return ACTIONS[card.name]?.cost ?? 2;
    if (card.type === "magic") return MAGICS[card.name]?.cost ?? 3;
    return Math.min(5, Math.max(0, card.level || 0)) + 1;
  }
  function resource(card) { return card.type === "magic" ? "mana" : card.type === "special" ? "none" : "energy"; }
  function describe(card, buff = 0) {
    if (card.type === "action") return ACTIONS[card.name]?.desc || "行動效果";
    if (card.type === "magic") return MAGICS[card.name]?.desc || "魔法效果";
    if (card.type === "special") {
      const kind = SPECIALS[card.name]?.key;
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
  function migrateCard(card) {
    if (!card || typeof card !== "object") return card;
    // v0.4 的「行動牌」變為免費補行動點的特殊牌；舊特殊牌改歸魔法牌。
    if (card.type === "action" && NAMES.special.slice(0, 5).includes(card.name)) card.type = "special";
    else if (card.type === "special" && Object.prototype.hasOwnProperty.call(MAGICS, card.name)) card.type = "magic";
    if (!card.branch) card.branch = "標準";
    return card;
  }
  const CHAPTERS = ["霧中行者", "松間觀客", "雨幕旅人", "林下守夜者", "折枝者", "未眠樵夫", "鹿角見證人", "暮林幽客", "循聲而來者", "無名守林人"];
  const HEALTH = [30, 50, 80, 120, 170, 230, 300, 380, 470, 570];
  window.LinCardData = Object.freeze({ TYPES, LABELS, SYMBOLS, NAMES, SPECIALS, ACTIONS, MAGICS, BRANCHES,
    LEVEL_TYPES, CHAPTERS, HEALTH, BONUS_POOL, make, initialPool, bossBase, rewardCards, victoryAttack,
    value, actionGain, resourceGain, effectiveLevel, cost, resource, describe, starterAttacks, migrateCard });
})();
