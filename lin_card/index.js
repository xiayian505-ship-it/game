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
      version: 1, phase: "choose", stage: 1, completed: 0,
      player: [], boss: Data.bossBase(), pool: Data.initialPool(),
      pendingReward: null, selectedDeckIds: [], lastDeckIds: []
    };
  }
  if (!save || !Array.isArray(save.pool) || !Array.isArray(save.selectedDeckIds)) save = fresh();
  if (save.phase === "battle") save.phase = "deck"; // 暫不恢復半場戰鬥；永久成長完整保留。
  if (save.phase === "choose" && save.pool?.length !== 30) save = fresh();
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
    else if (chosenInitial.size < 15) chosenInitial.add(id);
    else return refresh("初始只能選 15 張，要換牌請先取消一張。 ");
    persist(); refresh();
  }
  function confirmInitial() {
    if (save.phase !== "choose" || chosenInitial.size !== 15) return refresh("請選滿 15 張牌。 ");
    save.player = save.pool.filter(c => chosenInitial.has(c.id));
    save.boss.push(...save.pool.filter(c => !chosenInitial.has(c.id)));
    save.pool = [];
    chosenDeck = new Set(save.player.map(c => c.id));
    save.selectedDeckIds = [...chosenDeck];
    setPhase("deck");
    refresh("15 張初始牌已入手，剩餘的 15 張已交給 Boss。 ");
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
    if (!card || card.level === 0 || card.type === "special" || !Data.BRANCHES[card.type]?.includes(branch)) return;
    card.branch = branch;
    persist(); refresh(`「${card.name}」戰術調整為「${branch}」。`);
  }
  function beginBattle() {
    if (save.phase !== "deck" || chosenDeck.size === 0 || chosenDeck.size > 30) return refresh("請至少帶一張卡牌出戰。 ");
    if (!window.Deck?.create) return refresh("軍火庫 Deck 尚未載入。請確認網路可連線 https://lib.stillnessbyslowly.com/ 再重新整理。 ");
    try {
      const cards = save.player.filter(c => chosenDeck.has(c.id));
      save.lastDeckIds = cards.map(c => c.id);
      battle = new window.LinCardBattle.Battle(cards, save.boss, save.stage);
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
      save.pendingReward = { mode: null, queue: [], cursor: 0 };
      persist();
      refresh("你擊敗了 Boss！請選擇一種接龍模擬獎勵。 ");
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
    if (!battle.play("player", index)) return refresh("行動點不足，或卡牌條件不成立。 ");
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
    if (mode === "classic3") {
      const ids = new Set(save.lastDeckIds);
      let upgraded = 0;
      for (const card of save.player) {
        if (ids.has(card.id) && card.type !== "special" && card.level < 5) { card.level += 1; upgraded++; }
      }
      finishReward();
      return refresh(`模擬翻三張通關：本場出戰牌組有 ${upgraded} 張升級了。`);
    }
    pending.queue = Data.rewardCards({ classic1: 1, spider1: 2, freecell: 3, spider2: 4 }[mode]);
    pending.cursor = 0;
    persist(); refresh(`已模擬接龍通關，請逐張處理 ${pending.queue.length} 張獎勵卡。`);
  }
  function currentReward() { return save.phase === "reward" ? save.pendingReward?.queue?.[save.pendingReward.cursor] : null; }
  function acceptReward(replaceId = null) {
    const card = currentReward();
    if (!card) return;
    if (save.player.length >= 60) {
      const idx = save.player.findIndex(c => c.id === replaceId);
      if (idx < 0) return refresh("收藏已滿 60 張，請先選擇一張舊卡換掉，或放棄新卡。 ");
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
    save.completed += 1;
    save.stage = Math.min(10, save.completed + 1);
    save.pendingReward = null;
    battle = null;
    if (save.completed >= 10) save.phase = "complete";
    else {
      save.phase = "deck";
      chosenDeck = new Set(save.lastDeckIds.filter(id => save.player.some(c => c.id === id)));
    }
    persist(); refresh(save.completed >= 10 ? "十關全勝，試煉通關！" : `已通過 ${save.completed} 關。請準備下一關。`);
  }
  function newGame() {
    if (!window.confirm("確定重新開始？目前十關進度與雙方永久牌庫將被清除。")) return;
    Storage.remove(); save = fresh(); chosenInitial = new Set(); chosenDeck = new Set(); battle = null;
    selectedCard = null; targetPrompt = null; persist(); refresh("已建立新的 30 張共同牌池。 ");
  }
  function view() { return { save, battle: battle?.state() || null, selectedCard, targetPrompt, chosenInitial, chosenDeck, notice, hasLibrary: !!window.Deck?.create }; }
  window.LinCardGame = Object.freeze({ view, pickInitial, confirmInitial, toggleDeck, selectAllDeck, changeBranch, beginBattle, cardClick, playTarget, closeTarget, endTurn, freeDiscard, retry, chooseReward, acceptReward, rejectReward, newGame, currentReward });
  persist();
  window.addEventListener("DOMContentLoaded", () => window.LinCardUI?.render());
})();
