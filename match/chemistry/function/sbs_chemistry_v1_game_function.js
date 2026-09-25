// 遊戲規則與棋盤資料；不負責 DOM 或按鈕事件。
(() => {
    'use strict';
    const game = window.SBSChemistryV1;
    const random = items => items[window.SlowlyRandom.int(0, items.length - 1)];

    game.pool = () => game.level < 2 ? ['N']
        : game.level < 6 ? ['N', 'N', 'T']
        : game.level < 10 ? ['N', 'N', 'T', 'T', 'S']
        : game.level < 14 ? ['N', 'N', 'T', 'T', 'S', 'F']
        : ['N', 'N', 'T', 'T', 'S', 'F', 'K'];
    game.target = () => game.level === 1 ? 3 : Math.min(5 + Math.floor(game.level * 1.8), 38);
    game.supply = () => game.level === 1 ? 12 : Math.min(14 + game.level * 2, 45);

    game.start = () => {
        if (game.nextLevelTimer) game.nextLevelTimer.stop();
        game.nextLevelTimer = null;
        game.level = 1;
        game.total = 0;
        game.begin();
    };

    game.begin = () => {
        game.score = 0;
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
        game.say('點擊空格放入原子；把相鄰原子組成合成表中的分子！');
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
