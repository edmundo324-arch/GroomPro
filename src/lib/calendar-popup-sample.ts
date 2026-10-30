// Fictional preview data only. Never saved, imported or used for real bookings.
const date=(value:string)=>new Date(value+'T12:00:00Z');
function pet(id:string,name:string,breed:string,weightLbs:number,primary:string,secondary:string){return {
 id,name,breed,weightLbs,breedId:'sample-'+id+'-breed',primaryBreedId:primary,secondaryBreedId:secondary,
 vipMember:id==='max',originalBreed:breed,groomingClassification:'GR',weightDescription:weightLbs+' lb at last visit',
 lastVisit:date('2026-09-17'),kennelNotes:'Quiet kennel near the grooming area.',coatLength:'Long',coatTexture:id==='bella'?'Straight':'Curly',
 breedingStatus:'Neutered / spayed',vipEligible:true,vipEligibilityNotes:'Eligible for monthly grooming membership.',
 dateOfBirth:date(id==='bella'?'2020-04-12':'2021-07-08'),species:'Dog',gender:id==='bella'?'Female':'Male',color:id==='bella'?'Tan and silver':'Golden cream',
 groomingNotes:id==='bella'?'Usual haircut: #5 Body, #1 GC Face/TBF, trim ears and tail.':'Usual haircut: #4 Body, round face, trim ears and tail.',
 todaysGroomingNotes:id==='bella'?'#5 Body · #1 GC Face/TBF · Trim ears · Trim tail · Keep eyelashes.':'#4 Body · Round face · Trim ears · Trim tail · Scissor legs.',
 medicalNotes:id==='bella'?'Sensitive skin; use hypoallergenic shampoo.':'Mild arthritis; offer breaks while standing.',
 behaviorNotes:'Calm with gentle handling; reassure during drying.',careFlags:{SensitiveSkin:true,Shy:true},
 veterinarian:'Oak Grove Animal Clinic · (512) 555-0140',pictureUrl:'https://example.com/photos/'+id+'.jpg',
 preferredPackageId:id==='bella'?'sample-medium-groom':'sample-large-groom',
 notes:'Permanent: handle gently and keep the face dry during bathing.',active:true,
 createdAt:date('2024-05-10'),updatedAt:date('2026-10-28'),
 vaccinations:[{vaccineName:'Rabies',expiresAt:date('2027-05-10')},{vaccineName:'Bordetella',expiresAt:date('2027-03-15')}],
};}
const customer={
 id:'SAMPLE-CUSTOMER-001',firstName:'John',lastName:'Smith',email:'john.smith@example.com',
 phones:[{number:'(512) 555-0100'},{number:'(512) 555-0101'}],
 address1:'123 Oak Lane',address2:'Suite 2',city:'Austin',state:'TX',postalCode:'78701',
 notes:'Prefers appointments together for Bella and Max.',popupNotes:'Please text Maria when both dogs are ready.',
 historyNotes:'Customer since 2024. Both dogs prefer gentle drying.',sourceCreatedAt:date('2024-05-10'),
 firstVisit:date('2024-05-15'),lastVisit:date('2026-09-17'),totalVisits:18,noShowCount:1,
 invalidEmail:false,invalidSmsNumber:false,consentStatus:'Email and text reminders approved',spouse:'Maria Smith',
 documentFolder:'Customers / John Smith',dateOfBirth:date('1985-08-21'),anniversary:date('2010-06-12'),
 occupation:'Teacher',gender:'Male',title:'Mr.',emergencyContactName:'Maria Smith',emergencyContactNumber:'(512) 555-0101',
 emergencyContactRelationship:'Spouse',doNotCall:false,doNotPostalMail:false,appointmentEmail:true,appointmentSms:true,
 serviceDiscountPct:5,productDiscountPct:10,preferredEmployeeId:'sample-maya',pictureUrl:'https://example.com/photos/john-smith.jpg',
 active:true,vipStatus:'ACTIVE',loyaltyPoints:240,balanceCents:3500,creditCents:1500,
 createdAt:date('2024-05-10'),updatedAt:date('2026-10-28'),
};
function line(id:string,petId:string|null,description:string,price:number,extras:Record<string,unknown>={}){return {
 id,ticketId:'SAMPLE-TICKET-1042',petId,description,lineType:'SERVICE',role:'GROOM',quantity:1,
 unitPriceCents:price,discountCents:0,totalCents:price,durationMin:60,reportCardDescription:'Freshly groomed and comfortable.',
 packageId:null,packageGroupKey:null,packageName:null,sourceKey:'sample:'+id,serviceId:'sample-service-'+id,productId:null,
 commissionPct:40,commissionCents:Math.round(price*.4),sortOrder:0,assignedUserId:'sample-maya',
 assignedAt:date('2026-10-29'),assignmentUnavailable:false,...extras,
};}
export const calendarPopupSample={
 id:'SAMPLE-TICKET-1042',orderNumber:1042,timingMode:'CONCURRENT',status:'CLOSED',
 scheduledStart:'2026-10-29T09:00:00',durationMin:120,bookingSource:'ONLINE',onlineCategory:'Grooming',bookingDecision:'ACCEPTED',
 requestedAt:date('2026-10-22'),checkedInAt:'2026-10-29T08:50:00',pickupAt:'2026-10-29T11:15:00',pickupCompletedAt:'2026-10-29T12:00:00',
 arrivalPriority:3,tipCents:2000,salesTaxCents:1744,totalCents:28044,accountCreditCents:1500,
 noShowFeeCents:2500,noShowFeeProcessedAt:date('2026-09-01'),daycareStatus:'STAYING',daycareAddedAt:'2026-10-29T08:55:00',
 daycareAddedByUserId:'sample-alex',notes:'Both dogs booked together. Text when ready; pickup around noon.',
 createdAt:date('2026-10-22'),updatedAt:date('2026-10-29'),closedAt:'2026-10-29T12:00:00',customer,
 pets:[{pet:pet('bella','Bella','Morkie',10,'sample-yorkshire-terrier','sample-maltese')},{pet:pet('max','Max','Goldendoodle',65,'sample-golden-retriever','sample-standard-poodle')}],
 lines:[
  line('bella-groom','bella','Medium Groom · Grooming',8000,{packageId:'sample-medium-groom',packageGroupKey:'bella:groom',packageName:'Medium Groom'}),
  line('max-groom','max','Large Groom · Grooming',11000,{packageId:'sample-large-groom',packageGroupKey:'max:groom',packageName:'Large Groom',durationMin:120,sortOrder:1}),
  line('brushing','bella','Tooth brushing',1500,{role:'ADD_ON',discountCents:500,totalCents:1000,durationMin:5,commissionPct:10,commissionCents:100,sortOrder:2,sourceKey:'offer-today:sample-service-brushing'}),
  line('shampoo','bella','Gentle shampoo bottle',2000,{lineType:'PRODUCT',role:'PRODUCT',serviceId:null,productId:'sample-shampoo',discountCents:200,totalCents:1800,durationMin:0,commissionPct:10,commissionCents:180,sortOrder:3}),
  line('previous-fee',null,'Previous missed appointment fee',2500,{role:'ADD_ON',durationMin:0,commissionPct:0,commissionCents:0,sortOrder:4}),
 ],
 payments:[{paymentType:'CARD',amount:265.44}],
 assignments:[{role:'GROOMER',user:{id:'sample-maya',firstName:'Maya',lastName:'Reed',displayName:'Maya'}},{role:'BACK',user:{id:'sample-alex',firstName:'Alex',lastName:'Cruz',displayName:'Alex'}}],
};
