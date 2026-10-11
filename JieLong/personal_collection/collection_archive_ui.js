(() => {
  "use strict";
  const archive = window.TroveGameArchive;
  const kind = document.body.dataset.collectionKind;
  const modes = (document.body.dataset.collectionModes || "").split(",").filter(Boolean);
  if (!archive || !modes.length || !["favorite", "possible"].includes(kind)) return;
  const states = Object.fromEntries(modes.map(mode => [mode, {page: 1}]));
  let activeMode = modes[0];
  function ui(mode, suffix) { return document.getElementById(`${mode}_${suffix}`); }
  function stat(label, value) {
    const el = document.createElement("span");
    el.append(document.createTextNode(`${label} `));
    const strong = document.createElement("strong");
    strong.textContent = value;
    el.append(strong);
    return el;
  }
  function load(mode, keepPage = true) {
    const list = ui(mode, "list"), count = ui(mode, "count"), status = ui(mode, "status"), pager = ui(mode, "pager");
    if (!list || !count || !status || !pager) return;
    try {
      const rows = archive.records(mode, kind);
      const result = archive.paginate(rows, keepPage ? states[mode].page : 1);
      states[mode].page = result.page;
      count.textContent = String(rows.length);
      status.textContent = rows.length ? `本頁 ${result.records.length} 筆` : "";
      list.replaceChildren();
      if (!result.records.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = "目前沒有資料。";
        list.append(empty);
      }
      result.records.forEach((record, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "record-row";
        button.title = `開啟完整 UID：${record.uid}`;
        const head = document.createElement("div");
        head.className = "record-head";
        const code = document.createElement("span");
        code.className = "record-uid";
        code.textContent = archive.shortUid(mode, record.uid);
        const number = document.createElement("span");
        number.className = "record-index";
        number.textContent = `#${result.startIndex + index + 1}`;
        head.append(code, number);
        const stats = document.createElement("div");
        stats.className = "record-stats";
        if (kind === "possible") stats.append(stat("挑戰：", `${record.attemptCount} 次`));
        else {
          stats.append(stat("最佳：", record.bestSteps === null ? "— 步" : `${record.bestSteps} 步`));
          stats.append(stat("破關：", `${record.clearCount} 次`));
        }
        button.append(head, stats);
        button.addEventListener("click", () => archive.launch(record));
        list.append(button);
      });
      pager.hidden = !rows.length;
      ui(mode, "page").textContent = `${result.page} / ${result.totalPages}`;
      ui(mode, "prev").disabled = !result.hasPrevious;
      ui(mode, "next").disabled = !result.hasNext;
    } catch (error) {
      console.error("[秘藏之谷] 館藏讀取失敗", error);
      count.textContent = "—";
      status.textContent = "讀取失敗";
      pager.hidden = true;
      const warning = document.createElement("div");
      warning.className = "error-state";
      warning.textContent = `讀取失敗：${error.message || error}`;
      list.replaceChildren(warning);
    }
  }
  for (const mode of modes) {
    ui(mode, "prev")?.addEventListener("click", () => {
      if (states[mode].page > 1) { states[mode].page--; load(mode); }
    });
    ui(mode, "next")?.addEventListener("click", () => { states[mode].page++; load(mode); });
  }
  document.getElementById("refreshButton")?.addEventListener("click", () => load(activeMode));
  if (modes.length > 1 && window.SlowlyTabs?.create) {
    window.SlowlyTabs.create("#collectionTabs", {
      initial: modes[0],
      onChange({ name }) {
        if (!states[name]) return;
        activeMode = name;
        load(name);
      }
    });
  } else if (modes.length > 1) {
    // 外部 Tabs 元件若無法載入，原生頁籤仍可切換，不讓其他難度消失。
    const buttons = document.querySelectorAll("[data-view-target]");
    buttons.forEach(button => button.addEventListener("click", () => {
      const name = button.dataset.viewTarget;
      if (!states[name]) return;
      buttons.forEach(tab => tab.setAttribute("aria-selected", String(tab === button)));
      document.querySelectorAll("[data-view-panel]").forEach(panel => { panel.hidden = panel.dataset.viewPanel !== name; });
      activeMode = name;
      load(name);
    }));
  }
  load(activeMode, false);
  window.addEventListener("pageshow", () => load(activeMode));
})();
