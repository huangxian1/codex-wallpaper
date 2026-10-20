function isTarget(t){
 try{const u=new URL(t.url);return t.type==='page'&&u.protocol==='app:'&&u.hostname==='-'&&['/index.html','/detached-window.html'].includes(u.pathname)&&!u.search.includes('avatar-overlay');}catch{return false;}
}
async function targets(port){
 const r=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(3000)});
 if(!r.ok)throw Error('无法连接主题通道。');
 return (await r.json()).filter(isTarget);
}
function command(port,target,method,params={}){
 const u=new URL(target.webSocketDebuggerUrl);
 if(u.protocol!=='ws:'||u.hostname!=='127.0.0.1'||Number(u.port)!==port||u.username||u.password||!u.pathname.startsWith('/devtools/page/'))return Promise.reject(Error('连接地址验证失败。'));
 return new Promise((resolve,reject)=>{
  const socket=new WebSocket(u);
  let settled=false;
  const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);socket.close();error?reject(error):resolve(result);};
  const timer=setTimeout(()=>finish(Error('客户端响应超时。')),7000);
  socket.addEventListener('open',()=>socket.send(JSON.stringify({id:1,method,params})));
  socket.addEventListener('error',()=>finish(Error('连接中断。')));
  socket.addEventListener('close',()=>{if(!settled)finish(Error('连接已关闭。'));});
  socket.addEventListener('message',e=>{try{const r=JSON.parse(String(e.data));if(r.id!==1)return;if(r.error)finish(Error(r.error.message));else finish(null,r.result);}catch(err){finish(err);}});
 });
}
async function evaluate(port,target,expression){
 const result=await command(port,target,'Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
 if(result.exceptionDetails)throw Error('样式未能加载，请恢复外观后重试。');
 return result.result?.value;
}
module.exports={targets,command,evaluate,isTarget};
