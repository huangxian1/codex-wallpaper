const {contextBridge,ipcRenderer,webUtils}=require('electron');
contextBridge.exposeInMainWorld('wallpaper',{
 state:()=>ipcRenderer.invoke('state'),
 save:s=>ipcRenderer.invoke('save',s),
 choose:()=>ipcRenderer.invoke('choose'),
 drop:file=>ipcRenderer.invoke('import',webUtils.getPathForFile(file)),
 select:id=>ipcRenderer.invoke('select',id),
 remove:id=>ipcRenderer.invoke('remove',id),
 connect:()=>ipcRenderer.invoke('connect'),
 apply:()=>ipcRenderer.invoke('apply'),
 restore:()=>ipcRenderer.invoke('restore'),
 capture:()=>ipcRenderer.invoke('capture'),
 reset:()=>ipcRenderer.invoke('reset'),
 quit:()=>ipcRenderer.invoke('quit'),
 onState:fn=>{ipcRenderer.on('state-change',(_,state)=>fn(state));}
});
