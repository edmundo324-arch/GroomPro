// A provider-classified preference takes precedence over the customer's words.
// HELP and ordinary replies must never change consent or appointment status.
export function inboundSmsPreference(parameters:URLSearchParams):boolean|null{
 const kind=parameters.get('OptOutType')?.toUpperCase();
 if(kind)return kind==='STOP'?false:kind==='START'?true:null;
 const body=(parameters.get('Body')||'').trim().toUpperCase();
 if(['STOP','STOPALL','UNSUBSCRIBE','CANCEL','END','QUIT','REVOKE','OPTOUT'].includes(body))return false;
 if(['START','UNSTOP'].includes(body))return true;
 return null;
}
