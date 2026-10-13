/** 霧林之契 v0.8｜故事資料、進度及跳轉核心。採 JSON 事件格式，僅戰鬥通關才解鎖故事，不因閱讀而解鎖關卡。 */
(() => {
  "use strict";
  const SAVE_KEY = "mistforest_pact_story_progress_v3";
  const GAME_SAVE_KEY = "mistforest_pact_save_v3";
  const DATA_BASE = new URL("./data/", window.location.href);
  const listeners = new Set();
  const fresh = () => ({ completedSections: [], seenSections: [], bookmark: null });
  function loadProgress() {
    const result = fresh();
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
      if (saved && typeof saved === "object") {
        result.completedSections = Array.isArray(saved.completedSections) ? saved.completedSections.filter(x => typeof x === "string") : [];
        result.seenSections = Array.isArray(saved.seenSections) ? saved.seenSections.filter(x => typeof x === "string") : [];
        result.bookmark = saved.bookmark && typeof saved.bookmark === "object" ? saved.bookmark : null;
      }
    } catch (err) { console.warn("故事閱讀紀錄載入失敗", err); }
    return result;
  }
  let progress = loadProgress();
  let manifest = null;
  let prepared = new Map();
  let screen = { page: "loading", entry: null, eventIndex: 0, error: "" };
  let requestSerial = 0;
  const emit = () => listeners.forEach(fn => fn(snapshot()));
  const snapshot = () => ({ ...screen, progress: JSON.parse(JSON.stringify(progress)) });
  const rememberSave = () => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); }
    catch (err) { console.warn("故事閱讀進度暫時無法儲存", err); }
  };
  function completedStages() {
    try {
      const saved = JSON.parse(localStorage.getItem(GAME_SAVE_KEY) || "null");
      if (saved?.version === 5 && Number.isInteger(saved.completed)) return Math.min(10, Math.max(0, saved.completed));
    } catch (err) { console.warn("無法讀取遊戲通關紀錄", err); }
    return 0;
  }
  const unlocked = (chapterId, index) => chapterId === "prologue" ||
    (chapterId === "epilogue" ? completedStages() >= 10 : completedStages() >= index);
  const allChapters = () => manifest ? [...manifest.main, ...manifest.extras] : [];
  function fileUrl(file) {
    const url = new URL(String(file), DATA_BASE);
    if (url.origin !== DATA_BASE.origin || !url.pathname.startsWith(DATA_BASE.pathname)) throw new Error("故事資料路徑無效");
    return url;
  }
  async function fetchJson(url) {
    const result = await fetch(url, { cache: "no-cache" });
    if (!result.ok) throw new Error(`故事讀取失敗（HTTP ${result.status}）`);
    return result.json();
  }
  // 主線關卡標題由 Boss 資料決定；「契約之後」為不參與戰鬥的獨立篇章。
  function chapterTitle(index, reader = false) {
    if (index === 0) return "序章｜契約之前";
    if (index === 11) return "契約之後";
    const boss = window.LinCardData?.bossByStage(index);
    return boss ? `第${index}關${reader ? "" : "通關故事"}｜${boss.name}` : `第${index}關`;
  }
  // 對使用者而言，只需填 JSON 的 events；契約之後同樣依完成十關解鎖。
  function catalog() {
    if (!manifest) return [];
    return allChapters().map((ch, index) => {
      const section = ch.sections[0];
      const data = prepared.get(ch.id);
      return { id: ch.id, title: chapterTitle(index), sectionId: section.id,
        published: Array.isArray(data?.events) && data.events.length > 0,
        unlocked: unlocked(ch.id, index),
        read: progress.completedSections.includes(ch.id),
        seen: progress.seenSections.includes(ch.id) };
    });
  }
  async function initialize() {
    const serial = ++requestSerial;
    screen = { page: "loading", entry: null, eventIndex: 0, error: "" }; emit();
    try {
      const items = await fetchJson(new URL("chapters.json", DATA_BASE));
      if (!Array.isArray(items.main) || items.main.length !== 11 || !Array.isArray(items.extras)) throw new Error("章節索引必須含序章及十段通關故事");
      // 單一 manifest 管理主章與額外篇章；各段獨立 JSON，不需改 JS 才能填故事。
      const loaded = await Promise.all([...items.main, ...items.extras].map(async ch => {
        const section = ch.sections?.[0];
        if (!section) throw new Error(`故事缺少小節：${ch.id}`);
        const result = await fetchJson(fileUrl(section.file));
        if (result.id !== section.id || !Array.isArray(result.events)) throw new Error(`故事格式不正確：${section.file}`);
        return [ch.id, result];
      }));
      if (serial !== requestSerial) return;
      manifest = items;
      prepared = new Map(loaded);
      screen = { page: "catalog", entry: null, eventIndex: 0, error: "" };
      const entry = new URL(window.location.href).searchParams.get("entry");
      const requested = catalog().find(x => x.id === entry);
      if (requested?.published && requested.unlocked) {
        await openSection(requested.id, true);
        return;
      }
    } catch (err) {
      if (serial !== requestSerial) return;
      screen = { page: "error", entry: null, eventIndex: 0, error: err.message || String(err) };
    }
    emit();
  }
  function openCatalog() {
    requestSerial++;
    screen = { page: "catalog", entry: null, eventIndex: 0, error: "" };
    emit();
  }
  async function openSection(chapterId, resume = false) {
    const entries = allChapters();
    const index = entries.findIndex(x => x.id === chapterId);
    if (index < 0 || !unlocked(chapterId, index)) return false;
    const ch = entries[index];
    const data = prepared.get(ch.id);
    if (!data?.events?.length) return false;
    requestSerial++;
    const bk = progress.bookmark;
    const pos = resume && bk?.chapterId === chapterId && Number.isInteger(bk.index)
      ? Math.max(0, Math.min(bk.index, data.events.length - 1)) : 0;
    screen = { page: "reader", entry: { chapterId, chapterIndex: index, title: data.title || chapterTitle(index, true), events: data.events }, eventIndex: pos, error: "" };
    bookmark();emit();return true;
  }
  function bookmark() {
    if (screen.page !== "reader") return;
    progress.bookmark = { chapterId: screen.entry.chapterId, index: screen.eventIndex };
    rememberSave();
  }
  function currentEvent() { return screen.page === "reader" ? screen.entry.events[screen.eventIndex] : null; }
  function advance() {
    const ev = currentEvent();
    if (!ev || ev.type === "choice" || ev.type === "challenge") return;
    next();
  }
  function next() {
    if (screen.eventIndex + 1 >= screen.entry.events.length) return finish();
    screen.eventIndex++;
    bookmark();emit();
  }
  function chooseOption(index) {
    const ev = currentEvent();
    if (ev?.type !== "choice" || !Array.isArray(ev.options) || !ev.options[index]) return;
    const option = ev.options[index];
    if (!option.goto) return next();
    const i = screen.entry.events.findIndex(item => item.id === option.goto);
    if (i < 0) { screen.error = `找不到分支事件：${option.goto}`; emit(); return; }
    screen.eventIndex = i;screen.error = "";bookmark();emit();
  }
  function markSeen(chapterId, read = false) {
    if (!progress.seenSections.includes(chapterId)) progress.seenSections.push(chapterId);
    if (read && !progress.completedSections.includes(chapterId)) progress.completedSections.push(chapterId);
    if (progress.bookmark?.chapterId === chapterId) progress.bookmark = null;
    rememberSave();
  }
  function finish() {
    if (screen.page !== "reader") return;
    const entry = screen.entry;
    markSeen(entry.chapterId, true);
    screen = { page: "complete", entry, eventIndex: screen.eventIndex, error: "" };
    emit();
  }
  function skip() {
    if (screen.page !== "reader") return;
    const entry = screen.entry;
    markSeen(entry.chapterId, false);
    screen = { page: "skipped", entry, eventIndex: screen.eventIndex, error: "" };
    emit();
  }
  function resume() { if (progress.bookmark?.chapterId) openSection(progress.bookmark.chapterId, true); }
  function backToGame() {
    const returnView = new URL(window.location.href).searchParams.get("return");
    const url = `../index.html${returnView === "game" ? "?view=game" : returnView === "challenge" ? "?view=challenge" : ""}`;
    if (window.SlowlyNavigation?.go) window.SlowlyNavigation.go(url);
    else window.location.assign(url);
  }
  window.MistForestStory = Object.freeze({ initialize, snapshot, catalog, openCatalog, openSection,
    currentEvent, advance, chooseOption, resume, skip, backToGame,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); } });
})();
