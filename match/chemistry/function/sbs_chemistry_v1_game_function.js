// 遊戲規則與棋盤資料；模式／場次生命週期遵循 match3_v1。
(() => {
  'use strict';
  const game = window.SBSChemistryV1;
  const random = items => items[window.SlowlyRandom.int(0, items.length - 1)];
  const validMode = mode => Object.prototype.hasOwnProperty.call(game.modes, mode) ? mode : 'normal';

  game.pool = () => game.level < 2 ? ['N']
    : game.level < 6 ? ['N', 'N', 'T']
      : game.level < 10 ? ['N', 'N', 'T', 'T', 'S']
        : game.level < 14 ? ['N', 'N', 'T', 'T', 'S', 'F']
          : ['N', 'N', 'T', 'T', 'S', 'F', 'K'];
  game.target = () => game.level === 1 ? 3 : Math.min(5 + Math.floor(game.level * 1.8), 38);
  game.supply = () => game.level === 1 ? 12 : Math.min(14 + game.level * 2, 45);

  // 過關分數與剩餘原子獎勵已結入 total；未過關的本關分數即時加總。
  game.liveTotal = () => game.total + (game.roundCommitted ? 0 : game.score);
  game.elapsedMs = () => {
    if (!game.runId) return 0;
    const reference = game.endedAt ?? (game.state === 'paused' ? game.pausedAt : Date.now());
    return Math.max(0, reference - game.startedAt - game.pausedMs);
  };
  game.clearLevelTransition = () => {
    if (game.nextLevelTimer) game.nextLevelTimer.stop();
    game.nextLevelTimer = null;
    game.pendingLevelAdvance = false;
  };

  // 設定頁選模式只建立尚未開始的預覽；不建立場次或排行榜紀錄。
  game.preview = (mode = game.selectedMode) => {
    if (game.saving || (game.state !== 'idle' && game.state !== 'ended')) return false;
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

  // 和 match3_v1 一樣，只有「開始」才將待機／已結束遊戲變為進行中。
  game.start = (mode = game.selectedMode) => {
    if (game.saving || (game.state !== 'idle' && game.state !== 'ended')) return false;
    if (game.state === 'ended' && game.unsaved) {
      game.say('上局分數尚未儲存，請先按「分數紀錄」後再開始。');
      return false;
    }
    const chosen = validMode(mode);
    if (game.state === 'ended' || chosen !== game.mode) game.preview(chosen);
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
    if (game.pendingLevelAdvance) game.advanceLevel();
    else game.renderButtons();
    game.say(`已繼續${game.modes[game.mode].label}第 ${game.level} 關。`);
    return true;
  };
  game.togglePause = () => game.state === 'running' ? game.pause() : game.resume();
  game.requestAutoPause = () => {
    if (game.state !== 'running') return;
    if (game.saving) game.pendingAutoPause = true;
    else game.pause();
  };

  game.begin = () => {
    game.score = 0;
    game.roundCommitted = false;
    game.remaining = game.supply();
    game.over = false;
    game.locked = false;
    game.board = Array(game.size * game.size).fill(null);
    game.queue = Array.from({ length: Math.max(game.remaining, 5) }, () => random(game.pool()));
    if (game.level === 1) {
      game.board[14] = 'N';
      game.board[16] = 'N';
      game.board[26] = 'N';
      game.board[28] = 'N';
    }
    game.render();
  };
  game.advanceLevel = () => {
    if (game.state !== 'running' || !game.locked || game.over) return;
    game.clearLevelTransition();
    game.level++;
    game.begin();
    game.say(`🎉 進入第 ${game.level} 關！新的合成表已更新。`);
  };

  game.neighbors = i => {
    const row = Math.floor(i / game.size);
    const col = i % game.size;
    return [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]
      .filter(([r, c]) => r >= 0 && r < game.size && c >= 0 && c < game.size)
      .map(([r, c]) => r * game.size + c);
  };

  game.matches = (recipe, placed) => {
    let found = null;
    const symbols = recipe.s;
    function search(path, used) {
      if (found) return;
      if (path.length === symbols.length) {
        if (used.has(placed)) found = [...path];
        return;
      }
      for (const next of game.neighbors(path[path.length - 1])) {
        if (!used.has(next) && game.board[next] === symbols[path.length]) {
          used.add(next);
          path.push(next);
          search(path, used);
          path.pop();
          used.delete(next);
        }
      }
    }
    for (let i = 0; i < game.board.length && !found; i++) {
      if (game.board[i] === symbols[0]) search([i], new Set([i]));
    }
    return found;
  };
})();
