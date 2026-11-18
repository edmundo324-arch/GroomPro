import {definitions,convert,type Dataset} from './fields';
export function prepareCatalogDatasets(datasets:Dataset[]):Dataset[]{
 const existing=new Set(datasets.filter(d=>d.entity==='SERVICE'||d.entity==='PACKAGE').flatMap(d=>d.rows.map(r=>d.entity+':'+String(r[d.idColumn]))));
 const services=new Map<string,any>(),packages=new Map<string,any>();
 const add=(map:Map<string,any>,id:string,value:any,label:string)=>{const old=map.get(id);if(old&&JSON.stringify(old)!==JSON.stringify(value))throw Error(label+' '+id+' has different names, prices or contents in the source. Include a reviewed catalog file for it instead.');map.set(id,value)};
 for(const dataset of datasets.filter(d=>d.entity==='APPOINTMENT'&&d.selected!==false))for(const row of dataset.rows){
  const mapped:any={};for(const [header,key] of Object.entries(dataset.mapping)){const definition=definitions.APPOINTMENT[key];if(definition&&['lines','serviceSourceId','description','priceCents','durationMin'].includes(definition.target))mapped[definition.target]=convert(row[header],definition);}
  const lines=mapped.lines||[{serviceId:mapped.serviceSourceId,description:mapped.description,unitPriceCents:mapped.priceCents,durationMin:mapped.durationMin}];
  if(!Array.isArray(lines))throw Error('Map booked Lines to a JSON array before preparing catalog items.');
  const packageLines=new Map<string,any[]>();
  for(const line of lines){
   if(!line.serviceId){if(line.packageId)throw Error('Each package component needs a stable service identifier. Include a reviewed service catalog file.');continue;}
   const id=String(line.serviceId),price=Number(line.unitPriceCents),duration=Number(line.durationMin||0),role=line.role||'GROOM';
   if(!line.description||!Number.isSafeInteger(price)||price<0||!Number.isSafeInteger(duration)||duration<0)throw Error('Catalog proposals need a service name, price in cents and valid minutes. Review the booked source lines.');
   if(!existing.has('SERVICE:'+id))add(services,id,{ID:id,Name:String(line.description),Price:(price/100).toFixed(2),DurationMin:duration,WorkflowRole:role},'Service');
   if(line.packageId){const key=String(line.packageId)+'\0'+String(line.petId||'');packageLines.set(key,[...(packageLines.get(key)||[]),line]);}
  }
  for(const lines of packageLines.values()){const id=String(lines[0].packageId);if(existing.has('PACKAGE:'+id))continue;
   const name=lines[0].packageName;if(!name)throw Error('Package '+id+' needs its catalog name. Include its package file or add packageName to the source lines.');
   const items=lines.map(line=>({serviceId:String(line.serviceId),quantity:Number(line.quantity||1),role:line.role||'GROOM'}));
   const price=lines.reduce((n,line)=>n+Number(line.unitPriceCents)*Number(line.quantity||1)-Number(line.discountCents||0),0);
   add(packages,id,{PackageID:id,Name:String(name),Price:(price/100).toFixed(2),Items:JSON.stringify(items)},'Package');
  }
 }
 const output:Dataset[]=[];
 for(const [entity,map] of [['SERVICE',services],['PACKAGE',packages]] as const){if(!map.size)continue;const rows=[...map.values()],headers=Object.keys(rows[0]);output.push({catalogProposal:true,name:'Reviewed booked '+entity.toLowerCase()+' catalog',entity,headers,rows,idColumn:entity==='SERVICE'?'ID':'PackageID',mapping:Object.fromEntries(headers.map(h=>[h,h])),selected:true});}
 return output;
}
