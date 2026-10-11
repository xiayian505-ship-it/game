/** lin_card｜卡片資料：宿主自有名稱、類型、符號及升級規則。 */
(() => {
  "use strict";

  const TYPES = ["attack", "defense", "shield", "heal", "action", "special"];
  const LABELS = { attack: "攻擊", defense: "防禦", shield: "護盾", heal: "生命", action: "行動", special: "特殊" };
  const SYMBOLS = { attack: "⌁", defense: "♧", shield: "❖", heal: "☽", action: "✧", special: "✦" };
  const NAMES = {
    attack: ["穿霧", "殘月", "林中足跡", "樹影", "霜枝"],
    defense: ["林蔭", "古木", "靜守", "青苔", "松籟"],
    shield: ["苔痕", "雨幕", "低語", "霧簾", "晨露"],
    heal: ["雨聲", "鹿角餘音", "春芽", "林泉", "暮雨"],
    action: ["林間微光", "風息", "流螢", "葉脈", "回聲"],
    special: ["一葉歸塵", "萬葉歸根", "借影易形", "斷枝奪葉", "枯木逢春", "移花接木"]
  };
  const SPECIALS = {
    "一葉歸塵": { key: "self_one", cost: 1, desc: "自己棄一張手牌。" },
    "萬葉歸根": { key: "self_all", cost: 2, desc: "棄掉自己剩餘全部手牌。" },
    "借影易形": { key: "swap_one", cost: 3, desc: "選自己一張手牌，與對方隨機一張交換。" },
    "斷枝奪葉": { key: "foe_one", cost: 3, desc: "強制對方隨機棄一張手牌。" },
    "枯木逢春": { key: "revive", cost: 4, desc: "從本場棄牌堆取回一張已用過的牌。" },
    "移花接木": { key: "swap_all", cost: 5, desc: "交換雙方目前全部手牌，不轉移永久收藏。" }
  };

  const BRANCHES = {
    attack: ["標準", "破盾", "汲取"],
    defense: ["標準", "堅守", "反震"],
    shield: ["標準", "凝霧", "回春"],
    heal: ["標準", "滋養", "蓄息"],
    action: ["標準", "聚息", "癒息"]
  };
  let serial = 0;
  function make(type, name, source = "reward") {
    serial += 1;
    return { id: `lc-${Date.now().toString(36)}-${serial.toString(36)}-${Math.random().toString(36).slice(2, 7)}`, type, name, level: 0, branch: "標準", source };
  }
  function initialPool() {
    return TYPES.flatMap(type => Array.from({ length: 5 }, (_, i) => make(type, NAMES[type][i], "initial")));
  }
  function bossBase() {
    return TYPES.flatMap(type => Array.from({ length: 12 }, (_, i) => {
      // 特殊牌固定 6 種各 2 張，其餘類別各 12 張。
      const name = NAMES[type][i % NAMES[type].length];
      return make(type, name, "boss-base");
    }));
  }
  function rewardCards(count) {
    // 依六類隨機產生獎勵；允許同名不同實例，Lv.0 起始。
    return Array.from({ length: count }, () => {
      const type = TYPES[Math.floor(Math.random() * TYPES.length)];
      const names = NAMES[type];
      return make(type, names[Math.floor(Math.random() * names.length)]);
    });
  }
  const value = level => 5 + level * (level + 1) / 2;
  const actionGain = level => level + 1; // v0.1 試玩值：行動牌 Lv.0 +1、Lv.5 +6。
  const cost = card => card.type === "action" ? 0 : card.type === "special" ? SPECIALS[card.name]?.cost ?? 1 : Math.min(5, Math.max(0, card.level)) + 1;
  function describe(card) {
    if (card.type === "special") return SPECIALS[card.name]?.desc || "特殊效果";
    const n = value(card.level);
    const noun = { attack: "造成傷害", defense: "防禦下次敵方回合", shield: "獲得持續護盾", heal: "恢復生命", action: "增加行動點" };
    const number = card.type === "action" ? actionGain(card.level) : n;
    const branch = card.branch !== "標準" ? `｜${card.branch}` : "";
    return `${noun[card.type]} ${number}${branch}`;
  }
  const CHAPTERS = ["霧中行者", "松間觀客", "雨幕旅人", "林下守夜者", "折枝者", "未眠樵夫", "鹿角見證人", "暮林幽客", "循聲而來者", "無名守林人"];
  const HEALTH = [30, 50, 80, 120, 170, 230, 300, 380, 470, 570];
  window.LinCardData = Object.freeze({ TYPES, LABELS, SYMBOLS, NAMES, SPECIALS, BRANCHES, CHAPTERS, HEALTH, make, initialPool, bossBase, rewardCards, value, actionGain, cost, describe });
})();
