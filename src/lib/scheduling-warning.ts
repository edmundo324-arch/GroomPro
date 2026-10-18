export function isSchedulingWarning(message:string){return /^(Choose an appointment that starts and finishes within |This location is closed on |Choose a time within the booking asset|This booking asset has a time block|Choose an available groomer or Assign later\.|This employee is unavailable for this appointment\.|The selected employee is unavailable at this time\.|This employee has a time block)/.test(message)}
// Only explicitly identified scheduling checks may use this override.
export function schedulingApproved(request:{headers:{get:(key:string)=>string|null}},message:string){
 if(!isSchedulingWarning(message))return false;
 try {const values=JSON.parse(decodeURIComponent(request.headers.get('x-groompro-scheduling-overrides')||'[]'));return Array.isArray(values)&&values.includes(message)}catch{return false}
}
export function schedulingWarning(message:string){return {error:message,...(isSchedulingWarning(message)?{schedulingWarning:message}:{})}}
export function schedulingException(message:string){return Object.assign(new Error(message),isSchedulingWarning(message)?{schedulingWarning:message}:{})}
export function warningDetails(error:unknown){return error&&typeof error==='object'&&'schedulingWarning' in error?{schedulingWarning:(error as {schedulingWarning:string}).schedulingWarning}:{}}
