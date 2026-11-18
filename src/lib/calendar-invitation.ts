const escape=(text:string)=>text.replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
const stamp=(value:Date)=>value.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
function fold(line:string){let current='',out='';for(const char of line){if(Buffer.byteLength(current+char,'utf8')>73){out+=current+'\r\n ';current='';}current+=char;}return out+current;}
export function calendarInvitation(ticket:{id:string;scheduledStart:Date;durationMin:number;updatedAt:Date;status:string},business:string,address:string){
 if(!ticket.scheduledStart||!Number.isFinite(+new Date(ticket.scheduledStart)))throw Error('Schedule this ticket before creating a calendar invitation.');
 const start=new Date(ticket.scheduledStart),end=new Date(+start+Math.max(1,ticket.durationMin)*60000);
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//GroomPro//Appointments//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT','UID:'+escape(ticket.id)+'@groompro','DTSTAMP:'+stamp(new Date(ticket.updatedAt)),'LAST-MODIFIED:'+stamp(new Date(ticket.updatedAt)),'DTSTART:'+stamp(start),'DTEND:'+stamp(end),'SUMMARY:'+escape('Grooming appointment at '+business),'LOCATION:'+escape(address),'DESCRIPTION:'+escape('Contact '+business+' if you need to change this appointment.'),'STATUS:'+(['CANCELLED','NO_SHOW'].includes(ticket.status)?'CANCELLED':'CONFIRMED'),'END:VEVENT','END:VCALENDAR'].map(fold).join('\r\n')+'\r\n';
}
