const test=require('node:test');
const assert=require('node:assert/strict');
const {normalize,defaults,palettes}=require('../settings.cjs');
const {buildCSS}=require('../theme.cjs');
const {eligible}=require('../platform.cjs');
const {isTarget}=require('../cdp.cjs');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
test('corrupt settings cannot introduce CSS or unbounded blur',()=>{
 const s=normalize({panel:'red;}body{display:none}',composerOpacity:-50,wallpaperBlur:1000,zoom:NaN,radius:Infinity,live:'false'});
 assert.equal(s.panel,defaults.panel);assert.equal(s.composerOpacity,0);assert.equal(s.wallpaperBlur,30);assert.equal(s.zoom,100);assert.equal(s.radius,14);assert.equal(s.live,true);
 assert.throws(()=>buildCSS(s,'https://example.com/image.png'));
});
test('all palettes produce scoped CSS; native diff semantic colors untouched',()=>{
 for(const p of palettes){
  const css=buildCSS({...defaults,...p,palette:p.id},null);
  assert.ok(css.includes('html[data-cw-theme="active"]'));
  assert.ok(!css.includes('undefined'));assert.ok(!css.includes('NaN'));
  assert.ok(!css.includes('--color-diff-added'));assert.ok(!css.includes('display:none'));
 }
});
test('eligible endpoint must belong to default profile and loopback listener',()=>{
 const p={pid:1,port:19437,customProfile:false};
 assert.equal(eligible({processes:[p],listeners:[{pid:1,port:19437,address:'127.0.0.1'}]}).length,1);
 for(const address of ['0.0.0.0','192.168.1.1'])assert.equal(eligible({processes:[p],listeners:[{pid:1,port:19437,address}]}).length,0);
 assert.equal(eligible({processes:[{...p,customProfile:true}],listeners:[{pid:1,port:19437,address:'127.0.0.1'}]}).length,0);
 assert.equal(eligible({processes:[p],listeners:[{pid:999,port:19437,address:'127.0.0.1'}]}).length,0);
});
test('only app main windows get styles, never websites or pet overlays',()=>{
 for(const url of ['app://-/index.html','app://-/detached-window.html'])assert.ok(isTarget({type:'page',url}));
 for(const url of ['https://chatgpt.com','app://-/index.html?initialRoute=avatar-overlay','app://other/index.html','app://-/other.html'])assert.ok(!isTarget({type:'page',url}));
});
test('controller lease expires and removes only its own styles and listener',()=>{
 const nodes=[],attrs=new Map(),listeners=new Map(),timers=new Map();let now=100,seq=0;
 const root={getAttribute:k=>attrs.get(k)??null,setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)};
 const context={Date:{now:()=>now},innerWidth:1200,innerHeight:800,
  document:{documentElement:root,querySelector:()=>({}),createElement:()=>{const el={sheet:{cssRules:[{}]},remove(){nodes.splice(nodes.indexOf(el),1);}};return el;},head:{append:el=>nodes.push(el)}},
  window:{addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)},
  setInterval:fn=>{timers.set(++seq,fn);return seq;},clearInterval:id=>timers.delete(id)};
 vm.createContext(context);
 const apply=vm.runInContext(fs.readFileSync(path.join(__dirname,'../runtime.js'),'utf8'),context);
 const cfg={revision:'one',css:'body{}',zoom:100,width:1000,height:1000};
 assert.equal(apply(cfg).applied,true);assert.equal(nodes.length,2);
 assert.equal(apply(cfg).reused,true);assert.equal(nodes.length,2);
 now+=21000;for(const tick of [...timers.values()])tick();
 assert.equal(nodes.length,0);assert.equal(timers.size,0);assert.equal(listeners.size,0);assert.equal(attrs.size,0);
 assert.equal(context.window.__codexWallpaperWindowsV1,undefined);
});
