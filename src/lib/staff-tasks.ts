export type StaffTask={customerId?:string;sourceRuleId?:string;id:string;revision:number;title:string;notes:string;assigneeId:string;dueDate:string;timezone?:string;createdBy:string;createdAt:string;updatedAt:string;completedAt:string|null;completedBy:string|null};
export const staffTaskPrefix='STAFF_TASK:',staffTaskPolicyKey='STAFF_TASK_POLICY';
export const taskManager=(role:string)=>['PLATFORM_OWNER','DEVELOPER','ADMIN','MANAGER','FLOOR_MANAGER'].includes(role);
export function taskFields(value:any){
 const title=typeof value?.title==='string'?value.title.trim():'',notes=typeof value?.notes==='string'?value.notes.trim():'',dueDate=String(value?.dueDate||''),assigneeId=String(value?.assigneeId||'');
 if(!title||title.length>180)throw Error('Describe the task in 180 characters or fewer.');
 if(notes.length>4000)throw Error('Keep task notes within 4,000 characters.');
 if(dueDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)||!Number.isFinite(Date.parse(dueDate+'T12:00:00Z'))||new Date(dueDate+'T12:00:00Z').toISOString().slice(0,10)!==dueDate))throw Error('Choose a valid due date, or leave it empty.');
 if(!assigneeId||assigneeId.length>191)throw Error('Choose the employee responsible for this task.');
 return {title,notes,dueDate,assigneeId};
}
export function taskVisible(task:StaffTask,userId:string,manager:boolean){return manager||task.assigneeId===userId||task.createdBy===userId;}
export function changeTask(previous:StaffTask|undefined,input:any,actor:{id:string;manager:boolean;canAssignOthers:boolean;timezone?:string},at:string):StaffTask{
 if(previous){if(!taskVisible(previous,actor.id,actor.manager))throw Error('This task is not assigned to you.');if(input.revision!==previous.revision)throw Error('This task changed. Refresh the list before saving; your edits are still here.');}
 if(input.action==='COMPLETE'||input.action==='REOPEN'){
  if(!previous)throw Error('Task not found. Refresh the list.');
  return {...previous,revision:previous.revision+1,updatedAt:at,completedAt:input.action==='COMPLETE'?at:null,completedBy:input.action==='COMPLETE'?actor.id:null};
 }
 if(input.action!=='SAVE')throw Error('Choose a task action.');
 if(previous&&!actor.manager&&previous.createdBy!==actor.id)throw Error('Ask the person who assigned this task or a manager to change its details.');
 const fields=taskFields(input);
 if(fields.assigneeId!==actor.id&&fields.assigneeId!==previous?.assigneeId&&!actor.canAssignOthers)throw Error('An owner or manager can assign tasks to another employee.');
 return {...fields,...(previous?.customerId?{customerId:previous.customerId}:{}),...(previous?.sourceRuleId?{sourceRuleId:previous.sourceRuleId}:{}),timezone:previous?.timezone||actor.timezone||'America/Chicago',id:previous?.id||input.id,revision:(previous?.revision||0)+1,createdBy:previous?.createdBy||actor.id,createdAt:previous?.createdAt||at,updatedAt:at,completedAt:previous?.completedAt||null,completedBy:previous?.completedBy||null};
}

export function taskOverdue(task:StaffTask,now=new Date(),fallbackZone='America/Chicago'){
 if(task.completedAt||!task.dueDate)return false;
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:task.timezone||fallbackZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const part=(type:string)=>parts.find(p=>p.type===type)?.value;return task.dueDate<[part('year'),part('month'),part('day')].join('-');
}
