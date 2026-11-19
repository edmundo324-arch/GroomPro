export function emailDeliveryMessage(status:string){switch(status){
 case 'RECORDED':return 'This email is recorded in GroomPro; no delivery result is available.';
 case 'NOT_CONFIGURED':return 'This email was saved but not sent. Ask the business owner to finish setting up email delivery.';
 case 'SENDING':return 'The send request is still being checked. Review its delivery result before sending another copy.';
 case 'DELIVERED':return 'The customer’s email server accepted this message. This does not confirm that the customer read it.';
 case 'SENT':case 'ACCEPTED':return 'The email service accepted your message. Delivery has not been confirmed.';
 case 'DELAYED':return 'Email delivery is delayed. The email service is still trying; check Communication History before sending another copy.';
 case 'BOUNCED':return 'The customer’s email server rejected this message. Review the email address with the customer before trying again.';
 case 'COMPLAINED':return 'The recipient marked this email as spam. Review their communication preferences before contacting them again.';
 case 'SUPPRESSED':return 'The email service blocked this recipient. Ask the business owner to review the email service before sending again.';
 case 'FAILED':return 'The email was not sent. Ask the business owner to check the email service before trying again.';
 default:return 'We could not confirm whether the email was sent. Ask the business owner to check the email service before sending it again.';
}}
