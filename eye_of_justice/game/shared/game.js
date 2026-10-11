/**
 * Eye of Justice / game logic
 * 以 Claude《執法之眼》原型的「卷宗、凝視、場景搜查、對話、WebAudio 音效」為基礎，
 * 擴充為第一回第一節的場景調查與線索比對。格式化為可閱讀的功能檔。
 * 只負責遊戲狀態，不負責雨霧視覺動畫（另見 game_style.js）。
 */
(() => {
  'use strict';

  const data = window.EYE_EPISODE;
  if (!data) {
    document.body.textContent = '找不到第一節資料，請確認 section_01/data/episode_01_01.js 已載入。';
    return;
  }

  const $ = selector => document.querySelector(selector);
  const saveKey = 'eye-of-justice:01-01:progress';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const el = {
    shell: $('#gameShell'),
    stage: $('#stage'), art: $('#stageArt'), spots: $('#hotspotLayer'),
    sceneTitle: $('#sceneTitle'), location: $('#locationLabel'),
    objective: $('#objectiveText'), toolTip: $('#toolstripTip'),
    dialogue: $('#dialogue'), speaker: $('#speaker'), text: $('#dialogueText'),
    next: $('#nextButton'), interaction: $('#interaction'),
    interactionTitle: $('#interactionTitle'), options: $('#optionList'),
    resolve: $('#resolveButton'), record: $('#recordPanel'),
    clues: $('#clueList'), clueCount: $('#clueCount'),
    detail: $('#detailPanel'), detailText: $('#detailText'),
    detailPicture: $('#detailPicture'), gaze: $('#gazeButton'),
    hint: $('#hintPanel'), hintText: $('#hintText'),
    start: $('#startScreen'), resume: $('#resumeButton'),
    end: $('#endingScreen'), endRecord: $('#endingRecord'),
    toast: $('#toast'), mute: $('#muteButton')
  };

  const state = {
    phase: 'dream', step: 'intro', seen: new Set(), clues: new Set(),
    gaze: false, finished: false, dialogue: [], dialogueIndex: 0,
    typing: false, dialogueDone: null, inConversation: false, sound: true
  };

  // Claude 原型的 WebAudio 合成音效／雨聲環境音沿用並展開排版。
  // 夢境風聲另外由 dream_wind.js 合成，與其他場景音效分開控制。
  // 不下載音檔，第一次使用者點擊後才啟動 AudioContext。
  const audio = { context: null, rain: null, drone: null, master: null, noise: null, wind: null };

  function initAudio() {
    if (audio.context) return audio.context;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return null;

    const context = new Audio();
    const master = context.createGain();
    master.gain.value = state.sound ? 0.65 : 0;
    master.connect(context.destination);

    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;

    const rainSource = context.createBufferSource();
    rainSource.buffer = buffer;
    rainSource.loop = true;
    const rainFilter = context.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 1450;
    rainFilter.Q.value = 0.55;
    const rain = context.createGain();
    rain.gain.value = 0;
    rainSource.connect(rainFilter).connect(rain).connect(master);
    rainSource.start();

    const humSource = context.createOscillator();
    humSource.type = 'sawtooth';
    humSource.frequency.value = 46;
    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 105;
    const drone = context.createGain();
    drone.gain.value = 0;
    humSource.connect(lowpass).connect(drone).connect(master);
    humSource.start();

    Object.assign(audio, { context, master, rain, drone, noise: buffer });
    return context;
  }

  function tone(frequency, duration, type = 'sine', volume = 0.07, toFrequency = null, delay = 0) {
    if (!audio.context || !state.sound) return;
    const context = audio.context;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (toFrequency) oscillator.frequency.exponentialRampToValueAtTime(toFrequency, start + duration);
    envelope.gain.setValueAtTime(volume, start);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope).connect(audio.master);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  function noise(duration, volume, frequency, filterType = 'lowpass', delay = 0) {
    if (!audio.context || !state.sound) return;
    const context = audio.context;
    const source = context.createBufferSource();
    source.buffer = audio.noise;
    const filter = context.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    const envelope = context.createGain();
    const start = context.currentTime + delay;
    envelope.gain.setValueAtTime(volume, start);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(envelope).connect(audio.master);
    source.start(start);
    source.stop(start + duration);
  }

  const sounds = {
    click: () => tone(520, 0.08, 'triangle', 0.05),
    bell: () => [1568, 2093, 2637, 1760].forEach((hz, i) => tone(hz, 1.4, 'sine', 0.06, null, i * 0.1)),
    chime: () => { tone(988, 0.85, 'sine', 0.08); tone(1480, 1.1, 'sine', 0.05, null, 0.08); },
    thunder: () => { noise(2.4, 0.7, 180); tone(55, 1.9, 'sine', 0.23, 28); },
    gavel: () => { noise(0.24, 0.5, 420); tone(120, 0.43, 'triangle', 0.2, 42); },
    wrong: () => tone(155, 0.35, 'square', 0.085, 76),
    gaze: () => { tone(220, 0.9, 'sine', 0.10, 1250); tone(330, 0.9, 'triangle', 0.05, 1900); }
  };
  function sfx(name) { sounds[name]?.(); }
  function atmosphere(phase) {
    if (!audio.context) return;
    const targets = phase === 'dream' ? [0.065, 0.047] : [0.045, 0.009];
    audio.rain.gain.setTargetAtTime(targets[0], audio.context.currentTime, 0.7);
    audio.drone.gain.setTargetAtTime(targets[1], audio.context.currentTime, 0.7);

    // 風只屬於夢中公堂；進入辦公室便淡出，不影響原有的雨聲。
    if (!audio.wind && window.EyeDreamWind?.create) {
      audio.wind = window.EyeDreamWind.create({
        context: audio.context,
        destination: audio.master,
        noiseBuffer: audio.noise
      });
    }
    audio.wind?.setActive(phase === 'dream');
  }

  function flash() {
    el.stage.classList.remove('is-flashing');
    void el.stage.offsetWidth;
    el.stage.classList.add('is-flashing');
  }
  function toast(message) {
    el.toast.textContent = message;
    el.toast.classList.add('visible');
    clearTimeout(toast.timeout);
    toast.timeout = setTimeout(() => el.toast.classList.remove('visible'), 2600);
  }

  function save() {
    try {
      localStorage.setItem(saveKey, JSON.stringify({
        phase: state.phase, step: state.step, seen: [...state.seen],
        clues: [...state.clues], gaze: state.gaze, finished: state.finished
      }));
      el.resume.hidden = false;
    } catch (_) {
      // 私密瀏覽禁用儲存時，仍允許完整遊玩。
    }
  }
  function loadSaved() {
    try {
      const raw = localStorage.getItem(saveKey);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!['dream', 'office'].includes(obj.phase)) return null;
      return obj;
    } catch (_) {
      return null;
    }
  }
  function reset() {
    Object.assign(state, {
      phase: 'dream', step: 'intro', seen: new Set(), clues: new Set(),
      gaze: false, finished: false, dialogue: [], dialogueIndex: 0,
      typing: false, dialogueDone: null, inConversation: false
    });
    updateClues();
    save();
  }

  function collect(id) {
    if (state.clues.has(id)) return;
    state.clues.add(id);
    updateClues();
    sfx('chime');
    toast('線索已記錄：' + data.clues[id].title);
    save();
  }
  function updateClues() {
    el.clueCount.textContent = state.clues.size;
    el.clues.replaceChildren();
    for (const [id, info] of Object.entries(data.clues)) {
      const found = state.clues.has(id);
      const card = document.createElement('article');
      card.className = 'clue-card' + (found ? '' : ' missing');
      const mark = document.createElement('span');
      mark.className = 'clue-mark';
      mark.textContent = found ? info.symbol : '？';
      const copy = document.createElement('div');
      const group = document.createElement('small');
      group.textContent = found ? info.group : '尚未取得';
      const heading = document.createElement('h3');
      heading.textContent = found ? info.title : '未確認的線索';
      const text = document.createElement('p');
      text.textContent = found ? info.detail : '留意環境中的細節。';
      copy.append(group, heading, text);
      card.append(mark, copy);
      el.clues.append(card);
    }
  }

  // 延續 Claude 原型「逐字出現」的呈現，支援再次點擊立即顯示全文。
  function typeLine(line) {
    el.speaker.textContent = line.speaker || '旁白';
    el.text.replaceChildren();
    const chars = [...line.text];
    state.typing = !reduceMotion;
    el.dialogue.dataset.speaker = line.speaker === '黑臉大漢' ? 'magistrate' : 'normal';

    if (reduceMotion) {
      el.text.textContent = line.text;
    } else {
      chars.forEach((character, i) => {
        if (character === '\n') {
          el.text.append(document.createElement('br'));
          return;
        }
        const letter = document.createElement('span');
        letter.className = 'type-letter';
        letter.textContent = character;
        letter.style.animationDelay = `${i * 13}ms`;
        el.text.append(letter);
      });
    }
    clearTimeout(typeLine.timer);
    typeLine.timer = setTimeout(() => { state.typing = false; }, chars.length * 13 + 170);
    el.next.textContent = state.typing ? '顯示全文 ↗' : '繼續 ↗';
    if (line.sound) {
      sfx(line.sound);
      if (line.sound === 'thunder') flash();
    }
  }
  function dialogue(lines, done) {
    state.dialogue = lines;
    state.dialogueIndex = 0;
    state.dialogueDone = done;
    state.inConversation = true;
    el.dialogue.hidden = false;
    el.interaction.hidden = true;
    el.resolve.hidden = true;
    el.spots.replaceChildren();
    typeLine(lines[0]);
  }
  function nextDialogue() {
    if (!state.inConversation) return;
    if (state.typing) {
      state.typing = false;
      clearTimeout(typeLine.timer);
      el.text.textContent = state.dialogue[state.dialogueIndex].text;
      el.text.style.whiteSpace = 'pre-line';
      el.next.textContent = '繼續 ↗';
      return;
    }
    state.dialogueIndex++;
    if (state.dialogueIndex < state.dialogue.length) {
      sfx('click');
      typeLine(state.dialogue[state.dialogueIndex]);
      return;
    }
    state.inConversation = false;
    const done = state.dialogueDone;
    state.dialogueDone = null;
    done?.();
  }

  function setScene(scene) {
    state.phase = scene;
    el.stage.dataset.scene = scene;
    el.location.textContent = scene === 'dream' ? '序章・夢中公堂' : '第一節・刑事組辦公室';
    el.sceneTitle.innerHTML = scene === 'dream'
      ? '<span>THE DREAM / 01</span><strong>夢中公堂</strong>'
      : '<span>THE WAKING / 02</span><strong>刑事組辦公室</strong>';
    atmosphere(scene);
    dispatchEvent(new CustomEvent('eye:scene', { detail: { scene } }));
    save();
  }
  function setObjective(text) { el.objective.textContent = text; }
  function setHint(text) { el.hintText.textContent = text; }

  function renderSpots() {
    el.spots.replaceChildren();
    const locations = data[state.phase]?.places || [];
    for (const place of locations) {
      const spot = document.createElement('button');
      spot.type = 'button';
      spot.className = 'hotspot' + (state.seen.has(place.id) ? ' explored' : '');
      spot.style.left = `${place.x}%`;
      spot.style.top = `${place.y}%`;
      spot.dataset.id = place.id;
      spot.setAttribute('aria-label', `調查：${place.name}`);
      spot.innerHTML = `<span class="hotspot-ring"><span>${place.symbol}</span></span><span class="hotspot-label"></span>`;
      spot.querySelector('.hotspot-label').textContent = place.name;
      spot.addEventListener('click', () => inspect(place));
      el.spots.append(spot);
    }
  }
  function inspect(place) {
    sfx('click');
    state.seen.add(place.id);
    save();
    dialogue(place.lines, () => {
      if (place.clue) collect(place.clue);
      if (place.detail) openDetail();
      else explore();
    });
  }

  function explore() {
    state.step = state.phase === 'dream' ? 'dreamExplore' : 'officeExplore';
    save();
    el.interaction.hidden = true;
    el.dialogue.hidden = true;
    el.resolve.hidden = true;
    renderSpots();

    if (state.phase === 'dream') {
      const required = ['gavel', 'window', 'figure', 'relic'];
      const checked = required.filter(id => state.seen.has(id)).length;
      const ready = checked >= 3 && state.seen.has('relic');
      setObjective(`調查公堂中的異常 · ${checked}/4`);
      setHint(ready ? '已經看過足夠的異常了。按下「聆聽敕令」，聽堂上之人說話。' :
        '先觀察公堂的驚堂木、雨幕、堂上之人與案上小物。要特別留意發光的輪廓。');
      el.toolTip.textContent = ready ? '還可以繼續調查，也可以聆聽堂上之人。' : '點選畫面上的微光，調查物件。';
      el.resolve.hidden = !ready;
      el.resolve.textContent = '聆聽敕令 →';
    } else {
      const ready = state.gaze && state.clues.has('dream_relic') && state.clues.has('pendant');
      setObjective(ready ? '將夢中記憶與現實線索比對' : '檢查卷宗、窗外與頸間的異物');
      setHint(ready ? '按下「比對異象」，從線索中選出與夢中物事相同的東西。' :
        '檢查胸前吊墜，打開物件特寫後使用「凝視」。也別忘記調查桌上的案卷與窗外雨聲。');
      el.toolTip.textContent = ready ? '夢與現實之間，似乎有一處吻合。' : '找到疑點，再用「執法之眼」凝視。';
      el.resolve.hidden = !ready;
      el.resolve.textContent = '比對異象 →';
    }
  }

  function choose(question, options, onSelect) {
    el.spots.replaceChildren();
    el.dialogue.hidden = true;
    el.interaction.hidden = false;
    el.resolve.hidden = true;
    el.interactionTitle.textContent = question;
    el.options.replaceChildren();
    options.forEach((choice, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'choice-btn';
      button.textContent = choice.label;
      button.addEventListener('click', () => onSelect(choice, button, index));
      el.options.append(button);
    });
  }
  function dreamQuestion() {
    state.step = 'dreamQuestion';
    save();
    setObjective('從觀察中辨認聲音的來源');
    setHint('你已經看過公堂內外。黑臉大漢所說的「不是雷鳴」，和冤案有什麼關係？');
    choose(data.dream.question, data.dream.options, (option, button) => {
      if (!option.correct) {
        sfx('wrong');
        button.classList.add('is-wrong');
        toast(option.response);
        return;
      }
      sfx('chime');
      collect('court_voice');
      state.step = 'dreamReveal';
      save();
      dialogue(data.dream.revelation, () => {
        flash();
        setScene('office');
        state.step = 'officeIntro';
        save();
        dialogue(data.waking, explore);
      });
    });
  }

  function openDetail() {
    el.detail.hidden = false;
    el.detailPicture.classList.toggle('is-seen', state.gaze);
    el.detailText.textContent = state.gaze ? data.office.detail.after : data.office.detail.before;
    el.gaze.hidden = state.gaze;
    setObjective('凝視虎頭鍘吊墜');
    setHint('使用「凝視」，看清吊墜原本模糊的紋路。');
  }
  function closeDetail() {
    el.detail.hidden = true;
    explore();
  }
  function gaze() {
    if (state.gaze) return;
    sfx('gaze');
    state.gaze = true;
    el.detailPicture.classList.add('is-seen');
    el.detailText.textContent = data.office.detail.after;
    el.gaze.hidden = true;
    collect('pendant');
    flash();
    save();
  }
  function officeCompare() {
    state.step = 'officeCompare';
    save();
    setObjective('從卷宗中選出呼應夢境的線索');
    setHint('夢中被扔向胸口的，是案上的一件發光小物。仔細想想哪個現實物件輪廓相同。');
    const options = ['case_files', 'storm', 'pendant']
      .filter(id => state.clues.has(id))
      .map(id => ({ id, label: data.clues[id].title }));
    choose(data.office.question, options, option => {
      if (option.id !== data.office.answer) {
        sfx('wrong');
        toast(data.office.wrong);
        return;
      }
      sfx('chime');
      state.step = 'officeFinal';
      save();
      dialogue(data.office.final, finish);
    });
  }
  function finish() {
    state.finished = true;
    audio.wind?.setActive(false);
    state.step = 'complete';
    save();
    el.shell.hidden = true;
    el.end.hidden = false;
    el.endRecord.textContent = `線索 ${state.clues.size} / ${Object.keys(data.clues).length}　·　完成第一回第一節`;
    dispatchEvent(new CustomEvent('eye:scene', { detail: { scene: 'ending' } }));
  }
  function begin(resume = false) {
    initAudio()?.resume();
    if (!resume) reset();
    else {
      const saved = loadSaved();
      if (!saved) reset();
      else {
        state.phase = saved.phase;
        state.step = saved.step;
        state.seen = new Set(saved.seen || []);
        state.clues = new Set(saved.clues || []);
        state.gaze = !!saved.gaze;
        state.finished = !!saved.finished;
        updateClues();
      }
    }
    el.start.hidden = true;
    el.end.hidden = true;
    el.shell.hidden = false;
    setScene(state.phase);

    if (state.finished) { finish(); return; }
    if (resume && state.step === 'dreamQuestion') { dreamQuestion(); return; }
    if (resume && state.step === 'officeCompare') { officeCompare(); return; }
    if (resume && state.phase === 'office') { explore(); return; }
    if (resume && state.step === 'dreamExplore') { explore(); return; }
    if (resume && state.step === 'dreamReveal') { dreamQuestion(); return; }
    dialogue(data.opening, explore);
  }

  function toggleSound() {
    state.sound = !state.sound;
    if (audio.master) audio.master.gain.value = state.sound ? 0.65 : 0;
    el.mute.textContent = state.sound ? '♫' : '♪̸';
    el.mute.title = state.sound ? '關閉音效' : '開啟音效';
    el.mute.setAttribute('aria-label', el.mute.title);
  }
  function closeLayers() {
    if (!el.hint.hidden) { el.hint.hidden = true; return true; }
    if (!el.record.hidden) { el.record.hidden = true; return true; }
    if (!el.detail.hidden) { closeDetail(); return true; }
    return false;
  }

  $('#startButton').addEventListener('click', () => begin(false));
  $('#resumeButton').addEventListener('click', () => begin(true));
  $('#replayButton').addEventListener('click', () => begin(false));
  el.next.addEventListener('click', nextDialogue);
  el.resolve.addEventListener('click', () => state.phase === 'dream' ? dreamQuestion() : officeCompare());
  el.mute.addEventListener('click', toggleSound);
  $('#recordButton').addEventListener('click', () => { updateClues(); el.record.hidden = false; });
  $('#closeRecordButton').addEventListener('click', () => { el.record.hidden = true; });
  $('#helpButton').addEventListener('click', () => { el.hint.hidden = false; });
  $('#closeHintButton').addEventListener('click', () => { el.hint.hidden = true; });
  $('#closeDetailButton').addEventListener('click', closeDetail);
  el.gaze.addEventListener('click', gaze);

  for (const layer of [el.record, el.hint, el.detail]) {
    layer.addEventListener('click', event => { if (event.target === layer) closeLayers(); });
  }
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { closeLayers(); return; }
    if (!el.start.hidden || !el.end.hidden) return;
    const key = event.key.toLowerCase();
    if (key === 'm') toggleSound();
    if (key === 'r' && el.record.hidden) { updateClues(); el.record.hidden = false; }
    if (key === 'e' && !el.detail.hidden) gaze();
    if ((key === 'enter' || key === ' ') && state.inConversation &&
        !['BUTTON', 'A'].includes(document.activeElement?.tagName)) {
      event.preventDefault();
      nextDialogue();
    }
  });

  window.addEventListener('pagehide', () => {
    audio.wind?.dispose();
    audio.wind = null;
  }, { once: true });

  el.resume.hidden = !loadSaved();
  updateClues();
  setObjective('查看眼前的公堂');
  setHint('跟隨宋雁寧的視角，調查夢中公堂。');
  // UI 效果由 game_style.js 監聽 eye:scene，與遊戲邏輯保持分離。
})();
