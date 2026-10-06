(() => {
  "use strict";

  const SUPABASE_URL = "https://bkjqaetxwvcdciieevvs.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_dAHoIimWgbGAF2wtIVSZfg_V8rzc200";
  const TABLE = "klondike_draw1_solved_deals";
  const SUITS = new Set(["spade", "heart", "diamond", "club"]);

  function normalizeDeal(deal) {
    if (!Array.isArray(deal) || deal.length !== 52) return null;

    const normalized = deal.map(card => {
      const rank = Number(card?.rank);
      const suit = String(card?.suit || "");
      if (!Number.isInteger(rank) || rank < 1 || rank > 13) return null;
      if (!SUITS.has(suit)) return null;
      return { rank, suit };
    });

    return normalized.every(Boolean) ? normalized : null;
  }

  function normalizeRecord(row) {
    const deal = normalizeDeal(row?.deal);
    if (!row || typeof row.uid !== "string" || !deal) return null;

    return {
      uid: row.uid,
      deal,
      solvedAt: row.client_solved_at || row.solved_at || "",
      bestSteps: Number.isInteger(Number(row.best_steps)) && Number(row.best_steps) > 0
        ? Number(row.best_steps)
        : null,
      clearCount: Number.isInteger(Number(row.clear_count)) && Number(row.clear_count) >= 0
        ? Number(row.clear_count)
        : 0
    };
  }

  function dealKey(deal) {
    const normalized = normalizeDeal(deal);
    return normalized
      ? normalized.map(card => `${card.rank}:${card.suit}`).join("|")
      : "";
  }

  function createClient() {
    if (!window.supabase?.createClient) return null;
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
  }

  const client = createClient();
  const SELECT_FIELDS = "uid,deal,client_solved_at,solved_at,best_steps,clear_count";

  async function listPage(page = 1, pageSize = 5) {
    if (!client) throw new Error("Supabase client 尚未載入。");

    const size = Math.min(50, Math.max(1, Math.trunc(Number(pageSize)) || 5));
    const requestedPage = Math.max(1, Math.trunc(Number(page)) || 1);
    const from = (requestedPage - 1) * size;
    const to = from + size - 1;

    const { data, error, count: total } = await client
      .from(TABLE)
      .select(SELECT_FIELDS, { count: "exact" })
      .order("solved_at", { ascending: false })
      .order("uid", { ascending: true })
      .range(from, to);

    if (error) throw error;

    const totalCount = Number(total || 0);
    const totalPages = Math.max(1, Math.ceil(totalCount / size));
    return {
      records: (data || []).map(normalizeRecord).filter(Boolean),
      page: Math.min(requestedPage, totalPages),
      pageSize: size,
      totalCount,
      totalPages
    };
  }

  async function count() {
    if (!client) throw new Error("Supabase client 尚未載入。");
    const { count: total, error } = await client
      .from(TABLE)
      .select("uid", { count: "exact", head: true });
    if (error) throw error;
    return Number(total || 0);
  }

  async function random() {
    if (!client) throw new Error("Supabase client 尚未載入。");
    const total = await count();
    if (total <= 0) return null;

    const offset = Math.floor(Math.random() * total);
    const { data, error } = await client
      .from(TABLE)
      .select(SELECT_FIELDS)
      .order("solved_at", { ascending: false })
      .order("uid", { ascending: true })
      .range(offset, offset);

    if (error) throw error;
    return normalizeRecord((data || [])[0]);
  }

  async function findByUid(uid) {
    if (!client) throw new Error("Supabase client 尚未載入。");
    const q = String(uid || "").trim();
    if (!q) return null;
    const { data, error } = await client.from(TABLE).select(SELECT_FIELDS).eq("uid", q).maybeSingle();
    if (error) throw error;
    return normalizeRecord(data);
  }

  async function findByDeal(deal) {
    if (!client) throw new Error("Supabase client 尚未載入。");
    const key = dealKey(deal);
    if (!key) return null;
    const { data, error } = await client.from(TABLE).select(SELECT_FIELDS).eq("deal_key", key).maybeSingle();
    if (error) throw error;
    return normalizeRecord(data);
  }

  async function save(record) {
    if (!client) throw new Error("Supabase client 尚未載入。");
    const normalizedDeal = normalizeDeal(record?.deal);
    if (!normalizedDeal) throw new TypeError("Klondike Draw 1 DB record.deal 必須是 52 張有效牌。");

    const existing = await findByDeal(normalizedDeal);
    if (existing) return { record: existing, isNew: false };

    const payload = {
      uid: String(record.uid || ""),
      deal: normalizedDeal,
      deal_key: dealKey(normalizedDeal),
      client_solved_at: String(record.solvedAt || "") || null
    };

    const { data, error } = await client.from(TABLE).insert(payload).select(SELECT_FIELDS).single();
    if (error) {
      const raced = await findByDeal(normalizedDeal).catch(() => null);
      if (raced) return { record: raced, isNew: false };
      throw error;
    }

    return { record: normalizeRecord(data), isNew: true };
  }

  async function updateBestSteps(uid, steps) {
    if (!client) throw new Error("Supabase client 尚未載入。");
    const q = String(uid || "").trim();
    const value = Math.trunc(Number(steps));
    if (!q || !Number.isInteger(value) || value <= 0) throw new TypeError("UID 與步數格式錯誤。");

    const current = await findByUid(q);
    if (!current) return null;
    if (Number.isInteger(current.bestSteps) && current.bestSteps > 0 && current.bestSteps <= value) return current;

    const { data, error } = await client
      .from(TABLE)
      .update({ best_steps: value })
      .eq("uid", q)
      .select(SELECT_FIELDS)
      .single();
    if (error) throw error;
    return normalizeRecord(data);
  }

  async function incrementClearCount(uid) {
    if (!client) throw new Error("Supabase client 尚未載入。");
    const q = String(uid || "").trim();
    if (!q) throw new TypeError("UID 格式錯誤。");

    const { data, error } = await client.rpc("increment_klondike_draw1_clear_count", { p_uid: q });
    if (error) throw error;
    const value = Number(data);
    return { uid: q, clearCount: Number.isInteger(value) && value >= 0 ? value : 0 };
  }

  window.KlondikeDraw1SolvedDealsDB = Object.freeze({
    listPage,
    count,
    random,
    findByUid,
    findByDeal,
    save,
    updateBestSteps,
    incrementClearCount,
    dealKey
  });
})();

