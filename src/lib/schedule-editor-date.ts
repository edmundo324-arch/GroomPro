export type ScheduleEditorDateFormat='LONG'|'ISO';
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
export function scheduleEditorDateFormat(value:unknown):ScheduleEditorDateFormat{
 if(value===undefined||value===null)return 'LONG';
 if(value!=='LONG'&&value!=='ISO')throw Error('Choose Month Day Year or YYYY-MM-DD for schedule dates.');
 return value;
}
export function scheduleEditorDate(date:string,format:ScheduleEditorDateFormat='LONG'){
 if(format==='ISO')return date;
 const [year,month,day]=date.split('-').map(Number);
 if(!months[month-1]||!Number.isInteger(day)||day<1||day>31)return date;
 const lastTwo=day%100,suffix=lastTwo>=11&&lastTwo<=13?'th':day%10===1?'st':day%10===2?'nd':day%10===3?'rd':'th';
 return `${months[month-1]} ${day}${suffix}, ${year}`;
}
