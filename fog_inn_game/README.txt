霧渡客棧｜策略卡牌 × 推理逃脫
================================
開啟方式：直接雙擊 index.html（需要連網，函式庫從 https://lib.stillnessbyslowly.com/ 載入）。

檔案結構
  index.html                  畫面骨架 + 依序載入「函式庫」與「遊戲程式」
  css/game_theme.css          遊戲外觀（版面、卡牌、房間、面板、動畫）
  js/game_data.js             卡牌／敵人／房間／線索／推理題／結局（改劇情只改這個）
  js/game_state.js            進度狀態（燈籠、線索、道具）
  js/feedback_effects.js      音效與特效的遊戲事件包裝（內部全是函式庫呼叫）
  js/card_battle_engine.js    策略卡牌戰鬥邏輯（無 DOM）
  js/card_battle_view.js      戰鬥畫面與操作
  js/escape_room.js           房間、熱點、線索簿、密碼鎖
  js/deduction_board.js       最終推理指認
  js/game_main.js             入口，串接整個流程

使用的函式庫積木（全部線上呼叫，沒有複製）
  策略卡牌：Deck、CardInstanceIdentity、CardResourcePool、CardTurnOrder、CardEffectRegistry、CardTargetSelection
  版面：SlowlyHandFanLayout、SlowlyToast
  特效：ConfettiBurst、Shockwave、FlashShake、StarExplosion、ClassicFireworks、VictoryBeam、ClickBurst、
        JackpotPop、Starfield、CanvasFog、CanvasRain、TiltSpotlight、PortalWipe、ElectricBorder、BreathingGlow
  音效：SlowlyAudioContext、SlowlyHarmonicChime

玩法
  1. 在大廳、客房、後院調查發光物件，收集 6 條線索。
  2. 紙人守衛與古井的四目鬼要用卡牌戰鬥擊敗（每回合 3 點靈力，選手牌出牌，單體技能需點選敵人）。
  3. 客房抽屜是四位數密碼鎖，答案藏在某條線索裡。
  4. 線索集滿後，走到大門做最終推理：兇手、手法、動機全對即過關。
