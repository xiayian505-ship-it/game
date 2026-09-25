// 畫面渲染與文字提示；不更動遊戲規則。
(() => {
    'use strict';
    const game = window.SBSChemistryV1;
    const $ = game.$;

    // 與 Match3 相同的同頁分頁：只切換畫面，不重置棋盤。
    const tabs = [...document.querySelectorAll('[data-view-target]')];
    const panels = [...document.querySelectorAll('[data-view-panel]')];
    function showView(view) {
        tabs.forEach(tab => {
            const selected = tab.dataset.viewTarget === view;
            tab.setAttribute('aria-selected', String(selected));
            tab.tabIndex = selected ? 0 : -1;
        });
        panels.forEach(panel => { panel.hidden = panel.dataset.viewPanel !== view; });
    }
    tabs.forEach(tab => tab.addEventListener('click', () => showView(tab.dataset.viewTarget)));
    document.getElementById('settingsHelp').addEventListener('click', () => game.showHelp());
    // 軍火庫只管理展開狀態；本專案負責 DOM 與畫面。
    const recipeTree = window.TreeSelection.create({ expansion: 'single' });
    const recipeToggle = $('recipeToggle');
    const recipeContent = $('recipeContent');
    recipeToggle.addEventListener('click', () => {
        const expanded = recipeTree.toggleExpanded('current-level-recipes');
        recipeToggle.setAttribute('aria-expanded', String(expanded));
        recipeToggle.textContent = expanded ? '本關合成表 −' : '本關合成表 ＋';
        recipeContent.hidden = !expanded;
    });
    showView('game');

    game.atom = (symbol, extraClass = '') => {
        const element = document.createElement('span');
        element.className = `atom ${symbol} ${extraClass}`;
        element.textContent = symbol;
        return element;
    };

    game.say = text => { $('message').textContent = text; };

    game.render = () => {
        $('level').textContent = game.level;
        $('achievementLevel').textContent = game.level;
        $('achievementTotal').textContent = game.total;
        $('score').textContent = `${game.score} / ${game.target()}`;
        $('total').textContent = game.total;
        $('remaining').textContent = game.remaining;
        $('progress').style.width = `${Math.min(100, game.score / game.target() * 100)}%`;

        const boardElement = $('board');
        boardElement.replaceChildren();
        game.board.forEach((symbol, index) => {
            const cell = document.createElement('button');
            cell.type = 'button';
            cell.className = `cell ${symbol ? '' : 'empty'}`;
            const location = `第${Math.floor(index / game.size) + 1}列第${index % game.size + 1}格`;
            cell.setAttribute('aria-label', `${location}：${symbol || '空白'}`);
            if (symbol) cell.append(game.atom(symbol));
            cell.addEventListener('click', () => game.place(index));
            boardElement.append(cell);
        });

        $('current').replaceWith(game.atom(game.queue[0] || 'N', 'large'));
        document.querySelector('.queue .large').id = 'current';
        $('next').replaceChildren(...game.queue.slice(1, 6).map(symbol => game.atom(symbol, 'mini')));

        const recipesElement = $('recipes');
        recipesElement.replaceChildren();
        game.recipes.filter(recipe => recipe.l <= game.level).forEach(recipe => {
            const row = document.createElement('div');
            row.className = 'recipe';
            const formula = document.createElement('span');
            formula.className = 'formula';
            for (const symbol of recipe.s) formula.append(game.atom(symbol));
            const points = document.createElement('strong');
            points.textContent = `+${recipe.p} 分`;
            row.append(formula, points);
            recipesElement.append(row);
        });
        $('danger').textContent = game.danger
            .filter(recipe => recipe.l <= game.level)
            .map(recipe => `⚠ ${recipe.s} 為不穩定分子，形成即失敗！`)
            .join(' ');
    };
})();
