/** 霧林之契｜遊戲開場：Canvas 細雨與螢火蟲、互動轉場。主遊戲 UI 不在此改動。 */
(() => {
  "use strict";
  const opening = document.querySelector("#wf-opening");
  const game = document.querySelector("#wf-game");
  const canvas = document.querySelector("#wf-weather");
  const entryButton = document.querySelector("#wf-enter");
  const soundButton = document.querySelector("#wf-sound");
  if (!opening || !game || !canvas || !entryButton) return;
  // 圖床暫時不可用時，標題仍能顯示文字並點擊進入遊戲。
  entryButton.querySelector(".wf-opening-title-art")?.addEventListener("error", () => {
    entryButton.classList.add("is-art-missing");
  });
  const ctx = canvas.getContext("2d");
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  let drops = [], lights = [], width = 1, height = 1, running = true, frame = 0, lastTime = 0;
  const rand = (a, b) => a + Math.random() * (b - a);

  function resetParticles() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    width = opening.clientWidth || window.innerWidth;
    height = opening.clientHeight || window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drops = Array.from({length: reduceMotion ? 20 : Math.min(145, Math.max(65, Math.floor(width * height / 7300)))}, () => ({
      x:rand(0,width),y:rand(0,height),len:rand(8,21),speed:rand(3.5,9),alpha:rand(.11,.36)
    }));
    lights = Array.from({length:reduceMotion?9:Math.min(23,Math.max(12,Math.floor(width/42)))}, () => ({
      x:rand(25,width-25),y:rand(height*.31,height*.90),phase:rand(0,Math.PI*2),radius:rand(1.2,2.6),speed:rand(.25,.85)
    }));
  }
  function draw(time) {
    if (!running || !ctx) return;
    const step = Math.min((time - (lastTime || time)) / 16.67, 2.2);
    if (time-lastTime < 28 && !reduceMotion) { frame=requestAnimationFrame(draw);return; }
    lastTime=time;
    ctx.clearRect(0,0,width,height);
    ctx.lineWidth=.75;
    for (const drop of drops) {
      ctx.beginPath(); ctx.strokeStyle=`rgba(191,223,216,${drop.alpha})`;
      ctx.moveTo(drop.x,drop.y);ctx.lineTo(drop.x-5,drop.y+drop.len);ctx.stroke();
      if (!reduceMotion) {drop.y+=drop.speed*step;drop.x-=1.55*step;if(drop.y>height+25){drop.y=-25;drop.x=rand(0,width+30)}}
    }
    ctx.globalCompositeOperation="screen";
    for (const light of lights) {
      const glow=.42+.30*Math.sin(time*.001*light.speed+light.phase);
      const x=light.x+(reduceMotion?0:Math.sin(time*.00035+light.phase)*11);
      const y=light.y+(reduceMotion?0:Math.cos(time*.00047+light.phase)*8);
      const gradient=ctx.createRadialGradient(x,y,0,x,y,13);
      gradient.addColorStop(0,`rgba(255,238,153,${Math.max(0,glow)})`);
      gradient.addColorStop(.20,`rgba(235,224,137,${glow*.30})`);
      gradient.addColorStop(1,"rgba(232,219,125,0)");
      ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(x,y,13,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=`rgba(252,239,166,${Math.max(.16,glow)})`;
      ctx.beginPath();ctx.arc(x,y,light.radius,0,Math.PI*2);ctx.fill();
    }
    ctx.globalCompositeOperation="source-over";
    if (!reduceMotion) frame=requestAnimationFrame(draw);
  }
  function soundLabel() {
    if (!soundButton) return;
    const on=!!window.MistforestAmbience?.enabled;
    soundButton.textContent=on?"♫ 風雨聲：開（點擊關閉）":"♫ 開啟風雨聲";
    soundButton.setAttribute("aria-pressed", String(on));
  }
  soundButton?.addEventListener("click", async () => {
    const audio=window.MistforestAmbience;
    if (!audio) return;
    await audio.setEnabled(!audio.enabled);
    soundLabel();
  });
  let entering=false;
  entryButton.addEventListener("click", () => {
    if (entering) return;
    entering=true;
    window.MistforestAmbience?.stop();
    game.hidden=false;
    window.dispatchEvent(new Event("mistforest:enter"));
    opening.classList.add("is-leaving");
    const finish = () => {
      opening.hidden=true;
      running=false;
      cancelAnimationFrame(frame);
      entryButton.disabled=false;
      game.focus({preventScroll:true});
      window.scrollTo(0,0);
    };
    window.setTimeout(finish,reduceMotion?10:880);
  });
  if (ctx) {
    resetParticles();
    frame=requestAnimationFrame(draw);
    window.addEventListener("resize",resetParticles,{passive:true});
    document.addEventListener("visibilitychange",()=>{
      if(!running || reduceMotion)return;
      if(document.hidden){cancelAnimationFrame(frame)}
      else {lastTime=0;frame=requestAnimationFrame(draw)}
    });
  }
  soundLabel();
})();
