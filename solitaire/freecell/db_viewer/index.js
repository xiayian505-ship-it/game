(() => {
  "use strict";

  const SUPABASE_URL = "https://bkjqaetxwvcdciieevvs.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_dAHoIimWgbGAF2wtIVSZfg_V8rzc200";
  const TABLE = "freecell_solved_deals";
  const PAGE_SIZE = 20;

  const state = {
    records: [],
    total: null,
    page: 1,
    pagination: null,
    loading: false
  };

  const client = window.supabase?.createClient
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      })
    : null;

  const ui = {
    list: document.getElementById("freecellList"),
    count: document.getElementById("freecellCount"),
    status: document.getElementById("freecellStatus"),
    pager: document.getElementById("freecellPager"),
    prev: document.getElementById("freecellPrev"),
    next: document.getElementById("freecellNext"),
    pageInfo: document.getElementById("freecellPageInfo"),
    refresh: document.getElementById("refreshButton")
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function shortUid(uid) {
    const raw = String(uid || "")
      .replace(/^freecell-/i, "")
      .replace(/[^a-z0-9]/gi, "")
      .toUpperCase();

    return raw ? `F-${raw.slice(0, 8)}` : "F-────────";
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

  async function countRows() {
    const { count, error } = await client
      .from(TABLE)
      .select("uid", { count: "exact", head: true });

    if (error) throw error;
    return Number(count || 0);
  }

  async function fetchRows(start, end) {
    if (end < start) return [];

    let result = await client
      .from(TABLE)
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
          .from(TABLE)
          .select("uid,client_solved_at,solved_at")
          .order("solved_at", { ascending: false })
          .order("uid", { ascending: true })
          .range(start, end);
      }
    }

    if (result.error) throw result.error;
    return (result.data || []).map(normalizeRecord);
  }

  function render() {
    const pagination = state.pagination;

    ui.count.textContent = state.total === null ? "—" : String(state.total);

    if (!state.records.length) {
      ui.list.innerHTML = '<div class="empty-state">目前沒有資料。</div>';
    } else {
      const firstIndex = pagination?.startIndex || 0;

      ui.list.innerHTML = state.records.map((record, index) => {
        const dbTime = formatTime(record.databaseTime);
        const clientTime = formatTime(record.clientTime);
        const best = record.bestSteps === null ? "—" : record.bestSteps;
        const clears = record.clearCount === null ? "—" : record.clearCount;

        return `
          <article class="record-row">
            <div class="record-head">
              <div class="record-uid" title="${escapeHtml(record.uid)}">${escapeHtml(shortUid(record.uid))}</div>
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

    if (!pagination || state.total === 0) {
      ui.pager.hidden = true;
      return;
    }

    ui.pager.hidden = false;
    ui.pageInfo.textContent = `${pagination.page} / ${pagination.totalPages}`;
    ui.prev.disabled = state.loading || !pagination.hasPrevious;
    ui.next.disabled = state.loading || !pagination.hasNext;
  }

  function renderError(error) {
    ui.list.innerHTML = `<div class="error-state">讀取失敗：${escapeHtml(error?.message || error || "未知錯誤")}</div>`;
    ui.pager.hidden = true;
  }

  async function loadPage(page = state.page) {
    if (!client) {
      renderError(new Error("Supabase 尚未載入。"));
      return;
    }

    if (state.loading) return;

    state.loading = true;
    ui.status.textContent = "讀取中…";
    ui.refresh.disabled = true;
    ui.prev.disabled = true;
    ui.next.disabled = true;

    try {
      const total = await countRows();
      const pagination = makePagination(total, page);
      const rows = await fetchRows(pagination.startIndex, pagination.endIndex);

      state.total = total;
      state.page = pagination.page;
      state.pagination = pagination;
      state.records = rows;

      ui.status.textContent = total === 0 ? "" : `本頁 ${rows.length} 筆`;
      render();
    } catch (error) {
      console.error("[FreeCell DB] 讀取失敗：", error);
      ui.status.textContent = "讀取失敗";
      renderError(error);
    } finally {
      state.loading = false;
      ui.refresh.disabled = false;
      if (state.pagination) {
        ui.prev.disabled = !state.pagination.hasPrevious;
        ui.next.disabled = !state.pagination.hasNext;
      }
    }
  }

  ui.refresh?.addEventListener("click", () => {
    void loadPage(state.page);
  });

  ui.prev?.addEventListener("click", () => {
    if (!state.pagination?.hasPrevious) return;
    void loadPage(state.pagination.page - 1);
  });

  ui.next?.addEventListener("click", () => {
    if (!state.pagination?.hasNext) return;
    void loadPage(state.pagination.page + 1);
  });

  void loadPage(1);
})();
