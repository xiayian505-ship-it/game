// 玩家操作、關卡結算與說明；模式選擇／開始／暫停／結束比照 match3_v1。
(() => {
  'use strict';
  const game = window.SBSPeriodicV1;
  const $ = game.$;
  const modePicker = $('periodicMode');
  const descriptions = Object.freeze({
    normal: '普通模式從第 1 關開始，逐步解鎖元素與分子配方。選好後回遊戲頁按「開始」。',
    endless: '無盡模式從第 16 關開始，直接開放全部 5 種元素與 16 種分子；本場分數仍從 0 開始。'
  });

  // 只在普通模式第 15 → 16 關時提示；維持目前模式與整場分數。
  const endlessNotice = $('endlessNotice');
  game.showEndlessNotice = () => {
    if (game.mode === 'normal' && game.level === 16 && game.runId) {
      endlessNotice.hidden = false;
      // 玩家剛在棋盤操作，可能已滑到頁面下方；將首次提示帶入視野。
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      endlessNotice.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'center'
      });
    }
  };
  game.hideEndlessNotice = () => {
    endlessNotice.hidden = true;
  };
  $('endlessNoticeDismiss').addEventListener('click', game.hideEndlessNotice);

  function renderModeDescription(mode = game.selectedMode) {
    $('periodicModeNote').textContent = descriptions[mode] || descriptions.normal;
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
    game.hideEndlessNotice();
    game.render();
    const message = reason === 'manual' ? '本局已結束。' : reason;
    await recordOnEnd(message);
    return true;
  };

  game.place = index => {
    if (
      game.state !== 'running'
      || game.over
      || game.locked
      || game.saving
      || !Number.isInteger(index)
      || index < 0
      || index >= game.board.length
      || game.board[index]
      || game.remaining <= 0
    ) {
      return;
    }

    game.board[index] = game.queue.shift();
    game.remaining--;
    game.moves++;

    // 與虛構原子的舊版不同：只掃描橫向、直向，且分子不可共用元素。
    const completed = game.planSynthesis(index);
    if (completed.length > 0) {
      const consumed = new Set(completed.flatMap(item => item.path));
      for (const position of consumed) {
        game.board[position] = null;
      }

      const earned = completed.reduce((sum, item) => sum + item.recipe.p, 0);
      game.score += earned;

      // 兩種模式都收集分子；同一配方只存一次，不影響當回合計分與消除。
      void game.recordMolecules(completed.map(item => item.recipe.formula));

      if (completed.length === 1) {
        const { formula, name } = completed[0].recipe;
        game.say(`✨ 合成 ${formula}（${name}），獲得 ${earned} 分！`);
      } else {
        const summary = completed
          .map(item => `${item.recipe.formula}（${item.recipe.name}，+${item.recipe.p}）`)
          .join('、');
        game.say(`✨ 同時合成 ${summary}，共獲得 ${earned} 分！`);
      }
    } else {
      game.say('元素已放入，繼續組合分子！');
    }

    game.render();

    if (game.score >= game.target()) {
      game.locked = true;
      const clearBonus = game.level >= 6 && game.board.every(item => !item)
        ? 5
        : 0;
      const bonus = game.remaining + clearBonus;
      game.total += game.score + bonus;
      game.roundCommitted = true;
      game.render();
      game.say(`🎉 第 ${game.level} 關完成！剩餘元素獎勵 +${bonus} 分。`);

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
      void game.end(`🧪 元素用完或棋盤已滿，還差 ${game.target() - game.score} 分。`);
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
    $('modalBody').innerHTML = `
      <p>
        點擊 6×6 棋盤的空格，放入目前元素。
        將元素橫向或直向連成合成表的排列，即可合成分子並得分；
        不能轉彎或跳格。棋盤上的排列只表示連接順序，不代表真實分子形狀。
      </p>
      <p>
        同一顆元素不能同時算進兩個分子。
        如果較長的配方已解鎖，優先採用分數較高的合成結果，
        例如 OOO 會合成 O₃，而不是重複計算 O₂。
      </p>
      <p>
        每關元素供應量有限，達到目標分數就過關；
        越早過關，剩餘元素獎勵越高。
        第 15 關完成基礎配方，第 16 關起繼續挑戰，最多每關提供 60 個元素。
      </p>
      <p>
        普通模式從第 1 關開始；無盡模式直接從第 16 關開始，分數仍從 0 計算。
        切離遊戲頁會自動暫停；結束本局後才能切換模式。
        成就頁的元素週期表只隨普通模式進度解鎖；
        分子圖鑑則可在普通、無盡兩種模式收集，成功合成一次就永久點亮。
      </p>
      <p>
        隨時可記錄分數，同一場紀錄會更新原本的名次；
        重新開始會先記錄本場分數。
        排行頁可查看兩種模式獨立的本機 TOP 3。
      </p>
    `;
    $('modal').showModal();
  };
  $('modalClose').addEventListener('click', () => $('modal').close());

  renderModeDescription();
  game.preview('normal');
})();
