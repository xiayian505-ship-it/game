/** 霧林之契｜故事 UI；只負責顯示、點擊與手機閱讀，不計算關卡進度。 */
(() => {
  "use strict";
  const story = window.MistForestStory;
  const $ = id => document.getElementById(id);
  const pages = ["catalogScreen", "readerScreen", "statusScreen"];
  const show = id => pages.forEach(name => { $(name).hidden = name !== id; });
  const make = (tag, css = "", label) => {
    const el = document.createElement(tag);
    el.className = css;
    if (label !== undefined) el.textContent = label;
    return el;
  };
  const sceneNames = { mist: "霧林深處", swamp: "迷失沼澤", tree: "古木之間", rain: "雨中記憶" };
  function renderCatalog(state) {
    show("catalogScreen");
    const catalog = $("catalogList");
    catalog.replaceChildren();
    story.catalog().forEach((item, index) => {
      const button = make("button", "story-entry");
      button.type = "button";
      button.disabled = !(item.published && item.unlocked);
      const title = make("span", "story-entry-title", `${String(index).padStart(2, "0")} · ${item.title}`);
      const status = item.published ? (!item.unlocked ? "尚未通關解鎖" : item.read ? "已讀完 · 可重看" : item.seen ? "已略過 · 可重看" : "已解鎖 · 可閱讀") : "故事尚未寫入";
      button.append(title, make("span", "story-entry-status", status));
      button.addEventListener("click", () => story.openSection(item.id));
      catalog.append(button);
    });
    const b = state.progress.bookmark;
    $("resumeButton").hidden = !(b && story.catalog().some(e => e.id === b.chapterId && e.published && e.unlocked));
  }
  function renderReader(state) {
    show("readerScreen");
    const event = story.currentEvent();
    if (!event) return;
    $("readerHeading").textContent = state.entry.title;
    $("readingPosition").textContent = `${state.eventIndex + 1} / ${state.entry.events.length}`;
    $("progressFill").style.width = `${(state.eventIndex + 1) / state.entry.events.length * 100}%`;
    const scene = typeof event.scene === "string" ? event.scene : "mist";
    $("visualStage").dataset.scene = Object.hasOwn(sceneNames, scene) ? scene : "mist";
    $("sceneKicker").textContent = scene.toUpperCase();
    $("sceneTitle").textContent = event.type === "scene" ? event.title || sceneNames[scene] || "霧林深處" : sceneNames[scene] || "霧林深處";
    $("stageSpeaker").textContent = event.type === "dialogue" ? event.speaker || "？？？" : "";
    $("speakerName").textContent = event.type === "dialogue" ? event.speaker || "" : event.type === "scene" ? "場景" : "";
    const choices = $("storyChoices"); choices.replaceChildren();
    const next = $("nextButton"); next.hidden = false;
    $("readerNotice").textContent = state.error || "";
    $("readerNotice").hidden = !state.error;
    if (event.type === "choice") {
      $("speakerName").textContent = "旅人的選擇";
      $("storyText").textContent = event.prompt || "請做出選擇";
      next.hidden = true;
      (event.options || []).forEach((option, i) => {
        const button = make("button", "", option.text || `選項 ${i + 1}`);
        button.type = "button"; button.addEventListener("click", () => story.chooseOption(i));choices.append(button);
      });
      if (!event.options?.length) { $("readerNotice").textContent = "選項尚未設定";$("readerNotice").hidden = false; }
    } else if (event.type === "challenge") {
      $("storyText").textContent = "戰鬥由主遊戲負責。請先返回遊戲挑戰關卡。";
      next.hidden = true;
    } else if (["scene", "narration", "dialogue", "text"].includes(event.type)) {
      $("storyText").textContent = event.text || event.title || "";
    } else {
      $("storyText").textContent = `不支援的事件類型：${event.type || "(空白)"}`;
      next.hidden = true;
    }
  }
  function renderStatus(state) {
    show("statusScreen");
    const heading = { loading: "正在翻開故事", complete: "這段故事已讀完", skipped: "已略過這段故事", error: "迷霧遮住了文字" };
    $("statusTitle").textContent = heading[state.page] || "故事紀錄";
    const body = { loading: "讀取章節中。", complete: "之後仍可以返回已解鎖的故事重看。", skipped: "略過只記錄閱讀狀態，不會替你通關。", error: state.error || "故事檔案無法載入。" };
    $("statusText").textContent = body[state.page] || "";
  }
  let last = null;
  function render(state) {
    if (state.page === "catalog") renderCatalog(state);
    else if (state.page === "reader") renderReader(state);
    else renderStatus(state);
    if (last !== state.page) {window.scrollTo({ top: 0, behavior: "instant" });last = state.page;}
  }
  $("returnCatalog").addEventListener("click", story.openCatalog);
  $("statusBack").addEventListener("click", story.openCatalog);
  $("catalogBack").addEventListener("click", story.backToGame);
  $("returnGame").addEventListener("click", story.backToGame);
  $("skipButton").addEventListener("click", story.skip);
  $("nextButton").addEventListener("click", story.advance);
  $("resumeButton").addEventListener("click", story.resume);
  $("dialoguePanel").addEventListener("click", event => {
    if (event.target.closest("button")) return;
    if (["dialogue", "text", "narration", "scene"].includes(story.currentEvent()?.type)) story.advance();
  });
  story.subscribe(render);
  story.initialize();
})();
