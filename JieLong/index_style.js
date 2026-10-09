(() => {
  "use strict";

  if (window.SlowlyReveal?.create) {
    window.SlowlyReveal.create({
      selector: "[data-slowly-reveal]",
      threshold: 0.12,
      rootMargin: "0px 0px -24px 0px"
    });
  } else {
    document.querySelectorAll("[data-slowly-reveal]").forEach((element) => {
      element.classList.add("is-visible");
    });
  }

  const quickLayer = document.querySelector("#quick-panel-layer");
  const quickTitle = document.querySelector("#quick-panel-title");
  const quickViews = Array.from(document.querySelectorAll("[data-panel-view]"));
  const quickOpeners = Array.from(document.querySelectorAll("[data-quick-panel]"));
  const quickClosers = Array.from(document.querySelectorAll("[data-panel-close]"));
  let lastQuickOpener = null;

  const panelTitles = {
    territories: "三大領地",
    games: "六個遊戲入口",
    classics: "經典無解牌局"
  };

  function openQuickPanel(name, opener) {
    if (!quickLayer) return;
    const targetView = quickViews.find((view) => view.dataset.panelView === name);
    if (!targetView) return;

    quickViews.forEach((view) => { view.hidden = view !== targetView; });
    if (quickTitle) quickTitle.textContent = panelTitles[name] || "帝國快捷入口";
    lastQuickOpener = opener || document.activeElement;
    quickLayer.hidden = false;
    document.body.classList.add("quick-panel-open");
    requestAnimationFrame(() => quickLayer.classList.add("is-open"));
    quickLayer.querySelector(".quick-panel-close")?.focus();
  }

  function closeQuickPanel(options = {}) {
    if (!quickLayer || quickLayer.hidden) return;
    quickLayer.classList.remove("is-open");
    document.body.classList.remove("quick-panel-open");
    window.setTimeout(() => {
      quickLayer.hidden = true;
      if (options.restoreFocus !== false) lastQuickOpener?.focus?.();
    }, 180);
  }

  quickOpeners.forEach((button) => {
    button.addEventListener("click", () => openQuickPanel(button.dataset.quickPanel, button));
  });

  quickClosers.forEach((button) => {
    button.addEventListener("click", () => closeQuickPanel());
  });

  const book = document.querySelector("[data-page-book]");
  const bookStage = document.querySelector("[data-book-stage]");
  const bookPages = Array.from(document.querySelectorAll("[data-book-page]"));
  const bookPrev = document.querySelector("[data-book-prev]");
  const bookNext = document.querySelector("[data-book-next]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let activeBookIndex = Math.max(0, bookPages.findIndex((page) => page.classList.contains("is-active")));
  let bookTurning = false;
  const curtainTransition = window.SlowlyCurtainTransition?.create?.(book, {
    surface: bookStage,
    duration: 1720
  });

  function revealPageContent(page) {
    page?.querySelectorAll("[data-slowly-reveal]").forEach((element) => {
      element.classList.add("is-visible");
    });
  }

  function syncBookHeight(index = activeBookIndex) {
    if (!bookStage || !bookPages[index]) return;
    const pageHeight = Math.ceil(bookPages[index].scrollHeight);
    if (pageHeight > 0) bookStage.style.height = `${pageHeight}px`;
  }

  function syncBookControls() {
    const unavailable = bookPages.length <= 1;
    if (bookPrev) bookPrev.disabled = unavailable;
    if (bookNext) bookNext.disabled = unavailable;
  }

  function wrapBookIndex(index) {
    if (!bookPages.length) return -1;
    return (index + bookPages.length) % bookPages.length;
  }

  function getShortestBookDirection(targetIndex) {
    const total = bookPages.length;
    if (total <= 1 || targetIndex === activeBookIndex) return "next";
    const forward = (targetIndex - activeBookIndex + total) % total;
    const backward = (activeBookIndex - targetIndex + total) % total;
    return forward <= backward ? "next" : "prev";
  }

  function finishBookTurn(fromPage, toPage, targetIndex) {
    fromPage?.classList.remove("is-active");
    toPage?.classList.add("is-active");
    activeBookIndex = targetIndex;
    bookTurning = false;
    book?.classList.remove("is-turning", "is-turning-next", "is-turning-prev");
    syncBookControls();
    syncBookHeight();
  }

  function turnBookTo(targetIndex, options = {}) {
    if (!bookPages.length) return;
    targetIndex = wrapBookIndex(targetIndex);
    if (targetIndex === activeBookIndex) {
      syncBookHeight();
      return;
    }
    if (bookTurning && !options.instant) return;

    const fromPage = bookPages[activeBookIndex];
    const toPage = bookPages[targetIndex];
    const direction = options.direction || getShortestBookDirection(targetIndex);
    revealPageContent(toPage);

    if (options.instant || reduceMotion) {
      curtainTransition?.clear?.();
      bookPages.forEach((page, index) => {
        page.classList.toggle("is-active", index === targetIndex);
      });
      activeBookIndex = targetIndex;
      bookTurning = false;
      book?.classList.remove("is-turning", "is-turning-next", "is-turning-prev");
      syncBookControls();
      requestAnimationFrame(() => syncBookHeight());
      return;
    }

    bookTurning = true;
    book?.classList.add(
      "is-turning",
      direction === "next" ? "is-turning-next" : "is-turning-prev"
    );
    syncBookHeight(targetIndex);

    const done = () => {
      if (!bookTurning) return;
      finishBookTurn(fromPage, toPage, targetIndex);
    };

    if (!curtainTransition) {
      done();
      return;
    }

    void curtainTransition.play({
      outgoing: fromPage,
      incoming: toPage,
      duration: 1720,
      onFinish: done
    }).catch((error) => {
      console.warn("[JieLong] Curtain Transition 播放失敗：", error);
      curtainTransition.clear();
      done();
    });
  }

  bookPrev?.addEventListener("click", () => turnBookTo(activeBookIndex - 1, { direction: "prev" }));
  bookNext?.addEventListener("click", () => turnBookTo(activeBookIndex + 1, { direction: "next" }));

  // 自由之都｜經典牌局收合：狀態由慢慢軍火庫 TreeSelection 管理。
  const classicTreeToggle = document.querySelector("[data-classic-tree-toggle]");
  const classicTreePanel = document.querySelector("[data-classic-tree-panel]");
  const classicTree = window.TreeSelection?.create?.({ expansion: "single" });

  classicTreeToggle?.addEventListener("click", () => {
    const key = "freecell-classics";
    const expanded = classicTree
      ? classicTree.toggleExpanded(key)
      : classicTreeToggle.getAttribute("aria-expanded") !== "true";

    classicTreeToggle.setAttribute("aria-expanded", String(expanded));
    if (classicTreePanel) classicTreePanel.hidden = !expanded;
    requestAnimationFrame(() => syncBookHeight());
  });

  // 自由之都｜經典牌局第二層收合。一次只展開一組。
  const classicGroupToggles = Array.from(document.querySelectorAll("[data-classic-group-toggle]"));
  const classicGroupPanels = Array.from(document.querySelectorAll("[data-classic-group-panel]"));
  const classicGroupTree = window.TreeSelection?.create?.({ expansion: "single" });

  classicGroupToggles.forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.classicGroupToggle;
      if (!key) return;

      const expanded = classicGroupTree
        ? classicGroupTree.toggleExpanded(key)
        : button.getAttribute("aria-expanded") !== "true";

      classicGroupToggles.forEach((item) => {
        item.setAttribute("aria-expanded", String(item === button && expanded));
      });
      classicGroupPanels.forEach((panel) => {
        panel.hidden = !(panel.dataset.classicGroupPanel === key && expanded);
      });
      requestAnimationFrame(() => syncBookHeight());
    });
  });

  // 自由之都｜入境後整頁交給遊戲本體；遊戲中隱藏帝國翻頁箭頭。
  const freecellPage = bookPages.find((page) => page.dataset.bookPage === "territory-freecell");
  const freecellEnter = document.querySelector("[data-freecell-enter]");
  const freecellMicrosoftEnter = document.querySelector("[data-freecell-microsoft-enter]");
  const freecellHistoryEnter = document.querySelector("[data-freecell-history-enter]");
  const freecellClassicEnters = Array.from(document.querySelectorAll("[data-freecell-classic-enter]"));
  const freecellEmbed = document.querySelector("[data-freecell-embed]");
  const freecellIframe = document.querySelector("[data-freecell-iframe]");
  let lastFreecellOpener = freecellEnter;
  let currentFreecellUrl = "";
  let currentFreecellMode = "";

  function normalizeFreecellUrl(url) {
    try {
      return new URL(url, window.location.href).href;
    } catch {
      return String(url || "");
    }
  }

  function enterFreecell(url, opener, { preserveCurrent = false, mode = "freecell" } = {}) {
    if (!freecellPage || !freecellEmbed || !freecellIframe || !url) return;

    const targetUrl = normalizeFreecellUrl(url);
    const sameTarget = currentFreecellUrl === targetUrl && currentFreecellMode === mode;
    lastFreecellOpener = opener || freecellEnter;

    // 同一入口離境後再入境：保留 iframe 內目前狀態。
    // 切換到另一個入口：明確重新指定 src，不依賴瀏覽器回報的 iframe.src 狀態。
    if (!preserveCurrent || !sameTarget || !freecellIframe.getAttribute("src")) {
      if (!sameTarget && freecellIframe.getAttribute("src")) {
        freecellIframe.removeAttribute("src");
      }
      freecellIframe.src = targetUrl;
      currentFreecellUrl = targetUrl;
      currentFreecellMode = mode;
    }

    freecellPage.classList.add("is-freecell-playing");
    book?.classList.add("is-freecell-playing");
    freecellEmbed.hidden = false;
    requestAnimationFrame(() => syncBookHeight());
  }

  freecellEnter?.addEventListener("click", (event) => {
    event.preventDefault();
    const targetUrl = normalizeFreecellUrl(freecellEnter.href);
    enterFreecell(targetUrl, freecellEnter, { preserveCurrent: currentFreecellUrl === targetUrl && currentFreecellMode === "freecell", mode: "freecell" });
  });

  freecellMicrosoftEnter?.addEventListener("click", (event) => {
    event.preventDefault();
    const targetUrl = normalizeFreecellUrl(freecellMicrosoftEnter.href);
    enterFreecell(targetUrl, freecellMicrosoftEnter, { preserveCurrent: currentFreecellUrl === targetUrl && currentFreecellMode === "microsoft", mode: "microsoft" });
  });

  freecellHistoryEnter?.addEventListener("click", (event) => {
    event.preventDefault();
    const targetUrl = normalizeFreecellUrl(freecellHistoryEnter.href);
    enterFreecell(targetUrl, freecellHistoryEnter, { preserveCurrent: currentFreecellUrl === targetUrl && currentFreecellMode === "history", mode: "history" });
  });

  freecellClassicEnters.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      enterFreecell(link.href, link, { mode: "classic" });
    });
  });

  // 自由之都遊戲本體通知「離開」時，只收起 iframe；不清 src，保留目前牌局。
  window.addEventListener("message", (event) => {
    if (!freecellPage || !freecellEmbed || !freecellIframe) return;
    if (event.origin !== window.location.origin) return;
    if (event.source !== freecellIframe.contentWindow) return;

    if (event.data?.type === "slowly-freecell-open" && event.data?.mode === "freecell") {
      const targetUrl = normalizeFreecellUrl(freecellEnter?.href);
      enterFreecell(targetUrl, freecellEnter, { preserveCurrent: false, mode: "freecell" });
      return;
    }

    if (event.data?.type !== "slowly-freecell-leave") return;

    freecellPage.classList.remove("is-freecell-playing");
    book?.classList.remove("is-freecell-playing");
    freecellEmbed.hidden = true;
    requestAnimationFrame(() => {
      syncBookHeight();
      lastFreecellOpener?.focus?.();
    });
  });

  // 秩序之城與經典之境｜比照 FreeCell 的 iframe 入境、離境及切換。
  const empireEmbeds = new Map();
  for (const territory of ["territory-spider", "territory-klondike"]) {
    const page = bookPages.find((item) => item.dataset.bookPage === territory);
    const embed = document.querySelector(`[data-empire-embed="${territory}"]`);
    const iframe = document.querySelector(`[data-empire-iframe="${territory}"]`);
    if (page && embed && iframe) empireEmbeds.set(territory, { page, embed, iframe, url: "", opener: null });
  }

  function hideOtherEmpireGames(except = "") {
    for (const [territory, state] of empireEmbeds) {
      if (territory === except) continue;
      state.page.classList.remove("is-empire-playing");
      state.embed.hidden = true; // src 不清除：同一局再入境可繼續。
    }
    if (except !== "territory-freecell") {
      freecellPage?.classList.remove("is-freecell-playing");
      if (freecellEmbed) freecellEmbed.hidden = true;
      book?.classList.remove("is-freecell-playing");
    }
    book?.classList.toggle("is-empire-playing", [...empireEmbeds.values()].some(({ page }) => page.classList.contains("is-empire-playing")));
  }

  function enterEmpireGame(territory, url, opener) {
    const state = empireEmbeds.get(territory);
    if (!state || !url) return;
    const targetUrl = normalizeFreecellUrl(url);
    hideOtherEmpireGames(territory);
    state.opener = opener;
    // FreeCell 同款行為：同入口重進保留頁面；換難度重新載入 iframe。
    if (state.url !== targetUrl || !state.iframe.getAttribute("src")) {
      if (state.iframe.getAttribute("src")) state.iframe.removeAttribute("src");
      state.iframe.src = targetUrl;
      state.url = targetUrl;
    }
    state.page.classList.add("is-empire-playing");
    book?.classList.add("is-empire-playing");
    state.embed.hidden = false;
    const targetIndex = bookPages.indexOf(state.page);
    if (targetIndex !== activeBookIndex) turnBookTo(targetIndex);
    requestAnimationFrame(() => syncBookHeight(targetIndex));
  }

  document.querySelectorAll("[data-empire-game-enter]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      closeQuickPanel({ restoreFocus: false });
      enterEmpireGame(link.dataset.empireGameEnter, link.href, link);
    });
  });

  document.querySelector("[data-empire-freecell-quick]")?.addEventListener("click", (event) => {
    event.preventDefault();
    const link = event.currentTarget;
    closeQuickPanel({ restoreFocus: false });
    hideOtherEmpireGames("territory-freecell");
    enterFreecell(link.href, link, { preserveCurrent: currentFreecellUrl === normalizeFreecellUrl(link.href) && currentFreecellMode === "freecell", mode: "freecell" });
    const index = bookPages.indexOf(freecellPage);
    if (index !== activeBookIndex) turnBookTo(index);
  });

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin || event.data?.type !== "slowly-empire-leave") return;
    const state = empireEmbeds.get(event.data?.territory);
    if (!state || event.source !== state.iframe.contentWindow) return;
    state.page.classList.remove("is-empire-playing");
    state.embed.hidden = true;
    book?.classList.remove("is-empire-playing");
    requestAnimationFrame(() => {
      syncBookHeight();
      state.opener?.focus?.();
    });
  });

  document.querySelectorAll("[data-territory-jump]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const targetId = link.getAttribute("href")?.replace(/^#/, "");
      const targetIndex = bookPages.findIndex((page) => page.dataset.bookPage === targetId);
      closeQuickPanel({ restoreFocus: false });
      window.setTimeout(() => turnBookTo(targetIndex), 190);
    });
  });

  const initialHash = window.location.hash.replace(/^#/, "");
  const initialIndex = bookPages.findIndex((page) => page.dataset.bookPage === initialHash);
  if (initialIndex >= 0) turnBookTo(initialIndex, { instant: true });
  else {
    syncBookControls();
    requestAnimationFrame(() => syncBookHeight());
  }

  window.addEventListener("resize", () => syncBookHeight());

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && quickLayer && !quickLayer.hidden) closeQuickPanel();
  });

  const hero = document.querySelector(".hero");
  if (reduceMotion || !hero) return;

  const suits = ["♠", "♥", "♦", "♣"];
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < 18; i += 1) {
    const mote = document.createElement("span");
    mote.className = "royal-mote";
    mote.textContent = suits[i % suits.length];
    mote.style.left = `${4 + Math.random() * 92}%`;
    mote.style.animationDelay = `${Math.random() * -10}s`;
    mote.style.animationDuration = `${8 + Math.random() * 8}s`;
    mote.style.fontSize = `${10 + Math.random() * 10}px`;
    fragment.appendChild(mote);
  }

  hero.appendChild(fragment);
})();
