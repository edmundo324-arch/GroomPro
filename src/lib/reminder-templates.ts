// Reusable wording only: making these available never schedules or sends a message.
export const reminderTemplates=[
 {id:'factory-reminder-sms-pampering-v1',name:'Text: A Little Pampering Ahead',channel:'SMS',active:true,text:"Hi {firstName}! A little pampering is on the calendar for {pets}: {appointmentDate} at {appointmentTime}, at {location}. We look forward to seeing you both! — {business}"},
 {id:'factory-reminder-sms-countdown-v1',name:'Text: The Grooming Countdown',channel:'SMS',active:true,text:"The countdown to fresh-coat time is on! {pets}'s appointment is {appointmentDate} at {appointmentTime}. See you at {location}, {firstName}! — {business}"},
 {id:'factory-reminder-sms-simple-v1',name:'Text: Short and Sweet Reminder',channel:'SMS',active:true,text:"Hi {firstName}! A friendly reminder: {pets} is booked with {business} on {appointmentDate} at {appointmentTime}. See you at {location}!"},
 {id:'factory-reminder-email-pampering-v1',name:'Email: A Little Pampering Ahead',channel:'EMAIL',active:true,text:"Hi {firstName},\n\nA little pampering is coming up for {pets}, and we are looking forward to it!\n\nAppointment: {appointmentDate} at {appointmentTime}\nLocation: {location}\nBooked for: {customer}\n\nHave a grooming request you would like us to know about? Reply and tell us, so we can discuss it with you at check-in.\n\nSee you soon!\nThe {business} Team"},
 {id:'factory-reminder-email-calendar-v1',name:'Email: Save the Date for a Fresh Coat',channel:'EMAIL',active:true,text:"Hi {firstName},\n\nHere is a happy little calendar reminder for {pets}!\n\nWe will see you on {appointmentDate} at {appointmentTime}, at {location}.\n\nIf you have a question about this visit, reply to this message. We are happy to help.\n\nWarm wishes,\nThe {business} Team"},
 {id:'factory-reminder-email-simple-v1',name:'Email: Your Next Visit',channel:'EMAIL',active:true,text:"Hi {customer},\n\nWe are looking forward to welcoming {pets} for the next visit!\n\nDate: {appointmentDate}\nTime: {appointmentTime}\nShop: {location}\n\nThank you for choosing {business}. See you soon!"}
] as const;
export function libraryWithReminderTemplates(value:any){
 const saved=value&&Array.isArray(value.rows)?value:{revision:0,rows:[]};
 if(saved.reminderTemplatesVersion===1)return saved;
 const ids=new Set(saved.rows.map((r:any)=>r.id));
 return {...saved,reminderTemplatesVersion:1,rows:[...saved.rows,...reminderTemplates.filter(r=>!ids.has(r.id)).slice(0,Math.max(0,2000-saved.rows.length))]};
}
export const templateDetailLabels={business:'Business Name',customer:'Customer Full Name',firstName:'Customer First Name',pets:'Dog Names',appointmentDate:'Appointment Date',appointmentTime:'Appointment Time',location:'Shop Name'} as const;
