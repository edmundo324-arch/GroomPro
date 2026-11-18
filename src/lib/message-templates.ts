export const messageVariables=['business','customer','firstName','pets','appointmentDate','appointmentTime','location'] as const;
export function validateMessageTemplate(text:string,channel:string){
 if(!['SMS','EMAIL'].includes(channel))throw Error('Choose SMS or email for this saved message.');
 if(!text.trim()||text.length>(channel==='SMS'?1600:10000))throw Error(channel==='SMS'?'Keep the saved text message between 1 and 1,600 characters.':'Keep the saved email between 1 and 10,000 characters.');
 for(const token of text.match(/\{[^{}]*\}/g)||[])if(!messageVariables.includes(token.slice(1,-1) as any))throw Error('Use one of the listed automatic details, such as {customer} or {pets}.');
}
export function renderMessageTemplate(text:string,values:Partial<Record<typeof messageVariables[number],string>>,channel:string){
 validateMessageTemplate(text,channel);
 const rendered=text.replace(/\{([^{}]+)\}/g,(_,key:typeof messageVariables[number])=>{const value=values[key];if(!value)throw Error(`The ${key} detail is unavailable. Choose the appointment or update the profile before inserting this message.`);return value;});
 if(rendered.length>(channel==='SMS'?1600:10000))throw Error('The customer details make this message too long. Shorten the saved wording before inserting it.');
 return rendered;
}
