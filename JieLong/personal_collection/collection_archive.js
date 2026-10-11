(() => {
  "use strict";
  // 秘藏之谷｜讀取秩序／傳說兩城在遊戲內建立的本機收藏及個人標記。
  // 任何資料變更仍由遊戲端執行；館藏頁不自行改寫 Key。
  const modes = Object.freeze({
    spider_easy: { path: "spider/easy/spider_easy.html", prefix: "E", uidPrefix: "spider-", length: 104, easy: true, pending: "spider_pending_deals_v1" },
    spider_medium: { path: "spider/medium/spider_medium.html", prefix: "M", uidPrefix: "spider-medium-", length: 104, suits: ["spade", "heart"], pending: "spider_medium_pending_deals_v1" },
    spider_hard: { path: "spider/hard/spider_hard.html", prefix: "H", uidPrefix: "spider-hard-", length: 104, suits: ["spade", "heart", "diamond", "club"], pending: "spider_hard_pending_deals_v1" },
    klondike_draw1: { path: "klondike/draw1/klondike_1.html", prefix: "K1", uidPrefix: "klondike-draw1-", length: 52, suits: ["spade", "heart", "diamond", "club"], pending: "klondike_draw1_pending_deals_v1" },
    klondike_draw3: { path: "klondike/draw3/klondike_3.html", prefix: "K3", uidPrefix: "klondike-draw3-", length: 52, suits: ["spade", "heart", "diamond", "club"], pending: "klondike_draw3_pending_deals_v1" }
  });
  function definition(mode) { return modes[mode] || null; }
  function validDeal(mode, deal) {
    const spec = definition(mode);
    if (!spec || !Array.isArray(deal) || deal.length !== spec.length) return false;
    return deal.every(card => {
      const rank = Number(spec.easy ? card : card?.rank);
      return Number.isInteger(rank) && rank >= 1 && rank <= 13 &&
        (spec.easy || spec.suits.includes(String(card?.suit)));
    });
  }
  function readArray(key) {
    let parsed;
    try { parsed = JSON.parse(localStorage.getItem(key) || "[]"); }
    catch { throw new Error(`本機館藏「${key}」的資料格式無法解析。`); }
    if (!Array.isArray(parsed)) throw new Error(`本機館藏「${key}」不是有效清單。`);
    return parsed;
  }
  function findRecord(mode, kind, uid) {
    const key = window.EmpireCollectionKeys?.[mode]?.[kind];
    if (!key || typeof uid !== "string" || !uid) return null;
    return readArray(key).find(record => record?.uid === uid && validDeal(mode, record.deal)) || null;
  }
  function records(mode, kind) {
    if (!definition(mode) || !["favorite", "possible"].includes(kind)) throw new Error("館藏分類無效。");
    const key = window.EmpireCollectionKeys?.[mode]?.[kind];
    if (!key) throw new Error("館藏 Key 尚未定義。");
    const seen = new Set();
    const attempts = kind === "possible" ? new Map(readArray(definition(mode).pending)
      .filter(item => typeof item?.uid === "string")
      .map(item => [item.uid, Math.max(1, Number(item.attemptCount) || 1)])) : null;
    const result = readArray(key).filter(record => {
      if (typeof record?.uid !== "string" || !record.uid || !validDeal(mode, record.deal) || seen.has(record.uid)) return false;
      seen.add(record.uid);
      return true;
    }).map(record => ({
      mode, kind, uid: record.uid,
      bestSteps: Number(record.bestSteps) > 0 ? Number(record.bestSteps) : null,
      clearCount: Math.max(0, Number(record.clearCount) || 0),
      attemptCount: Math.max(1, Number(record.attemptCount) || 1, attempts?.get(record.uid) || 1),
      markedAt: Number(record.markedAt) || 0
    }));
    if (kind === "possible") result.sort((a, b) => b.markedAt - a.markedAt);
    return result;
  }
  function shortUid(mode, uid) {
    const spec = definition(mode);
    if (!spec) return String(uid || "");
    const raw = String(uid || "").replace(new RegExp(`^${spec.uidPrefix}`, "i"), "")
      .replace(/[^a-z0-9]/gi, "").toUpperCase();
    return raw ? `${spec.prefix}-${raw.slice(0, 8)}` : `${spec.prefix}-────────`;
  }
  function paginate(rows, page) {
    if (!window.FictionPaginate?.paginate) throw new Error("慢慢軍火庫 FictionPaginate 載入失敗。");
    const result = window.FictionPaginate.paginate(rows, { page, pageSize: 20 });
    return { ...result, records: rows.slice(result.startIndex, result.endIndex + 1) };
  }
  function launch(record) {
    const {mode, kind, uid} = record || {};
    const spec = definition(mode);
    if (!spec || !["favorite", "possible"].includes(kind) || !findRecord(mode, kind, uid)) return false;
    if (window.parent !== window) {
      window.parent.postMessage({ type: "slowly-trove-launch", mode, kind, uid }, window.location.origin);
    } else {
      // 直接開啟第三層頁面時也能從自己的網頁切換到指定牌局。
      const url = new URL(`../../../${spec.path}`, window.location.href);
      url.searchParams.set("collectionUid", uid);
      url.searchParams.set("collectionKind", kind);
      window.location.assign(url.href);
    }
    return true;
  }
  window.TroveGameArchive = Object.freeze({ modes, records, findRecord, validDeal, shortUid, paginate, launch });
})();
