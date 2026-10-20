const palettes = [
 ['acheron','黄泉','#100f1b','#201b2e','#ffffff','#d0c7df','#c6b6ff'],
 ['ink','墨夜','#171c25','#242b37','#eef1f7','#a7b1c2','#a6bfff'],
 ['forest','松林','#17221f','#24342d','#eaf1eb','#a9bcaf','#a9d8b4'],
 ['paper','奶油','#f5f1e8','#fffcf5','#302e29','#706a60','#866237'],
 ['rose','暮紫','#251d2b','#352a3d','#f5edf7','#beaac8','#d8b4ee'],
 ['ocean','深海','#111e32','#1c2d46','#edf4ff','#a5b9d2','#8ccaff'],
 ['graphite','石墨','#202124','#2d2f33','#f0f0f2','#b5b8be','#c3c9d9'],
 ['obsidian','曜黑','#0d0f12','#1a1d23','#f3f5fa','#afb5c0','#b6caff'],
 ['cocoa','可可','#291f1b','#3b2d26','#f8efe6','#c6b3a4','#efc49b'],
 ['sakura','樱粉','#f7edf0','#fff8fa','#412d35','#80616e','#a54368'],
 ['mist','雾蓝','#eaf1f7','#f7fbff','#263a4b','#52697d','#306a99'],
 ['sage','鼠尾草','#edf2e9','#f8fbf4','#303d2d','#596a51','#477440'],
 ['lavender','浅薰衣','#f0ecf8','#faf7ff','#373044','#726483','#7650a3']
].map(([id,name,base,panel,text,muted,accent])=>({id,name,base,panel,text,muted,accent}));
const defaults = {
 palette:'acheron', base:'#100f1b',panel:'#201b2e',text:'#ffffff',muted:'#d0c7df',accent:'#c6b6ff',
 strength:95, wallpaperBlur:0, zoom:100, offsetX:0, positionY:50,
 menuOpacity:24,railOpacity:20,sidebarOpacity:38,composerOpacity:8,cardOpacity:10,
 menuBlur:14,railBlur:16,sidebarBlur:12,composerBlur:4,cardBlur:3,
 radius:14,border:20,highlight:18,shadow:18,textShadow:65,glass:true,live:true
};
const ranges={strength:[0,100],wallpaperBlur:[0,30],zoom:[25,300],offsetX:[-100,100],positionY:[0,100],
 menuOpacity:[0,100],railOpacity:[0,100],sidebarOpacity:[0,100],composerOpacity:[0,100],cardOpacity:[0,100],
 menuBlur:[0,30],railBlur:[0,30],sidebarBlur:[0,30],composerBlur:[0,30],cardBlur:[0,30],
 radius:[0,28],border:[0,60],highlight:[0,60],shadow:[0,60],textShadow:[0,100]};
function normalize(input={}){
 const out={...defaults};
 for(const key of ['base','panel','text','muted','accent'])if(typeof input[key]==='string'&&/^#[0-9a-f]{6}$/i.test(input[key]))out[key]=input[key];
 for(const [key,[min,max]]of Object.entries(ranges))if(typeof input[key]==='number'&&Number.isFinite(input[key]))out[key]=Math.max(min,Math.min(max,input[key]));
 for(const key of ['glass','live'])if(typeof input[key]==='boolean')out[key]=input[key];
 if(palettes.some(p=>p.id===input.palette))out.palette=input.palette;
 return out;
}
module.exports={palettes,defaults,normalize};
