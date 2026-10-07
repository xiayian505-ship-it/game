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
  let bookTimer = null;

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
    window.clearTimeout(bookTimer);
    fromPage?.classList.remove("is-active", "is-stage-exit");
    toPage?.classList.remove("is-book-reveal");
    toPage?.classList.add("is-active");
    activeBookIndex = targetIndex;
    bookTurning = false;
    book?.classList.remove("is-turning", "is-turning-next", "is-turning-prev", "is-curtain-transition");
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
      window.clearTimeout(bookTimer);
      bookPages.forEach((page, index) => {
        page.classList.toggle("is-active", index === targetIndex);
        page.classList.remove("is-book-reveal", "is-stage-exit", "is-book-flip-next", "is-book-flip-prev");
      });
      activeBookIndex = targetIndex;
      bookTurning = false;
      book?.classList.remove("is-turning", "is-turning-next", "is-turning-prev", "is-curtain-transition");
      syncBookControls();
      requestAnimationFrame(() => syncBookHeight());
      return;
    }

    bookTurning = true;
    book?.classList.add(
      "is-turning",
      "is-curtain-transition",
      direction === "next" ? "is-turning-next" : "is-turning-prev"
    );
    toPage.classList.add("is-book-reveal");
    fromPage.classList.add("is-stage-exit");
    syncBookHeight(targetIndex);

    const done = () => {
      if (!bookTurning) return;
      finishBookTurn(fromPage, toPage, targetIndex);
    };

    bookTimer = window.setTimeout(done, 1740);
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

  // 自由之都｜入境後整頁交給遊戲本體，只留下帝國翻頁箭頭與頁尾。
  const freecellPage = bookPages.find((page) => page.dataset.bookPage === "territory-freecell");
  const freecellEnter = document.querySelector("[data-freecell-enter]");
  const freecellEmbed = document.querySelector("[data-freecell-embed]");
  const freecellIframe = document.querySelector("[data-freecell-iframe]");

  freecellEnter?.addEventListener("click", (event) => {
    event.preventDefault();
    if (!freecellPage || !freecellEmbed || !freecellIframe) return;

    if (!freecellIframe.getAttribute("src")) freecellIframe.src = freecellEnter.href;
    freecellPage.classList.add("is-freecell-playing");
    freecellEmbed.hidden = false;
    requestAnimationFrame(() => syncBookHeight());
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
