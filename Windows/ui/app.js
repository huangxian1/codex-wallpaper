const $=s=>document.querySelector(s),api=window.wallpaper;
let model,saveTimer,saveSerial=0,previewReady=false,captureTimer,captureBusy=false,captureAgain=false;
function error(e){$('#toast').textContent=e.message||String(e);$('#toast').hidden=false;setTimeout(()=>$('#toast').hidden=true,6500);}
async function action(fn){try{const result=await fn();if(result)receive(result);}catch(e){error(e);}}
function connection(c){if(!c)return;const wasActive=model.connection?.active;model.connection=c;$('#status').textContent=c.status;$('#status-dot').classList.toggle('active',c.active);$('#version').textContent=(c.version?'Codex '+c.version+' · ':'')+'关闭窗口后继续在托盘运行';$('#connect').disabled=c.busy;$('#connect').textContent=c.busy?'正在连接…':c.active?'重新连接':'连接 Codex';$('#apply').disabled=!c.active||c.busy;$('#refresh-preview').hidden=!c.active;if(c.active&&!wasActive)scheduleCapture();if(!c.active){$('#actual-preview').hidden=true;$('#actual-preview').removeAttribute('src');$('#preview').hidden=false;$('#preview-label').textContent='布局示意';$('#preview-note').textContent='未连接时为布局示意；连接后显示客户端实景';}}
function scheduleCapture(){clearTimeout(captureTimer);if(model?.connection?.active)captureTimer=setTimeout(capture,300);}
async function capture(){
 if(!model?.connection?.active)return;
 if(captureBusy){captureAgain=true;return;}
 captureBusy=true;$('#preview-label').textContent='正在刷新';
 try{const shot=await api.capture();if(!model.connection.active)return;$('#actual-preview').src=shot.image;$('#actual-preview').hidden=false;$('#preview').hidden=true;$('#preview-label').textContent='客户端实景';$('#preview-note').textContent='当前窗口截图，仅在本机显示；应用更改后刷新';}
 catch(e){$('#preview-label').textContent='实景暂不可用';$('#preview-note').textContent='请打开 Codex 主窗口后点击“刷新实景”';if(!$('#actual-preview').src){$('#preview').hidden=false;$('#preview-label').textContent='布局示意 · 实景不可用';}}
 finally{captureBusy=false;if(captureAgain){captureAgain=false;scheduleCapture();}}
}
function receive(data){
 if(data.settings){model=data;render();if(model.connection.active&&model.settings.live)scheduleCapture();}
 else{if(data.previewCSS){model.previewCSS=data.previewCSS;preview();}if(data.connection)connection(data.connection);}
}
function preview(){
 if(!previewReady||!model)return;
 const doc=$('#preview').contentDocument;
 doc.querySelector('#theme').textContent=model.previewCSS;
 const w=$('#preview').clientWidth,h=$('#preview').clientHeight;
 const scale=Math.max(w/model.width,h/model.height)*model.settings.zoom/100;
 doc.querySelector('#sizing').textContent=`html[data-cw-theme=active] [data-app-shell-frame]::before{background-size:${model.width*scale}px ${model.height*scale}px!important}`;
}
function edited(){
 clearTimeout(saveTimer);
 const serial=++saveSerial;
 saveTimer=setTimeout(async()=>{try{const r=await api.save({...model.settings});if(serial===saveSerial){receive(r);if(model.settings.live)scheduleCapture();else if(model.connection.active)$('#preview-note').textContent='实景仍为已应用的设置，点击“应用更改”后刷新';}}catch(e){error(e);}},250);
}
function slider(key,label,min,max,unit='',parent){
 const el=document.createElement('div');el.className='control';
 const line=document.createElement('div');line.className='control-line';
 const text=document.createElement('label');text.textContent=label;text.htmlFor=key;
 const number=document.createElement('span');number.className='number';
 const field=document.createElement('input');field.type='number';field.min=min;field.max=max;field.value=model.settings[key];field.setAttribute('aria-label',label+'数值');
 number.append(field,document.createTextNode(unit));line.append(text,number);
 const range=document.createElement('input');range.type='range';range.min=min;range.max=max;range.value=model.settings[key];range.id=key;
 const change=value=>{const v=Math.max(min,Math.min(max,Number(value)));if(!Number.isFinite(v))return;model.settings[key]=v;range.value=v;field.value=v;edited();};
 range.addEventListener('input',()=>change(range.value));field.addEventListener('change',()=>change(field.value));
 el.append(line,range);parent.append(el);
}
function render(){
 const s=model.settings;
 $('#live').checked=s.live;$('#glass').checked=s.glass;
 const selected=model.library.find(x=>x.id===model.selected);
 $('#wallpaper-name').textContent=selected?.name||'纯色 · 自在留白';
 $('#library-count').textContent=model.library.length;
 $('#gallery').replaceChildren();
 for(const item of model.library){
  const card=document.createElement('div');card.className='wallpaper-card'+(item.id===model.selected?' active':'');
  const button=document.createElement('button');button.style.cssText='display:block;width:100%;padding:0;border:0;text-align:left;border-radius:0';button.setAttribute('aria-label','使用 '+item.name);
  const img=document.createElement('img');img.src=item.thumb;img.alt='';
  const name=document.createElement('span');name.className='name';name.textContent=item.name;
  button.append(img,name);button.onclick=()=>action(()=>api.select(item.id));
  const del=document.createElement('button');del.className='delete';del.textContent='×';del.setAttribute('aria-label','移除 '+item.name);del.onclick=()=>action(()=>api.remove(item.id));
  card.append(button,del);$('#gallery').append(card);
 }
 $('#palettes').replaceChildren();
 for(const p of model.palettes){
  const button=document.createElement('button');button.className='palette'+(p.id===s.palette?' active':'');button.title=p.name;
  const swatch=document.createElement('span');swatch.className='swatch';swatch.style.background=`linear-gradient(130deg,${p.accent},${p.base} 65%)`;
  button.append(swatch,document.createTextNode(p.name));
  button.onclick=()=>{Object.assign(s,{palette:p.id,base:p.base,panel:p.panel,text:p.text,muted:p.muted,accent:p.accent});render();edited();};
  $('#palettes').append(button);
 }
 const wp=$('#wallpaper-controls');wp.replaceChildren();
 for(const args of [['strength','壁纸可见度',0,100,'%'],['wallpaperBlur','壁纸模糊',0,30,'px'],['zoom','图片缩放',25,300,'%'],['offsetX','左右偏移',-100,100,'%'],['positionY','上下位置',0,100,'%']])slider(...args,wp);
 $('#colors').replaceChildren();
 for(const [key,name]of [['base','背景底色'],['panel','玻璃底色'],['text','正文文字'],['muted','辅助文字'],['accent','强调颜色']]){
  const label=document.createElement('label');label.className='color-field';const input=document.createElement('input');input.type='color';input.value=s[key];input.id='color-'+key;input.addEventListener('input',()=>{s[key]=input.value;edited();});label.append(input,document.createTextNode(name));$('#colors').append(label);
 }
 $('#regions').replaceChildren();
 for(const [key,name]of [['menu','顶部菜单'],['rail','左侧导航'],['sidebar','会话列表'],['composer','输入框'],['card','文件 / 输出卡片']]){
  const region=document.createElement('div');region.className='region';const title=document.createElement('div');title.className='region-title';title.textContent=name;region.append(title);
  slider(key+'Opacity','底色浓度',0,100,'%',region);slider(key+'Blur','玻璃模糊',0,30,'px',region);$('#regions').append(region);
 }
 const detail=$('#details-controls');detail.replaceChildren();
 for(const args of [['radius','输入框 / 卡片圆角',0,28,'px'],['border','边框亮度',0,60,'%'],['highlight','玻璃高光',0,60,'%'],['shadow','阴影浓度',0,60,'%'],['textShadow','文字阴影',0,100,'%']])slider(...args,detail);
 connection(model.connection);preview();
}
$('#preview').addEventListener('load',()=>{previewReady=true;preview();});
if($('#preview').contentDocument?.readyState==='complete')previewReady=true;
new ResizeObserver(preview).observe($('#preview'));
document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{
 document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-selected',String(b===button));});
 $('#wallpaper-panel').hidden=button.dataset.tab!=='wallpaper';$('#advanced-panel').hidden=button.dataset.tab!=='advanced';
});
$('#live').onchange=()=>{model.settings.live=$('#live').checked;edited();};
$('#glass').onchange=()=>{model.settings.glass=$('#glass').checked;edited();};
$('#import').onclick=()=>action(()=>api.choose());
$('#clear').onclick=()=>action(()=>api.select(null));
$('#connect').onclick=()=>action(()=>api.connect());
$('#apply').onclick=()=>action(async()=>{clearTimeout(saveTimer);await api.save({...model.settings});const r=await api.apply();scheduleCapture();return r;});
$('#refresh-preview').onclick=capture;
$('#restore').onclick=()=>action(()=>api.restore());
$('#reset').onclick=()=>action(()=>api.reset());
document.addEventListener('dragover',e=>{e.preventDefault();$('#dropzone').classList.add('drag');});
document.addEventListener('dragleave',()=>$('#dropzone').classList.remove('drag'));
document.addEventListener('drop',e=>{e.preventDefault();$('#dropzone').classList.remove('drag');for(const file of e.dataTransfer.files)action(()=>api.drop(file));});
api.onState(receive);
action(()=>api.state());
