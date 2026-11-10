export async function returnToGroomPro(tryKeepSignIn:boolean){
 if(tryKeepSignIn){
  const result=await fetch('/api/platform-access',{
   method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'RETURN_HOME'}),
  }).catch(()=>null);
  if(result?.ok)return;
 }
 // Clearing the workspace ends the tenant session. Main-business access still needs its own PIN.
 const reset=await fetch('/api/setup/context',{method:'POST'});
 if(!reset.ok){
  const data=await reset.json().catch(()=>null);
  throw Error(data?.error||'Could not return to GroomPro. Try again.');
 }
}
