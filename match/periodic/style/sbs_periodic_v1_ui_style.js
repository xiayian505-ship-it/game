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
      // 週期表在手機上需要橫向捲動；第一次開啟先顯示 C、N、O、S 所在區域。
      const tableScroll = $('periodicScroll');
      if (!tableScroll.dataset.initialPositioned) {
        tableScroll.scrollLeft = tableScroll.scrollWidth - tableScroll.clientWidth;
        tableScroll.dataset.initialPositioned = 'true';
      }

      void game.renderTop3().catch(error => console.error('[Periodic] 讀取排行榜失敗：', error));
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
      const tile = document.querySelector(`[data-element="${element.symbol}"]`);
      if (!tile) continue;

      const unlocked = highestNormalLevel >= element.unlockLevel;
      tile.dataset.unlocked = String(unlocked);
      tile.setAttribute(
        'aria-label',
        unlocked
          ? `${element.name} ${element.symbol}：已解鎖`
          : `${element.name} ${element.symbol}：普通模式第 ${element.unlockLevel} 關解鎖`
      );
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

  void progressReady.then(() => game.renderPeriodicTable());

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
        $('rankList').textContent = '分數已儲存，請重新開啟成就頁查看。';
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
