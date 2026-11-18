export type TipShare={userId:string;amountCents:number};
export function splitTip(amountCents:number,userIds:string[]):TipShare[]{
 if(!Number.isSafeInteger(amountCents)||amountCents<0)throw Error('Enter a valid tip amount.');
 const ids=[...new Set(userIds)].sort();if(!ids.length)throw Error('Assign the employees who worked on this ticket before splitting the tip.');
 const base=Math.floor(amountCents/ids.length),extra=amountCents%ids.length;
 return ids.map((userId,i)=>({userId,amountCents:base+(i<extra?1:0)}));
}
export function validateTipShares(value:unknown,total:number,allowed:Set<string>):TipShare[]{
 if(!Array.isArray(value)||value.length>200)throw Error('Choose the employees receiving this tip.');
 const rows=value.map(r=>({userId:String(r.userId||''),amountCents:r.amountCents}));
 if(new Set(rows.map(r=>r.userId)).size!==rows.length||rows.some(r=>!allowed.has(r.userId)||!Number.isSafeInteger(r.amountCents)||r.amountCents<0))throw Error('Choose each employee once and enter a valid amount.');
 if(rows.reduce((sum,r)=>sum+r.amountCents,0)!==total)throw Error('Assigned tips must add up to the full tip amount.');
 return rows.filter(r=>r.amountCents>0);
}
