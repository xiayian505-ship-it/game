// 共用狀態與啟動入口；依序載入功能、畫面與互動模組。
window.SBSChemistryV1 = {
    size: 6,
    recipes: [
        { s: 'NN', l: 1, p: 1 }, { s: 'NTN', l: 2, p: 2 },
        { s: 'TTT', l: 3, p: 2 }, { s: 'TTTTT', l: 5, p: 4 },
        { s: 'NSSN', l: 6, p: 4 }, { s: 'NTNTN', l: 8, p: 6 },
        { s: 'NFFFN', l: 10, p: 7 }, { s: 'SSSSSSS', l: 13, p: 10 },
        { s: 'KK', l: 14, p: 1 }, { s: 'SKSKSK', l: 16, p: 10 }
    ],
    danger: [{ s: 'SSSS', l: 7 }, { s: 'TTTT', l: 18 }],
    board: [],
    queue: [],
    level: 1,
    score: 0,
    total: 0,
    remaining: 0,
    over: false,
    locked: false,
    nextLevelTimer: null,
    $: id => document.getElementById(id)
};
