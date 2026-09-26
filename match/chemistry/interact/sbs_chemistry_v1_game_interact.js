// 玩家操作、關卡結算與說明；模式選擇／開始／暫停／結束比照 match3_v1。
(() => {
  'use strict';
  const game = window.SBSChemistryV1;
  const $ = game.$;
  const modePicker = $('chemistryMode');
  const descriptions = Object.freeze({
    normal: '普通模式從第 1 關開始。選好後回到遊戲頁按「開始」；進行中不能切換模式。',
    endless: '無盡模式從第 14 關開始，但本場分數依然從 0 開始計算。選好後按「開始」。'
  });

  function renderModeDescription(mode = game.selectedMode) {
    $('chemistryModeNote').textContent = descriptions[mode] || descriptions.normal;
  }

  async function recordOnEnd(message) {
    game.say(`${message} 正在記錄分數…`);
    const saved = await game.saveCurrentScore({ announce: false });
    game.say(saved
      ? `${message} 分數已自動記錄。`
      : `${message} 分數儲存失敗，請按「分數紀錄」重試。`);
  }

  game.end = async (reason = 'manual') => {
    if (game.saving || (game.state !== 'running' && game.state !== 'paused')) return false;
    // 暫停中的時長不得算進本場時間，與 match3 的暫停計時一致。
    game.endedAt = game.state === 'paused' ? game.pausedAt : Date.now();
    game.state = 'ended';
    game.over = true;
    game.locked = true;
    game.unsaved = true;
    game.clearLevelTransition();
    game.render();
    const message = reason === 'manual' ? '本局已結束。' : reason;
    await recordOnEnd(message);
    return true;
  };

  game.place = index => {
    if (game.state !== 'running' || game.over || game.locked || game.saving || game.board[index]) return;
    game.board[index] = game.queue.shift();
    game.remaining--;
    game.moves++;

    const candidates = window.FictionFilter.filter(game.recipes, {
      predicate: recipe => recipe.l <= game.level
    }).map((recipe, order) => ({
      recipe, order, path: game.matches(recipe, index)
    }));

    // 七顆 S 的成功配方包含四顆 S；同一次放置若湊齊七顆，應先完成合成。
    // 沒有湊齊七顆時，四顆 S 與其他不穩定分子仍照原規則判定失敗。
    const sevenS = candidates.find(item => item.recipe.s === 'SSSSSSS' && item.path);
    const danger = sevenS ? null : window.FictionFilter.filter(game.danger, {
      predicate: recipe => recipe.l <= game.level
    }).map(recipe => ({ recipe, path: game.matches(recipe, index) }))
      .find(result => result.path);
    if (danger) {
      void game.end(`💥 合成了不穩定分子 ${danger.recipe.s}！實驗失敗。`);
      return;
    }

    // 先比較所有符合配方的原子路徑，再一次結算；避免第一條路徑
    // 占走另一種配方需要的原子。只有本次放入的原子允許共用。
    const completed = game.planSynthesis(index, candidates);

    if (completed.length > 0) {
      const consumed = new Set(completed.flatMap(item => item.path));
      for (const position of consumed) game.board[position] = null;

      const earned = completed.reduce((sum, item) => sum + item.recipe.p, 0);
      game.score += earned;

      if (completed.length === 1) {
        game.say(`✨ 合成 ${completed[0].recipe.s}，獲得 ${earned} 分！`);
      } else {
        const summary = completed
          .map(item => `${item.recipe.s}（+${item.recipe.p}）`)
          .join('、');
        game.say(`✨ 同時合成 ${summary}，共獲得 ${earned} 分！`);
      }
    } else {
      game.say('原子已放入，繼續組合！');
    }
    game.render();

    if (game.score >= game.target()) {
      game.locked = true;
      const bonus = game.remaining + (game.level >= 6 && game.board.every(item => !item) ? 5 : 0);
      game.total += game.score + bonus;
      game.roundCommitted = true;
      game.render();
      game.say(`🎉 第 ${game.level} 關完成！剩餘原子獎勵 +${bonus} 分。`);
      game.nextLevelTimer = window.PhaseCycle.create({
        phases: [{ duration: 1100 }],
        loop: false,
        onComplete: () => {
          game.nextLevelTimer = null;
          if (game.state === 'paused') {
            game.pendingLevelAdvance = true;
          } else if (game.state === 'running') {
            game.advanceLevel();
          }
        }
      });
      game.nextLevelTimer.start();
    } else if (game.remaining <= 0 || game.board.every(Boolean)) {
      void game.end(`🧪 原子用完或棋盤已滿，還差 ${game.target() - game.score} 分。`);
    }
  };

  $('btnStart').addEventListener('click', () => {
    game.start(game.selectedMode);
  });
  $('btnPause').addEventListener('click', () => {
    game.togglePause();
  });
  $('btnEnd').addEventListener('click', () => {
    void game.end('manual');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) game.requestAutoPause();
  });

  $('saveScore').addEventListener('click', () => {
    void game.saveCurrentScore();
  });

  $('restart').addEventListener('click', async () => {
    if (!game.runId || game.saving) return;
    const originalRunId = game.runId;
    const confirmed = await window.SlowlyConfirm.show({
      title: '重新開始',
      message:
        `確定要重新開始${game.modes[game.mode].label}嗎？本局會先記錄分數，` +
        `再從第 ${game.modes[game.selectedMode].startLevel} 關開始。`,
      confirmText: '記錄並重新開始',
      cancelText: '取消'
    });
    if (!confirmed || game.saving || game.runId !== originalRunId) return;
    if (!await game.saveCurrentScore({ announce: false })) {
      game.say('分數儲存失敗，已保留目前這局；請重新記錄後再試。');
      return;
    }
    // 結算與重置都由主動確認的「重新開始」負責；切換模式本身不觸發。
    game.clearLevelTransition();
    game.state = 'ended';
    game.start(game.selectedMode);
  });

  modePicker.addEventListener('change', () => {
    const requested = modePicker.value;
    if (!Object.prototype.hasOwnProperty.call(game.modes, requested) || game.saving ||
      game.state === 'running' || game.state === 'paused') {
      modePicker.value = game.selectedMode;
      game.modeSelect.sync();
      renderModeDescription();
      if (game.state === 'running' || game.state === 'paused') {
        game.say('請先結束本局，再選擇其他模式。');
      }
      return;
    }
    game.selectedMode = requested;
    renderModeDescription(requested);
    if (game.state === 'idle') game.preview(requested);
    // match3_v1 的已結束狀態：選新模式只改下一局，按「開始」才重置。
  });

  game.showHelp = () => {
    $('modalTitle').textContent = '玩法說明';
    $('modalBody').innerHTML =
      "<p>點擊 6×6 棋盤的空格，放入目前原子。把原子連成合成表中的排列，即可合成並得分。" +
      "原子可以橫向、直向、轉彎連接，合成後會消失。</p>" +
      "<p>每關原子數有限，達到目標分數就過關；剩餘原子會計入總分。第 7 關開始要小心不穩定分子！</p>" +
      "<p>在設定頁選普通模式（第 1 關）或無盡模式（第 14 關），回遊戲頁按「開始」開局，" +
      "兩種模式的分數都從 0 計算。遊戲中切換分頁會自動暫停，結束本局後才能切換模式。</p>" +
      "<p>可隨時記錄分數；重新開始會先記錄本局成績。排行榜位於「成就」頁，兩種模式各有獨立的本機 TOP 3。" +
      "</p>";
    $('modal').showModal();
  };
  $('modalClose').addEventListener('click', () => $('modal').close());

  renderModeDescription();
  game.preview('normal');
})();
