/**
 * 《執法之眼》第一集／第一回／第一節
 * 敘事依據：《人格篡位》第一回開頭至第一個「＃」分隔符。
 * 調查互動與選項為遊戲化呈現；不新增原作案件事實。
 * 獨立資料檔，不依賴伺服器 fetch；file:// 亦可開啟。
 */
window.EYE_EPISODE = {
  id: '01-01',
  book: '人格篡位：狸貓換太子',
  chapter: '第一回　墨水滲出藏狡詐，包家後人偏姓宋',
  section: '第一節・敕令',
  opening: [
    { speaker: '旁白', text: '屋外雷雨交加。\n閃電照出一座陌生的公堂，案上的小物被驚堂木震得東倒西歪。', sound: 'thunder' },
    { speaker: '宋雁寧', text: '……這是哪裡？\n明明聽得見雷聲，卻總覺得不只如此。' }
  ],
  dream: {
    places: [
      {
        id: 'gavel', x: 49, y: 70,
        name: '驚堂木', symbol: '木',
        lines: [
          { speaker: '旁白', text: '木鎚擊下，沉悶的聲音穿過整座公堂。案上的物什被震得偏離原位。', sound: 'gavel' },
          { speaker: '宋雁寧', text: '這聲音不像窗外的雷……倒像是有人正等著審案。' }
        ]
      },
      {
        id: 'window', x: 17, y: 48,
        name: '雨幕', symbol: '雨',
        lines: [
          { speaker: '旁白', text: '窗外狂風裹著暴雨。每當雷聲遠去，似乎還有另一種聲音殘留。' },
          { speaker: '宋雁寧', text: '只是風聲嗎？還是……有人在喊？' }
        ]
      },
      {
        id: 'figure', x: 52, y: 39,
        name: '堂上之人', symbol: '影',
        lines: [
          { speaker: '旁白', text: '黑臉大漢端坐堂中，身影不動，卻有不容迴避的威嚴。' },
          { speaker: '宋雁寧', text: '從小到大都有人叫我包大人……但我的人生，憑什麼由別人決定？' }
        ]
      },
      {
        id: 'relic', x: 63, y: 63,
        name: '案上小物', symbol: '？',
        clue: 'dream_relic',
        lines: [
          { speaker: '旁白', text: '案前有道細小的金光。那件物事有突出的虎首輪廓，下面還拖著一片鋒利的弧影。' },
          { speaker: '宋雁寧', text: '……虎頭？這到底是什麼東西？' }
        ]
      }
    ],
    question: '那不是雷鳴。宋雁寧聽見的，還可能是什麼？',
    options: [
      { label: '只有窗外的狂風暴雨', correct: false, response: '雨聲清晰，但堂上之人說的「不是雷鳴」仍沒有得到解釋。' },
      { label: '萬千世人的喊冤之聲', correct: true, response: '雷聲之外，還有不肯沉寂的冤聲。' },
      { label: '被驚堂木震落的案上器物', correct: false, response: '那聲音來自堂內，不是黑臉大漢指向的窗外。' }
    ],
    revelation: [
      { speaker: '黑臉大漢', text: '『後代子孫包雁寧聽令。如今世道淪喪，冤案叢生，故賜妳此執法之眼，望妳莫辱包家門風！』', sound: 'bell' },
      { speaker: '宋雁寧', text: '「我也沒做什麼辱沒包家門風的事吧……」\n她想抗議，卻在那肅穆的氣氛裡越說越小聲。' },
      { speaker: '黑臉大漢', text: '『聽見了嗎？那不是雷鳴，而是萬千世人在喊冤。』' },
      { speaker: '旁白', text: '大漢抓起案上發著光的物什，朝她扔來。\n萬丈光芒撞上胸口——', sound: 'chime' }
    ]
  },
  waking: [
    { speaker: '宋雁寧', text: '「是夢？」\n她猛然驚醒。明明才下午，刑事組辦公室卻暗得像深夜。', sound: 'thunder' },
    { speaker: '旁白', text: '颱風帶來的狂風暴雨，震得老舊鋁窗框嘎嘎作響。\n桌上堆著查了整整兩週的柳云依墜樓案卷宗。' }
  ],
  office: {
    places: [
      {
        id: 'files', x: 30, y: 77, name: '墜樓案卷宗', symbol: '卷', clue: 'case_files',
        lines: [
          { speaker: '宋雁寧', text: '柳云依墜樓，已經整整兩週。\n所有證據都指向意外……為什麼還是覺得不對勁？' },
          { speaker: '旁白', text: '卷宗一頁接著一頁，卻沒有任何能直接推翻「意外」的證據。' }
        ]
      },
      {
        id: 'window', x: 78, y: 40, name: '老舊鋁窗', symbol: '雨', clue: 'storm',
        lines: [
          { speaker: '旁白', text: '悶雷在窗外滾過。鋁製窗框發出與夢中不同、卻同樣刺耳的震響。' },
          { speaker: '宋雁寧', text: '這次是真的雷聲。氣象預報好像說過，最近會有颱風。' }
        ]
      },
      {
        id: 'pendant', x: 55, y: 76, name: '胸前異物', symbol: '眼', detail: true,
        lines: [
          { speaker: '旁白', text: '揉著太陽穴的手碰到一件不屬於自己的東西。\n脖子上不知何時，多出了一枚冰涼的吊墜。' },
          { speaker: '宋雁寧', text: '這個形狀……我好像剛才才見過。' }
        ]
      }
    ],
    detail: {
      title: '虎頭鍘吊墜',
      subtitle: '查看細節／使用執法之眼',
      before: '金屬表面的紋路模糊不清，像還蒙著夢中的霧。',
      after: '微光沿著虎首與鍘刀輪廓流動。這與夢中案上的小物，是同一種形狀。'
    },
    question: '夢中被擲向她胸口的物事，在現實中對應哪一項線索？',
    answer: 'pendant',
    wrong: '這項線索存在於現實，卻無法解釋夢中發光的物事。',
    final: [
      { speaker: '宋雁寧', text: '「難道……從小跟在我身邊，那個每天唸個沒完的阿公……」' },
      { speaker: '宋雁寧', text: '「其實就是我家的祖先，包拯？」' },
      { speaker: '旁白', text: '可那分明只是個囉嗦的普通老人，跟夢裡黑臉威嚴的大漢，形象差得也太遠了吧？' }
    ]
  },
  clues: {
    dream_relic: { title: '案上的虎首輪廓', group: '夢境', detail: '驚堂木旁的小物泛著金光，依稀看見虎首與刀刃的形狀。', symbol: '虎' },
    court_voice: { title: '萬千冤聲', group: '夢境', detail: '堂上之人說，那不是雷鳴，而是萬千世人在喊冤。', symbol: '聲' },
    case_files: { title: '柳云依案卷宗', group: '現實', detail: '兩週來證據都指向意外，宋雁寧卻仍覺得不對勁。', symbol: '卷' },
    storm: { title: '窗外的雷聲', group: '現實', detail: '現實中的颱風雨聲，與夢中的異樣聲響形成對照。', symbol: '雨' },
    pendant: { title: '虎頭鍘吊墜', group: '現實', detail: '驚醒後突然出現在頸上的吊墜。凝視時能看清與夢中相同的輪廓。', symbol: '鍘' }
  }
};
