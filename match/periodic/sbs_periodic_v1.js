// 元素實驗室｜共用資料、狀態與啟動入口。
// 腳本載入順序：主檔 → 遊戲功能 → 畫面 → 玩家互動。
window.SBSPeriodicV1 = {
  size: 6,

  // s 是棋盤上的直線排列；formula 是真實化學式，不代表分子鍵角。
  // l 是普通模式最早解鎖關卡；無盡模式從第 16 關開始，直接使用全部配方。
  recipes: [
    { s: 'OO', formula: 'O2', name: '氧氣', l: 1, p: 2 },
    { s: 'HH', formula: 'H2', name: '氫氣', l: 2, p: 2 },
    { s: 'HOH', formula: 'H2O', name: '水', l: 3, p: 4 },
    { s: 'CO', formula: 'CO', name: '一氧化碳', l: 4, p: 2 },
    { s: 'OCO', formula: 'CO2', name: '二氧化碳', l: 5, p: 4 },
    { s: 'NN', formula: 'N2', name: '氮氣', l: 6, p: 2 },
    { s: 'NO', formula: 'NO', name: '一氧化氮', l: 7, p: 2 },
    { s: 'ONO', formula: 'NO2', name: '二氧化氮', l: 8, p: 4 },
    { s: 'OOO', formula: 'O3', name: '臭氧', l: 9, p: 5 },
    { s: 'HCN', formula: 'HCN', name: '氰化氫', l: 10, p: 4 },
    { s: 'NNO', formula: 'N2O', name: '一氧化二氮', l: 11, p: 4 },
    { s: 'HOOH', formula: 'H2O2', name: '過氧化氫', l: 12, p: 6 },
    { s: 'HCCH', formula: 'C2H2', name: '乙炔', l: 13, p: 6 },
    { s: 'HSH', formula: 'H2S', name: '硫化氫', l: 14, p: 4 },
    { s: 'OSO', formula: 'SO2', name: '二氧化硫', l: 14, p: 4 },
    { s: 'SCS', formula: 'CS2', name: '二硫化碳', l: 15, p: 4 }
  ],

  // row / col 是真實週期表的前三週期位置（從 1 起算）。
  elements: Object.freeze([
    { symbol: 'H', name: '氫', number: 1, unlockLevel: 2, row: 1, col: 1, weight: 3 },
    { symbol: 'C', name: '碳', number: 6, unlockLevel: 4, row: 2, col: 14, weight: 2 },
    { symbol: 'N', name: '氮', number: 7, unlockLevel: 6, row: 2, col: 15, weight: 2 },
    { symbol: 'O', name: '氧', number: 8, unlockLevel: 1, row: 2, col: 16, weight: 4 },
    { symbol: 'S', name: '硫', number: 16, unlockLevel: 14, row: 3, col: 16, weight: 2 }
  ]),

  board: [],
  queue: [],
  modes: Object.freeze({
    normal: Object.freeze({ label: '普通模式', startLevel: 1 }),
    endless: Object.freeze({ label: '無盡模式', startLevel: 16 })
  }),
  mode: 'normal',
  selectedMode: 'normal',
  state: 'idle', // idle → running ⇄ paused → ended
  unsaved: false,
  pausedAt: null,
  pausedMs: 0,
  pendingAutoPause: false,
  pendingLevelAdvance: false,
  rankingMode: 'normal',
  runId: null,
  runSeq: 0,
  startedAt: 0,
  endedAt: null,
  moves: 0,
  roundCommitted: false,
  saving: false,
  level: 1,
  score: 0,
  total: 0,
  remaining: 0,
  over: false,
  locked: false,
  nextLevelTimer: null,
  $: id => document.getElementById(id)
};
