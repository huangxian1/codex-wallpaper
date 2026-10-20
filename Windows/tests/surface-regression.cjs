const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const cdp=require('../cdp.cjs'),{buildCSS}=require('../theme.cjs');
(async()=>{
 const home=path.join(process.env.APPDATA,'Codex Wallpaper');
 const saved=JSON.parse(fs.readFileSync(path.join(home,'settings.json')));
 const image='data:image/jpeg;base64,'+fs.readFileSync(path.join(home,'wallpapers',saved.selected+'.jpg')).toString('base64');
 const css=buildCSS(saved.settings,image);
 for(const target of await cdp.targets(19437)){
  if(!await cdp.evaluate(19437,target,"!!document.querySelector('[data-app-shell-frame]')"))continue;
  if(!process.argv.includes('--inspect-only'))await cdp.evaluate(19437,target,`document.getElementById('codex-wallpaper-windows-style').textContent=${JSON.stringify(css)};true`);
  const metrics=await cdp.evaluate(19437,target,`(()=>{
   const backing=document.querySelector('[data-thread-scroll-footer] [class*="_background_"][class*="_surface_"]');
   const input=document.querySelector('[data-composer-surface-variant][data-composer-radius-variant]');
   const output=document.querySelector('[data-summary-panel-variant]');
   const fade=document.querySelector('.thread-scroll-container [class*="_background_"][class*="_fade_"]');
   return {backing:backing?getComputedStyle(backing).backgroundColor:null,fade:fade?getComputedStyle(fade).backgroundImage:null,composer:getComputedStyle(input).backgroundColor,output:output?getComputedStyle(output).backgroundColor:null,overflow:document.documentElement.scrollWidth>innerWidth};
  })()`);
  assert.equal(metrics.backing,'rgba(0, 0, 0, 0)');
  if(metrics.fade!==null)assert.equal(metrics.fade,'none');
  assert.ok(metrics.composer.endsWith(`${saved.settings.composerOpacity/100})`));
  if(metrics.output)assert.ok(metrics.output.endsWith(`${saved.settings.cardOpacity/100})`));
  assert.equal(metrics.overflow,false);
  const shot=await cdp.command(19437,target,'Page.captureScreenshot',{format:'jpeg',quality:82,captureBeyondViewport:false});
  fs.writeFileSync('test-output/actual-fixed.jpg',Buffer.from(shot.data,'base64'));
  fs.writeFileSync('test-output/surface-regression.json',JSON.stringify(metrics,null,2));
  console.log(metrics);
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
