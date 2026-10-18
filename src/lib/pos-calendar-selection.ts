export function calendarSelection(panel:string,date:Date,resource:{id:string;kind:string;name:string}){
 const value=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}T${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
 return {workflow:panel==='Rebook'?'rebook':'appointment',value,employeeId:resource.kind==='employee'?resource.id:'',asset:resource.kind==='asset'?{id:resource.id,name:resource.name}:null};
}
