// Only reviewed source columns are eligible for transfer. In particular, never
// discover-and-upload every column: source tables also contain payment secrets.
export const sourceTables:Record<string,{key:string;columns:string[]}>={
 tblEmployees:{key:'fldPK',columns:['fldPK','fldEmployeeID','fldFirstName','fldLastName','fldABName','fldCategory','fldActive','fldLastEdit']},
 tblClients:{key:'fldClientID',columns:['fldClientID','fldFirstName','fldLastName','fldEMail','fldAddress','fldAddress2','fldCity','fldState','fldZIP','fldHomePhone','fldCellPhone','fldWorkPhone','fldPrimaryPhoneNumber','fldInactive','fldComment','fldPopUp','fldClientHistory','fldDOB','fldLastEdit']},
 tblPets:{key:'fldPetID',columns:['fldPetID','fldClientID','fldName','fldBreed','fldType','fldWeight','fldDOB','fldGender','fldInactive','fldNotes','fldComments','fldGroomComments','fldPersonalityComments','fldKennelComments','fldMedicalComments','fldLength','fldColor','fldTexture','fldDead','fldLastEdit']},
 tblProductsAndServices:{key:'fldPK',columns:['fldPK','fldID','fldPS','fldName','fldDur','fldRetail','fldWholeSale','fldStockCount','fldCategory','fldInactive','fldLastEdit']},
 tblPackagesSummary:{key:'fldPK',columns:['fldPK','fldPackageID','fldName','fldCategory','fldComments','fldInactive','fldLastEdit','fldRetail']},
 tblPackagesRow:{key:'fldPK',columns:['fldPK','fldPackageItemGuid','fldOrder','fldPackageID','fldPSID','fldRetail','fldQuantity','fldQuantityUsed']},
 tblTicketsSummary:{key:'fldPK',columns:['fldPK','fldTicketID','fldGuid','fldTicketType','fldTicketStatus','fldClientID','fldDateScheduled','fldCheckedIn','fldCompleted','fldSubtotal','fldTotal','fldLastEdit','fldTax1','fldTax2','fldTax3','fldTip','fldTender1','fldTender2','fldPayType1','fldPayType2','fldChange','fldDateClosed','fldTimeClosed','fldPickupFull']},
 tblTicketsRow:{key:'fldPK',columns:['fldPK','fldTicketID','fldQuoteID','fldGuid','fldParentGuid','fldPetID','fldEmployeeID','fldStartDateTime','fldEndDateTime','fldID','fldPS','fldDescription','fldRowOrder','fldQuantity','fldQuantityUsed','fldPrice','fldDiscountCurrency','fldDiscountPercent','fldRowTotal','fldRowSubTotal','fldRowTotalCouponDiscount','fldRowTotalLoyaltyPointDiscount','fldStartDate','fldStartTime','fldEndDate','fldEndTime']},
 tblMembershipsSummary:{key:'fldID',columns:['fldGuid','fldID','fldActive','fldBillingCycle','fldBillingFrequency','fldDescription','fldDateCreated','fldLastEdit','fldPrice','fldComments']},
 tblClientMembershipsSummary:{key:'fldGuid',columns:['fldGuid','fldMembershipGuid','fldID','fldDescription','fldBillingCycle','fldBillingFrequency','fldCanceled','fldPrice','fldTicketID','fldLastEdit','fldComments']},
};
export function readManifest(schema:any){
 return Object.entries(sourceTables).map(([table,definition])=>{
  const actual=new Set(schema.columns.filter((c:any)=>c.schema==='dbo'&&c.table===table).map((c:any)=>c.column));
  const columns=definition.columns.filter(c=>actual.has(c));
  if(!columns.includes(definition.key))throw Error('Source identifier missing for '+table);
  const indexes=schema.keys.filter((k:any)=>k.schema==='dbo'&&k.table===table&&k.is_unique);
  const unique=indexes.some((k:any)=>k.column===definition.key&&indexes.filter((x:any)=>x.index===k.index).length===1);
  if(!unique)throw Error('Source identifier is not independently unique for '+table);
  return {schema:'dbo',table,key:definition.key,columns};
 });
}
export function validateBatch(manifest:ReturnType<typeof readManifest>,table:string,rows:any[]){
 const spec=manifest.find(t=>t.table===table);
 if(!spec||!Array.isArray(rows)||rows.length>100)throw Error('Unsupported source batch.');
 const ids=new Set<string>();
 for(const row of rows){
  if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(k=>!spec.columns.includes(k)))throw Error('Unapproved source field.');
  if(spec.columns.some(k=>!Object.hasOwn(row,k)))throw Error('Incomplete source record.');
  const id=row[spec.key];if(!['string','number'].includes(typeof id)||String(id).length>191||String(id)===''||ids.has(String(id)))throw Error('Invalid or duplicate source identifier.');
  if(Object.values(row).some(v=>v!==null&&!['string','number','boolean'].includes(typeof v)))throw Error('Unsupported source value.');
  ids.add(String(id));
 }
 return spec;
}
