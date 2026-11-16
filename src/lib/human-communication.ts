// Presentation only: never use rewritten wording for authorization, retries,
// scheduling overrides, delivery state, or any other business decision.
export function helpfulError(value:string){
 const text=String(value||'').replace(/^Error:\s*/, '');
 if(/^(Failed to fetch|NetworkError when attempting to fetch resource\.?|Load failed|fetch failed)$/i.test(text)||/^(The operation was aborted|The operation timed out)/i.test(text))
  return 'We couldn’t confirm the result. Check your connection, then check whether your change was saved before trying again.';
 if(/PrismaClient|Invalid `(?:prisma|tx|db)\.|ECONNREFUSED|ETIMEDOUT|Can't reach database server|P1001|P1002/.test(text))
  return 'We couldn’t reach the saved information. Please try again in a moment. If this keeps happening, contact your GroomPro support contact.';
 return text;
}

export function vipConversationHint(pet:{name?:string;careFlags?:{vipConversationAt?:string|null}},now:Date,timeZone?:string){
 const name=pet.name?.trim()||'this dog';
 const date=(value:Date)=>Number.isFinite(+value)?new Intl.DateTimeFormat('en-US',{month:'numeric',day:'numeric',year:'2-digit',...(timeZone?{timeZone}:{})}).format(value):'';
 const recorded=pet.careFlags?.vipConversationAt;
 if(recorded){const day=date(new Date(recorded));return `VIP Membership was discussed for ${name}${day?' on '+day:''}. Uncheck only if this was recorded by mistake.`;}
 return `Check this after discussing VIP Membership for ${name} with their owner. The conversation will be recorded${date(now)?' for '+date(now):' when you check it'}.`;
}

export function deliveryMessage(status:string){
 switch(status.toUpperCase()){
  case 'DELIVERED':return 'The text was delivered.';
  case 'SENT':return 'The text was sent. Delivery has not been confirmed yet.';
  case 'FAILED':case 'UNDELIVERED':return 'The text could not be delivered. Check the phone number and your texting service before trying again.';
  case 'UNKNOWN':return 'We couldn’t confirm whether the text was sent. Check your texting service before resending so the customer doesn’t receive it twice.';
  default:return 'Your texting service accepted the message. Delivery has not been confirmed yet.';
 }
}
