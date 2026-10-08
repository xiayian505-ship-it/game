(() => {
  "use strict";

  const STORAGE_KEY = "freecell_microsoft_solved_v1";
  const MIN_DEAL = 1;
  const MAX_DEAL = 1000000;
  const HIDDEN_DEALS = Object.freeze([-1, -2, -3, -4]);

  function normalizeDealNumber(value) {
    const number = Math.trunc(Number(value));
    if (!Number.isInteger(number)) return null;
    if (HIDDEN_DEALS.includes(number)) return number;
    return number >= MIN_DEAL && number <= MAX_DEAL ? number : null;
  }

  function readRecords() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(record => {
          const dealNumber = normalizeDealNumber(record?.dealNumber);
          if (!dealNumber) return null;
          return {
            dealNumber,
            bestSteps: Number.isInteger(Number(record?.bestSteps)) && Number(record.bestSteps) > 0 ? Number(record.bestSteps) : null,
            clearCount: Math.max(0, Math.trunc(Number(record?.clearCount)) || 0),
            solvedAt: String(record?.solvedAt || "")
          };
        })
        .filter(Boolean)
        .sort((a, b) => (b.solvedAt || "").localeCompare(a.solvedAt || ""));
    } catch {
      return [];
    }
  }

  function writeRecords(records) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  function uidFor(dealNumber) {
    return `microsoft-deal-${dealNumber}`;
  }

  function numberFromUid(uid) {
    const match = String(uid || "").match(/^microsoft-deal-(-?\d+)$/);
    return match ? normalizeDealNumber(match[1]) : null;
  }

  function shortUid(uid) {
    const number = numberFromUid(uid);
    return number ? `#${number}` : String(uid || "");
  }

  function findByNumber(dealNumber) {
    const number = normalizeDealNumber(dealNumber);
    if (!number) return null;
    return readRecords().find(record => record.dealNumber === number) || null;
  }

  function count() {
    return readRecords().length;
  }

  function listPage(page = 1, pageSize = 5) {
    const records = readRecords();
    const size = Math.max(1, Math.trunc(Number(pageSize)) || 5);
    const totalCount = records.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / size));
    const currentPage = Math.min(Math.max(1, Math.trunc(Number(page)) || 1), totalPages);
    const start = (currentPage - 1) * size;
    return {
      records: records.slice(start, start + size),
      page: currentPage,
      pageSize: size,
      totalCount,
      totalPages
    };
  }

  function randomSolved() {
    const records = readRecords();
    if (!records.length) return null;
    return records[Math.floor(Math.random() * records.length)] || null;
  }

  async function handleWin({ steps, uid }) {
    const dealNumber = numberFromUid(uid);
    if (!dealNumber) {
      return { uid: uid || null, bestSteps: null, clearCount: 0, totalCount: count(), isNew: false };
    }

    const records = readRecords();
    const index = records.findIndex(record => record.dealNumber === dealNumber);
    const moveSteps = Math.max(1, Math.trunc(Number(steps)) || 1);
    const now = new Date().toISOString();
    let isNew = false;

    if (index >= 0) {
      const current = records[index];
      current.bestSteps = current.bestSteps ? Math.min(current.bestSteps, moveSteps) : moveSteps;
      current.clearCount = Math.max(0, current.clearCount) + 1;
      current.solvedAt = now;
      records.splice(index, 1);
      records.unshift(current);
    } else {
      records.unshift({ dealNumber, bestSteps: moveSteps, clearCount: 1, solvedAt: now });
      isNew = true;
    }

    writeRecords(records);
    const record = records[0];
    return {
      uid: uidFor(dealNumber),
      bestSteps: record.bestSteps,
      clearCount: record.clearCount,
      totalCount: records.length,
      isNew
    };
  }

  async function initialize() {
    window.FreeCellGame?.setSolvedDealCount?.(count());
    return count();
  }

  async function copyUid(uid, button) {
    const text = shortUid(uid);
    try {
      await navigator.clipboard.writeText(text);
      if (button) {
        const before = button.textContent;
        button.textContent = "已複製";
        window.setTimeout(() => { button.textContent = before; }, 900);
      }
      return true;
    } catch {
      return false;
    }
  }

  window.MicrosoftFreeCellLocal = Object.freeze({
    minDeal: MIN_DEAL,
    maxDeal: MAX_DEAL,
    hiddenDeals: HIDDEN_DEALS.slice(),
    normalizeDealNumber,
    uidFor,
    numberFromUid,
    findByNumber,
    count,
    listPage,
    randomSolved
  });

  window.FreeCellData = Object.freeze({
    shortUid,
    handleWin,
    initialize,
    copyUid
  });
})();
