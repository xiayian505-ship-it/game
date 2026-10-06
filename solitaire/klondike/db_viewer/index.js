(() => {
  "use strict";

  const SUPABASE_URL = "https://bkjqaetxwvcdciieevvs.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_dAHoIimWgbGAF2wtIVSZfg_V8rzc200";
  const PAGE_SIZE = 20;

  const MODES = Object.freeze({
    draw1: {
      label: "1 張牌",
      prefix: "K1",
      uidPrefix: "klondike-draw1-",
      table: "klondike_draw1_solved_deals"
    },
    draw3: {
      label: "3 張牌",
      prefix: "K3",
      uidPrefix: "klondike-draw3-",
      table: "klondike_draw3_solved_deals"
    }
  });

  const state = Object.fromEntries(
    Object.keys(MODES).map(key => [key, {
      records: [],
      total: null,
      page: 1,
      pagination: null,
      loaded: false,
      loading: false
    }])
  );

  const client = window.supabase?.createClient
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      })
    : null;

  function els(mode) {
    return {
      list: document.getElementById(`${mode}List`),
      count: document.getElementById(`${mode}Count`),
      status: document.getElementById(`${mode}Status`),
      pager: document.getElementById(`${mode}Pager`),
      prev: document.getElementById(`${mode}Prev`),
      next: document.getElementById(`${mode}Next`),
      pageInfo: document.getElementById(`${mode}PageInfo`)
    };
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function shortUid(uid, config) {
    const source = String(uid || "");
    const raw = source.toLowerCase().startsWith(config.uidPrefix)
      ? source.slice(config.uidPrefix.length)
      : source;
    const clean = raw.replace(/[^a-z0-9]/gi, "").toUpperCase();
    return clean ? `${config.prefix}-${clean.slice(0, 8)}` : `${config.prefix}-────────`;
  }

  const timeFormatter = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  function formatTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return timeFormatter.format(date);
  }

  function normalizeRecord(row) {
    return {
      uid: String(row?.uid || ""),
      databaseTime: row?.solved_at || "",
      clientTime: row?.client_solved_at || "",
      bestSteps: Number.isInteger(Number(row?.best_steps)) && Number(row.best_steps) > 0
        ? Number(row.best_steps)
        : null,
      clearCount: Number.isInteger(Number(row?.clear_count)) && Number(row.clear_count) >= 0
        ? Number(row.clear_count)
        : null
    };
  }

  function makePagination(total, requestedPage) {
    if (!window.FictionPaginate?.paginate) {
      throw new Error("慢慢軍火庫 FictionPaginate 載入失敗。");
    }

    const indexes = Array.from({ length: Math.max(0, total) }, (_, index) => index);
    return window.FictionPaginate.paginate(indexes, {
      page: requestedPage,
      pageSize: PAGE_SIZE
    });
  }

  async function countMode(mode) {
    const { table } = MODES[mode];
    const { count, error } = await client
      .from(table)
      .select("uid", { count: "exact", head: true });

    if (error) throw error;
    return Number(count || 0);
  }

  async function fetchRows(mode, start, end) {
    const { table } = MODES[mode];
    if (end < start) return [];

    let result = await client
      .from(table)
      .select("uid,client_solved_at,solved_at,best_steps,clear_count")
      .order("solved_at", { ascending: false })
      .order("uid", { ascending: true })
      .range(start, end);

    if (result.error) {
      const message = String(result.error?.message || "").toLowerCase();
      const fallback =
        message.includes("best_steps") ||
        message.includes("clear_count") ||
        result.error?.code === "42703" ||
        result.error?.code === "PGRST204";

      if (fallback) {
        result = await client
          .from(table)
          .select("uid,client_solved_at,solved_at")
          .order("solved_at", { ascending: false })
          .order("uid", { ascending: true })
          .range(start, end);
      }
    }

    if (result.error) throw result.error;
    return (result.data || []).map(normalizeRecord);
  }

  function render(mode) {
    const config = MODES[mode];
    const current = state[mode];
    const ui = els(mode);
    const pagination = current.pagination;

    ui.count.textContent = current.total === null ? "—" : String(current.total);

    if (!current.records.length && current.loaded) {
      ui.list.innerHTML = '<div class="empty-state">目前沒有資料。</div>';
    } else {
      const firstIndex = pagination?.startIndex || 0;

      ui.list.innerHTML = current.records.map((record, index) => {
        const dbTime = formatTime(record.databaseTime);
        const clientTime = formatTime(record.clientTime);
        const best = record.bestSteps === null ? "—" : record.bestSteps;
        const clears = record.clearCount === null ? "—" : record.clearCount;

        return `
          <article class="record-row">
            <div class="record-head">
              <div class="record-uid" title="${escapeHtml(record.uid)}">${escapeHtml(shortUid(record.uid, config))}</div>
              <div class="record-index">#${firstIndex + index + 1}</div>
            </div>
            <div class="record-times">
              <div class="time-row">
                <span class="time-label">資料庫寫入</span>
                <time class="time-value" datetime="${escapeHtml(record.databaseTime)}">${escapeHtml(dbTime)}</time>
              </div>
              <div class="time-row">
                <span class="time-label">玩家解出</span>
                <time class="time-value" datetime="${escapeHtml(record.clientTime)}">${escapeHtml(clientTime)}</time>
              </div>
            </div>
            <div class="record-stats">
              <span>最佳：<strong>${escapeHtml(best)}</strong> 步</span>
              <span>破關：<strong>${escapeHtml(clears)}</strong> 次</span>
            </div>
          </article>
        `;
      }).join("");
    }

    if (!pagination || current.total === 0) {
      ui.pager.hidden = true;
      return;
    }

    ui.pager.hidden = false;
    ui.pageInfo.textContent = `${pagination.page} / ${pagination.totalPages}`;
    ui.prev.disabled = current.loading || !pagination.hasPrevious;
    ui.next.disabled = current.loading || !pagination.hasNext;
  }

  function renderError(mode, error) {
    const ui = els(mode);
    ui.list.innerHTML = `<div class="error-state">讀取失敗：${escapeHtml(error?.message || error || "未知錯誤")}</div>`;
    ui.pager.hidden = true;
  }

  async function loadMode(mode, { page = state[mode].page } = {}) {
    if (!client) {
      renderError(mode, new Error("Supabase 尚未載入。"));
      return;
    }

    const current = state[mode];
    if (current.loading) return;

    current.loading = true;
    let succeeded = false;
    const ui = els(mode);
    ui.status.textContent = "讀取中…";
    ui.prev.disabled = true;
    ui.next.disabled = true;

    try {
      const total = await countMode(mode);
      const pagination = makePagination(total, page);
      const rows = await fetchRows(mode, pagination.startIndex, pagination.endIndex);

      current.total = total;
      current.page = pagination.page;
      current.pagination = pagination;
      current.records = rows;
      current.loaded = true;

      ui.status.textContent = total === 0 ? "" : `本頁 ${rows.length} 筆`;
      succeeded = true;
    } catch (error) {
      console.error(`[Klondike DB] ${mode} 讀取失敗：`, error);
      ui.status.textContent = "讀取失敗";
      renderError(mode, error);
    } finally {
      current.loading = false;
      if (succeeded) render(mode);
    }
  }

  function activeMode() {
    const selected = document.querySelector('#dbTabs [data-view-target][aria-selected="true"]');
    return selected?.dataset.viewTarget || "draw1";
  }

  function initTabs() {
    if (!window.SlowlyTabs?.create) {
      console.error("[Klondike DB] SlowlyTabs 尚未載入。");
      return null;
    }

    return window.SlowlyTabs.create("#dbTabs", {
      initial: "draw1",
      onChange({ name }) {
        if (MODES[name] && !state[name].loaded) {
          void loadMode(name, { page: state[name].page });
        }
      }
    });
  }

  function bindEvents() {
    document.getElementById("refreshButton")?.addEventListener("click", () => {
      const mode = activeMode();
      void loadMode(mode, { page: state[mode].page });
    });

    Object.keys(MODES).forEach(mode => {
      const ui = els(mode);

      ui.prev?.addEventListener("click", () => {
        const pagination = state[mode].pagination;
        if (!pagination?.hasPrevious) return;
        void loadMode(mode, { page: pagination.page - 1 });
      });

      ui.next?.addEventListener("click", () => {
        const pagination = state[mode].pagination;
        if (!pagination?.hasNext) return;
        void loadMode(mode, { page: pagination.page + 1 });
      });
    });
  }

  initTabs();
  bindEvents();
  void loadMode("draw1", { page: 1 });
})();
