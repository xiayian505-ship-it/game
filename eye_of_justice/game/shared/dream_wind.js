/**
 * 執法之眼｜夢中風聲（純 Web Audio API 合成）
 *
 * 只負責產生聲音，不設定宿主畫面、字體或視覺風格。
 * 使用既有 AudioContext、音量總線與白噪音緩衝，不額外下載音檔。
 * 由遊戲引擎依場景呼叫 setActive()；離開夢境後柔和淡出。
 */
(() => {
  'use strict';

  function create({ context, destination, noiseBuffer }) {
    if (!context || !destination || !noiseBuffer) return null;

    // 低頻風體：去除沉重低頻與尖銳高頻，模擬遠處穿堂的風。
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;

    const highpass = context.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 70;

    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 720;

    const body = context.createGain();
    body.gain.value = 0.13;

    // 少量較高頻的氣流，讓聲音不像低沉的持續機器噪音。
    const airFilter = context.createBiquadFilter();
    airFilter.type = 'bandpass';
    airFilter.frequency.value = 1220;
    airFilter.Q.value = 0.45;

    const air = context.createGain();
    air.gain.value = 0.022;

    // 不同週期的低頻振盪使風自然起伏，不以固定音量循環。
    const slowGust = context.createOscillator();
    slowGust.type = 'sine';
    slowGust.frequency.value = 0.075;
    const slowDepth = context.createGain();
    slowDepth.gain.value = 0.050;

    const smallGust = context.createOscillator();
    smallGust.type = 'sine';
    smallGust.frequency.value = 0.19;
    const smallDepth = context.createGain();
    smallDepth.gain.value = 0.019;

    const windLevel = context.createGain();
    windLevel.gain.value = 1;
    const fade = context.createGain();
    fade.gain.value = 0;

    source.connect(highpass).connect(lowpass).connect(body).connect(windLevel);
    source.connect(airFilter).connect(air).connect(windLevel);
    windLevel.connect(fade).connect(destination);

    // 音量 LFO 接在風體音量上，不產生可聽見的固定音高。
    slowGust.connect(slowDepth).connect(body.gain);
    smallGust.connect(smallDepth).connect(body.gain);

    source.start();
    slowGust.start();
    smallGust.start();

    let disposed = false;
    return {
      setActive(isDream) {
        if (disposed) return;
        const now = context.currentTime;
        fade.gain.cancelScheduledValues(now);
        fade.gain.setTargetAtTime(isDream ? 1 : 0, now, isDream ? 0.75 : 0.40);
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        for (const node of [source, slowGust, smallGust]) {
          try { node.stop(); } catch (_) { /* 已結束即可忽略 */ }
          node.disconnect();
        }
        for (const node of [highpass, lowpass, body, airFilter, air,
          slowDepth, smallDepth, windLevel, fade]) node.disconnect();
      }
    };
  }

  window.EyeDreamWind = { create };
})();
