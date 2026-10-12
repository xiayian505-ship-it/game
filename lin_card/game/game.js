/** 霧林之契｜遊戲流程、戰後獎勵、收藏與十關進度。UI 由 game_ui.js 繪製。 */
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
  // 預留獎勵式廣告驗證；v0.8 測試期間全部直接領取。
  // 正式開通時必須在廣告平台核發獎勵後才解除檢查，不能單純把此開關改為 false。
  const REWARD_TEST_MODE = true;
  const REWARD_MODES = Object.freeze({
    card1: { requiresAd: false, cards: 1 },
    deck_up: { requiresAd: false, upgrade: "lastDeck" },
    card4: { requiresAd: true, cards: 4 },
    collection_up: { requiresAd: true, upgrade: "collection" }
  });

  function fresh() {
    return {
      version: 3, phase: "choose", stage: 1, completed: 0,
      player: [], starter: Data.starterAttacks(), boss: Data.bossBase(), pool: Data.initialPool(),
      pendingReward: null, selectedDeckIds: [], lastDeckIds: [],
      activeDeckIndex: 0, deckPresets: [[], [], []]
    };
  }
  // v0.7 已使用獨立儲存 key；不載入舊版存檔，也不執行跨版遷移。
  if (!save || !Array.isArray(save.pool) || !Array.isArray(save.player) ||
      !Array.isArray(save.deckPresets) || save.deckPresets.length !== 3 ||
      !save.deckPresets.every(Array.isArray) || !Array.isArray(save.selectedDeckIds)) {
    save = fresh();
  }
  if (save.phase === "battle") save.phase = "deck"; // 戰鬥不跨重新整理恢復，永久進度仍保留。
  if (![0, 1, 2].includes(save.activeDeckIndex)) save.activeDeckIndex = 0;
  const ownedIds = new Set(save.player.map(c => c.id));
  save.deckPresets = save.deckPresets.map(ids => [...new Set(ids.filter(id => ownedIds.has(id)))].slice(0, 30));
  chosenInitial = new Set(save.chosenInitialIds || []);
  chosenDeck = new Set(save.deckPresets[save.activeDeckIndex]);
  function persist() {
    save.chosenInitialIds = [...chosenInitial];
    save.selectedDeckIds = [...chosenDeck];
    save.deckPresets[save.activeDeckIndex] = [...chosenDeck];
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
    save.deckPresets = [[...chosenDeck], [], []];
    save.activeDeckIndex = 0;
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
  function activateDeck(index) {
    if (save.phase !== "deck") return false; // 戰鬥或領獎途中不切換牌組。
    if (!Number.isInteger(index) || index < 0 || index >= 3) return false;
    save.deckPresets[save.activeDeckIndex] = [...chosenDeck];
    save.activeDeckIndex = index;
    const owned = new Set(save.player.map(c => c.id));
    chosenDeck = new Set(save.deckPresets[index].filter(id => owned.has(id)));
    persist();
    refresh(`已切換至牌組 ${index + 1}（${chosenDeck.size} / 30 張）。`);
    return true;
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
    if (window.MistStoryBridge?.beforeBattle?.(save)) return;
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
      console.error("霧林之契：開戰失敗", err);
      refresh(`開戰失敗：${err.message}`);
    }
  }
  function syncBattle(deferRender = false) {
    if (!battle) return;
    selectedCard = null;
    targetPrompt = null;
    if (battle.outcome === "win") {
      save.phase = "reward";
      save.pendingReward = { mode: null, queue: [], cursor: 0, fixedAttack: Data.victoryAttack(), fixedAttackAdded: true };
      persist();
      if (!deferRender) refresh("戰鬥勝利！固定獲得攻擊牌 1 張，下一場初始行動點 +1；再選一種額外獎勵。 ");
      else notice = "戰鬥勝利！固定獲得攻擊牌 1 張，下一場初始行動點 +1；再選一種額外獎勵。 ";
    } else if (battle.outcome === "lose") {
      save.phase = "defeat";
      persist();
      if (!deferRender) refresh("本關戰敗。所有永久牌庫與進度仍保留。 ");
      else notice = "本關戰敗。所有永久牌庫與進度仍保留。 ";
    } else if (!deferRender) refresh();
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
  function endTurn(options = {}) {
    if (save.phase !== "battle" || !battle) return null;
    if (!battle.endTurn()) return null;
    // 動畫期間 UI 不重繪，玩家可以先看完 Boss 翻出的真卡，再顯示結算。
    const action = battle.lastBossAction;
    syncBattle(options.deferRender === true);
    return action;
  }
  function openingExchange() {
    if (save.phase !== "battle" || !battle) return;
    if (selectedCard === null) return refresh("請先選取要換掉的手牌。 ");
    if (!battle.openingExchange(selectedCard)) return refresh("只有回合開始、尚未出牌或整理前，而且抽牌堆還有牌時，才能棄一抽一。 ");
    syncBattle();
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
    const policy = REWARD_MODES[mode];
    if (!policy) return;
    // 測試期四種全可直接領；正式廣告尚未接入，一旦關閉測試模式就先禁止廣告獎勵。
    if (policy.requiresAd && !REWARD_TEST_MODE) return refresh("此獎勵需要完成廣告驗證，目前尚未開放。 ");
    const pending = save.pendingReward;
    pending.mode = mode;
    // 每關固定的攻擊牌維持一張，此外才處理四選一獎勵。
    pending.queue = [pending.fixedAttack || Data.victoryAttack()];
    pending.cursor = 0;
    delete pending.fixedAttack;
    pending.fixedAttackAdded = true;
    if (policy.upgrade) {
      const ids = new Set(save.lastDeckIds);
      let upgraded = 0;
      for (const card of save.player) {
        if ((policy.upgrade === "collection" || ids.has(card.id)) &&
            Data.LEVEL_TYPES.includes(card.type) && card.level < 5) {
          card.level += 1;
          upgraded++;
        }
      }
      persist();
      return refresh(`${policy.upgrade === "collection" ? "永久收藏" : "本場出戰牌組"}有 ${upgraded} 張可升等卡牌提升 1 級（最高 Lv.5）；固定攻擊牌仍待領取。`);
    }
    pending.queue.push(...Data.rewardCards(policy.cards));
    persist(); refresh(`固定攻擊牌 1 張，加上額外的 ${policy.cards} 張卡牌，共 ${pending.queue.length} 張待處理。`);
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
      // 三套牌組共用永久收藏，失去這張實體卡時都需取消引用。
      save.deckPresets = save.deckPresets.map(ids => ids.filter(id => id !== old.id));
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
    if (save.phase !== "reward" || !save.pendingReward) return;
    save.completed += 1;
    save.stage = Math.min(10, save.completed + 1);
    save.pendingReward = null;
    battle = null;
    if (save.completed >= 10) save.phase = "complete";
    else {
      save.phase = "deck";
      // 不覆蓋玩家自己配置的三套牌組；移除已不在收藏中的牌即可。
      const owned = new Set(save.player.map(c => c.id));
      chosenDeck = new Set([...chosenDeck].filter(id => owned.has(id)));
    }
    persist();
    if (window.MistStoryBridge?.afterReward?.(save)) return;
    refresh(save.completed >= 10 ? "十關全勝，試煉通關！" : `已通過 ${save.completed} 關。下一場玩家初始行動點為 ${5 + save.completed}。`);
  }
  function newGame() {
    if (!window.confirm("確定重新開始？目前十關進度與雙方永久牌庫將被清除。")) return;
    Storage.remove(); window.MistStoryBridge?.reset?.(); save = fresh(); chosenInitial = new Set(); chosenDeck = new Set(); battle = null;
    selectedCard = null; targetPrompt = null; persist(); refresh("已建立新的 40 張初始候選牌池。 ");
  }
  function view() { return { save, battle: battle?.state() || null, selectedCard, targetPrompt, chosenInitial, chosenDeck, notice, hasLibrary: !!window.Deck?.create }; }
  window.LinCardGame = Object.freeze({ view, pickInitial, confirmInitial, toggleDeck, selectAllDeck, activateDeck, changeBranch, beginBattle, cardClick, playTarget, closeTarget, endTurn, openingExchange, freeDiscard, concede, retry, chooseReward, acceptReward, rejectReward, newGame, currentReward });
  persist();
  window.addEventListener("DOMContentLoaded", () => window.LinCardUI?.render());
})();
