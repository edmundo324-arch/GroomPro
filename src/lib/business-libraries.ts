export const libraryKinds=['vendors','grooming-picks'] as const;
export function libraryKey(kind:string){if(!libraryKinds.includes(kind as any))throw Error('Choose Vendors or Grooming quick picks.');return 'BUSINESS_LIBRARY:'+kind;}
export const groomingFields=['body','tbf','ears','tail','specialNotes'];
export function validateLibrary(kind:string,rows:any[]){
 libraryKey(kind);if(!Array.isArray(rows)||rows.length>2000)throw Error('Keep each library within 2,000 entries.');
 const ids=new Set<string>();return rows.map(row=>{
  if(typeof row.id!=='string'||!row.id||row.id.length>100||ids.has(row.id))throw Error('Each entry needs its own identifier.');ids.add(row.id);
  const text=(key:string,max=2000)=>{const value=String(row[key]??'').trim();if(value.length>max)throw Error('Please shorten '+key+' to '+max+' characters.');return value;};
  const name=text('name',200);if(!name)throw Error('Enter a name for each entry.');
  if(kind==='grooming-picks'){if(!groomingFields.includes(row.field))throw Error('Choose the grooming field for this quick pick.');const value=text('text',4000);if(!value)throw Error('Enter the grooming instructions to insert.');return {id:row.id,name,field:row.field,text:value,active:row.active!==false};}
  if(!Array.isArray(row.productIds)||row.productIds.some((id:any)=>typeof id!=='string'))throw Error('Choose products from this business.');
  return {id:row.id,name,contact:text('contact',200),phone:text('phone',100),email:text('email',254),address:text('address'),website:text('website',500),notes:text('notes',4000),productIds:[...new Set<string>(row.productIds)],active:row.active!==false};
 });
}
