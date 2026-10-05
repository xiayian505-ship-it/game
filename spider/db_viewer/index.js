(() => {
  "use strict";

  const SUPABASE_URL = "https://bkjqaetxwvcdciieevvs.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_dAHoIimWgbGAF2wtIVSZfg_V8rzc200";
  const PAGE_SIZE = 50;

  const MODES = Object.freeze({
    easy: {
      label: "初階",
      prefix: "E",
      table: "spider_solved_deals"
    },
    medium: {
      label: "中階",
      prefix: "M",
      table: "spider_medium_solved_deals"
    },
    hard: {
      label: "高階",
      prefix: "H",
      table: "spider_hard_solved_deals"
    }
  });

  const state = Object.fromEntries(
    Object.keys(MODES).map(key => [key, {
      records: [],
      total: null,
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
      more: document.getElementById(`${mode}More`)
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

  function shortUid(uid, prefix) {
    const raw = String(uid || "")
      .replace(/^spider-(?:medium-|hard-)?/i, "")
      .replace(/[^a-z0-9]/gi, "")
      .toUpperCase();

    return raw ? `${prefix}-${raw.slice(0, 8)}` : `${prefix}-────────`;
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
    return timeFormatter.format(date).replaceAll("/", "/");
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

  async function countMode(mode) {
    const { table } = MODES[mode];
    const { count, error } = await client
      .from(table)
      .select("uid", { count: "exact", head: true });

    if (error) throw error;
    return Number(count || 0);
  }

  async function fetchRows(mode, start) {
    const { table } = MODES[mode];
    const end = start + PAGE_SIZE - 1;

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

    ui.count.textContent = current.total === null ? "—" : String(current.total);

    if (!current.records.length && current.loaded) {
      ui.list.innerHTML = '<div class="empty-state">目前沒有資料。</div>';
    } else {
      ui.list.innerHTML = current.records.map((record, index) => {
        const dbTime = formatTime(record.databaseTime);
        const clientTime = formatTime(record.clientTime);
        const best = record.bestSteps === null ? "—" : record.bestSteps;
        const clears = record.clearCount === null ? "—" : record.clearCount;

        return `
          <article class="record-row">
            <div class="record-head">
              <div class="record-uid" title="${escapeHtml(record.uid)}">${escapeHtml(shortUid(record.uid, config.prefix))}</div>
              <div class="record-index">#${index + 1}</div>
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

    const hasMore = current.total !== null && current.records.length < current.total;
    ui.more.hidden = !hasMore;
    ui.more.disabled = current.loading;
  }

  function renderError(mode, error) {
    const ui = els(mode);
    ui.list.innerHTML = `<div class="error-state">讀取失敗：${escapeHtml(error?.message || error || "未知錯誤")}</div>`;
    ui.more.hidden = true;
  }

  async function loadMode(mode, { reset = false } = {}) {
    if (!client) {
      renderError(mode, new Error("Supabase 尚未載入。"));
      return;
    }

    const current = state[mode];
    if (current.loading) return;

    current.loading = true;
    const ui = els(mode);
    ui.status.textContent = "讀取中…";
    ui.more.disabled = true;

    try {
      if (reset) {
        current.records = [];
        current.total = null;
        current.loaded = false;
      }

      const start = current.records.length;
      const [total, rows] = await Promise.all([
        current.total === null ? countMode(mode) : Promise.resolve(current.total),
        fetchRows(mode, start)
      ]);

      current.total = total;
      current.records.push(...rows);
      current.loaded = true;
      ui.status.textContent = rows.length ? `已載入 ${current.records.length} 筆` : "已是最新";
      render(mode);
    } catch (error) {
      console.error(`[Spider DB] ${mode} 讀取失敗：`, error);
      ui.status.textContent = "讀取失敗";
      renderError(mode, error);
    } finally {
      current.loading = false;
      ui.more.disabled = false;
    }
  }

  function activeMode() {
    const selected = document.querySelector('#dbTabs [data-view-target][aria-selected="true"]');
    return selected?.dataset.viewTarget || "easy";
  }

  function initTabs() {
    if (!window.SlowlyTabs?.create) {
      console.error("[Spider DB] SlowlyTabs 尚未載入。");
      return null;
    }

    return window.SlowlyTabs.create("#dbTabs", {
      initial: "easy",
      onChange({ name }) {
        if (MODES[name] && !state[name].loaded) {
          void loadMode(name);
        }
      }
    });
  }

  function bindEvents() {
    document.getElementById("refreshButton")?.addEventListener("click", () => {
      void loadMode(activeMode(), { reset: true });
    });

    Object.keys(MODES).forEach(mode => {
      els(mode).more?.addEventListener("click", () => {
        void loadMode(mode);
      });
    });
  }

  initTabs();
  bindEvents();
  void loadMode("easy", { reset: true });
})();
