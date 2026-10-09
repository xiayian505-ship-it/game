/* 慢慢遊戲大廳｜核心：遊戲入口與跳頁流程。連結保留原生 href 作為 fallback。 */
(()=>{
  'use strict';
  const cards=document.querySelectorAll('.game-card[href]');
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  let navigating=false;

  cards.forEach(link=>{
    link.addEventListener('click',async event=>{
      // 右鍵、新分頁／另存、已處理事件都交給瀏覽器原生行為。
      if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.hasAttribute('download'))return;
      if(navigating){event.preventDefault();return}
      const portal=window.SlowlyPortalWipe;
      if(reduce.matches||typeof portal?.play!=='function')return;

      event.preventDefault();
      navigating=true;
      const rect=link.getBoundingClientRect();
      const keyboard=event.detail===0;
      const x=keyboard?rect.left+rect.width/2:event.clientX;
      const y=keyboard?rect.top+rect.height/2:event.clientY;
      const color=getComputedStyle(link).getPropertyValue('--accent').trim()||'#e8c56a';

      // UI 特效是可選的：只有 index_style.js 監聽，不影響導頁。
      document.dispatchEvent(new CustomEvent('slowly:lobby-launch',{detail:{link,x,y,color}}));
      try{
        await portal.play({x,y,color,hold:true});
      }catch(error){
        console.warn('傳送門無法播放，改用原生跳頁。',error);
      }
      window.location.assign(link.href);
    });
  });

  // 使用返回鍵從 BFCache 回到大廳時恢復可點擊狀態。
  addEventListener('pageshow',()=>{
    navigating=false;
    window.SlowlyPortalWipe?.reset?.();
  });
})();
