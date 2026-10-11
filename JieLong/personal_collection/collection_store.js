(() => {
  "use strict";

  const KEYS = Object.freeze({
    favorite: "freecell_favorite_deals_v1",
    microsoft: "freecell_microsoft_favorites_v1",
    microsoftSolved: "freecell_microsoft_solved_v1",
    possible: "freecell_possible_unsolvable_deals_v1",
    pending: "freecell_pending_deals_v1"
  });
  const hiddenNumbers = new Set([-1, -2, -3, -4]);
  const suits = new Set(["spade", "heart", "diamond", "club"]);

  function readArray(key) {
    let value;
    try { value = JSON.parse(localStorage.getItem(key) || "[]"); }
    catch { throw new Error(`本機館藏「${key}」資料無法解析。`); }
    if (!Array.isArray(value)) throw new Error(`本機館藏「${key}」不是有效清單。`);
    return value;
  }

  function validDeal(deal) {
    return Array.isArray(deal) && deal.length === 52 && deal.every(card =>
      Number.isInteger(Number(card?.rank)) && Number(card.rank) >= 1 && Number(card.rank) <= 13 && suits.has(String(card?.suit)));
  }

  function shortUid(uid) {
    const raw = String(uid || "").replace(/^freecell-/i, "").replace(/[^a-z0-9]/gi, "").toUpperCase();
    return raw ? `F-${raw.slice(0, 8)}` : "F-────────";
  }

  function normalizeNumber(value) {
    // 百萬牌局 1–1,000,000；保留 -1 至 -4 的隱藏牌局。
    if (typeof value !== "number" && (typeof value !== "string" || !/^-?\d+$/.test(value.trim()))) return null;
    const number = Number(value);
    return Number.isSafeInteger(number) && (hiddenNumbers.has(number) || (number >= 1 && number <= 1000000)) ? number : null;
  }

  function readFavorites() {
    return readArray(KEYS.favorite).filter(item => typeof item?.uid === "string" && item.uid && validDeal(item.deal))
      .map(item => ({ uid: item.uid, bestSteps: Number(item.bestSteps) > 0 ? Number(item.bestSteps) : null,
        clearCount: Math.max(0, Number(item.clearCount) || 0), kind: "favorite", mode: "freecell" }));
  }

  function readMicrosoftFavorites() {
    const solved = new Map(readArray(KEYS.microsoftSolved).map(item => [normalizeNumber(item?.dealNumber), item]));
    const seen = new Set();
    return readArray(KEYS.microsoft).map(normalizeNumber).filter(number => {
      if (number === null || seen.has(number)) return false;
      seen.add(number);
      return true;
    }).map(number => {
      const score = solved.get(number);
      return { dealNumber: number, bestSteps: Number(score?.bestSteps) > 0 ? Number(score.bestSteps) : null,
        clearCount: Math.max(0, Number(score?.clearCount) || 0), kind: "favorite", mode: "microsoft" };
    });
  }

  function readPossible() {
    const attempts = new Map(readArray(KEYS.pending).filter(item => typeof item?.uid === "string")
      .map(item => [item.uid, Math.max(1, Number(item.attemptCount) || 1)]));
    const seen = new Set();
    return readArray(KEYS.possible).filter(item => {
      if (typeof item?.uid !== "string" || !item.uid || !validDeal(item.deal) || seen.has(item.uid)) return false;
      seen.add(item.uid);
      return true;
    }).map(item => ({ uid: item.uid, attemptCount: Math.max(1, Number(item.attemptCount) || 1, attempts.get(item.uid) || 1),
      markedAt: Number(item.markedAt) || 0, kind: "possible", mode: "freecell" }))
      .sort((a, b) => b.markedAt - a.markedAt);
  }

  function paginate(records, page) {
    if (!window.FictionPaginate?.paginate) throw new Error("慢慢軍火庫 FictionPaginate 載入失敗。");
    const result = window.FictionPaginate.paginate(records, { page, pageSize: 20 });
    return { ...result, records: records.slice(result.startIndex, result.endIndex + 1) };
  }

  function launch(record) {
    if (window.parent !== window) {
      window.parent.postMessage({ type: "slowly-trove-launch", kind: record.kind, mode: record.mode,
        uid: record.uid || null, dealNumber: record.dealNumber ?? null }, window.location.origin);
      return;
    }
    // 獨立開啟館藏頁時，直接用遊戲本身的指定開局網址。
    const target = record.mode === "microsoft" ? "../../../freecell/microsoft/microsoft.html" : "../../../freecell/freecell.html";
    const url = new URL(target, window.location.href);
    if (record.mode === "microsoft") url.searchParams.set("deal", String(record.dealNumber));
    else {
      url.searchParams.set("collectionUid", record.uid);
      url.searchParams.set("collectionKind", record.kind);
    }
    window.location.assign(url.href);
  }

  window.TroveCollection = Object.freeze({ readFavorites, readMicrosoftFavorites, readPossible, paginate, launch, shortUid });
})();
