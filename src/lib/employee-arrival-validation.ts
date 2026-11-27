import {ticketArrivalLimitError,type ArrivalReservation} from './employee-arrival-capacity';
import {schedulingException} from './scheduling-warning';
export {readTicketArrivalReservations} from './employee-arrival-capacity';

// Call inside the booking transaction, after the Tenant lock and proposed writes.
// Rejection rolls those writes back; ordinary employee work attribution is separate.
export async function enforceTicketArrivalLimit(client:any,tenantId:string,ticketId:string,approve?:(message:string)=>Promise<boolean>,previous?:ArrivalReservation[]){
 const message=await ticketArrivalLimitError(client,tenantId,ticketId,previous);
 if(message&&!await approve?.(message))throw schedulingException(message);
}
