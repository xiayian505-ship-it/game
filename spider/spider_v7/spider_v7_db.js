(() => {
  "use strict";

  const SUPABASE_URL = "https://bkjqaetxwvcdciieevvs.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_dAHoIimWgbGAF2wtIVSZfg_V8rzc200";
  const TABLE = "spider_solved_deals";

  function normalizeRecord(row) {
    if (!row || typeof row.uid !== "string" || !Array.isArray(row.deal) || row.deal.length !== 104) {
      return null;
    }

    return {
      uid: row.uid,
      deal: row.deal.map(Number),
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
    return Array.isArray(deal) ? deal.join(",") : "";
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

  async function listPage(page = 1, pageSize = 10) {
    if (!client) throw new Error("Supabase client 尚未載入。");

    const size = Math.min(50, Math.max(1, Math.trunc(Number(pageSize)) || 10));
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
      throw new TypeError("Spider DB record.deal 必須是 104 張牌。");
    }

    const existing = await findByDeal(record.deal);
    if (existing) return { record: existing, isNew: false };

    const payload = {
      uid: String(record.uid || ""),
      deal: record.deal.map(Number),
      deal_key: dealKey(record.deal),
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

    const { data, error } = await client.rpc("increment_spider_clear_count", { p_uid: q });
    if (error) throw error;

    const value = Number(data);
    return {
      uid: q,
      clearCount: Number.isInteger(value) && value >= 0 ? value : 0
    };
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
})();
