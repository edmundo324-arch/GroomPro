import {WORKSPACE_MODULES} from './module-catalog';
export const visualModules=[...WORKSPACE_MODULES.filter(m=>m!=='Settings'),'POS Ticket','Customer Profile','Pet Profile','Employee','Booking asset','Service editor','Product editor','Package editor','VIP editor','Employee shift','Asset shift'] as const;
export type VisualRule={label?:string;color?:string;background?:string;order?:number;width?:number;height?:number;fontSize?:number};
export type VisualLayout={controls:Record<string,VisualRule>};
export type LayoutVersion={id:string;savedAt:string;actorId:string;value:any};
export function layoutEqual(a:any,b:any):boolean{const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;return JSON.stringify(canonical(a))===JSON.stringify(canonical(b));}
export function retainLayoutVersions(history:LayoutVersion[],value:any,actorId:string,previous:any,now=new Date()):LayoutVersion[]{
 const entries=Array.isArray(history)?history.filter(h=>h&&typeof h.id==='string'&&h.value):[];
 if(!entries.length)entries.push({id:'initial',savedAt:now.toISOString(),actorId,value:previous});
 if(!layoutEqual(entries.at(-1)?.value,value))entries.push({id:globalThis.crypto.randomUUID(),savedAt:now.toISOString(),actorId,value});
 return entries.slice(-5);
}
export function validateVisualLayout(input:any,developer:boolean,previous:VisualLayout={controls:{}}):VisualLayout{
 if(!input||!input.controls||typeof input.controls!=='object'||Array.isArray(input.controls))throw Error('Choose a valid module layout.');
 const entries=Object.entries(input.controls);if(entries.length>500)throw Error('Too many layout controls.');
 const controls:Record<string,VisualRule>={};
 for(const [id,v] of entries){if(['__proto__','constructor','prototype'].includes(id)||!/^[a-zA-Z0-9:_-]{1,180}$/.test(id)||!v||typeof v!=='object'||Array.isArray(v))throw Error('Invalid layout control.');const rule=v as any,result:VisualRule={};
  if(rule.label!==undefined){if(typeof rule.label!=='string'||rule.label.trim().length>100)throw Error('Labels must be 100 characters or fewer.');if(rule.label.trim())result.label=rule.label.trim();}
  for(const key of ['color','background'] as const)if(rule[key]){if(!/^#[0-9a-f]{6}$/i.test(rule[key]))throw Error('Choose a valid color.');result[key]=rule[key];}
  if(rule.order!==undefined){if(!Number.isInteger(rule.order)||rule.order<0||rule.order>500)throw Error('Invalid control order.');result.order=rule.order;}
  for(const key of ['width','height','fontSize'] as const){const old=previous.controls[id]?.[key],next=rule[key];if(!developer){if(next!==undefined&&next!==old)throw Error('Only Developers can adjust control sizes.');if(old!==undefined)result[key]=old;continue;}if(next!==undefined){const min=key==='fontSize'?11:24,max=key==='fontSize'?24:2400;if(!Number.isInteger(next)||next<min||next>max)throw Error('Choose a valid control size.');result[key]=next;}}
  controls[id]=result;
 }
 // A tenant cannot erase Developer sizing by omitting a control.
 if(!developer)for(const [id,rule] of Object.entries(previous.controls))for(const key of ['width','height','fontSize'] as const)if(rule[key]!==undefined)(controls[id]??={})[key]=rule[key];
 return {controls};
}
export function preserveTicketSizes(next:any,previous:any,developer:boolean){
 if(developer)return next;for(const device of ['desktop','phone'])if(next[device].fontSize!==previous[device].fontSize)throw Error('Only Developers can adjust ticket typeset size.');return next;
}
