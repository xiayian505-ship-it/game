(() => {
  "use strict";
  const store = window.TroveCollection;
  const definitions = {
    freecell: { read: () => store.readFavorites() },
    microsoft: { read: () => store.readMicrosoftFavorites() }
  };
  const state = Object.fromEntries(Object.keys(definitions).map(key => [key, { page: 1, loaded: false }]));
  let activeMode = "freecell";
  function elements(mode) {
    return Object.fromEntries(["Count", "Status", "List", "Pager", "Prev", "Next", "PageInfo"].map(key =>
      [key, document.getElementById(mode + key)]));
  }
  function line(label, value) {
    const span = document.createElement("span");
    span.textContent = label + " ";
    const strong = document.createElement("strong");
    strong.textContent = String(value);
    span.append(strong);
    return span;
  }
  function load(mode, { keepPage = true } = {}) {
    const ui = elements(mode);
    try {
      if (!store) throw new Error("館藏資料模組尚未載入。");
      const records = definitions[mode].read();
      const result = store.paginate(records, keepPage ? state[mode].page : 1);
      state[mode].page = result.page;
      state[mode].loaded = true;
      ui.Count.textContent = String(records.length);
      ui.Status.textContent = records.length ? `本頁 ${result.records.length} 筆` : "";
      ui.List.replaceChildren();
      if (!result.records.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = "目前沒有資料。";
        ui.List.append(empty);
      } else {
        result.records.forEach((record, index) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "record-row";
          button.title = record.mode === "microsoft" ? `開啟微軟牌局 #${record.dealNumber}` : `開啟完整 UID：${record.uid}`;
          const head = document.createElement("div");
          head.className = "record-head";
          const code = document.createElement("span");
          code.className = "record-uid";
          code.textContent = record.mode === "microsoft" ? `#${record.dealNumber}` : store.shortUid(record.uid);
          const order = document.createElement("span");
          order.className = "record-index";
          order.textContent = `#${result.startIndex + index + 1}`;
          head.append(code, order);
          const stats = document.createElement("div");
          stats.className = "record-stats";
          if (record.kind === "possible") stats.append(line("挑戰：", record.attemptCount + " 次"));
          else {
            stats.append(line("最佳：", record.bestSteps === null ? "— 步" : record.bestSteps + " 步"));
            stats.append(line("破關：", record.clearCount + " 次"));
          }
          button.append(head, stats);
          button.addEventListener("click", () => store.launch(record));
          ui.List.append(button);
        });
      }
      ui.Pager.hidden = !records.length;
      ui.PageInfo.textContent = `${result.page} / ${result.totalPages}`;
      ui.Prev.disabled = !result.hasPrevious;
      ui.Next.disabled = !result.hasNext;
    } catch (error) {
      console.error("[秘藏之谷] 讀取館藏失敗", error);
      ui.Status.textContent = "讀取失敗";
      ui.Count.textContent = "—";
      ui.Pager.hidden = true;
      const alert = document.createElement("div");
      alert.className = "error-state";
      alert.textContent = `讀取失敗：${error.message || error}`;
      ui.List.replaceChildren(alert);
    }
  }
  Object.keys(definitions).forEach(mode => {
    const ui = elements(mode);
    ui.Prev?.addEventListener("click", () => { if (state[mode].page > 1) { state[mode].page--; load(mode); } });
    ui.Next?.addEventListener("click", () => { state[mode].page++; load(mode); });
  });
  document.getElementById("refreshButton")?.addEventListener("click", () => load(activeMode));
  const tabsReady = Boolean(window.SlowlyTabs?.create);
  if (tabsReady) {
    window.SlowlyTabs.create("#collectionTabs", { initial: "freecell", onChange({ name }) {
      if (!definitions[name]) return;
      activeMode = name;
      load(name);
    }});
  } else {
    // 不隱藏故障：仍能看第一組清單，並在可見位置提示分頁元件失敗。
    console.error("[秘藏之谷] 慢慢軍火庫 Tabs 尚未載入。");
  }
  load("freecell", { keepPage: false });
  if (!tabsReady) document.getElementById("freecellStatus").textContent = "Tabs 載入失敗";
  window.addEventListener("pageshow", () => load(activeMode));
})();
