export const customerMessageFields={
 appointmentEmail:{label:'Appointment emails',initial:true,help:'Send appointment confirmations and reminders to this customer’s email address. Turning this off does not stop staff from sending a requested receipt or agreement copy.'},
 appointmentSms:{label:'Appointment texts',initial:true,help:'Send appointment confirmations and reminders to a phone number with SMS enabled under Phone contacts. Turning this off stops automatic appointment texts for this customer.'},
 invalidEmail:{label:'Email address needs correction',initial:false,help:'Mark an email address that cannot receive messages. Automatic appointment emails and calendar invitations stop until staff correct the address. Saving a changed address clears this check.'},
 invalidSmsNumber:{label:'Texting number needs correction',initial:false,help:'Mark a texting number that cannot receive messages. Automatic appointment texts stop until staff correct the number and clear this check.'},
} as const;
export type CustomerMessagePreferences=Partial<Record<keyof typeof customerMessageFields,boolean>>;
export function customerMessagePreferences(input:Record<string,unknown>):CustomerMessagePreferences{
 const result:CustomerMessagePreferences={};
 for(const key of Object.keys(customerMessageFields) as (keyof typeof customerMessageFields)[]){
  if(input[key]===undefined)continue;
  if(typeof input[key]!=='boolean')throw Error('Choose on or off for each customer communication preference.');
  result[key]=input[key];
 }
 return result;
}
