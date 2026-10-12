/** 霧林之契｜風雨環境音：Web Audio 合成，不引用或嵌入他人的音檔。點按音效開關後才播放。 */
(() => {
  "use strict";
  let context = null;
  let master = null;
  let sources = [];
  let enabled = false;

  function makeNoise(seconds) {
    const sampleRate = context.sampleRate;
    const buffer = context.createBuffer(1, Math.floor(sampleRate * seconds), sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    sources.push(source);
    return source;
  }
  function startAudio() {
    if (!context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0;
      master.connect(context.destination);
      // 雨：帶通白噪聲；風：更低頻的緩慢變化濾波噪聲。
      const rain = makeNoise(2.8);
      const rainFilter = context.createBiquadFilter(); rainFilter.type = "highpass"; rainFilter.frequency.value = 900;
      const rainLow = context.createBiquadFilter(); rainLow.type = "lowpass"; rainLow.frequency.value = 6400;
      const rainGain = context.createGain(); rainGain.gain.value = .22;
      rain.connect(rainFilter).connect(rainLow).connect(rainGain).connect(master);
      const wind = makeNoise(3.7);
      const windFilter = context.createBiquadFilter(); windFilter.type = "lowpass"; windFilter.frequency.value = 420;
      const windGain = context.createGain(); windGain.gain.value = .29;
      wind.connect(windFilter).connect(windGain).connect(master);
      const sway = context.createOscillator(); sway.type = "sine"; sway.frequency.value = .13;
      const swayDepth = context.createGain(); swayDepth.gain.value = 145;
      sway.connect(swayDepth).connect(windFilter.frequency);
      sources.push(sway);
      sources.forEach(node => node.start());
    }
    context.resume().catch(() => {});
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setTargetAtTime(.23, context.currentTime, .6);
    return true;
  }
  function stopAudio() {
    if (!context || !master) return;
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setTargetAtTime(0, context.currentTime, .32);
  }
  async function setEnabled(next) {
    if (next) {
      try { enabled = startAudio(); } catch (error) { enabled = false; console.warn("霧林之契：環境音無法啟用", error); }
    } else { enabled = false; stopAudio(); }
    return enabled;
  }
  window.MistforestAmbience = Object.freeze({ setEnabled, stop: () => setEnabled(false), get enabled(){return enabled;} });
})();
