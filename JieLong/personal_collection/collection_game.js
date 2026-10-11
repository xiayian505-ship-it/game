(() => {
  "use strict";
  // 帝國內五種玩法共用的「個人本機館藏」管理；不更動軍火庫函式與資料庫表。
  function create({ mode, getCurrent, startRecord, findSolved, shortUid, onUpdated }) {
    const entry = window.EmpireCollectionKeys?.[mode];
    if (!entry) throw new Error(`找不到 ${mode} 的個人館藏儲存 Key。`);
    const favoriteButton = document.getElementById("favoriteDealToggle");
    const dialog = document.getElementById("possibleMarkConfirm");
    const description = document.getElementById("possibleMarkDescription");
    const cancelButton = document.getElementById("possibleMarkCancel");
    const acceptButton = document.getElementById("possibleMarkAccept");
    let control = null;
    let target = null;
    let opener = null;
    let reconcilePromise = null;
    let previousIdentity = "";
    const pageSize = 4;
    const isEasy = mode === "spider_easy";
    const length = mode.startsWith("spider_") ? 104 : 52;
    const allowedSuits = mode === "spider_medium" ? ["spade", "heart"] : ["spade", "heart", "club", "diamond"];

    function dealKey(deal) {
      if (!Array.isArray(deal) || deal.length !== length) return "";
      const normalized = [];
      for (const card of deal) {
        const rank = Number(isEasy ? card : card?.rank);
        if (!Number.isInteger(rank) || rank < 1 || rank > 13) return "";
        if (isEasy) normalized.push(rank);
        else {
          const suit = String(card?.suit || "");
          if (!allowedSuits.includes(suit)) return "";
          normalized.push([rank, suit]);
        }
      }
      return JSON.stringify(normalized);
    }
    function cloneDeal(deal) {
      return isEasy ? deal.map(Number) : deal.map(card => ({rank: Number(card.rank), suit: String(card.suit)}));
    }
    function read(key) {
      try {
        const value = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(value) ? value.filter(item => typeof item?.uid === "string" && item.uid && dealKey(item.deal)) : [];
      } catch (error) {
        console.warn("本機館藏資料無法讀取，未覆蓋原有紀錄。", error);
        return [];
      }
    }
    function write(key, records) {
      try {
        localStorage.setItem(key, JSON.stringify(records));
        return true;
      } catch (error) {
        console.warn("個人館藏本機儲存失敗。", error);
        return false;
      }
    }
    function same(a, b) {
      if (a.uid && a.uid === b.uid) return true;
      const key = dealKey(a.deal);
      return Boolean(key && key === dealKey(b.deal));
    }
    function favorites() { return read(entry.favorite); }
    function possible() { return read(entry.possible).sort((a, b) => (Number(b.markedAt) || 0) - (Number(a.markedAt) || 0)); }
    function isFavorite(record) { return favorites().some(item => same(item, record)); }
    function isMarked(record) { return possible().some(item => same(item, record)); }
    function saveFavorite(record) {
      if (!record?.uid || !dealKey(record.deal)) return false;
      const existing = favorites();
      const prior = existing.find(item => same(item, record));
      const next = existing.filter(item => !same(item, record));
      next.unshift({ uid: record.uid, deal: cloneDeal(record.deal),
        bestSteps: Number(record.bestSteps) > 0 ? Number(record.bestSteps) : null,
        clearCount: Math.max(0, Number(record.clearCount) || 0), addedAt: prior?.addedAt || Date.now() });
      return write(entry.favorite, next);
    }
    function removeFavorite(record) {
      const before = favorites();
      return write(entry.favorite, before.filter(item => !same(item, record)));
    }
    function sync() {
      if (!favoriteButton) return;
      const record = getCurrent?.();
      const valid = Boolean(record?.uid && dealKey(record.deal));
      favoriteButton.hidden = !valid;
      if (!valid) { previousIdentity = ""; return; }
      const identity = `${record.uid}|${dealKey(record.deal)}`;
      if (identity === previousIdentity) return;
      previousIdentity = identity;
      const match = favorites().find(item => same(item, record));
      if (match && match.uid !== record.uid) saveFavorite(record); // 與已解牌局 canonical UID 同步
      favoriteButton.dataset.favoriteId = record.uid;
      control?.set(Boolean(match), { silent: true });
    }
    if (favoriteButton && window.SlowlyFavorite?.create) {
      control = window.SlowlyFavorite.create(favoriteButton, {
        inactiveLabel: "☆", activeLabel: "★",
        render({element, active}) { element.textContent = active ? "★" : "☆"; },
        onChange({active}) {
          const record = getCurrent?.();
          const ok = record && (active ? saveFavorite(record) : removeFavorite(record));
          if (!ok) control?.set(!active, { silent: true });
        }
      });
    }
    function removeSolved(uid, deal) {
      const before = possible();
      const probe = {uid, deal};
      const next = before.filter(item => !same(item, probe));
      return next.length !== before.length && write(entry.possible, next);
    }
    function closeDialog() {
      dialog.hidden = true;
      target = null;
      opener?.focus?.();
      opener = null;
    }
    function requestMark(record, button) {
      if (!record?.uid || !dealKey(record.deal) || isMarked(record)) return;
      target = record;
      opener = button;
      description.textContent = `要將 ${shortUid(record.uid)} 標記為「可能無解」嗎？`;
      dialog.hidden = false;
      cancelButton.focus();
    }
    function confirmMark() {
      const record = target;
      if (!record || isMarked(record)) { closeDialog(); return; }
      const next = possible();
      next.push({uid: record.uid, deal: cloneDeal(record.deal),
        attemptCount: Math.max(1, Number(record.attemptCount) || 1), markedAt: Date.now() });
      const ok = write(entry.possible, next);
      closeDialog();
      if (ok) { onUpdated?.("已標記為個人可能無解局；不可手動取消，破解後才會移除。"); void reconcile(); }
      else onUpdated?.("本機標記失敗，請確認瀏覽器儲存權限。");
    }
    cancelButton?.addEventListener("click", closeDialog);
    acceptButton?.addEventListener("click", confirmMark);
    dialog?.addEventListener("keydown", event => {
      if (event.key === "Escape") { event.preventDefault(); closeDialog(); }
      if (event.key === "Tab") {
        const end = event.shiftKey ? cancelButton : acceptButton;
        if (document.activeElement === end) {
          event.preventDefault();
          (event.shiftKey ? acceptButton : cancelButton).focus();
        }
      }
    });
    function decoratePending(button, record) {
      const wrapper = document.createElement("div");
      wrapper.className = "pending-row-wrap";
      button.classList.add("pending-play-button");
      const details = button.querySelector(".contributed-best");
      const attempts = document.createElement("button");
      attempts.type = "button";
      attempts.className = "pending-attempt-button";
      attempts.textContent = (details?.textContent || `挑戰 ${Math.max(1, Number(record.attemptCount) || 1)} 次`) + " ›";
      attempts.addEventListener("click", () => button.click());
      details?.remove();
      const flag = document.createElement("button");
      flag.type = "button";
      flag.className = "pending-flag-button";
      const marked = isMarked(record);
      flag.textContent = marked ? "⚑" : "⚐";
      flag.disabled = marked;
      flag.classList.toggle("is-marked", marked);
      flag.setAttribute("aria-label", marked ? "已標記可能無解（不可取消）" : `標記 ${shortUid(record.uid)} 可能無解`);
      flag.title = marked ? "已標記可能無解（不可取消）" : "標記可能無解";
      flag.addEventListener("click", () => requestMark(record, flag));
      wrapper.append(button, flag, attempts);
      return wrapper;
    }
    function paginate(records, page) {
      const totalCount = records.length;
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
      const safe = Math.min(Math.max(1, Math.trunc(Number(page)) || 1), totalPages);
      return {records: records.slice((safe - 1) * pageSize, safe * pageSize),
        totalCount, totalPages, page: safe};
    }
    async function reconcile() {
      if (reconcilePromise) return reconcilePromise;
      const marks = possible();
      if (!marks.length || !findSolved) return;
      reconcilePromise = (async () => {
        let changed = false;
        for (let start = 0; start < marks.length; start += 4) {
          await Promise.all(marks.slice(start, start + 4).map(async record => {
            try {
              if (await findSolved(record)) changed = removeSolved(record.uid, record.deal) || changed;
            } catch (error) { console.warn("比對已解牌局失敗，保留個人標記。", error); }
          }));
        }
        if (changed) onUpdated?.("已同步已解牌局，自動清除已破解的標記。", true);
      })().finally(() => { reconcilePromise = null; });
      return reconcilePromise;
    }
    function onWin(uid, deal, bestSteps, clearCount) {
      removeSolved(uid, deal);
      const match = favorites().find(item => same(item, {uid, deal}));
      if (match) saveFavorite({uid, deal, bestSteps, clearCount});
      previousIdentity = "";
      sync();
    }
    window.addEventListener("focus", () => { void reconcile(); });
    window.addEventListener("pageshow", () => { previousIdentity = ""; sync(); void reconcile(); });
    sync();
    void reconcile();
    return Object.freeze({sync, favorites, possible, favoritePage: page => paginate(favorites(), page),
      possiblePage: page => paginate(possible(), page), decoratePending, reconcile, onWin, startRecord});
  }
  window.EmpirePersonalDeals = Object.freeze({create});
})();
