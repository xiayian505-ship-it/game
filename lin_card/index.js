/** lin_card｜遊戲流程、戰後獎勵、收藏與十關進度。UI 由 index_style.js 繪製。 */
(() => {
  "use strict";
  const Data = window.LinCardData;
  const Storage = window.LinCardSave;
  let save = Storage.read();
  let battle = null;
  let chosenInitial = new Set();
  let chosenDeck = new Set();
  let selectedCard = null;
  let targetPrompt = null;
  let notice = "";

  function fresh() {
    return {
      version: 2, bonusSystemV1: true, phase: "choose", stage: 1, completed: 0,
      player: [], starter: Data.starterAttacks(), boss: Data.bossBase(), pool: Data.initialPool(),
      pendingReward: null, retroBonusQueue: [], selectedDeckIds: [], lastDeckIds: []
    };
  }
  if (!save || !Array.isArray(save.pool) || !Array.isArray(save.selectedDeckIds)) save = fresh();
  if (save.phase === "battle") save.phase = "deck"; // 暫不恢復半場戰鬥；永久成長完整保留。
  // 新玩家從 40 張候選牌挑 25 張；舊版尚未開局者直接切至新牌池。
  if (save.phase === "choose" && (save.pool?.length !== 40 || save.starter?.length !== 5)) save = fresh();
  // v0.3 舊存檔相容：依已通過關卡一次性補發攻擊牌；不刪除現有牌庫或重置進度。
  // 收藏已達上限者保留補領清單，之後可自己決定換牌或拒領，絕不擅自把牌送 Boss。
  if (!save.bonusSystemV1) {
    const owed = Math.min(10, Math.max(0, Number.isInteger(save.completed) ? save.completed : 0));
    save.retroBonusQueue = Array.isArray(save.retroBonusQueue) ? save.retroBonusQueue : [];
    for (let i = 0; i < owed; i++) {
      const bonus = Data.victoryAttack();
      if (save.player.length < 80) save.player.push(bonus);
      else save.retroBonusQueue.push(bonus);
    }
    save.bonusSystemV1 = true;
  }
  // 兼容 v0.3 領獎途中升級：僅補上一張固定攻擊獎勵，不重抽先前獎勵。
  if (save.phase === "reward" && save.pendingReward && !save.pendingReward.fixedAttackAdded) {
    if (save.pendingReward.mode && save.pendingReward.mode !== "retro") {
      save.pendingReward.queue.splice(save.pendingReward.cursor, 0, Data.victoryAttack());
      save.pendingReward.fixedAttackAdded = true;
    } else if (!save.pendingReward.mode) {
      save.pendingReward.fixedAttack = Data.victoryAttack();
      save.pendingReward.fixedAttackAdded = true;
    }
  }
  // v0.4 → v0.5：保留舊存檔進度、升級、已選牌、Boss 收下的棄牌，不清檔。
  // 舊行動牌→特殊補點；舊特殊牌→魔法。將 Boss 固定牌組換成七類各 15 張。
  // 已完成初始選牌的玩家直接補 15 張功能牌至原來的 15 張，不會強迫重選或打掉戰績。
  if ((save.version || 1) < 2) {
    const migrate = items => { for (const card of items || []) Data.migrateCard(card); };
    migrate(save.player); migrate(save.boss); migrate(save.starter); migrate(save.pool);
    migrate(save.pendingReward?.queue); migrate(save.retroBonusQueue);
    if (save.pendingReward?.fixedAttack) Data.migrateCard(save.pendingReward.fixedAttack);
    if (save.phase !== "choose") {
      const candidates = Data.initialPool();
      const picks = [
        ...candidates.filter(c => c.type === "action").slice(0, 4),
        ...candidates.filter(c => c.type === "special" && Data.SPECIALS[c.name]?.key === "energy").slice(0, 2),
        ...candidates.filter(c => c.type === "special" && Data.SPECIALS[c.name]?.key === "mana").slice(0, 2),
        ...candidates.filter(c => c.type === "special" && Data.SPECIALS[c.name]?.key === "sacrifice").slice(0, 2),
        ...candidates.filter(c => c.type === "magic").slice(-5)
      ];
      save.player.push(...picks.map(c => ({ ...c, source: "v0.5-migration" })));
      const existingSelected = new Set(save.selectedDeckIds || []);
      for (const c of picks) if (existingSelected.size < 30) existingSelected.add(c.id);
      save.selectedDeckIds = [...existingSelected];
      save.boss = [...Data.bossBase(), ...save.boss.filter(c => c.source !== "boss-base")];
      notice = "已保留舊版進度，補入 15 張新功能牌；Boss 固定牌庫更新為七類各 15 張。";
    }
    save.version = 2;
  }
  chosenInitial = new Set(save.chosenInitialIds || []);
  chosenDeck = new Set(save.selectedDeckIds.length ? save.selectedDeckIds : save.player.map(c => c.id).slice(0, 30));
  function persist() {
    save.chosenInitialIds = [...chosenInitial];
    save.selectedDeckIds = [...chosenDeck];
    if (!Storage.write(save)) notice = "存檔寫入失敗，請檢查瀏覽器儲存權限。";
  }
  function refresh(message = "") {
    if (message) notice = message;
    window.LinCardUI?.render();
  }
  function setPhase(phase) { save.phase = phase; persist(); refresh(); }
  function pickInitial(id) {
    if (save.phase !== "choose") return;
    if (chosenInitial.has(id)) chosenInitial.delete(id);
    else if (chosenInitial.size < 25) chosenInitial.add(id);
    else return refresh("另外 25 張只能選 25 張，要換牌請先取消一張。 ");
    persist(); refresh();
  }
  function confirmInitial() {
    if (save.phase !== "choose" || chosenInitial.size !== 25) return refresh("請從選牌池選滿 25 張牌。 ");
    save.player = [...save.starter, ...save.pool.filter(c => chosenInitial.has(c.id))];
    save.boss.push(...save.pool.filter(c => !chosenInitial.has(c.id)));
    save.pool = [];
    save.starter = [];
    chosenDeck = new Set(save.player.map(c => c.id));
    save.selectedDeckIds = [...chosenDeck];
    setPhase("deck");
    refresh("5 張專屬攻擊牌＋25 張自選牌已入手，剩下的 15 張已交給 Boss。 ");
  }
  function toggleDeck(id) {
    if (save.phase !== "deck" || !save.player.some(c => c.id === id)) return;
    if (chosenDeck.has(id)) chosenDeck.delete(id);
    else if (chosenDeck.size < 30) chosenDeck.add(id);
    else return refresh("每場最多帶 30 張卡牌。 ");
    persist(); refresh();
  }
  function selectAllDeck() {
    if (save.phase !== "deck") return;
    chosenDeck = new Set(save.player.slice(0, 30).map(c => c.id));
    persist(); refresh();
  }
  function changeBranch(id, branch) {
    if (save.phase !== "deck") return;
    const card = save.player.find(c => c.id === id);
    if (!card || card.level === 0 || !Data.BRANCHES[card.type]?.includes(branch)) return;
    card.branch = branch;
    persist(); refresh(`「${card.name}」戰術調整為「${branch}」。`);
  }
  function beginBattle() {
    if (save.phase !== "deck" || chosenDeck.size === 0 || chosenDeck.size > 30) return refresh("請至少帶一張卡牌出戰。 ");
    if (!window.Deck?.create) return refresh("軍火庫 Deck 尚未載入。請確認網路可連線 https://lib.stillnessbyslowly.com/ 再重新整理。 ");
    try {
      const cards = save.player.filter(c => chosenDeck.has(c.id));
      save.lastDeckIds = cards.map(c => c.id);
      battle = new window.LinCardBattle.Battle(cards, save.boss, save.stage, 5 + save.completed);
      save.phase = "battle";
      persist();
      selectedCard = null;
      targetPrompt = null;
      refresh(`第 ${save.stage} 關開始，請出牌。`);
    } catch (err) {
      console.error("lin_card：開戰失敗", err);
      refresh(`開戰失敗：${err.message}`);
    }
  }
  function syncBattle() {
    if (!battle) return;
    selectedCard = null;
    targetPrompt = null;
    if (battle.outcome === "win") {
      save.phase = "reward";
      save.pendingReward = { mode: null, queue: [], cursor: 0, fixedAttack: Data.victoryAttack(), fixedAttackAdded: true };
      persist();
      refresh("戰鬥勝利！固定獲得攻擊牌 1 張，下一場初始行動點 +1；再選一種額外獎勵。 ");
    } else if (battle.outcome === "lose") {
      save.phase = "defeat";
      persist();
      refresh("本關戰敗。所有永久牌庫與進度仍保留。 ");
    } else refresh();
  }
  function cardClick(index) {
    if (save.phase !== "battle" || !battle || battle.outcome) return;
    const b = battle.state();
    if (index < 0 || index >= b.player.hand.length) return;
    if (selectedCard !== index) { selectedCard = index; return refresh(`已選取「${b.player.hand[index].name}」，再點一次出牌。`); }
    const target = battle.targets(index);
    if (target) {
      targetPrompt = { index, ...target };
      return refresh();
    }
    if (!battle.play("player", index)) return refresh("行動點／魔法點不足，或卡牌條件不成立。 ");
    syncBattle();
  }
  function playTarget(id) {
    if (!battle || !targetPrompt) return;
    const index = targetPrompt.index;
    if (!battle.play("player", index, id)) return refresh("選擇已失效，請重新選牌。 ");
    syncBattle();
  }
  function closeTarget() { targetPrompt = null; refresh(); }
  function endTurn() {
    if (save.phase !== "battle" || !battle) return;
    battle.endTurn(); syncBattle();
  }
  function freeDiscard() {
    if (save.phase !== "battle" || selectedCard === null) return refresh("先選取一張手牌，才能整理。 ");
    if (!battle.freeDiscard(selectedCard)) return refresh("本回合已經整理過一張手牌。 ");
    syncBattle();
  }
  function concede() {
    if (save.phase !== "battle" || !battle || battle.outcome) return;
    if (!window.confirm("確定認輸本場戰鬥？將從目前關卡重新挑戰，永久收藏與 Boss 牌庫不變。")) return;
    battle.concede();
    syncBattle();
  }
  function retry() {
    if (save.phase !== "defeat") return;
    battle = null; selectedCard = null; targetPrompt = null;
    save.phase = "deck";
    persist(); refresh("重新挑選出戰牌組，再挑戰同一關。 ");
  }
  function chooseReward(mode) {
    if (save.phase !== "reward" || save.pendingReward?.mode) return;
    const available = ["classic1", "classic3", "spider1", "freecell", "spider2"];
    if (!available.includes(mode)) return;
    const pending = save.pendingReward;
    pending.mode = mode;
    // 固定攻擊牌優先領取；其餘五選一獎勵完全照舊。
    pending.queue = [pending.fixedAttack || Data.victoryAttack()];
    pending.cursor = 0;
    delete pending.fixedAttack;
    pending.fixedAttackAdded = true;
    if (mode === "classic3") {
      const ids = new Set(save.lastDeckIds);
      let upgraded = 0;
      for (const card of save.player) {
        if (ids.has(card.id) && Data.LEVEL_TYPES.includes(card.type) && card.level < 5) { card.level += 1; upgraded++; }
      }
      persist();
      return refresh(`本場出戰牌組有 ${upgraded} 張升級；還有固定攻擊牌待領取。`);
    }
    pending.queue.push(...Data.rewardCards({ classic1: 1, spider1: 2, freecell: 3, spider2: 4 }[mode]));
    persist(); refresh(`固定攻擊牌 1 張，加上選定的額外獎勵，共 ${pending.queue.length} 張待處理。`);
  }
  function currentReward() { return save.phase === "reward" ? save.pendingReward?.queue?.[save.pendingReward.cursor] : null; }
  function acceptReward(replaceId = null) {
    const card = currentReward();
    if (!card) return;
    if (save.player.length >= 80) {
      const idx = save.player.findIndex(c => c.id === replaceId);
      if (idx < 0) return refresh("收藏已滿 80 張，請先選擇一張舊卡換掉，或放棄新卡。 ");
      const [old] = save.player.splice(idx, 1);
      save.boss.push({ ...old, source: "donation" });
      chosenDeck.delete(old.id);
    }
    save.player.push(card);
    advanceReward();
  }
  function rejectReward() {
    const card = currentReward();
    if (!card) return;
    save.boss.push({ ...card, source: "donation" });
    advanceReward();
  }
  function advanceReward() {
    save.pendingReward.cursor += 1;
    if (save.pendingReward.cursor >= save.pendingReward.queue.length) finishReward();
    else { persist(); refresh("繼續處理下一張獎勵卡。 "); }
  }
  function finishReward() {
    if (save.pendingReward?.mode === "retro") {
      save.phase = save.pendingReward.returnPhase || "deck";
      save.pendingReward = null;
      persist();
      return refresh("舊版通關的攻擊牌已補領完畢。");
    }
    if (save.phase !== "reward" || !save.pendingReward) return;
    save.completed += 1;
    save.stage = Math.min(10, save.completed + 1);
    save.pendingReward = null;
    battle = null;
    if (save.completed >= 10) save.phase = "complete";
    else {
      save.phase = "deck";
      chosenDeck = new Set(save.lastDeckIds.filter(id => save.player.some(c => c.id === id)));
    }
    persist(); refresh(save.completed >= 10 ? "十關全勝，試煉通關！" : `已通過 ${save.completed} 關。下一場玩家初始行動點為 ${5 + save.completed}。`);
  }
  function claimRetroBonus() {
    if (!["deck", "complete"].includes(save.phase) || !save.retroBonusQueue?.length) return;
    const returnPhase = save.phase;
    save.phase = "reward";
    save.pendingReward = { mode: "retro", queue: save.retroBonusQueue.splice(0), cursor: 0, returnPhase, fixedAttackAdded: true };
    persist(); refresh("請處理舊版通關補發的攻擊牌；每張仍可保留、替換或放棄。");
  }
  function newGame() {
    if (!window.confirm("確定重新開始？目前十關進度與雙方永久牌庫將被清除。")) return;
    Storage.remove(); save = fresh(); chosenInitial = new Set(); chosenDeck = new Set(); battle = null;
    selectedCard = null; targetPrompt = null; persist(); refresh("已建立新的 40 張初始候選牌池。 ");
  }
  function view() { return { save, battle: battle?.state() || null, selectedCard, targetPrompt, chosenInitial, chosenDeck, notice, hasLibrary: !!window.Deck?.create }; }
  window.LinCardGame = Object.freeze({ view, pickInitial, confirmInitial, toggleDeck, selectAllDeck, changeBranch, beginBattle, cardClick, playTarget, closeTarget, endTurn, freeDiscard, concede, retry, chooseReward, acceptReward, rejectReward, claimRetroBonus, newGame, currentReward });
  persist();
  window.addEventListener("DOMContentLoaded", () => window.LinCardUI?.render());
})();
