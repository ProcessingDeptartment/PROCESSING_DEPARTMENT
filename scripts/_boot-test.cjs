const {spawn}=require('child_process');const http=require('http');const t0=Date.now();
const BOOT="const p=require.resolve('./src/jobs/unverified-alert');require.cache[p]={id:p,filename:p,loaded:true,exports:{runUnverifiedAlert:async()=>{}}};require('./src/index.js');";
const c=spawn(process.execPath,['-e',BOOT],{env:{...process.env,PORT:'39517',API_KEY:'testkey123'},stdio:['ignore','pipe','pipe']});
let log='';c.stdout.on('data',d=>log+=d);c.stderr.on('data',d=>log+=d);c.on('exit',code=>{console.log('API exited',code,((Date.now()-t0)/1000).toFixed(1)+'s');console.log(log.slice(-1500));process.exit()});
const probe=(host)=>new Promise(r=>{const q=http.get({host,port:39517,path:'/api/health',timeout:2000},x=>{x.resume();r(x.statusCode)});q.on('error',e=>r(e.code));q.on('timeout',()=>{q.destroy();r('timeout')})});
(async()=>{for(let i=0;i<40;i++){const a=await probe('127.0.0.1'),b=await probe('localhost');if(i%5===0||typeof a==='number'||typeof b==='number')console.log(((Date.now()-t0)/1000).toFixed(1)+'s 127.0.0.1:',a,'localhost:',b);if(typeof a==='number'||typeof b==='number')break;await new Promise(r=>setTimeout(r,1000))}
console.log('--- api log:\n'+log.slice(-1200));c.kill();})();
