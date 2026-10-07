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

  document.querySelectorAll("[data-territory-jump]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const target = document.querySelector(link.getAttribute("href"));
      closeQuickPanel({ restoreFocus: false });
      window.setTimeout(() => target?.scrollIntoView({ behavior: "smooth", block: "start" }), 190);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && quickLayer && !quickLayer.hidden) closeQuickPanel();
  });

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
