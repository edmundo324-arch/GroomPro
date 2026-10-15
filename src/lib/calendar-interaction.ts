export function popupPosition(rect:{left:number;right:number;top:number},viewportWidth:number,viewportHeight:number){
 const right=Math.max(0,viewportWidth-rect.right-16),left=Math.max(0,rect.left-16);
 const side=right>=320||right>=left?'right':'left',width=Math.min(320,side==='right'?right:left);
 return {left:side==='right'?rect.right+8:rect.left-width-8,top:Math.max(8,Math.min(rect.top,viewportHeight-320)),width,maxHeight:Math.max(80,viewportHeight-16)};
}
export function slotMinute(y:number,top:number,first:number){return Math.max(0,Math.min(1435,first+Math.floor((y-top)/1.2/5)*5))}
export function intervalsOverlap(a:string,b:string,c:string,d:string){return +new Date(a)<+new Date(d)&&+new Date(c)<+new Date(b)}
export type CalendarBlock={id:string;resourceKind:'employee'|'asset';resourceId:string;start:string;end:string;label:string;revision:number};
