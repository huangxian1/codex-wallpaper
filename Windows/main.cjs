const {app,BrowserWindow,ipcMain,dialog,Tray,Menu,nativeImage}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {defaults,palettes,normalize}=require('./settings.cjs');
const {buildCSS}=require('./theme.cjs');
const {Controller}=require('./controller.cjs');
app.setName('Codex Wallpaper');
if(process.argv.includes('--test-profile'))app.setPath('userData',path.join(__dirname,'.test-user-data'));
if(!app.requestSingleInstanceLock()){app.quit();}
else{
 let win,tray,controller,quitting=false,store,home,library;
 let imageCache=new Map();
 const readImage=id=>{
  if(!id)return null;
  if(imageCache.has(id))return imageCache.get(id);
  const item=store.library.find(x=>x.id===id);if(!item)return null;
  const file=path.join(library,id+'.jpg');if(!fs.existsSync(file))return null;
  const image=nativeImage.createFromPath(file);
  if(image.isEmpty())return null;
  const size=image.getSize(),value={data:'data:image/jpeg;base64,'+fs.readFileSync(file).toString('base64'),thumb:'data:image/jpeg;base64,'+image.resize({width:260}).toJPEG(80).toString('base64'),...size};
  imageCache.set(id,value);return value;
 };
 const persist=()=>{const temp=path.join(home,'settings.tmp');fs.writeFileSync(temp,JSON.stringify(store,null,2));fs.renameSync(temp,path.join(home,'settings.json'));};
 const state=()=>{
  const image=readImage(store.selected);
  return {settings:store.settings,palettes,selected:store.selected,
   library:store.library.map(item=>({...item,thumb:readImage(item.id)?.thumb||''})),
   image:image?.data||null,width:image?.width||1920,height:image?.height||1080,
   previewCSS:buildCSS(store.settings,image?.data),connection:controller?.info()||{active:false,status:'准备中'}};
 };
 const notify=()=>{if(win&&!win.isDestroyed())win.webContents.send('state-change',{connection:controller.info()});updateTray();};
 const show=()=>{if(win.isMinimized())win.restore();win.show();win.focus();};
 const connect=async()=>{await controller.connect();if(controller.active){store.enabled=true;persist();}};
 const restore=async()=>{store.enabled=false;persist();await controller.restore();};
 const updateTray=()=>{if(!tray)return;tray.setToolTip('Codex 外观 · '+(controller?.active?'已连接':'未连接'));tray.setContextMenu(Menu.buildFromTemplate([
  {label:'打开外观设置',click:show},
  {label:'连接 Codex',enabled:!controller?.busy,click:connect},
  {type:'separator'},
  ...store.library.slice(0,10).map(item=>({label:item.name,type:'radio',checked:store.selected===item.id,click:async()=>{store.selected=item.id;persist();await controller.apply();win.webContents.send('state-change',state());}})),
  {type:'separator'},
  {label:'恢复原始外观',click:restore},
  {label:'退出并恢复',click:()=>app.quit()}
 ]));};
 function addImage(file,name){
  const stat=fs.statSync(file);if(!stat.isFile()||stat.size>50*1024*1024)throw Error('请选择小于 50 MB 的图片。');
  let image=nativeImage.createFromPath(file);if(image.isEmpty())throw Error('图片无法读取，请使用 PNG、JPEG 或 WebP。');
  const size=image.getSize();if(Math.max(size.width,size.height)>2560)image=image.resize(size.width>=size.height?{width:2560}:{height:2560});
  const jpg=image.toJPEG(91),id=crypto.createHash('sha256').update(jpg).digest('hex').slice(0,20);
  if(!store.library.some(x=>x.id===id)){
   fs.writeFileSync(path.join(library,id+'.jpg'),jpg);
   store.library.push({id,name:name||path.basename(file,path.extname(file))});
  }
  store.selected=id;persist();return id;
 }
 app.on('second-instance',()=>{if(win)show();});
 app.whenReady().then(()=>{
  home=app.getPath('userData');library=path.join(home,'wallpapers');fs.mkdirSync(library,{recursive:true});
  try{store=JSON.parse(fs.readFileSync(path.join(home,'settings.json'),'utf8'));}catch{store={settings:{...defaults},library:[],selected:null};}
  store.settings=normalize(store.settings);
  store.library=Array.isArray(store.library)?store.library.filter(x=>/^[a-f0-9]{20}$/.test(x.id)&&typeof x.name==='string'):[];
  if(!store.initialized){
   const source=path.join(__dirname,'private-assets','acheron.png');
   if(fs.existsSync(source))addImage(source,'黄泉 · 虚无之镜');
   store.initialized=true;persist();
  }
  controller=new Controller(()=>{const image=readImage(store.selected);return {settings:store.settings,image:image?.data,width:image?.width,height:image?.height};},notify);
  win=new BrowserWindow({width:1280,height:860,minWidth:1080,minHeight:740,title:'Codex 外观',backgroundColor:'#101016',autoHideMenuBar:true,
   icon:path.join(__dirname,'icon.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',event=>event.preventDefault());
  win.loadFile(path.join(__dirname,'ui','index.html'));
  win.on('close',event=>{if(!quitting){event.preventDefault();win.hide();}});
  tray=new Tray(nativeImage.createFromPath(path.join(__dirname,'icon.png')).resize({width:20,height:20}));
  tray.on('double-click',show);updateTray();
  ipcMain.handle('state',()=>state());
  ipcMain.handle('save',async(_,settings)=>{store.settings=normalize(settings);persist();if(store.settings.live)await controller.apply();return {connection:controller.info(),previewCSS:buildCSS(store.settings,readImage(store.selected)?.data)};});
  ipcMain.handle('choose',async()=>{
   const result=await dialog.showOpenDialog(win,{title:'导入壁纸',properties:['openFile','multiSelections'],filters:[{name:'图片',extensions:['png','jpg','jpeg','webp']}]});
   if(!result.canceled){for(const file of result.filePaths)addImage(file);if(store.settings.live)await controller.apply();updateTray();}
   return state();
  });
  ipcMain.handle('import',async(_,file)=>{if(typeof file!=='string'||!path.isAbsolute(file))throw Error('请选择本机图片。');addImage(file);if(store.settings.live)await controller.apply();updateTray();return state();});
  ipcMain.handle('select',async(_,id)=>{if(id!==null&&!store.library.some(x=>x.id===id))throw Error('没有找到壁纸。');store.selected=id;persist();if(store.settings.live)await controller.apply();updateTray();return state();});
  ipcMain.handle('remove',async(_,id)=>{
   const item=store.library.find(x=>x.id===id);if(!item)return state();
   const choice=await dialog.showMessageBox(win,{type:'question',buttons:['保留','移除'],defaultId:0,cancelId:0,message:'从壁纸库移除这张图片？',detail:'原始图片不会删除。'});
   if(choice.response===1){store.library=store.library.filter(x=>x.id!==id);if(store.selected===id)store.selected=null;persist();imageCache.delete(id);fs.rmSync(path.join(library,id+'.jpg'),{force:true});if(store.settings.live)await controller.apply();updateTray();}
   return state();
  });
  ipcMain.handle('connect',async()=>{await connect();return {connection:controller.info()};});
  ipcMain.handle('apply',async()=>{await controller.apply();return {connection:controller.info()};});
  ipcMain.handle('restore',async()=>{await restore();return {connection:controller.info()};});
  let capturePending;
  ipcMain.handle('capture',()=>{if(!capturePending)capturePending=controller.capture().finally(()=>capturePending=null);return capturePending;});
  ipcMain.handle('reset',async()=>{store.settings={...defaults};persist();if(controller.active)await controller.apply();return state();});
  ipcMain.handle('quit',()=>app.quit());
  app.on('activate',show);
  if((process.argv.includes('--connect')||store.enabled)&&!process.argv.includes('--ui-test'))win.webContents.once('did-finish-load',()=>setTimeout(connect,600));
  if(process.argv.includes('--ui-test')){
   win.webContents.once('did-finish-load',async()=>{
    const output=path.join(__dirname,'test-output');fs.mkdirSync(output,{recursive:true});
    try{
     for(let i=0;i<40;i++){if(await win.webContents.executeJavaScript("!!document.querySelector('.wallpaper-card')"))break;await new Promise(r=>setTimeout(r,150));}
     await new Promise(r=>setTimeout(r,500));
     fs.writeFileSync(path.join(output,'wallpaper.png'),(await win.webContents.capturePage()).toPNG());
     const before=await win.webContents.executeJavaScript("({cards:document.querySelectorAll('.wallpaper-card').length,palettes:document.querySelectorAll('.palette').length,previewRules:document.querySelector('#preview').contentDocument.querySelector('#theme').sheet.cssRules.length,overflow:document.documentElement.scrollWidth>innerWidth})");
     await win.webContents.executeJavaScript("document.querySelector('[data-tab=advanced]').click();const r=document.querySelector('#composerOpacity');r.value=27;r.dispatchEvent(new Event('input',{bubbles:true}));");
     await new Promise(r=>setTimeout(r,700));
     fs.writeFileSync(path.join(output,'advanced.png'),(await win.webContents.capturePage()).toPNG());
     const persisted=JSON.parse(fs.readFileSync(path.join(home,'settings.json')));
     const after=await win.webContents.executeJavaScript("({advanced:!document.querySelector('#advanced-panel').hidden,colors:document.querySelectorAll('input[type=color]').length,rangeCount:document.querySelectorAll('input[type=range]').length,previewBackground:getComputedStyle(document.querySelector('#preview').contentDocument.querySelector('[data-composer-surface-variant]')).backgroundColor})");
     win.close();const hidden=!win.isVisible();show();const reopened=win.isVisible();
     const result={before,after,persistedOpacity:persisted.settings.composerOpacity,closeToTray:hidden,reopened,pass:before.cards>0&&before.previewRules>20&&!before.overflow&&after.advanced&&persisted.settings.composerOpacity===27&&hidden&&reopened};
     fs.writeFileSync(path.join(output,'ui-test.json'),JSON.stringify(result,null,2));
    }catch(e){fs.writeFileSync(path.join(output,'ui-test.json'),JSON.stringify({pass:false,error:e.stack}));}
    finally{app.quit();}
   });
  }
 }).catch(e=>{dialog.showErrorBox('无法启动外观管理器',e.message);quitting=true;app.quit();});
 app.on('window-all-closed',()=>{});
 app.on('before-quit',event=>{
  if(quitting)return;
  event.preventDefault();quitting=true;
  Promise.race([controller?.restore(),new Promise(r=>setTimeout(r,8500))]).finally(()=>{tray?.destroy();app.quit();});
 });
}
