// 元素實驗室｜棋盤、關卡與直線分子配方；遊戲生命週期沿用既有模式架構。
(() => {
  'use strict';

  const game = window.SBSPeriodicV1;
  const random = items => items[window.SlowlyRandom.int(0, items.length - 1)];
  const validMode = mode => Object.prototype.hasOwnProperty.call(game.modes, mode)
    ? mode
    : 'normal';

  // 關卡依序增加元素種類；重複出現的符號代表抽取權重。
  game.pool = () => game.elements
    .filter(element => element.unlockLevel <= game.level)
    .flatMap(element => Array(element.weight).fill(element.symbol));

  game.target = () => Math.min(4 + game.level * 2, 38);
  game.supply = () => Math.min(12 + game.level * 3, 60);
  game.liveTotal = () => game.total + (game.roundCommitted ? 0 : game.score);

  game.elapsedMs = () => {
    if (!game.runId) return 0;
    const reference = game.endedAt
      ?? (game.state === 'paused' ? game.pausedAt : Date.now());

    return Math.max(0, reference - game.startedAt - game.pausedMs);
  };

  game.clearLevelTransition = () => {
    if (game.nextLevelTimer) game.nextLevelTimer.stop();
    game.nextLevelTimer = null;
    game.pendingLevelAdvance = false;
  };

  // 設定選模式只更新預覽，不建立場次，也不儲存分數或成就。
  game.preview = (mode = game.selectedMode) => {
    if (game.saving || (game.state !== 'idle' && game.state !== 'ended')) {
      return false;
    }

    game.clearLevelTransition();
    game.mode = validMode(mode);
    game.selectedMode = game.mode;
    game.level = game.modes[game.mode].startLevel;
    game.total = 0;
    game.moves = 0;
    game.runId = null;
    game.startedAt = 0;
    game.endedAt = null;
    game.pausedAt = null;
    game.pausedMs = 0;
    game.unsaved = false;
    game.pendingAutoPause = false;
    game.state = 'idle';
    game.begin();
    game.say(`已選擇${game.modes[game.mode].label}，請按「開始」。`);
    return true;
  };

  game.start = (mode = game.selectedMode) => {
    if (game.saving || (game.state !== 'idle' && game.state !== 'ended')) {
      return false;
    }

    if (game.state === 'ended' && game.unsaved) {
      game.say('上局分數尚未儲存，請先按「分數紀錄」後再開始。');
      return false;
    }

    const chosen = validMode(mode);
    if (game.state === 'ended' || chosen !== game.mode) {
      game.preview(chosen);
    }

    game.selectedMode = chosen;
    game.state = 'running';
    game.startedAt = Date.now();
    game.endedAt = null;
    game.pausedAt = null;
    game.pausedMs = 0;
    game.runSeq++;
    game.runId = window.crypto?.randomUUID?.()
      ?? `${game.startedAt}-${game.runSeq}-${Math.random().toString(36).slice(2)}`;
    game.unsaved = false;

    // 無盡模式只借用已解鎖的玩法，不替普通模式解鎖元素成就。
    if (chosen === 'normal') {
      void game.unlockThroughLevel(game.level);
    }

    game.render();
    game.say(`已開始${game.modes[chosen].label}第 ${game.level} 關，分數從 0 計算！`);
    return true;
  };

  game.pause = () => {
    if (game.state !== 'running' || game.saving) return false;
    game.pausedAt = Date.now();
    game.state = 'paused';
    game.renderButtons();
    game.say('遊戲已暫停，按「繼續」返回本局。');
    return true;
  };

  game.resume = () => {
    if (game.state !== 'paused' || game.saving) return false;
    game.pausedMs += Math.max(0, Date.now() - game.pausedAt);
    game.pausedAt = null;
    game.state = 'running';

    if (game.pendingLevelAdvance) {
      game.advanceLevel();
    } else {
      game.renderButtons();
    }

    game.say(`已繼續${game.modes[game.mode].label}第 ${game.level} 關。`);
    return true;
  };

  game.togglePause = () => game.state === 'running'
    ? game.pause()
    : game.resume();

  game.requestAutoPause = () => {
    if (game.state !== 'running') return;

    if (game.saving) {
      game.pendingAutoPause = true;
    } else {
      game.pause();
    }
  };

  game.begin = () => {
    game.score = 0;
    game.roundCommitted = false;
    game.remaining = game.supply();
    game.over = false;
    game.locked = false;
    game.board = Array(game.size * game.size).fill(null);
    game.queue = Array.from({ length: game.remaining }, () => random(game.pool()));

    // 第一關保留舊版教學的四顆預置元素；位置彼此不相鄰。
    if (game.level === 1) {
      for (const index of [14, 16, 26, 28]) {
        game.board[index] = 'O';
      }
    }

    game.render();
  };

  game.advanceLevel = () => {
    if (game.state !== 'running' || !game.locked || game.over) return false;

    game.clearLevelTransition();
    game.level++;
    game.begin();

    if (game.mode === 'normal') {
      void game.unlockThroughLevel(game.level);
    }

    game.say(`🎉 進入第 ${game.level} 關！新的分子合成表已更新。`);
    return true;
  };

  // 只接受橫向或直向連續的相鄰格子，不允許轉彎或跳格。
  // 正向與反向代表同一配方：例如 OCO / OCO、NNO / ONN。
  game.matchLines = (placed, board = game.board) => {
    const results = [];
    const seen = new Set();
    const availableRecipes = game.recipes.filter(recipe => recipe.l <= game.level);

    for (const recipe of availableRecipes) {
      const reversed = [...recipe.s].reverse().join('');
      const length = recipe.s.length;

      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        for (let row = 0; row < game.size; row++) {
          for (let col = 0; col < game.size; col++) {
            const endRow = row + dr * (length - 1);
            const endCol = col + dc * (length - 1);
            if (endRow >= game.size || endCol >= game.size) continue;

            const path = Array.from({ length }, (_, index) => {
              return (row + dr * index) * game.size + col + dc * index;
            });
            if (!path.includes(placed)) continue;

            const symbols = path.map(position => board[position]).join('');
            if (symbols !== recipe.s && symbols !== reversed) continue;

            const mask = path.reduce((value, position) => {
              return value | (1n << BigInt(position));
            }, 0n);
            const key = `${recipe.formula}:${mask.toString()}`;
            if (seen.has(key)) continue;

            seen.add(key);
            results.push({ recipe, path, mask });
          }
        }
      }
    }

    return results;
  };

  // 先比較所有符合的直線配方，再一次選出不重用元素的最高分組合。
  // 因為每手只放一個元素且立即合成，正常操作下通常只會完成一個分子。
  game.planSynthesis = (placed, board = game.board) => {
    const candidates = game.matchLines(placed, board).sort((a, b) => {
      return b.recipe.p - a.recipe.p
        || b.path.length - a.path.length
        || a.recipe.l - b.recipe.l;
    });

    let best = [];
    let bestScore = -1;
    let bestConsumed = -1;

    const remainingScores = Array(candidates.length + 1).fill(0);
    for (let index = candidates.length - 1; index >= 0; index--) {
      remainingScores[index] = remainingScores[index + 1] + candidates[index].recipe.p;
    }

    function search(index, usedMask, totalScore, consumed, chosen) {
      if (totalScore + remainingScores[index] < bestScore) return;

      if (index === candidates.length) {
        if (totalScore > bestScore || (totalScore === bestScore && consumed > bestConsumed)) {
          bestScore = totalScore;
          bestConsumed = consumed;
          best = [...chosen];
        }
        return;
      }

      const candidate = candidates[index];
      if ((candidate.mask & usedMask) === 0n) {
        chosen.push(candidate);
        search(
          index + 1,
          usedMask | candidate.mask,
          totalScore + candidate.recipe.p,
          consumed + candidate.path.length,
          chosen
        );
        chosen.pop();
      }

      search(index + 1, usedMask, totalScore, consumed, chosen);
    }

    search(0, 0n, 0, 0, []);
    return best;
  };
})();
