const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const cdp=require('../cdp.cjs'),{buildCSS}=require('../theme.cjs');
(async()=>{
 const platform=require('../platform.cjs');
 const endpoints=platform.eligible(await platform.detect());
 assert.equal(endpoints.length,1,'Expected one connected Codex client');
 const {port}=endpoints[0];
 let tested=0;
 fs.mkdirSync('test-output',{recursive:true});
 const home=path.join(process.env.APPDATA,'Codex Wallpaper');
 const saved=JSON.parse(fs.readFileSync(path.join(home,'settings.json')));
 const image='data:image/jpeg;base64,'+fs.readFileSync(path.join(home,'wallpapers',saved.selected+'.jpg')).toString('base64');
 const css=buildCSS(saved.settings,image);
 for(const target of await cdp.targets(port)){
  if(!await cdp.evaluate(port,target,"!!document.querySelector('[data-app-shell-frame]')"))continue;
  if(!process.argv.includes('--inspect-only'))await cdp.evaluate(port,target,`document.getElementById('codex-wallpaper-windows-style').textContent=${JSON.stringify(css)};true`);
  const metrics=await cdp.evaluate(port,target,`(()=>{
   const surface=document.querySelector('[data-app-shell-surface-backing]');
   const footer=document.querySelector('.thread-scroll-container > :has(> [data-thread-scroll-footer])');
   const paint=(e,pseudo)=>{const s=getComputedStyle(e,pseudo);return [s.backgroundColor,s.backgroundImage];};
   const backing=document.querySelector('[data-thread-scroll-footer] [class*="_background_"][class*="_surface_"]');
   const input=document.querySelector('[data-composer-surface-variant][data-composer-radius-variant]');
   const output=document.querySelector('[data-summary-panel-variant]');
   const fade=document.querySelector('.thread-scroll-container [class*="_background_"][class*="_fade_"]');
   return {surface:surface?paint(surface):null,footer:footer?['::before','::after'].map(p=>paint(footer,p)):null,backing:backing?getComputedStyle(backing).backgroundColor:null,fade:fade?getComputedStyle(fade).backgroundImage:null,composer:getComputedStyle(input).backgroundColor,output:output?getComputedStyle(output).backgroundColor:null,overflow:document.documentElement.scrollWidth>innerWidth};
  })()`);
  const transparent=['rgba(0, 0, 0, 0)','none'];
  if(metrics.surface)assert.deepEqual(metrics.surface,transparent);
  if(metrics.footer)assert.deepEqual(metrics.footer,[transparent,transparent]);
  if(metrics.backing!==null)assert.equal(metrics.backing,transparent[0]);
  assert.ok(metrics.footer||metrics.backing!==null,'Expected a known thread footer');
  tested++;
  if(metrics.fade!==null)assert.equal(metrics.fade,'none');
  assert.ok(metrics.composer.endsWith(`${saved.settings.composerOpacity/100})`));
  if(metrics.output)assert.ok(metrics.output.endsWith(`${saved.settings.cardOpacity/100})`));
  assert.equal(metrics.overflow,false);
  const shot=await cdp.command(port,target,'Page.captureScreenshot',{format:'jpeg',quality:82,captureBeyondViewport:false});
  fs.writeFileSync('test-output/actual-fixed.jpg',Buffer.from(shot.data,'base64'));
  fs.writeFileSync('test-output/surface-regression.json',JSON.stringify(metrics,null,2));
  console.log(metrics);
 }
 assert.ok(tested,'Expected an open Codex main window');
})().catch(e=>{console.error(e);process.exitCode=1;});
