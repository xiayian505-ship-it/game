// 畫面渲染與文字提示；不更動遊戲規則。
(() => {
  'use strict';
  const game = window.SBSPeriodicV1;
  const $ = game.$;
  // 與 match3_v1 相同：原生 select 保留資料與 change，外觀由軍火庫接管。
  game.modeSelect = window.SlowlySelect.createAll('select[data-slowly-select]')[0];

  // 與 Match3 相同的同頁分頁：只切換畫面，不重置棋盤。
  const tabs = [...document.querySelectorAll('[data-view-target]')];
  const panels = [...document.querySelectorAll('[data-view-panel]')];
  const viewSelection = window.TreeSelection.create({ selected: ['game'] });
  function showView(view) {
    viewSelection.replaceSelected([view]);
    tabs.forEach(tab => {
      const selected = viewSelection.has(tab.dataset.viewTarget);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    panels.forEach(panel => {
      panel.hidden = !viewSelection.has(panel.dataset.viewPanel);
    });
  }
  // 比照 match3_v1：離開遊戲頁就暫停，換分頁不會重置棋盤。
  tabs.forEach(tab => tab.addEventListener('click', () => {
    const nextView = tab.dataset.viewTarget;
    if (nextView !== 'game') game.requestAutoPause();
    showView(nextView);
    if (nextView === 'achievements') {
      game.renderPeriodicTable();
      game.renderMoleculeCollection();
    }
    if (nextView === 'ranking') {
      void game.renderTop3().catch(error => {
        console.error('[Periodic] 讀取排行榜失敗：', error);
        $('rankList').textContent = '暫時無法讀取排行榜。';
      });
    }
  }));
  document.getElementById('settingsHelp').addEventListener('click', () => game.showHelp());
  // 軍火庫只管理展開狀態；本專案負責 DOM 與畫面。
  const recipeTree = window.TreeSelection.create({ expansion: 'single' });
  const recipeToggle = $('recipeToggle');
  const recipeContent = $('recipeContent');
  recipeToggle.addEventListener('click', () => {
    const expanded = recipeTree.toggleExpanded('current-level-recipes');
    recipeToggle.setAttribute('aria-expanded', String(expanded));
    recipeToggle.textContent = '本關合成表';
    recipeContent.hidden = !expanded;
  });
  showView('game');

  /*
   * 第一至第三週期由 HTML 靜態呈現，這裡補齊第 19 至 118 號元素。
   * 鑭系與錒系另列在下方，因此使用第 9、10 列；第 8 列是視覺間隔。
   * 灰色元素只用於圖鑑，不會加入遊戲的元素池或合成配方。
   */
  const otherPeriodicElements = [
    [19, 'K', 4, 1],
    [20, 'Ca', 4, 2],
    [21, 'Sc', 4, 3],
    [22, 'Ti', 4, 4],
    [23, 'V', 4, 5],
    [24, 'Cr', 4, 6],
    [25, 'Mn', 4, 7],
    [26, 'Fe', 4, 8],
    [27, 'Co', 4, 9],
    [28, 'Ni', 4, 10],
    [29, 'Cu', 4, 11],
    [30, 'Zn', 4, 12],
    [31, 'Ga', 4, 13],
    [32, 'Ge', 4, 14],
    [33, 'As', 4, 15],
    [34, 'Se', 4, 16],
    [35, 'Br', 4, 17],
    [36, 'Kr', 4, 18],
    [37, 'Rb', 5, 1],
    [38, 'Sr', 5, 2],
    [39, 'Y', 5, 3],
    [40, 'Zr', 5, 4],
    [41, 'Nb', 5, 5],
    [42, 'Mo', 5, 6],
    [43, 'Tc', 5, 7],
    [44, 'Ru', 5, 8],
    [45, 'Rh', 5, 9],
    [46, 'Pd', 5, 10],
    [47, 'Ag', 5, 11],
    [48, 'Cd', 5, 12],
    [49, 'In', 5, 13],
    [50, 'Sn', 5, 14],
    [51, 'Sb', 5, 15],
    [52, 'Te', 5, 16],
    [53, 'I', 5, 17],
    [54, 'Xe', 5, 18],
    [55, 'Cs', 6, 1],
    [56, 'Ba', 6, 2],
    [72, 'Hf', 6, 4],
    [73, 'Ta', 6, 5],
    [74, 'W', 6, 6],
    [75, 'Re', 6, 7],
    [76, 'Os', 6, 8],
    [77, 'Ir', 6, 9],
    [78, 'Pt', 6, 10],
    [79, 'Au', 6, 11],
    [80, 'Hg', 6, 12],
    [81, 'Tl', 6, 13],
    [82, 'Pb', 6, 14],
    [83, 'Bi', 6, 15],
    [84, 'Po', 6, 16],
    [85, 'At', 6, 17],
    [86, 'Rn', 6, 18],
    [87, 'Fr', 7, 1],
    [88, 'Ra', 7, 2],
    [104, 'Rf', 7, 4],
    [105, 'Db', 7, 5],
    [106, 'Sg', 7, 6],
    [107, 'Bh', 7, 7],
    [108, 'Hs', 7, 8],
    [109, 'Mt', 7, 9],
    [110, 'Ds', 7, 10],
    [111, 'Rg', 7, 11],
    [112, 'Cn', 7, 12],
    [113, 'Nh', 7, 13],
    [114, 'Fl', 7, 14],
    [115, 'Mc', 7, 15],
    [116, 'Lv', 7, 16],
    [117, 'Ts', 7, 17],
    [118, 'Og', 7, 18],
    [57, 'La', 9, 3],
    [58, 'Ce', 9, 4],
    [59, 'Pr', 9, 5],
    [60, 'Nd', 9, 6],
    [61, 'Pm', 9, 7],
    [62, 'Sm', 9, 8],
    [63, 'Eu', 9, 9],
    [64, 'Gd', 9, 10],
    [65, 'Tb', 9, 11],
    [66, 'Dy', 9, 12],
    [67, 'Ho', 9, 13],
    [68, 'Er', 9, 14],
    [69, 'Tm', 9, 15],
    [70, 'Yb', 9, 16],
    [71, 'Lu', 9, 17],
    [89, 'Ac', 10, 3],
    [90, 'Th', 10, 4],
    [91, 'Pa', 10, 5],
    [92, 'U', 10, 6],
    [93, 'Np', 10, 7],
    [94, 'Pu', 10, 8],
    [95, 'Am', 10, 9],
    [96, 'Cm', 10, 10],
    [97, 'Bk', 10, 11],
    [98, 'Cf', 10, 12],
    [99, 'Es', 10, 13],
    [100, 'Fm', 10, 14],
    [101, 'Md', 10, 15],
    [102, 'No', 10, 16],
    [103, 'Lr', 10, 17],
  ];

  // 大圖使用繁體中文元素名稱；遊戲元素與其他元素共用這份顯示資料。
  // 少數超重元素的中文字屬擴充字，未安裝對應字型時仍保留英文符號。
  const elementChineseNames = Object.freeze({
    1: '氫',
    2: '氦',
    3: '鋰',
    4: '鈹',
    5: '硼',
    6: '碳',
    7: '氮',
    8: '氧',
    9: '氟',
    10: '氖',
    11: '鈉',
    12: '鎂',
    13: '鋁',
    14: '矽',
    15: '磷',
    16: '硫',
    17: '氯',
    18: '氬',
    19: '鉀',
    20: '鈣',
    21: '鈧',
    22: '鈦',
    23: '釩',
    24: '鉻',
    25: '錳',
    26: '鐵',
    27: '鈷',
    28: '鎳',
    29: '銅',
    30: '鋅',
    31: '鎵',
    32: '鍺',
    33: '砷',
    34: '硒',
    35: '溴',
    36: '氪',
    37: '銣',
    38: '鍶',
    39: '釔',
    40: '鋯',
    41: '鈮',
    42: '鉬',
    43: '鍀',
    44: '釕',
    45: '銠',
    46: '鈀',
    47: '銀',
    48: '鎘',
    49: '銦',
    50: '錫',
    51: '銻',
    52: '碲',
    53: '碘',
    54: '氙',
    55: '銫',
    56: '鋇',
    57: '鑭',
    58: '鈰',
    59: '鐠',
    60: '釹',
    61: '鉕',
    62: '釤',
    63: '銪',
    64: '釓',
    65: '鋱',
    66: '鏑',
    67: '鈥',
    68: '鉺',
    69: '銩',
    70: '鐿',
    71: '鎦',
    72: '鉿',
    73: '鉭',
    74: '鎢',
    75: '錸',
    76: '鋨',
    77: '銥',
    78: '鉑',
    79: '金',
    80: '汞',
    81: '鉈',
    82: '鉛',
    83: '鉍',
    84: '釙',
    85: '砹',
    86: '氡',
    87: '鈁',
    88: '鐳',
    89: '錒',
    90: '釷',
    91: '鏷',
    92: '鈾',
    93: '錼',
    94: '鈽',
    95: '鋂',
    96: '鋦',
    97: '錇',
    98: '鉲',
    99: '鑀',
    100: '鐨',
    101: '鍆',
    102: '鍩',
    103: '鐒',
    104: '鑪',
    105: '𨧀',
    106: '𨭎',
    107: '𨨏',
    108: '鎚',
    109: '鐽',
    110: '𨱔',
    111: '錀',
    112: '鎶',
    113: '鉨',
    114: '𫓧',
    115: '鏌',
    116: '鉝',
    117: '鿬',
    118: '鐚',
  });

  function completePeriodicTable() {
    const grid = $('periodicGrid');
    const fragment = document.createDocumentFragment();

    for (const [number, symbol, row, column] of otherPeriodicElements) {
      const tile = document.createElement('div');
      tile.className = 'periodic-element periodic-element--other';
      tile.style.setProperty('--period-row', String(row));
      tile.style.setProperty('--period-col', String(column));
      tile.setAttribute('aria-hidden', 'true');
      tile.title = `${number} ${symbol}`;

      const atomicNumber = document.createElement('span');
      atomicNumber.className = 'periodic-number';
      atomicNumber.textContent = String(number);

      const elementSymbol = document.createElement('strong');
      elementSymbol.className = 'periodic-symbol';
      elementSymbol.textContent = symbol;

      const chineseName = document.createElement('span');
      chineseName.className = 'periodic-name';
      chineseName.textContent = elementChineseNames[number];

      tile.append(atomicNumber, elementSymbol, chineseName);
      fragment.appendChild(tile);
    }

    for (const [row, label] of [[6, '鑭系'], [7, '錒系']]) {
      const tile = document.createElement('div');
      tile.className = 'periodic-element periodic-element--other periodic-element--series';
      tile.style.setProperty('--period-row', String(row));
      tile.style.setProperty('--period-col', '3');
      tile.setAttribute('aria-hidden', 'true');
      tile.title = `${label}元素排列在週期表下方`;

      const symbol = document.createElement('strong');
      symbol.className = 'periodic-symbol';
      symbol.textContent = '↓';

      const name = document.createElement('span');
      name.className = 'periodic-name';
      name.textContent = label;

      tile.append(symbol, name);
      fragment.appendChild(tile);
    }

    grid.appendChild(fragment);
  }

  completePeriodicTable();

  /* 成就週期表大圖：沿用既有完整週期表的格位，不建立第二份元素資料。
     中文只在大圖完整呈現；小圖保持原本的 18 欄縮放版。 */
  const zoomDialog = $('periodicZoomDialog');
  const zoomGrid = $('periodicZoomGrid');
  const zoomScroll = $('periodicZoomScroll');
  const detailDialog = $('periodicDetailDialog');
  let previousZoomFocus = null;
  let previousDetailFocus = null;

  function showPeriodicElementDetail(element) {
    previousDetailFocus = document.activeElement;
    $('periodicDetailTitle').textContent = `${element.symbol}・${element.name}`;
    $('periodicDetailName').textContent = `${element.symbol}　${element.name}`;
    $('periodicDetailNumber').textContent = `原子序 ${element.number}`;
    $('periodicDetailStatus').textContent =
      `普通模式第 ${element.unlockLevel} 關解鎖`;
    $('periodicDetailIcon').replaceChildren(game.atom(element.symbol, 'large'));
    detailDialog.showModal();
  }

  function buildPeriodicZoomTable() {
    // 小圖已包含前 18 個元素和後續補齊的元素，直接複製能保證格位一致。
    zoomGrid.replaceChildren(...Array.from($('periodicGrid').children, tile => tile.cloneNode(true)));

    for (const tile of Array.from(zoomGrid.children)) {
      const number = Number(tile.querySelector('.periodic-number')?.textContent);
      const symbol = tile.querySelector('.periodic-symbol')?.textContent;
      const element = game.elements.find(item => item.symbol === symbol);

      if (!Number.isInteger(number)) {
        // 鑭系與錒系的導引格不是元素；保持原本位置即可。
        tile.removeAttribute('aria-hidden');
        continue;
      }

      const chineseName = elementChineseNames[number];
      let name = tile.querySelector('.periodic-name');
      if (!name) {
        name = document.createElement('span');
        name.className = 'periodic-name';
        tile.append(name);
      }
      name.textContent = chineseName;

      if (!element) {
        tile.removeAttribute('aria-hidden');
        tile.setAttribute('role', 'img');
        tile.setAttribute('aria-label', `${number} ${symbol} ${chineseName}`);
        continue;
      }

      // 遊戲內的五個元素才轉成真正的按鈕，可鍵盤操作與點擊。
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `${tile.className} periodic-element--interactive`;
      button.style.cssText = tile.style.cssText;
      button.dataset.element = element.symbol;
      button.dataset.unlocked = tile.dataset.unlocked;
      button.setAttribute('aria-label', `${element.name} ${element.symbol}：查看遊戲元素資訊`);
      button.append(...Array.from(tile.childNodes));
      tile.replaceWith(button);
      button.addEventListener('click', () => showPeriodicElementDetail(element));
    }
  }

  buildPeriodicZoomTable();
  $('periodicZoomOpen').addEventListener('click', () => {
    game.renderPeriodicTable();
    previousZoomFocus = document.activeElement;
    zoomDialog.showModal();
    // 初次打開先看最左側的 H；滑動提示讓玩家知道右邊還有 O、S。
    zoomScroll.scrollLeft = 0;
  });

  $('periodicZoomClose').addEventListener('click', () => zoomDialog.close());
  $('periodicDetailClose').addEventListener('click', () => detailDialog.close());
  zoomDialog.addEventListener('close', () => previousZoomFocus?.focus?.());
  detailDialog.addEventListener('close', () => previousDetailFocus?.focus?.());

  // 桌面點擊視窗外側也能關閉；點擊元素或內容區不會誤關閉。
  for (const dialog of [zoomDialog, detailDialog]) {
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
  }

  game.atom = (symbol, extraClass = '') => {
    const element = document.createElement('span');
    element.className = symbol
      ? `atom ${symbol} ${extraClass}`
      : `atom atom--placeholder ${extraClass}`;
    element.textContent = symbol || '—';
    return element;
  };

  // Unicode 下標只用在可見的化學式；棋盤仍使用單字母元素符號。
  game.displayFormula = formula => formula.replace(/[0-9]/g, number => {
    return '₀₁₂₃₄₅₆₇₈₉'[Number(number)];
  });

  game.say = text => {
    $('message').textContent = text;
  };

  /* Match3 同款倉庫排行榜：模式獨立、本機 TOP 3、分數／時間／步數排序。
     同一場以 runId 取代舊分數，不會因為按多次「分數紀錄」占用多個名次。 */
  const scoreStore = window.FictionStorage.create({ namespace: 'SBS_periodic_rank_v2' });
  const rankingCollections = Object.freeze({
    normal: scoreStore.collection('top3'),
    endless: scoreStore.collection('top3_endless')
  });
  // 成就使用獨立的 FictionStorage Namespace，只有普通模式能新增解鎖。
  const progressStore = window.FictionStorage.create({
    namespace: 'SBS_periodic_progress_v1'
  });
  const progressCollection = progressStore.collection('normal_unlocks');
  let highestNormalLevel = 0;
  let progressLoaded = false;
  let progressLoadFailed = false;
  let progressWrites = Promise.resolve();

  const progressReady = progressCollection.all()
    .then(rows => {
      highestNormalLevel = Math.max(
        0,
        ...rows.map(row => Number(row.highestLevel) || 0)
      );
      progressLoaded = true;
    })
    .catch(error => {
      progressLoaded = true;
      progressLoadFailed = true;
      console.error('[Periodic] 成就進度讀取失敗：', error);
    });

  game.renderPeriodicTable = () => {
    if (!progressLoaded) return;

    let unlockedCount = 0;
    for (const element of game.elements) {
      const tiles = document.querySelectorAll(`[data-element="${element.symbol}"]`);
      if (!tiles.length) continue;

      const unlocked = highestNormalLevel >= element.unlockLevel;
      for (const tile of tiles) {
        tile.dataset.unlocked = String(unlocked);
        tile.setAttribute(
          'aria-label',
          unlocked
            ? `${element.name} ${element.symbol}：已解鎖${tile.matches('button') ? '，查看元素資訊' : ''}`
            : `${element.name} ${element.symbol}：普通模式第 ${element.unlockLevel} 關解鎖${tile.matches('button') ? '，查看元素資訊' : ''}`
        );
      }
      if (unlocked) unlockedCount++;
    }

    const summary = $('periodicSummary');
    if (progressLoadFailed) {
      summary.textContent = '無法讀取成就紀錄；本次遊戲仍可繼續解鎖。';
    } else if (highestNormalLevel === 0) {
      summary.textContent = '尚未開始普通模式；無盡模式不會解鎖元素成就。';
    } else {
      summary.textContent = `已點亮 ${unlockedCount} / ${game.elements.length} 種元素・普通模式最高第 ${highestNormalLevel} 關。`;
    }
  };

  game.unlockThroughLevel = level => {
    if (game.mode !== 'normal') return Promise.resolve();

    progressWrites = progressWrites.then(async () => {
      await progressReady;
      if (level <= highestNormalLevel) return;

      highestNormalLevel = level;
      progressLoadFailed = false;
      game.renderPeriodicTable();
      game.renderMoleculeCollection();
      await progressCollection.replace([{
        id: 'normal',
        highestLevel: highestNormalLevel
      }]);
    }).catch(error => {
      console.error('[Periodic] 成就進度儲存失敗：', error);
      progressLoadFailed = true;
      game.renderPeriodicTable();
    });

    return progressWrites;
  };

  void progressReady.then(() => {
    game.renderPeriodicTable();
    game.renderMoleculeCollection();
  });

  // 分子收集獨立於普通模式關卡進度：普通／無盡都能永久點亮同一份圖鑑。
  // 舊版 normal_unlocks 與排行榜 Collection 原封不動，不需遷移既有紀錄。
  const moleculeCollection = progressStore.collection('molecule_discoveries');
  const knownFormulas = new Set(game.recipes.map(recipe => recipe.formula));
  let discoveredMolecules = new Set();
  let moleculesLoaded = false;
  let moleculesLoadFailed = false;
  let moleculesWriteFailed = false;
  let moleculeWrites = Promise.resolve();

  const moleculeReady = moleculeCollection.all()
    .then(rows => {
      const saved = rows.flatMap(row => Array.isArray(row.formulas) ? row.formulas : []);
      discoveredMolecules = new Set(saved.filter(formula => knownFormulas.has(formula)));
      moleculesLoaded = true;
    })
    .catch(error => {
      moleculesLoaded = true;
      moleculesLoadFailed = true;
      console.error('[Periodic] 分子圖鑑讀取失敗：', error);
    });

  // 軍火庫分頁只處理資料範圍；前後頁按鈕、翻牌及可讀性由宿主負責。
  const moleculePageSize = 8;
  let moleculePage = 1;

  function setMoleculeCardFlip(card, recipe, collected, flipped) {
    const formula = game.displayFormula(recipe.formula);
    const showBack = collected && flipped;
    card.dataset.flipped = String(showBack);
    if (collected) {
      card.setAttribute('aria-pressed', String(showBack));
    } else {
      card.removeAttribute('aria-pressed');
    }
    card.setAttribute(
      'aria-label',
      collected
        ? `${formula} ${recipe.name}，已收集；` +
          (showBack ? '目前是背面，按下返回正面' : '按下翻開查看解鎖關卡與合成資料')
        : `${formula} ${recipe.name}，尚未收集；成功合成後才能翻牌`
    );
    card.querySelector('.molecule-card-front').setAttribute('aria-hidden', String(showBack));
    card.querySelector('.molecule-card-back')?.setAttribute('aria-hidden', String(!showBack));
  }

  function createMoleculeCard(recipe) {
    const collected = discoveredMolecules.has(recipe.formula);
    const normalUnlocked = highestNormalLevel >= recipe.l;
    const formulaText = game.displayFormula(recipe.formula);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'molecule-card slowly-press';
    card.dataset.formula = recipe.formula;
    card.dataset.collected = String(collected);
    card.disabled = !collected;

    const inner = document.createElement('span');
    inner.className = 'molecule-card-inner';

    const front = document.createElement('span');
    front.className = 'molecule-card-face molecule-card-front';
    const formula = document.createElement('strong');
    formula.className = 'molecule-formula';
    formula.textContent = formulaText;
    const name = document.createElement('span');
    name.className = 'molecule-name';
    name.textContent = recipe.name;
    const status = document.createElement('span');
    status.className = 'molecule-status';
    status.textContent = collected
      ? '✓ 已收集'
      : normalUnlocked
        ? '尚未收集'
        : '普通模式尚未解鎖';
    const frontHint = document.createElement('span');
    frontHint.className = 'molecule-flip-hint';
    frontHint.textContent = collected ? '點擊翻牌 ↻' : '成功合成後可翻牌';
    front.append(formula, name, status, frontHint);

    inner.append(front);
    if (collected) {
      // 未收集時不建立背面資料；成功合成且存檔後才開放翻牌。
      const back = document.createElement('span');
      back.className = 'molecule-card-face molecule-card-back';
      const backTitle = document.createElement('strong');
      backTitle.className = 'molecule-back-title';
      backTitle.textContent = `${formulaText} · ${recipe.name}`;
      const level = document.createElement('span');
      level.className = 'molecule-unlock-level';
      level.textContent = `第 ${recipe.l} 關解鎖`;
      const points = document.createElement('span');
      points.className = 'molecule-points';
      points.textContent = `合成 +${recipe.p} 分`;
      const arrangement = document.createElement('span');
      arrangement.className = 'molecule-arrangement';
      arrangement.setAttribute('aria-label', `棋盤排列：${recipe.s}`);
      for (const symbol of recipe.s) {
        arrangement.append(game.atom(symbol));
      }
      back.append(backTitle, level, points, arrangement);
      inner.append(back);
    }
    card.append(inner);

    setMoleculeCardFlip(card, recipe, collected, false);
    if (collected) {
      card.addEventListener('click', () => {
        setMoleculeCardFlip(card, recipe, collected, card.dataset.flipped !== 'true');
      });
    }
    return card;
  }

  game.renderMoleculeCollection = () => {
    if (!moleculesLoaded) return;

    // 資料切頁直接引用軍火庫；配方增加後總頁數會自動成長。
    const paged = window.FictionPaginate.paginate(game.recipes, {
      page: moleculePage,
      pageSize: moleculePageSize
    });
    moleculePage = paged.page;
    const fragment = document.createDocumentFragment();
    for (const recipe of paged.data) {
      fragment.append(createMoleculeCard(recipe));
    }
    $('moleculeCollection').replaceChildren(fragment);
    $('moleculePagePrev').disabled = !paged.hasPrevious;
    $('moleculePageNext').disabled = !paged.hasNext;
    $('moleculePageStatus').textContent = `第 ${paged.page} / ${paged.totalPages} 頁`;

    $('moleculeCount').textContent = `${discoveredMolecules.size} / ${game.recipes.length}`;
    const summary = $('moleculeSummary');
    if (moleculesLoadFailed) {
      summary.textContent = '無法讀取已儲存的分子圖鑑，請檢查瀏覽器儲存權限。';
    } else if (moleculesWriteFailed) {
      summary.textContent = '有分子紀錄尚未儲存成功，請再合成一次重試。';
    } else if (discoveredMolecules.size === game.recipes.length) {
      summary.textContent = `🎉 ${game.recipes.length} 種分子全部收集完成！`;
    } else {
      summary.textContent = `已收集 ${discoveredMolecules.size} / ${game.recipes.length} 種分子，兩種模式的合成成果共用。`;
    }
  };

  $('moleculePagePrev').addEventListener('click', () => {
    if (moleculePage <= 1) return;
    moleculePage--;
    game.renderMoleculeCollection();
  });

  $('moleculePageNext').addEventListener('click', () => {
    moleculePage++;
    game.renderMoleculeCollection();
  });

  game.recordMolecules = formulas => {
    const found = [...new Set(formulas)].filter(formula => knownFormulas.has(formula));
    if (found.length === 0) return Promise.resolve(true);

    // 依序讀取／合併／寫回：連續合成不會因非同步儲存覆蓋上一筆。
    moleculeWrites = moleculeWrites.then(async () => {
      await moleculeReady;
      if (moleculesLoadFailed) return false;

      const next = new Set([...discoveredMolecules, ...found]);
      if (next.size === discoveredMolecules.size) return true;

      // 成功寫入後才點亮，避免儲存失敗卻顯示成永久收集。
      await moleculeCollection.replace([{
        id: 'molecules',
        formulas: [...next].sort()
      }]);
      discoveredMolecules = next;
      moleculesWriteFailed = false;
      game.renderMoleculeCollection();
      return true;
    }).catch(error => {
      moleculesWriteFailed = true;
      console.error('[Periodic] 分子圖鑑儲存失敗：', error);
      game.renderMoleculeCollection();
      return false;
    });

    return moleculeWrites;
  };

  void moleculeReady.then(() => game.renderMoleculeCollection());

  const rankTabs = [...document.querySelectorAll('[data-rank-mode]')];
  let rankRenderVersion = 0;

  function normalizedMode(mode) {
    return Object.prototype.hasOwnProperty.call(game.modes, mode) ? mode : 'normal';
  }

  function sortTop3(rows) {
    const sorted = window.FictionSort.sort(rows, {
      direction: 'asc',
      compare: (a, b) => Number(b.score) - Number(a.score)
        || Number(a.timeMs) - Number(b.timeMs)
        || Number(a.steps) - Number(b.steps)
    });
    return window.FictionPaginate.paginate(sorted, { page: 1, pageSize: 3 }).data;
  }

  game.renderTop3 = async (mode = game.rankingMode) => {
    const selectedMode = normalizedMode(mode);
    game.rankingMode = selectedMode;
    const renderVersion = ++rankRenderVersion;
    rankTabs.forEach(tab => {
      const selected = tab.dataset.rankMode === selectedMode;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });

    const rows = await rankingCollections[selectedMode].all();
    if (renderVersion !== rankRenderVersion || selectedMode !== game.rankingMode) return;

    const list = $('rankList');
    list.replaceChildren();
    const top3 = sortTop3(rows);
    if (top3.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'rank-empty';
      empty.textContent = '尚無紀錄，完成一局或隨時按「分數紀錄」就能留下成績。';
      list.append(empty);
      return;
    }

    top3.forEach((item, index) => {
      const line = document.createElement('div');
      line.className = 'rankLine';
      const rank = document.createElement('b');
      rank.textContent = `TOP ${index + 1}`;
      const stats = document.createElement('div');
      stats.className = 'rankStats';
      const entries = [
        ['分數', item.score ?? '—'],
        ['關卡', item.level ?? '—'],
        ['放置', item.steps ?? '—'],
        ['時間', window.SlowlyElapsedFormat.formatHMS(item.timeMs ?? 0)]
      ];
      entries.forEach(([label, value]) => {
        const itemEl = document.createElement('span');
        itemEl.className = 'rankStat';
        const labelEl = document.createElement('span');
        labelEl.className = 'rankStatLabel';
        labelEl.textContent = label;
        const valueEl = document.createElement('strong');
        valueEl.className = 'rankStatValue';
        valueEl.textContent = value;
        itemEl.append(labelEl, valueEl);
        stats.append(itemEl);
      });
      line.append(rank, stats);
      list.append(line);
    });
  };

  game.renderButtons = () => {
    const running = game.state === 'running';
    const paused = game.state === 'paused';
    $('btnStart').disabled = game.saving || !(game.state === 'idle' || game.state === 'ended');
    $('btnPause').disabled = game.saving || !(running || paused);
    $('btnPause').textContent = paused ? '繼續' : '暫停';
    $('btnEnd').disabled = game.saving || !(running || paused);
    $('saveScore').disabled = game.saving || !game.runId;
    $('restart').disabled = game.saving || !game.runId;
    $('periodicMode').disabled = game.saving;
    // 儲存中原生欄位的 disabled 變化需同步至軍火庫的可見按鈕。
    game.modeSelect.sync();
    $('saveScore').textContent = game.saving ? '記錄中…' : '分數紀錄';
    $('board').querySelectorAll('.cell').forEach((cell, index) => {
      cell.disabled = !running || game.saving || game.over || game.locked || Boolean(game.board[index]);
    });
  };

  game.saveCurrentScore = async ({ announce = true } = {}) => {
    if (game.saving || !game.runId) return false;
    const snapshot = {
      runId: game.runId,
      mode: game.mode,
      score: game.liveTotal(),
      level: game.level,
      steps: game.moves,
      timeMs: game.elapsedMs(),
      at: Date.now()
    };

    game.saving = true;
    game.renderButtons();
    try {
      const collection = rankingCollections[snapshot.mode];
      const rows = await collection.all();
      const withoutThisRun = rows.filter(row => row.runId !== snapshot.runId);
      const top3 = sortTop3([...withoutThisRun, snapshot]);
      await collection.replace(top3);
      game.unsaved = false;
      try {
        await game.renderTop3(snapshot.mode);
      } catch (displayError) {
        // 分數已寫入成功；排行榜畫面更新失敗不應阻止重新開始。
        console.error('[Periodic] 排行榜畫面更新失敗：', displayError);
        $('rankList').textContent = '分數已儲存，請重新開啟排行頁查看。';
      }

      if (announce) {
        const position = top3.findIndex(row => row.runId === snapshot.runId);
        game.say(position < 0
          ? `已結算本局 ${snapshot.score} 分，尚未進入${game.modes[snapshot.mode].label} TOP 3。`
          : `✅ 本局 ${snapshot.score} 分已記錄，${game.modes[snapshot.mode].label} TOP ${position + 1}！`);
      }
      return true;
    } catch (error) {
      console.error('[Periodic] 排行榜儲存失敗：', error);
      if (announce) game.say('分數紀錄失敗，請檢查瀏覽器儲存權限後再試。');
      return false;
    } finally {
      game.saving = false;
      if (game.pendingAutoPause) {
        game.pendingAutoPause = false;
        game.requestAutoPause();
      }
      game.renderButtons();
    }
  };

  rankTabs.forEach(tab => tab.addEventListener('click', () => {
    void game.renderTop3(tab.dataset.rankMode)
      .catch(error => {
        console.error('[Periodic] 排行榜讀取失敗：', error);
        $('rankList').textContent = '暫時無法讀取排行榜。';
      });
  }));

  game.render = () => {
    $('level').textContent = game.level;
    $('achievementLevel').textContent = game.level;
    $('achievementTotal').textContent = game.liveTotal();
    $('score').textContent = `${game.score} / ${game.target()}`;
    $('total').textContent = game.liveTotal();
    const stateText = game.state === 'idle' ? '（尚未開始）'
      : game.state === 'paused' ? '（已暫停）'
        : game.state === 'ended' ? '（已結束）' : '';
    $('modeIndicator').textContent = `${game.modes[game.mode].label}｜第 ${game.level} 關${stateText}`;
    $('remaining').textContent = game.remaining;
    $('progress').style.width = `${Math.min(100, game.score / game.target() * 100)}%`;

    const boardElement = $('board');
    boardElement.replaceChildren();
    game.board.forEach((symbol, index) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = `cell ${symbol ? '' : 'empty'}`;
      const location = `第${Math.floor(index / game.size) + 1}列第${index % game.size + 1}格`;
      cell.setAttribute('aria-label', `${location}：${symbol ? `${symbol} 元素` : '空白'}`);
      if (symbol) cell.append(game.atom(symbol));
      cell.addEventListener('click', () => game.place(index));
      boardElement.append(cell);
    });

    $('current').replaceWith(game.atom(game.queue[0], 'large'));
    document.querySelector('.queue .large').id = 'current';
    $('next').replaceChildren(...game.queue.slice(1, 6).map(symbol => game.atom(symbol, 'mini')));

    const recipesElement = $('recipes');
    recipesElement.replaceChildren();

    game.recipes
      .filter(recipe => recipe.l <= game.level)
      .forEach(recipe => {
        const row = document.createElement('div');
        row.className = 'recipe';

        const identity = document.createElement('span');
        identity.className = 'recipe-identity';
        const chemical = document.createElement('strong');
        chemical.className = 'recipe-chemical';
        chemical.textContent = game.displayFormula(recipe.formula);
        const name = document.createElement('span');
        name.className = 'recipe-name';
        name.textContent = recipe.name;
        identity.append(chemical, name);

        const arrangement = document.createElement('span');
        arrangement.className = 'formula';
        arrangement.setAttribute('aria-label', `棋盤排列：${recipe.s}`);
        for (const symbol of recipe.s) {
          arrangement.append(game.atom(symbol));
        }

        const points = document.createElement('strong');
        points.className = 'recipe-points';
        points.textContent = `+${recipe.p} 分`;
        row.append(identity, points, arrangement);
        recipesElement.append(row);
      });

    $('recipeRuleNote').textContent = '只判定橫向、直向的已解鎖配方；不轉彎，也不重複使用元素。';
    game.renderPeriodicTable();
    game.renderButtons();
  };

  void game.renderTop3('normal').catch(error => {
    console.error('[Periodic] 排行榜初始化失敗：', error);
    $('rankList').textContent = '暫時無法讀取排行榜。';
  });
})();
