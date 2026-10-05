/* =========================================================
   連環新接龍主頁｜UI 互動 JS
   - 勝利圖鑑 Tree DOM
   - checkbox 操作
   - 點名稱播放軍火庫勝利特效
========================================================= */

(function (global) {
  "use strict";

  const app = global.SpiderHome;
  const TreeSelection = global.TreeSelection;
  const treeRoot = document.getElementById("galleryTree");
  const stage = document.getElementById("galleryStage");
  const stageLabel = document.getElementById("galleryStageLabel");
  const previewCard = document.getElementById("galleryPreviewCard");

  if (!app || !treeRoot || !stage || !stageLabel || !previewCard) return;

  if (!TreeSelection?.create) {
    console.error("[Spider Home] TreeSelection 尚未載入。");
    return;
  }

  const difficultyTree = TreeSelection.create({ expansion: "single" });
  const rangeTree = TreeSelection.create({ expansion: "single" });
  let currentEffectId = "";

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function groupsOfTwenty() {
    const groups = [];

    for (let start = 0; start < app.effects.length; start += 20) {
      const items = app.effects.slice(start, start + 20);
      groups.push({
        start: start + 1,
        end: start + 20,
        label: `${pad(start + 1)}－${pad(start + 20)}`,
        items
      });
    }

    return groups;
  }

  function button(className, text) {
    const node = document.createElement("button");
    node.type = "button";
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function countText(modeId, effects) {
    return `${app.selectedCount(modeId, effects)} / ${effects.length}`;
  }

  function renderItem(mode, effect, index) {
    const row = document.createElement("div");
    row.className = "gallery-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = app.isChecked(mode.id, effect.id);
    checkbox.setAttribute("aria-label", `${mode.label} ${effect.name} 看過`);

    checkbox.addEventListener("change", () => {
      app.setChecked(mode.id, effect.id, checkbox.checked);
      render();
    });

    const playButton = button("gallery-effect-button");
    playButton.dataset.effectId = effect.id;
    if (currentEffectId === effect.id) playButton.classList.add("is-current");

    const number = document.createElement("span");
    number.className = "gallery-effect-number";
    number.textContent = pad(index + 1);

    const name = document.createElement("span");
    name.textContent = effect.name;

    playButton.append(number, name);
    playButton.addEventListener("click", () => play(effect));

    row.append(checkbox, playButton);
    return row;
  }

  function renderRange(mode, group) {
    const wrap = document.createElement("div");
    wrap.className = "gallery-range";

    const key = `${mode.id}:${group.start}`;
    const expanded = rangeTree.isExpanded(key);
    const toggle = button("gallery-range-toggle");
    toggle.setAttribute("aria-expanded", String(expanded));

    const arrow = document.createElement("span");
    arrow.className = "gallery-arrow";
    arrow.textContent = expanded ? "▾" : "▸";

    const label = document.createElement("span");
    label.textContent = group.label;

    const count = document.createElement("span");
    count.className = "gallery-count";
    count.textContent = countText(mode.id, group.items);

    toggle.append(arrow, label, count);
    toggle.addEventListener("click", () => {
      rangeTree.toggleExpanded(key);
      render();
    });

    wrap.appendChild(toggle);

    if (expanded) {
      const items = document.createElement("div");
      items.className = "gallery-items";
      group.items.forEach(effect => {
        const index = app.effects.findIndex(item => item.id === effect.id);
        items.appendChild(renderItem(mode, effect, index));
      });
      wrap.appendChild(items);
    }

    return wrap;
  }

  function renderDifficulty(mode) {
    const wrap = document.createElement("section");
    wrap.className = "gallery-difficulty";

    const expanded = difficultyTree.isExpanded(mode.id);
    const toggle = button("gallery-toggle");
    toggle.setAttribute("aria-expanded", String(expanded));

    const arrow = document.createElement("span");
    arrow.className = "gallery-arrow";
    arrow.textContent = expanded ? "▾" : "▸";

    const label = document.createElement("strong");
    label.textContent = mode.label;

    const count = document.createElement("span");
    count.className = "gallery-count";
    count.textContent = countText(mode.id, app.effects);

    toggle.append(arrow, label, count);
    toggle.addEventListener("click", () => {
      const wasExpanded = difficultyTree.isExpanded(mode.id);
      difficultyTree.toggleExpanded(mode.id);

      if (wasExpanded || !difficultyTree.isExpanded(mode.id)) {
        rangeTree.collapseAll();
      } else {
        const opened = rangeTree.getExpanded()[0];
        if (opened && !opened.startsWith(`${mode.id}:`)) rangeTree.collapseAll();
      }

      render();
    });

    wrap.appendChild(toggle);

    if (expanded) {
      const ranges = document.createElement("div");
      ranges.className = "gallery-ranges";
      groupsOfTwenty().forEach(group => ranges.appendChild(renderRange(mode, group)));
      wrap.appendChild(ranges);
    }

    return wrap;
  }

  function render() {
    treeRoot.replaceChildren();
    app.modes.forEach(mode => treeRoot.appendChild(renderDifficulty(mode)));
  }

  async function play(effect) {
    currentEffectId = effect.id;
    stageLabel.textContent = effect.name;
    render();

    try {
      await app.playEffect(effect.id, stage, previewCard);
    } catch (error) {
      console.error("[Spider Home] 勝利特效播放失敗。", error);
      stageLabel.textContent = `${effect.name} · 載入失敗`;
      return;
    }

    const reduceMotion = global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    stage.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "nearest"
    });
  }

  render();
})(window);
