(() => {
    'use strict';
    const $ = id => document.getElementById(id), SIZE = 6;
    const RECIPES = [{ s: 'NN', l: 1, p: 1 }, { s: 'NTN', l: 2, p: 2 }, { s: 'TTT', l: 3, p: 2 }, { s: 'TTTTT', l: 5, p: 4 }, { s: 'NSSN', l: 6, p: 4 }, { s: 'NTNTN', l: 8, p: 6 }, { s: 'NFFFN', l: 10, p: 7 }, { s: 'SSSSSSS', l: 13, p: 10 }, { s: 'KK', l: 14, p: 1 }, { s: 'SKSKSK', l: 16, p: 10 }];
    const DANGER = [{ s: 'SSSS', l: 7 }, { s: 'TTTT', l: 18 }];
    let board, queue, level, score, total, remaining, over = false, locked = false;
    const random = arr => arr[Math.floor(Math.random() * arr.length)];
    function pool() { return level < 2 ? ['N'] : level < 6 ? ['N', 'N', 'T'] : level < 10 ? ['N', 'N', 'T', 'T', 'S'] : level < 14 ? ['N', 'N', 'T', 'T', 'S', 'F'] : ['N', 'N', 'T', 'T', 'S', 'F', 'K']; }
    function target() { return level === 1 ? 3 : Math.min(5 + Math.floor(level * 1.8), 38); }
    function supply() { return level === 1 ? 12 : Math.min(14 + level * 2, 45); }
    function start() { level = 1; total = 0; begin(); }
    function begin() { score = 0; remaining = supply(); over = false; locked = false; board = Array(36).fill(null); queue = Array.from({ length: Math.max(remaining, 5) }, () => random(pool())); if (level === 1) {
        board[14] = 'N';
        board[16] = 'N';
        board[26] = 'N';
        board[28] = 'N';
    } render(); say('點擊空格放入原子；把相鄰原子組成合成表中的分子！'); }
    function atom(t, cls = '') { let a = document.createElement('span'); a.className = 'atom ' + t + ' ' + cls; a.textContent = t; return a; }
    function render() { $('level').textContent = level; $('score').textContent = score + ' / ' + target(); $('total').textContent = total; $('remaining').textContent = remaining; $('progress').style.width = Math.min(100, score / target() * 100) + '%'; let b = $('board'); b.replaceChildren(); board.forEach((t, i) => { let c = document.createElement('button'); c.type = 'button'; c.className = 'cell ' + (t ? '' : 'empty'); c.setAttribute('aria-label', t ? '第' + (Math.floor(i / 6) + 1) + '列第' + (i % 6 + 1) + '格：' + t : '第' + (Math.floor(i / 6) + 1) + '列第' + (i % 6 + 1) + '格：空白'); if (t)
        c.append(atom(t)); c.addEventListener('click', () => place(i)); b.append(c); }); $('current').replaceWith(atom(queue[0] || 'N', 'large')); $('current')?.remove(); let current = document.querySelector('.queue .large'); current.id = 'current'; let next = $('next'); next.replaceChildren(...queue.slice(1, 6).map(t => atom(t, 'mini'))); let recipes = $('recipes'); recipes.replaceChildren(); RECIPES.filter(r => r.l <= level).forEach(r => { let d = document.createElement('div'); d.className = 'recipe'; let f = document.createElement('span'); f.className = 'formula'; for (let t of r.s)
        f.append(atom(t)); let p = document.createElement('strong'); p.textContent = '+' + r.p + ' 分'; d.append(f, p); recipes.append(d); }); $('danger').textContent = DANGER.filter(r => r.l <= level).map(r => '⚠ ' + r.s + ' 為不穩定分子，形成即失敗！').join(' '); }
    function say(t) { $('message').textContent = t; }
    function neighbors(i) { let r = Math.floor(i / SIZE), c = i % SIZE; return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && a < SIZE && b >= 0 && b < SIZE).map(([a, b]) => a * SIZE + b); }
    function matches(recipe, placed) { let found = null; const str = recipe.s; function dfs(path, used) { if (found)
        return; if (path.length === str.length) {
        if (used.has(placed))
            found = [...path];
        return;
    } let last = path[path.length - 1]; for (let n of neighbors(last)) {
        if (!used.has(n) && board[n] === str[path.length]) {
            used.add(n);
            path.push(n);
            dfs(path, used);
            path.pop();
            used.delete(n);
        }
    } } for (let i = 0; i < 36 && !found; i++) {
        if (board[i] === str[0])
            dfs([i], new Set([i]));
    } return found; }
    function place(i) { if (over || locked || board[i])
        return; board[i] = queue.shift(); remaining--; let danger = DANGER.filter(r => r.l <= level).map(r => ({ r, path: matches(r, i) })).find(x => x.path); if (danger) {
        over = true;
        render();
        say('💥 合成了不穩定分子 ' + danger.r.s + '！實驗失敗。');
        return;
    } let best = null; for (let r of RECIPES.filter(r => r.l <= level)) {
        let path = matches(r, i);
        if (path && (!best || r.p > best.r.p || r.p === best.r.p && r.s.length > best.r.s.length))
            best = { r, path };
    } if (best) {
        for (let n of best.path)
            board[n] = null;
        score += best.r.p;
        say('✨ 合成 ' + best.r.s + '，獲得 ' + best.r.p + ' 分！');
    }
    else
        say('原子已放入，繼續組合！'); render(); if (score >= target()) {
        locked = true;
        let bonus = remaining + (level >= 6 && board.every(x => !x) ? 5 : 0);
        total += score + bonus;
        say('🎉 第 ' + level + ' 關完成！剩餘原子獎勵 +' + bonus + ' 分。');
        setTimeout(() => { level++; begin(); say('🎉 進入第 ' + level + ' 關！新的合成表已更新。'); }, 1100);
    }
    else if (remaining <= 0 || board.every(Boolean)) {
        over = true;
        say('🧪 原子用完或棋盤已滿，還差 ' + (target() - score) + ' 分。按「重新開始」再挑戰！');
    } }
    $('restart').addEventListener('click', () => { if (confirm('確定要從第一關重新開始嗎？'))
        start(); });
    $('help').addEventListener('click', () => { $('modalTitle').textContent = '玩法說明'; $('modalBody').innerHTML = '<p>點擊 6×6 棋盤的空格，放入目前原子。把原子連成右側合成表的排列，即可合成並得分。原子可以橫向、直向、轉彎連接，合成後會消失。</p><p>每關原子數有限，達到目標分數就過關；剩餘原子會計入總分。第 7 關開始要小心不穩定分子！</p><p>這是參考經典玩法的自製懷舊版，關卡配置和原版不完全相同。</p>'; $('modal').showModal(); });
    start();
})();

