export type ClockBreak={start:string;end?:string};
export type ClockShift={id:string;start:string;end?:string;breaks:ClockBreak[];locationId:string;recordedOffline?:boolean};
export type ClockState={revision:number;shifts:ClockShift[]};
export const emptyClock=():ClockState=>({revision:0,shifts:[]});
export function clockTotals(shift:ClockShift,now=new Date().toISOString()){
 const end=+(new Date(shift.end||now)),start=+new Date(shift.start);
 const elapsed=Math.max(0,end-start),breaks=shift.breaks.reduce((sum,b)=>sum+Math.max(0,+new Date(b.end||shift.end||now)-+new Date(b.start)),0);
 return {elapsedMinutes:elapsed/60000,breakMinutes:breaks/60000,minutesExcludingBreaks:Math.max(0,elapsed-breaks)/60000};
}
export function applyClock(state:ClockState,command:{action:string;revision:number;shiftId?:string;start?:string;end?:string;breaks?:ClockBreak[];reason?:string},at:string,id:string,locationId:string,offline=false):ClockState{
 if(command.revision!==state.revision)throw Error('Your time record changed. Refresh before recording another action. Your unsent entry is still available.');
 if(!Number.isFinite(+new Date(at)))throw Error('Choose a valid time.');
 const next:ClockState=JSON.parse(JSON.stringify(state)),active=next.shifts.find(s=>!s.end);
 if(command.action==='IN'){
  if(active)throw Error('You are already clocked in.');
  if(next.shifts.some(s=>+(new Date(s.end||s.start))>+new Date(at)))throw Error('Clock-in must be after the previous recorded shift. Ask a manager to correct the times.');
  next.shifts.push({id,start:at,breaks:[],locationId,recordedOffline:offline});
 }else if(command.action==='CORRECT'){
  if(!command.reason?.trim())throw Error('Enter the reason for correcting this time record.');
  const shift=next.shifts.find(s=>s.id===command.shiftId);if(!shift)throw Error('Choose a recorded shift.');
  const replacement={...shift,start:command.start||'',end:command.end||undefined,breaks:command.breaks||[]};
  if(!Number.isFinite(+new Date(replacement.start))||replacement.end&&(!Number.isFinite(+new Date(replacement.end))||+new Date(replacement.end)<=+new Date(replacement.start)))throw Error('The shift must end after it starts.');
  if(+new Date(replacement.start)>+new Date(at)+300000||replacement.end&&+new Date(replacement.end)>+new Date(at)+300000)throw Error('Recorded work cannot be in the future. Check the correction dates.');
  if(!replacement.end&&next.shifts.some(s=>s.id!==shift.id&&!s.end))throw Error('Another shift is already open.');
  let previous=+new Date(replacement.start);
  for(const b of replacement.breaks){if(!Number.isFinite(+new Date(b.start))||+new Date(b.start)<previous||b.end&&(!Number.isFinite(+new Date(b.end))||+new Date(b.end)<=+new Date(b.start))||!b.end&&replacement.end)throw Error('Breaks must be in order within the shift.');previous=b.end?+new Date(b.end):Infinity;if(replacement.end&&previous>+new Date(replacement.end))throw Error('A break cannot extend beyond the shift.');}
  if(next.shifts.some(s=>s.id!==shift.id&&+new Date(s.start)<(replacement.end?+new Date(replacement.end):Infinity)&&(s.end?+new Date(s.end):Infinity)>+new Date(replacement.start)))throw Error('This correction overlaps another shift.');
  Object.assign(shift,replacement);
 }else{
  if(!active)throw Error('Clock in before recording a break or clocking out.');
  active.recordedOffline=active.recordedOffline||offline;
  const openBreak=active.breaks.find(b=>!b.end),last=active.breaks.at(-1),lastTime=last?.end||last?.start||active.start;
  if(+new Date(at)<+new Date(lastTime))throw Error('This time is before the last recorded action. Ask a manager to correct the record.');
  if(command.action==='BREAK_START'){if(openBreak)throw Error('Your break is already started.');active.breaks.push({start:at});}
  else if(command.action==='BREAK_END'){if(!openBreak)throw Error('There is no open break to finish.');openBreak.end=at;}
  else if(command.action==='OUT'){if(openBreak)openBreak.end=at;active.end=at;}
  else throw Error('Choose a time-clock action.');
 }
 next.revision++;return next;
}
