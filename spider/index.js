/* =========================================================
   連環新接龍主頁｜功能本體 JS
   - 勝利圖鑑資料
   - checkbox 本機紀錄
   - 勝利特效延遲載入與播放
   新增勝利特效時，主要在 VICTORY_EFFECTS 加一筆。
========================================================= */

(function (global) {
  "use strict";

  const LIB_ROOT = "https://lib.stillnessbyslowly.com/effects/celebration/";
  const STORAGE_KEY = "sbs_spider_victory_gallery_v1";

  const MODES = Object.freeze([
    Object.freeze({ id: "easy", label: "初階模式" }),
    Object.freeze({ id: "medium", label: "中階模式" }),
    Object.freeze({ id: "hard", label: "高階模式" })
  ]);

  const VICTORY_EFFECTS = Object.freeze([
    Object.freeze({
      id: "confetti",
      name: "Confetti Burst",
      file: "confetti_burst",
      globalName: "SlowlyConfettiBurst",
      target: "stage"
    }),
    Object.freeze({
      id: "gold-rain",
      name: "Gold Rain",
      file: "gold_rain",
      globalName: "SlowlyGoldRain",
      target: "stage"
    }),
    Object.freeze({
      id: "stars",
      name: "Star Explosion",
      file: "star_explosion",
      globalName: "SlowlyStarExplosion",
      target: "stage"
    }),
    Object.freeze({
      id: "shockwave",
      name: "Shockwave",
      file: "shockwave",
      globalName: "SlowlyShockwave",
      target: "stage"
    }),
    Object.freeze({
      id: "flash-shake",
      name: "Flash Shake",
      file: "flash_shake",
      globalName: "SlowlyFlashShake",
      target: "stage"
    }),
    Object.freeze({
      id: "jackpot-pop",
      name: "Jackpot Pop",
      file: "jackpot_pop",
      globalName: "SlowlyJackpotPop",
      target: "card"
    }),
    Object.freeze({
      id: "card-rain",
      name: "Card Rain",
      file: "card_rain",
      globalName: "SlowlyCardRain",
      target: "stage"
    }),
    Object.freeze({
      id: "victory-beam",
      name: "Victory Beam",
      file: "victory_beam",
      globalName: "SlowlyVictoryBeam",
      target: "stage"
    }),
    Object.freeze({
      id: "classic-fireworks",
      name: "Classic Fireworks",
      file: "classic_fireworks",
      globalName: "SlowlyClassicFireworks",
      target: "stage"
    })
  ]);

  function emptyState() {
    return {
      easy: [],
      medium: [],
      hard: []
    };
  }

  function normalizeState(value) {
    const next = emptyState();
    const validIds = new Set(VICTORY_EFFECTS.map(effect => effect.id));

    for (const mode of MODES) {
      const source = Array.isArray(value?.[mode.id]) ? value[mode.id] : [];
      next[mode.id] = [...new Set(source.map(String).filter(id => validIds.has(id)))];
    }

    return next;
  }

  function readState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return normalizeState(raw ? JSON.parse(raw) : null);
    } catch (error) {
      console.warn("[Spider Home] 勝利圖鑑紀錄讀取失敗。", error);
      return emptyState();
    }
  }

  function writeState(state) {
    const normalized = normalizeState(state);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch (error) {
      console.warn("[Spider Home] 勝利圖鑑紀錄儲存失敗。", error);
    }
    return normalized;
  }

  function setChecked(modeId, effectId, checked) {
    const mode = MODES.find(item => item.id === String(modeId));
    const effect = VICTORY_EFFECTS.find(item => item.id === String(effectId));
    if (!mode || !effect) return false;

    const state = readState();
    const selected = new Set(state[mode.id]);

    if (checked) selected.add(effect.id);
    else selected.delete(effect.id);

    state[mode.id] = [...selected];
    writeState(state);
    return checked;
  }

  function isChecked(modeId, effectId) {
    return readState()[String(modeId)]?.includes(String(effectId)) || false;
  }

  function selectedCount(modeId, effects = VICTORY_EFFECTS) {
    const selected = new Set(readState()[String(modeId)] || []);
    return effects.reduce((count, effect) => count + (selected.has(effect.id) ? 1 : 0), 0);
  }

  const stylesheetPromises = new Map();
  const scriptPromises = new Map();
  let currentPlayback = null;
  let playGeneration = 0;

  function ensureStylesheet(url) {
    if (stylesheetPromises.has(url)) return stylesheetPromises.get(url);

    const existing = [...document.styleSheets]
      .map(sheet => sheet.href)
      .find(href => href === url);

    if (existing) {
      const resolved = Promise.resolve();
      stylesheetPromises.set(url, resolved);
      return resolved;
    }

    const promise = new Promise((resolve, reject) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      link.onload = () => resolve();
      link.onerror = () => reject(new Error(`CSS 載入失敗：${url}`));
      document.head.appendChild(link);
    });

    stylesheetPromises.set(url, promise);
    return promise;
  }

  function ensureScript(url, globalName) {
    if (global[globalName]?.play) return Promise.resolve();
    if (scriptPromises.has(url)) return scriptPromises.get(url);

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.onload = () => {
        if (global[globalName]?.play) resolve();
        else reject(new Error(`${globalName} 載入後未找到 play()`));
      };
      script.onerror = () => reject(new Error(`JS 載入失敗：${url}`));
      document.body.appendChild(script);
    });

    scriptPromises.set(url, promise);
    return promise;
  }

  function effectUrls(effect) {
    return {
      css: `${LIB_ROOT}${effect.file}.css`,
      js: `${LIB_ROOT}${effect.file}.js`
    };
  }

  function clearCurrentPlayback() {
    if (!currentPlayback) return;

    const { effect, target } = currentPlayback;
    const api = global[effect.globalName];

    try {
      api?.clear?.(target);
    } catch (error) {
      console.warn(`[Spider Home] ${effect.name} 清除失敗。`, error);
    }

    currentPlayback = null;
  }

  function clearPlayback() {
    playGeneration += 1;
    clearCurrentPlayback();
  }

  async function playEffect(effectId, stage, previewCard) {
    const effect = VICTORY_EFFECTS.find(item => item.id === String(effectId));
    if (!effect) throw new Error(`找不到勝利特效：${effectId}`);
    if (!(stage instanceof Element) || !(previewCard instanceof Element)) {
      throw new TypeError("勝利圖鑑播放舞台不存在。");
    }

    const requestId = ++playGeneration;
    clearCurrentPlayback();

    const urls = effectUrls(effect);
    await Promise.all([
      ensureStylesheet(urls.css),
      ensureScript(urls.js, effect.globalName)
    ]);

    if (requestId !== playGeneration) return effect;

    const api = global[effect.globalName];
    if (!api?.play) throw new Error(`${effect.globalName} 尚未正確載入。`);

    const target = effect.target === "card" ? previewCard : stage;
    currentPlayback = { effect, target };

    const options = { zIndex: 3 };
    if (effect.id === "flash-shake") options.shakeTarget = stage;

    Promise.resolve(api.play(target, options)).catch(error => {
      console.warn(`[Spider Home] ${effect.name} 播放失敗。`, error);
    });

    return effect;
  }

  global.SpiderHome = Object.freeze({
    modes: MODES,
    effects: VICTORY_EFFECTS,
    storageKey: STORAGE_KEY,
    readState,
    writeState,
    setChecked,
    isChecked,
    selectedCount,
    playEffect,
    clearPlayback
  });
})(window);
