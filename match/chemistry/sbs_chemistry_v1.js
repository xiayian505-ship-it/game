// 共用狀態與啟動入口；依序載入功能、畫面與互動模組。
window.SBSChemistryV1 = {
  size: 6,
  recipes: [
    { s: 'NN', l: 1, p: 1 },
    { s: 'NTN', l: 2, p: 2 },
    { s: 'TTT', l: 3, p: 2 },
    { s: 'TTTTT', l: 5, p: 4 },
    { s: 'NSSN', l: 6, p: 4 },
    { s: 'NTNTN', l: 8, p: 6 },
    { s: 'NFFFN', l: 10, p: 7 },
    { s: 'SSSSSSS', l: 13, p: 10 },
    { s: 'KK', l: 14, p: 1 },
    { s: 'SKSKSK', l: 16, p: 10 }
  ],
  danger: [
    { s: 'SSSS', l: 7 },
    { s: 'TTTT', l: 18 }
  ],
  board: [],
  queue: [],
  // 兩個獨立場次模式；普通照原有關卡進度，無盡直接從第 14 關開始。
  modes: Object.freeze({
    normal: Object.freeze({ label: '普通模式', startLevel: 1 }),
    endless: Object.freeze({ label: '無盡模式', startLevel: 14 })
  }),
  mode: 'normal',
  selectedMode: 'normal',
  state: 'idle', // match3_v1：idle → running ⇄ paused → ended
  unsaved: false,
  pausedAt: null,
  pausedMs: 0,
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
