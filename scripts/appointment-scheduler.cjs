// GroomPro's native server loop. No browser, external cron, or tenant-managed secret.
function startAppointmentScheduler({port,token,fetchImpl=fetch,setTimer=setTimeout,clearTimer=clearTimeout,onError=()=>console.error('GroomPro: appointment scheduler could not complete its check; it will check again.')}={}){
 let stopped=false,timer,controller,cursor=null;
 async function tick(){
  if(stopped)return;
  let failed=false;
  controller=new AbortController();const timeout=setTimer(()=>controller.abort(),120000);
  try{const response=await fetchImpl('http://127.0.0.1:'+port+'/api/internal/appointment-messages',{method:'POST',headers:{'Content-Type':'application/json','x-groompro-scheduler':token},body:JSON.stringify({cursor}),signal:controller.signal});if(!response.ok)throw Error('Scheduler check failed');const result=await response.json();cursor=result.cursor||null;}catch{failed=true;if(!stopped)onError();}finally{clearTimer(timeout);controller=null;if(!stopped)timer=setTimer(tick,!failed&&cursor?250:60000);}
 }
 timer=setTimer(tick,10000);
 return ()=>{stopped=true;clearTimer(timer);controller?.abort();};
}
module.exports={startAppointmentScheduler};
