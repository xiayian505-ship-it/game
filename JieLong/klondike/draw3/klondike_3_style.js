(() => {
  "use strict";

  const gameShell = document.getElementById("gameShell");
  const completedArea = document.getElementById("completedArea");
  const restartButton = document.getElementById("restartButton");

  // 同 FreeCell：在 iframe 裡通知帝國主城收起領地，不清除目前牌局。
  document.getElementById("leaveEmpireButton")?.addEventListener("click", () => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: "slowly-empire-leave", territory: "territory-klondike" }, window.location.origin);
      return;
    }
    if (window.history.length > 1) window.history.back();
  });


  const dealPicker = document.getElementById("dealPicker");
  const dealPickerNotice = document.getElementById("dealPickerNotice");
  const dealPickerBackButton = document.getElementById("dealPickerBackButton");
  const randomDealButton = document.getElementById("randomDealButton");
  const randomChoicePanel = document.getElementById("randomChoicePanel");
  const randomNewDealButton = document.getElementById("randomNewDealButton");
  const randomPendingDealButton = document.getElementById("randomPendingDealButton");
  const solvedDealButton = document.getElementById("solvedDealButton");
  const pendingDealButton = document.getElementById("pendingDealButton");
  const contributedPanel = document.getElementById("contributedPanel");
  const pendingChoiceTabs = document.getElementById("pendingChoiceTabs");
  const pendingAllTab = document.getElementById("pendingAllTab");
  const possibleUnsolvedTab = document.getElementById("possibleUnsolvedTab");
  const randomContributedButton = document.getElementById("randomContributedButton");
  const contributedList = document.getElementById("contributedList");
  const contributedPrevButton = document.getElementById("contributedPrevButton");
  const contributedNextButton = document.getElementById("contributedNextButton");
  const contributedPageInfo = document.getElementById("contributedPageInfo");
  const uidDealButton = document.getElementById("uidDealButton");
  const uidSearchPanel = document.getElementById("uidSearchPanel");
  const uidInput = document.getElementById("uidInput");
  const uidSearchButton = document.getElementById("uidSearchButton");

  const restartConfirm = document.getElementById("restartConfirm");
  const restartCancelButton = document.getElementById("restartCancelButton");
  const restartCurrentButton = document.getElementById("restartCurrentButton");
  const restartConfirmButton = document.getElementById("restartConfirmButton");

  const bombOverlay = document.getElementById("bombOverlay");
  const bombText = document.getElementById("bombText");
  const bombPlus = document.getElementById("bombPlus");
  const bombSubtext = document.getElementById("bombSubtext");
  const victoryParticles = document.getElementById("victoryParticles");

  const message = document.getElementById("message");
  const messageTitle = document.getElementById("messageTitle");
  const messageText = document.getElementById("messageText");
  const messageBest = document.getElementById("messageBest");
  const messageClears = document.getElementById("messageClears");
  const messageUidRow = document.getElementById("messageUidRow");
  const messageUid = document.getElementById("messageUid");
  const messageCopyUidButton = document.getElementById("messageCopyUidButton");
  const playAgainButton = document.getElementById("playAgainButton");

  const LAST_VICTORY_EFFECTS_STORAGE_KEY = "klondike_draw3_last_victory_effects_v1";
  const VICTORY_EFFECTS = Object.freeze([
    "confetti",
    "gold-rain",
    "stars",
    "shockwave",
    "flash-shake",
    "jackpot-pop",
    "card-rain",
    "victory-beam",
    "classic-fireworks"
  ]);

  const VICTORY_CARD_RAIN_ITEMS = Object.freeze([
    "♠", "♥", "♦", "♣",
    "A♠", "A♥", "A♦", "A♣",
    "K♠", "K♥", "K♦", "K♣"
  ]);

  let contributedPage = 1;
  let contributedTotalPages = 1;
  let contributedLoading = false;
  let contributedMode = "solved";
  let pendingListMode = "all";
  let lastVictoryEffectSignature = "";
  let lastVictoryEffects = (() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(LAST_VICTORY_EFFECTS_STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.filter(name => VICTORY_EFFECTS.includes(name)) : [];
    } catch {
      return [];
    }
  })();

  function sleep(ms) {
    return new Promise(resolve => window.setTimeout(resolve, Math.max(0, ms)));
  }

  function prefersReducedMotion() {
    return Boolean(
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function setPickerNotice(text) {
    dealPickerNotice.textContent = String(text || "");
  }

  function closeRandomChoices() {
    randomChoicePanel.hidden = true;
    randomDealButton.setAttribute("aria-expanded", "false");
  }

  function toggleRandomChoices() {
    if (window.KlondikeDraw3Game?.isBusy()) return;
    const willOpen = randomChoicePanel.hidden;
    closeRandomChoices();
    contributedPanel.hidden = true;
    uidSearchPanel.hidden = true;
    uidDealButton.setAttribute("aria-expanded", "false");
    if (willOpen) {
      randomChoicePanel.hidden = false;
      randomDealButton.setAttribute("aria-expanded", "true");
    }
    setPickerNotice("");
  }

  function showDealPicker(options = {}) {
    const canReturn = options.canReturn !== false;
    restartConfirm.hidden = true;
    message.hidden = true;
    dealPickerBackButton.hidden = !canReturn;
    closeRandomChoices();
    contributedPanel.hidden = true;
    uidSearchPanel.hidden = true;
    uidDealButton.setAttribute("aria-expanded", "false");
    uidInput.value = "";
    setPickerNotice("");
    dealPicker.hidden = false;
  }

  function hideDealPicker() {
    dealPicker.hidden = true;
    closeRandomChoices();
    contributedPanel.hidden = true;
    uidSearchPanel.hidden = true;
    uidDealButton.setAttribute("aria-expanded", "false");
    setPickerNotice("");
  }

  function toggleUidSearch() {
    const willOpen = uidSearchPanel.hidden;
    closeRandomChoices();
    contributedPanel.hidden = true;
    uidSearchPanel.hidden = !willOpen;
    uidDealButton.setAttribute("aria-expanded", String(willOpen));
    if (willOpen) uidInput.focus();
  }

  function isPendingMode() { return contributedMode === "pending"; }
  function currentPoolLabel() {
    if (contributedMode === "favorite") return "最愛牌局";
    if (isPendingMode() && pendingListMode === "possible") return "可能無解局";
    return isPendingMode() ? "待破解牌局" : "玩家已解牌局";
  }
  function switchPendingList(mode) {
    if (!isPendingMode() || contributedLoading || contributedPanel.hidden || pendingListMode === mode) return;
    pendingListMode = mode;
    pendingAllTab.setAttribute("aria-pressed", String(mode === "all"));
    possibleUnsolvedTab.setAttribute("aria-pressed", String(mode === "possible"));
    void loadContributedPage(1);
  }

  function renderContributedPage(result) {
    const records = Array.isArray(result?.records) ? result.records : [];
    contributedPage = Math.max(1, Number(result?.page) || 1);
    contributedTotalPages = Math.max(1, Number(result?.totalPages) || 1);
    contributedList.innerHTML = "";

    if (!records.length) {
      const empty = document.createElement("p");
      empty.className = "contributed-empty";
      empty.textContent = contributedMode === "favorite" ? "目前還沒有最愛牌局。"
        : (isPendingMode() ? (pendingListMode === "possible" ? "你尚未標記可能無解局。" : "目前還沒有待破解牌局。") : "目前還沒有玩家已解牌局。");
      contributedList.appendChild(empty);
    } else {
      records.forEach(record => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "contributed-deal-row";

        const code = document.createElement("span");
        code.className = "contributed-code";
        code.textContent = window.KlondikeDraw3Data?.shortUid?.(record.uid) || record.uid;
        button.appendChild(code);

        const info = document.createElement("span");
        info.className = "contributed-best";
        const best = Number(record.bestSteps);
        const clears = Math.max(0, Number(record.clearCount) || 0);
        info.textContent = isPendingMode()
          ? `挑戰 ${Math.max(1, Number(record.attemptCount) || 1)} 次`
          : (best > 0 ? `最佳 ${best} 步｜破關 ${clears} 次` : `尚無步數紀錄｜破關 ${clears} 次`);
        button.appendChild(info);

        button.addEventListener("click", () => {
          if (contributedLoading) return;
          window.KlondikeDraw3Game?.abandonCurrentDeal?.();
          if (window.KlondikeDraw3Game?.startKnownGame(record)) {
            if (isPendingMode()) void window.KlondikeDraw3Data?.markPendingAttempt?.(record);
            hideDealPicker();
          }
        });
        if (isPendingMode() && pendingListMode === "all") {
          contributedList.appendChild(window.EmpirePersonalCollection.decoratePending(button, record));
        } else {
          contributedList.appendChild(button);
        }
      });
    }

    contributedPageInfo.textContent = `${contributedPage} / ${contributedTotalPages}`;
    contributedPrevButton.disabled = contributedLoading || contributedPage <= 1;
    contributedNextButton.disabled = contributedLoading || contributedPage >= contributedTotalPages;
  }

  async function loadContributedPage(page = 1) {
    if (contributedLoading) return;
    contributedLoading = true;
    contributedPrevButton.disabled = true;
    contributedNextButton.disabled = true;
    const label = currentPoolLabel();
    setPickerNotice(`正在讀取${label}…`);
    try {
      const result = contributedMode === "favorite"
        ? window.EmpirePersonalCollection.favoritePage(page)
        : (isPendingMode() && pendingListMode === "possible"
          ? window.EmpirePersonalCollection.possiblePage(page)
          : (isPendingMode()
            ? await window.KlondikeDraw3Data.listPendingPage(page, 5)
            : await window.KlondikeDraw3Data.listPage(page, 5)));
      renderContributedPage(result);
      setPickerNotice(result.totalCount > 0 ? `共有 ${result.totalCount} 副${label}。` : `目前還沒有${label}。`);
    } catch (error) {
      console.warn(`讀取 Klondike Draw 3 ${label}失敗。`, error);
      setPickerNotice(`${label}目前讀取失敗，請稍後再試。`);
    } finally {
      contributedLoading = false;
      contributedPrevButton.disabled = contributedPage <= 1;
      contributedNextButton.disabled = contributedPage >= contributedTotalPages;
    }
  }

  async function openContributedPanel(mode = "solved") {
    contributedMode = ["pending", "favorite"].includes(mode) ? mode : "solved";
    if (contributedMode === "pending") pendingListMode = "all";
    pendingAllTab.setAttribute("aria-pressed", String(pendingListMode === "all"));
    possibleUnsolvedTab.setAttribute("aria-pressed", String(pendingListMode === "possible"));
    pendingChoiceTabs.hidden = contributedMode !== "pending";
    if (contributedMode === "pending") void window.EmpirePersonalCollection?.reconcile?.();
    closeRandomChoices();
    contributedPanel.hidden = false;
    contributedPanel.setAttribute("aria-label", currentPoolLabel());
    randomContributedButton.hidden = contributedMode !== "solved";
    randomContributedButton.textContent = "從已解牌局隨機抽一局";
    uidSearchPanel.hidden = true;
    uidDealButton.setAttribute("aria-expanded", "false");
    uidInput.value = "";
    await loadContributedPage(1);
  }

  async function loadRandomSolvedDeal(poolMode = contributedMode) {
    if (contributedLoading) return;
    contributedLoading = true;
    const pending = poolMode === "pending";
    const label = pending ? "待破解牌局" : "玩家已解牌局";
    setPickerNotice(`正在從${label}隨機抽一副…`);
    try {
      const record = pending
        ? await window.KlondikeDraw3Data.randomPending()
        : await window.KlondikeDraw3Data.randomSolved();
      if (!record) {
        setPickerNotice(pending ? "目前還沒有待破解牌局。" : "目前還沒有玩家已解牌局。先解出第一副吧。");
        return;
      }
      window.KlondikeDraw3Game?.abandonCurrentDeal?.();
      if (window.KlondikeDraw3Game?.startKnownGame(record)) {
        if (pending) void window.KlondikeDraw3Data?.markPendingAttempt?.(record);
        hideDealPicker();
      }
    } catch (error) {
      console.warn(`隨機讀取 Klondike Draw 3 ${label}失敗。`, error);
      setPickerNotice(`${label}目前讀取失敗，請稍後再試。`);
    } finally {
      contributedLoading = false;
    }
  }

  async function loadDealByUid() {
    const q = String(uidInput.value || "").trim();
    if (!q) {
      setPickerNotice("貼上完整 UID 後再載入。");
      return;
    }
    setPickerNotice("正在查詢 UID…");
    const record = isPendingMode()
      ? await window.KlondikeDraw3Data.findPendingByUid(q)
      : await window.KlondikeDraw3Data.findByUid(q);
    if (!record) {
      setPickerNotice("找不到這個完整 UID。");
      return;
    }
    window.KlondikeDraw3Game?.abandonCurrentDeal?.();
    if (window.KlondikeDraw3Game?.startKnownGame(record)) {
      if (isPendingMode()) void window.KlondikeDraw3Data?.markPendingAttempt?.(record);
      hideDealPicker();
    }
  }

  function clearVictoryEffect(api, target) {
    if (!api?.clear || !target) return;
    try {
      api.clear(target);
    } catch {}
  }

  function clearVictoryParticles() {
    clearVictoryEffect(window.SlowlyConfettiBurst, victoryParticles);
    clearVictoryEffect(window.SlowlyGoldRain, victoryParticles);
    clearVictoryEffect(window.SlowlyStarExplosion, victoryParticles);
    clearVictoryEffect(window.SlowlyShockwave, victoryParticles);
    clearVictoryEffect(window.SlowlyFlashShake, victoryParticles);
    clearVictoryEffect(window.SlowlyJackpotPop, bombPlus);
    clearVictoryEffect(window.SlowlyCardRain, victoryParticles);
    clearVictoryEffect(window.SlowlyVictoryBeam, victoryParticles);
    clearVictoryEffect(window.SlowlyClassicFireworks, victoryParticles);
    if (victoryParticles) victoryParticles.innerHTML = "";
  }

  function pickVictoryEffects() {
    if (prefersReducedMotion()) return ["jackpot-pop"];

    function shuffledPool() {
      const pool = VICTORY_EFFECTS.slice();
      for (let index = pool.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
      }
      return pool;
    }

    function visualDifference(leftList, rightList) {
      const left = new Set(leftList);
      const right = new Set(rightList);
      let changed = 0;
      VICTORY_EFFECTS.forEach(name => {
        if (left.has(name) !== right.has(name)) changed += 1;
      });
      return changed;
    }

    let selected = [];
    let signature = "";

    for (let attempt = 0; attempt < 40; attempt += 1) {
      const pool = shuffledPool();
      const count = 4 + Math.floor(Math.random() * 3);
      const candidate = pool.slice(0, count);
      const candidateSignature = candidate.slice().sort().join("|");

      if (
        candidateSignature !== lastVictoryEffectSignature &&
        (lastVictoryEffects.length === 0 || visualDifference(candidate, lastVictoryEffects) >= 4)
      ) {
        selected = candidate;
        signature = candidateSignature;
        break;
      }
    }

    if (selected.length === 0) {
      selected = shuffledPool().slice(0, 4);
      signature = selected.slice().sort().join("|");
    }

    lastVictoryEffectSignature = signature;
    lastVictoryEffects = selected.slice();

    try {
      localStorage.setItem(LAST_VICTORY_EFFECTS_STORAGE_KEY, JSON.stringify(lastVictoryEffects));
    } catch {}

    return selected;
  }

  function playVictoryEffect(api, target, options) {
    if (!api?.play || !target) return;
    void api.play(target, options).catch(error => {
      console.warn("[Klondike Draw 3] 勝利特效播放失敗：", error);
    });
  }

  function activateVictoryEffects(selectedEffects) {
    clearVictoryParticles();

    if (selectedEffects.includes("confetti")) {
      playVictoryEffect(window.SlowlyConfettiBurst, victoryParticles);
    }
    if (selectedEffects.includes("gold-rain")) {
      playVictoryEffect(window.SlowlyGoldRain, victoryParticles);
    }
    if (selectedEffects.includes("stars")) {
      playVictoryEffect(window.SlowlyStarExplosion, victoryParticles);
    }
    if (selectedEffects.includes("shockwave")) {
      playVictoryEffect(window.SlowlyShockwave, victoryParticles);
    }
    if (selectedEffects.includes("flash-shake")) {
      playVictoryEffect(window.SlowlyFlashShake, victoryParticles, { shakeTarget: gameShell });
    }
    if (selectedEffects.includes("jackpot-pop")) {
      playVictoryEffect(window.SlowlyJackpotPop, bombPlus);
    }
    if (selectedEffects.includes("card-rain")) {
      playVictoryEffect(window.SlowlyCardRain, victoryParticles, { items: VICTORY_CARD_RAIN_ITEMS });
    }
    if (selectedEffects.includes("victory-beam")) {
      playVictoryEffect(window.SlowlyVictoryBeam, victoryParticles);
    }
    if (selectedEffects.includes("classic-fireworks")) {
      playVictoryEffect(window.SlowlyClassicFireworks, victoryParticles);
    }
  }

  function flashCompletedArea() {
    completedArea.classList.remove("victory-flash");
    void completedArea.offsetWidth;
    completedArea.classList.add("victory-flash");
  }

  async function playVictory(result = {}) {
    const reduced = prefersReducedMotion();
    const selectedEffects = pickVictoryEffects();

    bombText.textContent = "牌局完成";
    bombPlus.textContent = "CLEAR";
    bombSubtext.textContent = result?.isNew ? "玩家已解牌局 +1" : "已完成玩家已解牌局";

    bombText.classList.remove("slowly-shine-text");
    void bombText.offsetWidth;
    bombText.classList.add("slowly-shine-text");

    flashCompletedArea();
    activateVictoryEffects(selectedEffects);

    bombOverlay.setAttribute("aria-hidden", "false");
    bombOverlay.classList.add("is-active");

    await sleep(reduced ? 220 : 1780);

    bombOverlay.classList.remove("is-active");
    await sleep(reduced ? 60 : 380);
    bombOverlay.setAttribute("aria-hidden", "true");
    completedArea.classList.remove("victory-flash");
    clearVictoryParticles();
  }

  function showWinMessage(steps, result = {}) {
    messageTitle.textContent = result?.isNew ? "恭喜玩家貢獻可解牌局 +1" : "牌局完成";
    messageText.textContent = `完成！共用了 ${steps} 步。`;

    const best = Number(result?.bestSteps);
    messageBest.hidden = !(best > 0);
    messageBest.textContent = best > 0
      ? (steps <= best ? `本局 ${steps} 步｜最佳紀錄 ${best} 步` : `本局 ${steps} 步｜最佳紀錄 ${best} 步`)
      : "";

    const clears = Math.max(0, Number(result?.clearCount) || 0);
    messageClears.hidden = !(clears > 0);
    messageClears.textContent = clears > 0 ? `這副牌已成功破關 ${clears} 次` : "";

    const uid = String(result?.uid || "");
    messageUidRow.hidden = !uid;
    messageUid.textContent = uid ? (window.KlondikeDraw3Data?.shortUid?.(uid) || uid) : "";
    messageCopyUidButton.dataset.uid = uid;
    message.hidden = false;
  }

  restartButton.addEventListener("click", () => {
    if (window.KlondikeDraw3Game?.isBusy()) return;
    restartConfirm.hidden = false;
  });

  restartCancelButton.addEventListener("click", () => {
    restartConfirm.hidden = true;
  });

  restartCurrentButton.addEventListener("click", () => {
    if (window.KlondikeDraw3Game?.restartCurrentDeal()) {
      restartConfirm.hidden = true;
    }
  });

  restartConfirmButton.addEventListener("click", () => {
    restartConfirm.hidden = true;
    showDealPicker({ canReturn: true });
  });

  randomDealButton.addEventListener("click", toggleRandomChoices);
  randomNewDealButton.addEventListener("click", () => {
    if (window.KlondikeDraw3Game?.isBusy()) return;
    try {
      window.KlondikeDraw3Game?.abandonCurrentDeal?.();
      window.KlondikeDraw3Game?.startRandomGame();
      hideDealPicker();
    } catch (error) {
      console.error(error);
      setPickerNotice(error?.message || "無法開始牌局。");
    }
  });

  randomPendingDealButton.addEventListener("click", () => void loadRandomSolvedDeal("pending"));
  solvedDealButton.addEventListener("click", () => void openContributedPanel("solved"));
  pendingDealButton.addEventListener("click", () => void openContributedPanel("pending"));
  pendingAllTab.addEventListener("click", () => switchPendingList("all"));
  possibleUnsolvedTab.addEventListener("click", () => switchPendingList("possible"));
  document.getElementById("favoriteDealButton").addEventListener("click", () => void openContributedPanel("favorite"));
  randomContributedButton.addEventListener("click", () => void loadRandomSolvedDeal());
  contributedPrevButton.addEventListener("click", () => {
    if (contributedPage > 1) void loadContributedPage(contributedPage - 1);
  });
  contributedNextButton.addEventListener("click", () => {
    if (contributedPage < contributedTotalPages) void loadContributedPage(contributedPage + 1);
  });

  uidDealButton.addEventListener("click", toggleUidSearch);
  uidSearchButton.addEventListener("click", () => void loadDealByUid());
  uidInput.addEventListener("keydown", event => {
    if (event.key === "Enter") void loadDealByUid();
  });

  dealPickerBackButton.addEventListener("click", hideDealPicker);
  messageCopyUidButton.addEventListener("click", () => {
    void window.KlondikeDraw3Data?.copyUid?.(messageCopyUidButton.dataset.uid, messageCopyUidButton);
  });

  playAgainButton.addEventListener("click", () => {
    message.hidden = true;
    showDealPicker({ canReturn: false });
  });

  window.KlondikeDraw3UI = Object.freeze({
    playVictory,
    showWinMessage,
    showDealPicker
  });

  window.EmpirePersonalCollection = window.EmpirePersonalDeals.create({
    mode: "klondike_draw3",
    getCurrent: () => window.KlondikeDraw3Game?.getCurrentDealRecord?.(),
    shortUid: uid => window.KlondikeDraw3Data?.shortUid?.(uid) || uid,
    findSolved: async record => {
      const db = window.KlondikeDraw3SolvedDealsDB;
      if (!db?.findByUid) return false;
      return Boolean((await db.findByUid(record.uid)) || (await db.findByDeal?.(record.deal)));
    },
    onUpdated: (message, changed) => {
      setPickerNotice(message);
      if (!contributedPanel.hidden && isPendingMode() && !contributedLoading) void loadContributedPage(contributedPage);
    }
  });

  void window.KlondikeDraw3Data?.initialize?.();

  // 秘藏之谷指定 UID 載入：從本機已保存牌組開局，保留原資料庫機制。
  function launchCollectionRequest() {
    const params = new URLSearchParams(window.location.search);
    const uid = params.get("collectionUid");
    const kind = params.get("collectionKind");
    if (!uid || !["favorite", "possible"].includes(kind)) return false;
    const key = window.EmpireCollectionKeys?.["klondike_draw3"]?.[kind];
    if (!key) return false;
    let record = null;
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "[]");
      record = Array.isArray(saved) ? saved.find(item => item?.uid === uid &&
        Array.isArray(item.deal) && item.deal.length === 52) : null;
    } catch (error) { console.warn("讀取指定館藏失敗。", error); }
    if (!record) {
      showDealPicker({ canReturn: false });
      setPickerNotice("找不到個人館藏牌局，請回館藏重新選擇。");
      return true;
    }
    window.KlondikeDraw3Game?.abandonCurrentDeal?.();
    if (window.KlondikeDraw3Game?.startKnownGame?.({
      ...record,
      bestSteps: kind === "favorite" ? record.bestSteps : null,
      clearCount: kind === "favorite" ? record.clearCount : 0
    })) {
      if (kind === "possible") void window.KlondikeDraw3Data?.markPendingAttempt?.(record);
      hideDealPicker();
      window.EmpirePersonalCollection?.sync?.();
    } else {
      showDealPicker({ canReturn: false });
      setPickerNotice("指定館藏牌局載入失敗。");
    }
    return true;
  }

  if (!launchCollectionRequest() && !window.KlondikeDraw3Game?.hasGame()) {
    showDealPicker({ canReturn: false });
  }
})();
