const {execFile,spawn}=require('node:child_process');
const path=require('node:path');
function powershell(script){
 return new Promise((resolve,reject)=>{
  const command=Buffer.from("[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)\n$ErrorActionPreference='Stop'\n"+script,'utf16le').toString('base64');
  execFile(path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),
   ['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',command],
   {windowsHide:true,timeout:15000,maxBuffer:1024*1024,encoding:'utf8'},(err,stdout,stderr)=>err?reject(Error(stderr.trim()||err.message)):resolve(stdout.replace(/^\uFEFF/,'').trim()));
 });
}
async function detect(){
 const raw=await powershell(`
$pkg=Get-AppxPackage -Name OpenAI.Codex | Sort-Object Version -Descending | Select-Object -First 1
if(-not $pkg){throw '未找到 Microsoft Store 版 Codex。'}
$exe=Join-Path $pkg.InstallLocation 'app\\ChatGPT.exe'
$processes=@(Get-CimInstance Win32_Process -Filter "Name='ChatGPT.exe'" | Where-Object {$_.ExecutablePath -ieq $exe -and $_.CommandLine -notmatch '--type='} | ForEach-Object {
 $port=0
 if($_.CommandLine -match '--remote-debugging-port=(\\d+)'){$port=[int]$Matches[1]}
 [pscustomobject]@{pid=$_.ProcessId;exe=$_.ExecutablePath;port=$port;customProfile=($_.CommandLine -match '--user-data-dir=')}
})
$listeners=@(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object {$_.OwningProcess -in $processes.pid} | Select-Object @{n='pid';e={$_.OwningProcess}},@{n='port';e={$_.LocalPort}},@{n='address';e={$_.LocalAddress}})
[pscustomobject]@{exe=$exe;version=$pkg.Version.ToString();processes=$processes;listeners=$listeners}|ConvertTo-Json -Depth 5 -Compress`);
 return JSON.parse(raw);
}
function eligible(snapshot){
 return snapshot.processes.filter(p=>p.port>1023&&!p.customProfile).filter(p=>{
  const listeners=snapshot.listeners.filter(l=>l.pid===p.pid&&l.port===p.port);
  return listeners.length>0&&listeners.every(l=>l.address==='127.0.0.1'||l.address==='::1');
 });
}
async function launch(exe,port){
 if(process.env.CODEX_ELECTRON_USER_DATA_PATH)throw Error('检测到独立配置目录。请从正常 Windows 桌面打开本程序后重试。');
 const net=require('node:net');
 await new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',()=>reject(Error('连接端口被占用，请稍后重试。')));server.listen(port,'127.0.0.1',()=>server.close(resolve));});
 await new Promise((resolve,reject)=>{
  const child=spawn(exe,['--remote-debugging-address=127.0.0.1',`--remote-debugging-port=${port}`,'codex://launch'],{windowsHide:true,detached:true,stdio:'ignore'});
  child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});
 });
}
async function stopLegacy(){
 // Only the known earlier CSS watcher, never the Codex client.
 await powershell(`
$legacy='C:\\Users\\Administrator\\Documents\\Codex\\2026-10-17\\ni-ch\\outputs\\acheron-css\\loader.mjs'
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {$_.CommandLine -and $_.CommandLine.Contains($legacy) -and $_.CommandLine -match '\\bwatch\\b'} | ForEach-Object {Stop-Process -Id $_.ProcessId -ErrorAction SilentlyContinue}`);
}
module.exports={detect,eligible,launch,stopLegacy};
