// GroomPro's native server loop. No browser, external cron, or tenant-managed secret.
function startAppointmentScheduler({port,token,fetchImpl=fetch,setTimer=setTimeout,clearTimer=clearTimeout,onError=()=>console.error('GroomPro: appointment scheduler could not complete its check; it will check again.')}={}){
 let stopped=false,timer,controller,cursor=null,waitlistCursor=null,messageDone=false,waitlistDone=false,vaccinationCursor=null,vaccinationDone=false,prepaidCursor=null,prepaidDone=false,birthdayCursor=null,birthdayDone=false;
 async function tick(){
  if(stopped)return;
  let failed=false;
  controller=new AbortController();const timeout=setTimer(()=>controller.abort(),120000);
  try{const response=await fetchImpl('http://127.0.0.1:'+port+'/api/internal/appointment-messages',{method:'POST',headers:{'Content-Type':'application/json','x-groompro-scheduler':token},body:JSON.stringify({cursor,waitlistCursor,messageDone,waitlistDone,vaccinationCursor,vaccinationDone,prepaidCursor,prepaidDone,birthdayCursor,birthdayDone}),signal:controller.signal});if(!response.ok)throw Error('Scheduler check failed');const result=await response.json();cursor=result.cursor||null;waitlistCursor=result.waitlistCursor||null;vaccinationCursor=result.vaccinationCursor||null;vaccinationDone=!vaccinationCursor;prepaidCursor=result.prepaidCursor||null;prepaidDone=!prepaidCursor;birthdayCursor=result.birthdayCursor||null;birthdayDone=!birthdayCursor;messageDone=!cursor;waitlistDone=!waitlistCursor;}catch{failed=true;if(!stopped)onError();}finally{clearTimer(timeout);controller=null;if(!stopped)timer=setTimer(tick,!failed&&(!messageDone||!waitlistDone||!vaccinationDone||!prepaidDone||!birthdayDone)?250:60000);if(!failed&&messageDone&&waitlistDone&&vaccinationDone&&prepaidDone&&birthdayDone){messageDone=false;waitlistDone=false;vaccinationDone=false;prepaidDone=false;birthdayDone=false;}}
 }
 timer=setTimer(tick,10000);
 return ()=>{stopped=true;clearTimer(timer);controller?.abort();};
}
module.exports={startAppointmentScheduler};
