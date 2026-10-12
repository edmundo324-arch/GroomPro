export type BoardSlots=(string|null)[];
export function arrangeRows(rows:{id:string;pets:{petId:string}[];scheduledStart:string|null}[],saved:BoardSlots|null):BoardSlots{
 const keys=rows.map(t=>`${t.id}:${t.pets[0].petId}`);
 if(saved){const valid=new Set(keys),slots=saved.map(k=>k&&valid.has(k)?k:null),seen=new Set(slots);for(const key of keys)if(!seen.has(key)){let index=slots.length-1;while(index>=0&&!slots[index])index--;slots[index+1]=key;seen.add(key)}return slots;}
 const slots:BoardSlots=[];
 for(let n=0;n<rows.length;n+=46){const page=rows.slice(n,n+46),morning=page.filter(t=>(t.scheduledStart?new Date(t.scheduledStart).getHours():0)<11),afternoon=page.filter(t=>(t.scheduledStart?new Date(t.scheduledStart).getHours():0)>=11);for(const half of [[...morning.slice(0,23),...afternoon.slice(23)],[...afternoon.slice(0,23),...morning.slice(23)]])for(let i=0;i<23;i++)slots.push(half[i]?`${half[i].id}:${half[i].pets[0].petId}`:null);}
 return slots;
}
export function moveAppointment(slots:BoardSlots,key:string,target:number):BoardSlots{
 const ticket=key.slice(0,key.lastIndexOf(':')),group=slots.filter((k):k is string=>!!k&&k.startsWith(ticket+':'));
 const first=slots.findIndex(k=>group.includes(k||''));
 if(!group.length||target<0||Math.floor(target/23)!==Math.floor((target+group.length-1)/23))throw Error('Choose enough consecutive rows on the same half for this appointment.');

 if(target<=slots.slice(0,first).reduce((last,k,i)=>k?i:last,-1))throw Error('Keep this appointment after the earlier scheduled appointments.');
 const next:BoardSlots=slots.map(k=>group.includes(k||'')?null:k);
 const following=slots.map((k,i)=>({k,i})).filter(v=>v.i>first&&v.k&&!group.includes(v.k));
 for(const v of following)next[v.i]=null;
 while(next.length<target+group.length)next.push(null);
 group.forEach((k,i)=>next[target+i]=k);
 let cursor=target+group.length;
 for(const v of following){const index=Math.max(cursor,v.i);while(next.length<=index)next.push(null);next[index]=v.k;cursor=index+1;}
 return next;
}
export function insertChronologically(slots:BoardSlots,keys:string[],times:Record<string,number>,displace=false):BoardSlots{
 const next=[...slots];
 for(const key of keys){if(next.includes(key))continue;let lower=0,upper=next.length;
 for(let i=0;i<next.length;i++){const k=next[i];if(!k)continue;if((times[k]||0)<=(times[key]||0))lower=i+1;else{upper=i;break;}}
 let at=lower;while(at<upper&&next[at])at++;
 if(at<next.length&&!next[at])next[at]=key;else if(displace)next.splice(at,0,key);
 }return next;
}
