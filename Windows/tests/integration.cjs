// Run manually against an existing verified default-profile Codex window.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {Controller}=require('../controller.cjs');
const {defaults}=require('../settings.cjs');
const cdp=require('../cdp.cjs');
let settings={...defaults};
const image='data:image/png;base64,'+fs.readFileSync(path.join(__dirname,'../private-assets/acheron.png')).toString('base64');
const controller=new Controller(()=>({settings,image,width:1672,height:941}),()=>{});
(async()=>{
 try{
  await controller.connect();
  assert.ok(controller.active,controller.status);
  const port=controller.endpoint.port;
  let target;
  for(const candidate of await cdp.targets(port)){if(await cdp.evaluate(port,candidate,"!!document.querySelector('[data-app-shell-frame]')")){target=candidate;break;}}
  assert.ok(target);
  const inspect=()=>cdp.evaluate(port,target,`(()=>{const frame=document.querySelector('[data-app-shell-frame]');const compose=document.querySelector('[data-composer-surface-variant][data-composer-radius-variant]');const s=compose&&getComputedStyle(compose);const nav=document.querySelector('[data-app-navigation-rail]');return {active:!!window.__codexWallpaperWindowsV1,background:getComputedStyle(frame,'::before').backgroundImage.startsWith('url('),opacity:getComputedStyle(frame,'::before').opacity,composer:s?.backgroundColor,blur:s?.backdropFilter,navWidth:nav?.getBoundingClientRect().width,overflow:document.documentElement.scrollWidth>innerWidth};})()`);
  const initial=await inspect();assert.ok(initial.active&&initial.background&&!initial.overflow);
  settings={...settings,composerOpacity:37,composerBlur:7,accent:'#ff6699'};
  await controller.apply();
  const adjusted=await inspect();assert.ok(adjusted.composer.includes('0.37'));assert.ok(adjusted.blur.includes('7px'));assert.equal(initial.navWidth,adjusted.navWidth);
  await controller.restore();
  const restored=await inspect();assert.equal(restored.active,false);
  fs.writeFileSync(path.join(__dirname,'../test-output/integration.json'),JSON.stringify({pass:true,initial,adjusted,restored,version:controller.version},null,2));
 }finally{await controller.restore();}
})().catch(e=>{console.error(e);process.exitCode=1;});
