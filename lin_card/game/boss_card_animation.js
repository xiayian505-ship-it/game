/** v0.8｜Boss 出牌演出。僅顯示實際已使用的卡牌；戰鬥結算仍由 battle_rules.js 執行。 */
(() => {
  "use strict";
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  function towardPlayer(card) {
    return card.type === "attack" || ["裂盾", "斷枝奪葉", "借影易形", "移花接木", "同命之契"].includes(card.name);
  }
  async function play(card, markup) {
    const boss = document.querySelector(".lc-battle-boss .lc-foe");
    const player = document.querySelector(".lc-battle-player");
    if (!boss || !player || !card) return;
    const scene = document.createElement("div");
    scene.className = "lc-boss-card-scene";
    scene.setAttribute("aria-label", `Boss 使用「${card.name}」`);
    scene.setAttribute("role", "status");
    const label = document.createElement("p");
    label.className = "lc-boss-card-label";
    label.textContent = `BOSS 使出 · ${card.name}`;
    const holder = document.createElement("div");
    holder.className = "lc-boss-card-holder";
    holder.innerHTML = markup; // 由既有 cardMarkup() 產生，沿用玩家卡牌的七大類樣式。
    const cardFace = holder.querySelector(".lc-card");
    if (!cardFace) return;
    scene.append(holder, label);
    document.body.append(scene);
    const bossBox = boss.getBoundingClientRect();
    const target = towardPlayer(card) ? player : document.querySelector(".lc-battle-boss");
    const aim = target.getBoundingClientRect();
    const size = holder.getBoundingClientRect();
    const w = size.width, h = size.height;
    const fromX = bossBox.left + bossBox.width / 2 - w / 2;
    const fromY = bossBox.top + bossBox.height / 2 - h / 2;
    const dx = aim.left + aim.width / 2 - (fromX + w / 2);
    const dy = aim.top + aim.height / 2 - (fromY + h / 2);
    holder.style.left = `${fromX}px`;
    holder.style.top = `${fromY}px`;
    label.style.left = `${Math.max(8, Math.min(window.innerWidth - 180, fromX + w / 2 - 90))}px`;
    label.style.top = `${Math.max(4, fromY - 30)}px`;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const animate = (element, frames, options) => element.animate
      ? element.animate(frames, options).finished.catch(() => {}) : pause(options.duration);
    try {
      if (reduced) { await pause(700); return; }
      await Promise.all([
        animate(holder, [
          { transform: "rotateY(90deg) scale(.65)", opacity: .4 },
          { transform: "rotateY(0deg) scale(1)", opacity: 1 }
        ], { duration: 360, easing: "ease-out", fill: "forwards" }),
        animate(boss, [
          { filter: "brightness(1)" }, { filter: "brightness(1.6)" }, { filter: "brightness(1)" }
        ], { duration: 410, easing: "ease-out" })
      ]);
      await pause(850); // 玩家可看清卡牌名稱、效果和等級。
      label.classList.add("is-flying");
      await animate(holder, [
        { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1 },
        { transform: `translate(${dx * .48}px,${dy * .48 - 20}px) scale(.80) rotate(7deg)`, opacity: 1, offset: .53 },
        { transform: `translate(${dx}px,${dy}px) scale(.20) rotate(-8deg)`, opacity: 0 }
      ], { duration: 580, easing: "cubic-bezier(.24,.64,.24,1)", fill: "forwards" });
      if (target.animate) await animate(target, [
        { filter: "brightness(1)" }, { filter: "brightness(1.55)" }, { filter: "brightness(1)" }
      ], { duration: 330, easing: "ease-out" });
    } finally { scene.remove(); }
  }
  window.MistBossCardAnimation = Object.freeze({ play });
})();