(() => {
  "use strict";

  const SOLVED_DEALS_STORAGE_KEY = "klondike_draw1_solved_deals_v1";
  const BEST_STEPS_STORAGE_KEY = "klondike_draw1_best_steps_v1";

  function validCard(card) {
    return card && Number.isInteger(Number(card.rank)) && Number(card.rank) >= 1 && Number(card.rank) <= 13 &&
      ["spade", "heart", "diamond", "club"].includes(String(card.suit));
  }

  function cloneDeal(deal) {
    return Array.isArray(deal) ? deal.map(card => ({ rank: Number(card.rank), suit: String(card.suit) })) : [];
  }

  function dealKeyOf(deal) {
    if (!Array.isArray(deal) || deal.length !== 52 || !deal.every(validCard)) return "";
    return deal.map(card => `${Number(card.rank)}:${String(card.suit)}`).join("|");
  }

  function shortUid(uid) {
    const raw = String(uid || "").replace(/^klondike-draw1-/i, "").replace(/[^a-z0-9]/gi, "").toUpperCase();
    return raw ? `K1-${raw.slice(0, 8)}` : "K1-────────";
  }

  function createUid() {
    if (window.RandomId?.create) return window.RandomId.create({ prefix: "klondike-draw1-" });
    return `klondike-draw1-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function readLocal() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SOLVED_DEALS_STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.filter(item => item?.uid && dealKeyOf(item.deal)) : [];
    } catch {
      return [];
    }
  }

  function writeLocal(records) {
    try {
      localStorage.setItem(SOLVED_DEALS_STORAGE_KEY, JSON.stringify(records));
      return true;
    } catch {
      return false;
    }
  }

  function saveLocal(record) {
    if (!record?.uid || !dealKeyOf(record.deal)) return false;
    const key = dealKeyOf(record.deal);
    const records = readLocal();
    const old = records.find(item => dealKeyOf(item.deal) === key) || null;
    const next = records.filter(item => dealKeyOf(item.deal) !== key);
    next.push({
      uid: record.uid,
      deal: cloneDeal(record.deal),
      solvedAt: record.solvedAt || old?.solvedAt || "",
      bestSteps: Number(record.bestSteps || old?.bestSteps) > 0 ? Number(record.bestSteps || old?.bestSteps) : null,
      clearCount: Math.max(Number(record.clearCount || 0), Number(old?.clearCount || 0))
    });
    return writeLocal(next);
  }

  function readBestMap() {
    try {
      const parsed = JSON.parse(localStorage.getItem(BEST_STEPS_STORAGE_KEY) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveBestLocal(uid, steps) {
    const value = Math.trunc(Number(steps));
    if (!uid || value <= 0) return null;
    const map = readBestMap();
    const old = Number(map[uid]);
    if (!Number.isInteger(old) || old <= 0 || value < old) {
      map[uid] = value;
      try { localStorage.setItem(BEST_STEPS_STORAGE_KEY, JSON.stringify(map)); } catch {}
      return value;
    }
    return old;
  }

  async function refreshCount() {
    let count = readLocal().length;
    try {
      if (window.KlondikeDraw1SolvedDealsDB?.count) count = await window.KlondikeDraw1SolvedDealsDB.count();
    } catch (error) {
      console.warn("讀取 Klondike Draw 1 已解牌局數量失敗，改用本機數量。", error);
    }
    window.KlondikeDraw1Game?.setSolvedDealCount?.(count);
    return count;
  }

  async function syncLocal() {
    if (!window.KlondikeDraw1SolvedDealsDB?.save) return;
    for (const record of readLocal()) {
      try {
        const result = await window.KlondikeDraw1SolvedDealsDB.save(record);
        if (result?.record) saveLocal(result.record);
      } catch (error) {
        console.warn("Klondike Draw 1 本機牌局同步失敗。", error);
        break;
      }
    }
  }

  async function initialize() {
    await refreshCount();
    await syncLocal();
    await refreshCount();
  }

  async function resolveDeal(deal) {
    const key = dealKeyOf(deal);
    if (!key) return null;
    let record = readLocal().find(item => dealKeyOf(item.deal) === key) || null;
    if (!record && window.KlondikeDraw1SolvedDealsDB?.findByDeal) {
      try {
        record = await window.KlondikeDraw1SolvedDealsDB.findByDeal(deal);
        if (record) saveLocal(record);
      } catch (error) {
        console.warn("比對 Klondike Draw 1 牌局 UID 失敗。", error);
      }
    }
    return record;
  }

  async function handleWin({ deal, steps, uid }) {
    const key = dealKeyOf(deal);
    if (!key) return { uid: null, bestSteps: Number(steps) || null, clearCount: 0, isNew: false, totalCount: await refreshCount() };

    let record = await resolveDeal(deal);
    const wasNew = !record;
    if (!record) {
      record = {
        uid: String(uid || "").trim() || createUid(),
        deal: cloneDeal(deal),
        solvedAt: window.Timestamp?.create ? window.Timestamp.create() : String(Date.now()),
        bestSteps: null,
        clearCount: 0
      };
      saveLocal(record);
    }

    if (window.KlondikeDraw1SolvedDealsDB?.save) {
      try {
        const saved = await window.KlondikeDraw1SolvedDealsDB.save(record);
        record = saved?.record || record;
        saveLocal(record);
      } catch (error) {
        console.warn("Klondike Draw 1 牌局寫入雲端失敗，已保留本機紀錄。", error);
      }
    }

    const localBest = saveBestLocal(record.uid, steps);
    let bestSteps = localBest || Number(record.bestSteps) || Number(steps);
    if (window.KlondikeDraw1SolvedDealsDB?.updateBestSteps) {
      try {
        const updated = await window.KlondikeDraw1SolvedDealsDB.updateBestSteps(record.uid, steps);
        if (Number(updated?.bestSteps) > 0) bestSteps = Math.min(bestSteps, Number(updated.bestSteps));
      } catch (error) {
        console.warn("Klondike Draw 1 最佳步數更新失敗。", error);
      }
    }

    let clearCount = Math.max(0, Number(record.clearCount) || 0) + 1;
    if (window.KlondikeDraw1SolvedDealsDB?.incrementClearCount) {
      try {
        const updated = await window.KlondikeDraw1SolvedDealsDB.incrementClearCount(record.uid);
        if (Number.isInteger(Number(updated?.clearCount))) clearCount = Number(updated.clearCount);
      } catch (error) {
        console.warn("Klondike Draw 1 破關次數更新失敗。", error);
      }
    }

    const merged = { ...record, bestSteps, clearCount };
    saveLocal(merged);
    const totalCount = await refreshCount();
    return { uid: record.uid, bestSteps, clearCount, isNew: wasNew, totalCount };
  }

  async function listPage(page = 1, pageSize = 5) {
    if (window.KlondikeDraw1SolvedDealsDB?.listPage) {
      try {
        const result = await window.KlondikeDraw1SolvedDealsDB.listPage(page, pageSize);
        (result.records || []).forEach(saveLocal);
        window.KlondikeDraw1Game?.setSolvedDealCount?.(result.totalCount || 0);
        return result;
      } catch (error) {
        console.warn("Klondike Draw 1 已解牌局分頁讀取失敗，改用本機。", error);
      }
    }

    const records = readLocal().slice().sort((a, b) => String(b.solvedAt || "").localeCompare(String(a.solvedAt || "")));
    const size = Math.max(1, Number(pageSize) || 5);
    const totalCount = records.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / size));
    const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
    return { records: records.slice((safePage - 1) * size, safePage * size), page: safePage, pageSize: size, totalCount, totalPages };
  }

  async function randomSolved() {
    if (window.KlondikeDraw1SolvedDealsDB?.random) {
      try {
        const record = await window.KlondikeDraw1SolvedDealsDB.random();
        if (record) saveLocal(record);
        return record;
      } catch (error) {
        console.warn("Klondike Draw 1 隨機已解牌局讀取失敗，改用本機。", error);
      }
    }
    const records = readLocal();
    return records.length ? records[Math.floor(Math.random() * records.length)] : null;
  }

  async function findByUid(uid) {
    const q = String(uid || "").trim();
    if (!q) return null;
    let record = readLocal().find(item => String(item.uid).toLowerCase() === q.toLowerCase()) || null;
    if (!record && window.KlondikeDraw1SolvedDealsDB?.findByUid) {
      try {
        record = await window.KlondikeDraw1SolvedDealsDB.findByUid(q);
        if (record) saveLocal(record);
      } catch (error) {
        console.warn("Klondike Draw 1 UID 查詢失敗。", error);
      }
    }
    return record;
  }

  async function copyUid(uid, button = null) {
    const value = String(uid || "").trim();
    if (!value) return false;
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        copied = true;
      }
    } catch {}
    if (!copied) {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        copied = document.execCommand("copy");
        textarea.remove();
      } catch {}
    }
    if (button) {
      const old = button.textContent;
      button.textContent = copied ? "已複製" : "複製失敗";
      setTimeout(() => { button.textContent = old; }, 1200);
    }
    return copied;
  }

  window.KlondikeDraw1Data = Object.freeze({
    initialize,
    refreshCount,
    resolveDeal,
    handleWin,
    listPage,
    randomSolved,
    findByUid,
    copyUid,
    shortUid
  });
})();
