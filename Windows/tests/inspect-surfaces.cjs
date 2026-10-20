const fs=require('node:fs'),cdp=require('../cdp.cjs');
(async()=>{
 for(const t of await cdp.targets(19437)){
  if(!await cdp.evaluate(19437,t,"!!document.querySelector('[data-app-shell-frame]')"))continue;
  const r=await cdp.evaluate(19437,t,`(()=>{
   const describe=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {tag:e.tagName,classes:e.className,attrs:[...e.attributes].filter(a=>a.name.startsWith('data-')).map(a=>[a.name,a.value]),rect:{x:r.x,y:r.y,w:r.width,h:r.height},bg:s.backgroundColor,img:s.backgroundImage,shadow:s.boxShadow,mask:s.maskImage,blur:s.backdropFilter,before:{bg:getComputedStyle(e,'::before').backgroundColor,img:getComputedStyle(e,'::before').backgroundImage},after:{bg:getComputedStyle(e,'::after').backgroundColor,img:getComputedStyle(e,'::after').backgroundImage}}};
   let e=document.querySelector('[contenteditable="true"]');const ancestors=[];for(let i=0;e&&i<20;i++,e=e.parentElement)ancestors.push(describe(e));
   const lower=document.elementsFromPoint(innerWidth*.5,innerHeight-45).map(describe);
   const right=document.elementsFromPoint(innerWidth-80,180).map(describe);
   return {footer:[...document.querySelectorAll('div,canvas,svg')].map(describe).filter(e=>e.rect.y>500&&e.rect.w>600&&e.rect.h<350),size:{w:innerWidth,h:innerHeight},ancestors,lower,right};
  })()`);
  fs.writeFileSync('test-output/surfaces.json',JSON.stringify(r,null,2));console.log(JSON.stringify(r.footer,(k,v)=>typeof v==='string'?v.slice(0,500):v,2));
 }
})().catch(console.error);
