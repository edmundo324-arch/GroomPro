type Notice={ticketId:string;readyAt:string};
type Snooze={until:number;events:string[]};
const eventKey=(notice:Notice)=>notice.ticketId+':'+notice.readyAt;
export function closePickupReminders(minutes:number,notices:Notice[],now=Date.now()):Snooze{
 return {until:minutes===0?0:now+minutes*60000,events:notices.map(eventKey)};
}
export function pickupRemindersHidden(snooze:Snooze|null,notices:Notice[],now=Date.now()){
 return !!snooze&&(snooze.until===0||now<snooze.until)&&notices.every(notice=>snooze.events?.includes(eventKey(notice)));
}
