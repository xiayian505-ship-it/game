(() => {
  "use strict";

  const SUPABASE_URL = "https://bkjqaetxwvcdciieevvs.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_dAHoIimWgbGAF2wtIVSZfg_V8rzc200";
  const TABLE = "spider_hard_solved_deals";
  const PENDING_TABLE = "spider_hard_pending_deals";

  function normalizeDeal(deal) {
    if (!Array.isArray(deal) || deal.length !== 104) return null;

    const normalized = deal.map(card => {
      const rank = Number(card?.rank);
      const suit = String(card?.suit || "");
      if (!Number.isInteger(rank) || rank < 1 || rank > 13) return null;
      if (!["spade", "heart", "diamond", "club"].includes(suit)) return null;
      return { rank, suit };
    });

    return normalized.every(Boolean) ? normalized : null;
  }

  function normalizeRecord(row) {
    const deal = normalizeDeal(row?.deal);
    if (!row || typeof row.uid !== "string" || !deal) {
      return null;
    }

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

  function normalizePendingRecord(row) {
    const deal = normalizeDeal(row?.deal);
    if (!row || typeof row.uid !== "string" || !deal) {
      return null;
    }

    return {
      uid: row.uid,
      deal,
      addedAt: row.client_added_at || row.added_at || "",
      attemptCount: Number.isInteger(Number(row.attempt_count)) && Number(row.attempt_count) >= 1
        ? Number(row.attempt_count)
        : 1
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

  const SELECT_BASE = "uid,deal,client_solved_at,solved_at";
  const SELECT_WITH_BEST = `${SELECT_BASE},best_steps,clear_count`;
  const PENDING_SELECT_FIELDS = "uid,deal,client_added_at,added_at,attempt_count";

  async function runWithBestFallback(makeQuery) {
    let result = await makeQuery(SELECT_WITH_BEST);
    if (!result.error) return result;

    const message = String(result.error?.message || "").toLowerCase();
    const missingBest = message.includes("best_steps") || message.includes("clear_count") || result.error?.code === "42703" || result.error?.code === "PGRST204";
    if (!missingBest) return result;

    return makeQuery(SELECT_BASE);
  }

  async function list() {
    if (!client) throw new Error("Supabase client 尚未載入。");

    const { data, error } = await runWithBestFallback(fields =>
      client.from(TABLE).select(fields).order("solved_at", { ascending: false })
    );

    if (error) throw error;
    return (data || []).map(normalizeRecord).filter(Boolean);
  }

  async function count() {
    if (!client) throw new Error("Supabase client 尚未載入。");

    const { count: total, error } = await client
      .from(TABLE)
      .select("uid", { count: "exact", head: true });

    if (error) throw error;
    return Number(total || 0);
  }

  async function listPage(page = 1, pageSize = 5) {
    if (!client) throw new Error("Supabase client 尚未載入。");

    const size = Math.min(50, Math.max(1, Math.trunc(Number(pageSize)) || 5));
    const requestedPage = Math.max(1, Math.trunc(Number(page)) || 1);
    const from = (requestedPage - 1) * size;
    const to = from + size - 1;

    const { data, error, count: total } = await runWithBestFallback(fields =>
      client
        .from(TABLE)
        .select(fields, { count: "exact" })
        .order("solved_at", { ascending: false })
        .order("uid", { ascending: true })
        .range(from, to)
    );

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

  async function random() {
    if (!client) throw new Error("Supabase client 尚未載入。");

    const total = await count();
    if (total <= 0) return null;

    const offset = Math.floor(Math.random() * total);
    const { data, error } = await runWithBestFallback(fields =>
      client
        .from(TABLE)
        .select(fields)
        .order("solved_at", { ascending: false })
        .order("uid", { ascending: true })
        .range(offset, offset)
    );

    if (error) throw error;
    return normalizeRecord((data || [])[0]);
  }

  async function findByUid(uid) {
    if (!client) throw new Error("Supabase client 尚未載入。");

    const q = String(uid || "").trim();
    if (!q) return null;

    const { data, error } = await runWithBestFallback(fields =>
      client.from(TABLE).select(fields).eq("uid", q).maybeSingle()
    );

    if (error) throw error;
    return normalizeRecord(data);
  }

  async function findByDeal(deal) {
    if (!client) throw new Error("Supabase client 尚未載入。");

    const key = dealKey(deal);
    if (!key) return null;

    const { data, error } = await runWithBestFallback(fields =>
      client.from(TABLE).select(fields).eq("deal_key", key).maybeSingle()
    );

    if (error) throw error;
    return normalizeRecord(data);
  }

  async function save(record) {
    if (!client) throw new Error("Supabase client 尚未載入。");
    if (!record || !Array.isArray(record.deal) || record.deal.length !== 104) {
      throw new TypeError("Spider Hard DB record.deal 必須是 104 張牌。");
    }

    const existing = await findByDeal(record.deal);
    if (existing) return { record: existing, isNew: false };

    const normalizedDeal = normalizeDeal(record.deal);
    if (!normalizedDeal) {
      throw new TypeError("Spider Hard DB record.deal 必須是 104 張有效四花色牌。");
    }

    const payload = {
      uid: String(record.uid || ""),
      deal: normalizedDeal,
      deal_key: dealKey(normalizedDeal),
      client_solved_at: String(record.solvedAt || "") || null
    };

    const { data, error } = await client
      .from(TABLE)
      .insert(payload)
      .select(SELECT_WITH_BEST)
      .single();

    if (error) {
      const raced = await findByDeal(record.deal).catch(() => null);
      if (raced) return { record: raced, isNew: false };
      throw error;
    }

    return { record: normalizeRecord(data), isNew: true };
  }

  async function updateBestSteps(uid, steps) {
    if (!client) throw new Error("Supabase client 尚未載入。");

    const q = String(uid || "").trim();
    const value = Math.trunc(Number(steps));
    if (!q || !Number.isInteger(value) || value <= 0) {
      throw new TypeError("UID 與步數格式錯誤。");
    }

    const current = await findByUid(q);
    if (!current) return null;

    const oldBest = Number(current.bestSteps);
    if (Number.isInteger(oldBest) && oldBest > 0 && oldBest <= value) {
      return current;
    }

    const { data, error } = await client
      .from(TABLE)
      .update({ best_steps: value })
      .eq("uid", q)
      .select(SELECT_WITH_BEST)
      .single();

    if (error) {
      const message = String(error?.message || "").toLowerCase();
      const unavailable =
        message.includes("best_steps") ||
        message.includes("permission denied") ||
        error?.code === "42703" ||
        error?.code === "42501" ||
        error?.code === "PGRST204";

      if (unavailable) return null;
      throw error;
    }
    return normalizeRecord(data);
  }


  async function incrementClearCount(uid) {
    if (!client) throw new Error("Supabase client 尚未載入。");

    const q = String(uid || "").trim();
    if (!q) throw new TypeError("UID 格式錯誤。");

    const { data, error } = await client.rpc("increment_spider_hard_clear_count", { p_uid: q });
    if (error) throw error;

    const value = Number(data);
    return {
      uid: q,
      clearCount: Number.isInteger(value) && value >= 0 ? value : 0
    };
  }

  async function pendingCount() {
    if (!client) throw new Error("Supabase client 尚未載入。");
    const { count: total, error } = await client
      .from(PENDING_TABLE)
      .select("uid", { count: "exact", head: true });
    if (error) throw error;
    return Number(total || 0);
  }

  async function pendingListPage(page = 1, pageSize = 5) {
    if (!client) throw new Error("Supabase client 尚未載入。");
    const size = Math.min(50, Math.max(1, Math.trunc(Number(pageSize)) || 5));
    const requestedPage = Math.max(1, Math.trunc(Number(page)) || 1);
    const from = (requestedPage - 1) * size;
    const to = from + size - 1;

    const { data, error, count: total } = await client
      .from(PENDING_TABLE)
      .select(PENDING_SELECT_FIELDS, { count: "exact" })
      .order("added_at", { ascending: false })
      .order("uid", { ascending: true })
      .range(from, to);

    if (error) throw error;

    const totalCount = Number(total || 0);
    const totalPages = Math.max(1, Math.ceil(totalCount / size));
    return {
      records: (data || []).map(normalizePendingRecord).filter(Boolean),
      page: Math.min(requestedPage, totalPages),
      pageSize: size,
      totalCount,
      totalPages
    };
  }

  async function pendingRandom() {
    if (!client) throw new Error("Supabase client 尚未載入。");
    const total = await pendingCount();
    if (total <= 0) return null;

    const offset = Math.floor(Math.random() * total);
    const { data, error } = await client
      .from(PENDING_TABLE)
      .select(PENDING_SELECT_FIELDS)
      .order("added_at", { ascending: false })
      .order("uid", { ascending: true })
      .range(offset, offset);

    if (error) throw error;
    return normalizePendingRecord((data || [])[0]);
  }

  async function pendingFindByUid(uid) {
    if (!client) throw new Error("Supabase client 尚未載入。");
    const q = String(uid || "").trim();
    if (!q) return null;
    const { data, error } = await client
      .from(PENDING_TABLE)
      .select(PENDING_SELECT_FIELDS)
      .eq("uid", q)
      .maybeSingle();
    if (error) throw error;
    return normalizePendingRecord(data);
  }

  async function pendingFindByDeal(deal) {
    if (!client) throw new Error("Supabase client 尚未載入。");
    const key = dealKey(deal);
    if (!key) return null;
    const { data, error } = await client
      .from(PENDING_TABLE)
      .select(PENDING_SELECT_FIELDS)
      .eq("deal_key", key)
      .maybeSingle();
    if (error) throw error;
    return normalizePendingRecord(data);
  }

  async function pendingSave(record) {
    if (!client) throw new Error("Supabase client 尚未載入。");
    const normalizedDeal = normalizeDeal(record?.deal);
    if (!normalizedDeal) throw new TypeError("Spider Hard Pending DB record.deal 必須是 104 張有效牌。");

    const solved = await findByDeal(normalizedDeal);
    if (solved) return { record: null, isNew: false, solved: true };

    const existing = await pendingFindByDeal(normalizedDeal);
    if (existing) return { record: existing, isNew: false, solved: false };

    const payload = {
      uid: String(record.uid || ""),
      deal: normalizedDeal,
      deal_key: dealKey(normalizedDeal),
      client_added_at: String(record.addedAt || "") || null
    };

    const { data, error } = await client
      .from(PENDING_TABLE)
      .insert(payload)
      .select(PENDING_SELECT_FIELDS)
      .single();

    if (error) {
      const raced = await pendingFindByDeal(normalizedDeal).catch(() => null);
      if (raced) return { record: raced, isNew: false, solved: false };
      throw error;
    }

    return { record: normalizePendingRecord(data), isNew: true, solved: false };
  }

  async function pendingIncrementAttempt(uid) {
    if (!client) throw new Error("Supabase client 尚未載入。");
    const q = String(uid || "").trim();
    if (!q) throw new TypeError("UID 格式錯誤。");

    const { data, error } = await client.rpc("increment_spider_hard_pending_attempt_count", { p_uid: q });
    if (error) throw error;
    const value = Number(data);
    return Number.isInteger(value) && value >= 1 ? value : null;
  }

  async function pendingPromote(uid, deal) {
    if (!client) throw new Error("Supabase client 尚未載入。");
    const q = String(uid || "").trim();
    const key = dealKey(deal);
    if (!q || !key) return false;

    const { data, error } = await client.rpc("promote_spider_hard_pending_deal", {
      p_uid: q,
      p_deal_key: key
    });
    if (error) throw error;
    return Boolean(data);
  }

  window.SpiderSolvedDealsDB = Object.freeze({
    list,
    count,
    listPage,
    random,
    findByUid,
    findByDeal,
    save,
    updateBestSteps,
    incrementClearCount,
    dealKey
  });

  window.SpiderPendingDealsDB = Object.freeze({
    listPage: pendingListPage,
    count: pendingCount,
    random: pendingRandom,
    findByUid: pendingFindByUid,
    findByDeal: pendingFindByDeal,
    save: pendingSave,
    incrementAttempt: pendingIncrementAttempt,
    promote: pendingPromote,
    dealKey
  });
})();
