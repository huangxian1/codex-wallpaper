// Temporary appearance layer only. No conversation text or application data is read.
(config => {
 const KEY='__codexWallpaperWindowsV1', prior=window[KEY];
 if(prior?.revision===config.revision){prior.touched=Date.now();return {applied:true,reused:true};}
 if(!document.querySelector('[data-app-shell-frame]')||!document.querySelector('[data-app-shell-main-surface]'))return {applied:false};
 prior?.restore();
 const root=document.documentElement;
 const previous=root.getAttribute('data-cw-theme');
 const style=document.createElement('style');style.id='codex-wallpaper-windows-style';
 style.textContent=config.css;
 root.setAttribute('data-cw-theme','active');
 document.head.append(style);
 const measure=()=>{
   const w=config.width||1920,h=config.height||1080;
   const scale=Math.max(innerWidth/w,innerHeight/h)*config.zoom/100;
   size.textContent=`html[data-cw-theme="active"] [data-app-shell-frame]::before {background-size:${w*scale}px ${h*scale}px !important;}`;
 };
 const size=document.createElement('style');size.id='codex-wallpaper-windows-sizing';document.head.append(size);
 measure();window.addEventListener('resize',measure,{passive:true});
 const state={revision:config.revision,touched:Date.now(),restore(){
   clearInterval(state.timer);window.removeEventListener('resize',measure);style.remove();size.remove();
   if(previous===null)root.removeAttribute('data-cw-theme');else root.setAttribute('data-cw-theme',previous);
   if(window[KEY]===state)delete window[KEY];
 }};
 state.timer=setInterval(()=>{if(Date.now()-state.touched>20000)state.restore();},2000);
 window[KEY]=state;
 return {applied:true,rules:style.sheet.cssRules.length};
})
