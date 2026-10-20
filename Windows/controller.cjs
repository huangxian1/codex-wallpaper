const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const platform=require('./platform.cjs');
const cdp=require('./cdp.cjs');
const {buildCSS}=require('./theme.cjs');
const runtime=fs.readFileSync(path.join(__dirname,'runtime.js'),'utf8');
class Controller{
 constructor(getConfig,notify){
  this.getConfig=getConfig;this.notify=notify;this.active=false;this.busy=false;this.endpoint=null;this.status='准备好你的黄泉工作空间。';this.timer=null;this.revision='';this.lock=null;this.checked=0;this.failures=0;
 }
 info(){return {active:this.active,busy:this.busy,status:this.status,version:this.version||''};}
 update(status){this.status=status;this.notify();}
 async verify(){
  const snap=await platform.detect();this.version=snap.version;
  const peers=platform.eligible(snap);
  if(peers.length!==1||snap.processes.length!==1)throw Error(snap.processes.length>1?'检测到多个 Codex 实例。请退出多余实例，再连接。':'当前 Codex 未开放主题通道。请从托盘完全退出 Codex，再点“连接 Codex”。程序会使用原配置启动它。');
  this.endpoint=peers[0];this.checked=Date.now();return snap;
 }
 async connect(){
  if(this.busy)return;
  this.busy=true;this.update('正在连接 Codex…');
  try{
   const snap=await platform.detect();this.version=snap.version;
   if(!snap.processes.length){
    await platform.launch(snap.exe,19447);
    let ready=false;
    for(let n=0;n<25;n++){await new Promise(r=>setTimeout(r,800));try{await this.verify();ready=true;break;}catch{}}
    if(!ready)throw Error('Codex 已启动，但主题通道尚未就绪。请等主窗口出现后再次连接。');
   }else await this.verify();
   await platform.stopLegacy();
   for(const target of await cdp.targets(this.endpoint.port))await cdp.evaluate(this.endpoint.port,target,"(()=>{document.getElementById('acheron-user-css-v2')?.remove();window.__ACHERON_LIQUID_GLASS__?.cleanup?.();return true})()");
   this.active=true;this.invalidate();
   await this.refresh(true);
   if(!this.timer)this.timer=setInterval(()=>this.tick(),3000);
  }catch(e){this.active=false;this.update(e.message);}
  finally{this.busy=false;this.notify();}
 }
 invalidate(){this.revision=crypto.randomUUID();this.payload=null;}
 async apply(){
  if(!this.active)return;
  this.invalidate();
  try{await this.refresh(true);}catch(e){this.update(e.message);}
 }
 async refresh(force=false){
  if(this.lock){await this.lock;if(force&&this.active)return this.refresh(true);return;}
  this.lock=this._refresh(force);
  try{await this.lock;}finally{this.lock=null;}
 }
 async _refresh(force){
  if(!this.active||!this.endpoint)return;
  const port=this.endpoint.port,revision=this.revision;
  if(!this.payload){
   const cfg=this.getConfig();
   this.payload=`(${runtime})(${JSON.stringify({revision,css:buildCSS(cfg.settings,cfg.image),zoom:cfg.settings.zoom,width:cfg.width,height:cfg.height})})`;
  }
  const payload=this.payload;
  let count=0;
  for(const target of await cdp.targets(port)){
   if(!force&&await cdp.evaluate(port,target,`(()=>{const r=window.__codexWallpaperWindowsV1;if(r?.revision===${JSON.stringify(revision)}){r.touched=Date.now();return true;}return false;})()`)){count++;continue;}
   const result=await cdp.evaluate(port,target,payload);
   if(result?.applied)count++;
  }
  if(!count)throw Error('等待 Codex 主窗口。打开主窗口后会自动重新应用。');
  this.failures=0;this.update(`已连接 · ${count} 个窗口 · 外观已应用`);
 }
 async tick(){
  if(!this.active||this.busy||this.lock)return;
  try{
   if(Date.now()-this.checked>15000)await this.verify();
   await this.refresh();
  }catch(e){
   this.failures++;this.update(this.failures>2?`${e.message} 正在等待重连…`:this.status);
   // Continue waiting for the same normal-profile app; never launch/restart from a timer.
  }
 }
 async capture(){
  if(!this.active||!this.endpoint)throw Error('请先连接 Codex。');
  if(this.lock)await this.lock;
  const port=this.endpoint.port;
  const candidates=[];
  for(const target of await cdp.targets(port)){
   const view=await cdp.evaluate(port,target,"(()=>{const e=document.querySelector('[data-app-shell-frame]');if(!e)return null;return {visible:document.visibilityState==='visible',width:innerWidth,height:innerHeight}})()");
   if(view)candidates.push({target,view});
  }
  const selected=candidates.find(x=>x.view.visible)||candidates[0];
  if(!selected)throw Error('没有找到 Codex 主窗口。');
  const shot=await cdp.command(port,selected.target,'Page.captureScreenshot',{format:'jpeg',quality:82,captureBeyondViewport:false,fromSurface:true});
  return {image:'data:image/jpeg;base64,'+shot.data,width:selected.view.width,height:selected.view.height};
 }
 async restore(){
  this.active=false;
  if(this.timer){clearInterval(this.timer);this.timer=null;}
  if(this.lock)await this.lock.catch(()=>{});
  let restored=false;
  if(this.endpoint)try{
   for(const t of await cdp.targets(this.endpoint.port))await cdp.evaluate(this.endpoint.port,t,'(()=>{window.__codexWallpaperWindowsV1?.restore();return true})()');
   restored=true;
  }catch{}
  this.payload=null;this.update(restored?'已恢复原始外观，设置已保留。':'已暂停；若连接已断开，样式会在约 20 秒后自动移除。');
 }
}
module.exports={Controller};
