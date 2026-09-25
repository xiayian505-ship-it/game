// 玩家操作、合成後的回饋與說明視窗。
(() => {
    'use strict';
    const game = window.SBSChemistryV1;
    const $ = game.$;

    game.place = index => {
        if (game.over || game.locked || game.board[index]) return;
        game.board[index] = game.queue.shift();
        game.remaining--;

        const danger = game.danger
            .filter(recipe => recipe.l <= game.level)
            .map(recipe => ({ recipe, path: game.matches(recipe, index) }))
            .find(result => result.path);
        if (danger) {
            game.over = true;
            game.render();
            game.say(`💥 合成了不穩定分子 ${danger.recipe.s}！實驗失敗。`);
            return;
        }

        let best = null;
        for (const recipe of game.recipes.filter(item => item.l <= game.level)) {
            const path = game.matches(recipe, index);
            if (path && (!best || recipe.p > best.recipe.p ||
                (recipe.p === best.recipe.p && recipe.s.length > best.recipe.s.length))) {
                best = { recipe, path };
            }
        }
        if (best) {
            for (const position of best.path) game.board[position] = null;
            game.score += best.recipe.p;
            game.say(`✨ 合成 ${best.recipe.s}，獲得 ${best.recipe.p} 分！`);
        } else {
            game.say('原子已放入，繼續組合！');
        }
        game.render();

        if (game.score >= game.target()) {
            game.locked = true;
            const bonus = game.remaining + (game.level >= 6 && game.board.every(item => !item) ? 5 : 0);
            game.total += game.score + bonus;
            $('achievementTotal').textContent = game.total;
            game.say(`🎉 第 ${game.level} 關完成！剩餘原子獎勵 +${bonus} 分。`);
            game.nextLevelTimer = setTimeout(() => {
                game.nextLevelTimer = null;
                game.level++;
                game.begin();
                game.say(`🎉 進入第 ${game.level} 關！新的合成表已更新。`);
            }, 1100);
        } else if (game.remaining <= 0 || game.board.every(Boolean)) {
            game.over = true;
            game.say(`🧪 原子用完或棋盤已滿，還差 ${game.target() - game.score} 分。按「重新開始」再挑戰！`);
        }
    };

    $('restart').addEventListener('click', () => {
        if (confirm('確定要從第一關重新開始嗎？')) game.start();
    });
    game.showHelp = () => {
        $('modalTitle').textContent = '玩法說明';
        $('modalBody').innerHTML = '<p>點擊 6×6 棋盤的空格，放入目前原子。把原子連成右側合成表的排列，即可合成並得分。原子可以橫向、直向、轉彎連接，合成後會消失。</p><p>每關原子數有限，達到目標分數就過關；剩餘原子會計入總分。第 7 關開始要小心不穩定分子！</p><p>這是參考經典玩法的自製懷舊版，關卡配置和原版不完全相同。</p>';
        $('modal').showModal();
    };
    $('modalClose').addEventListener('click', () => $('modal').close());
    game.start();
})();
