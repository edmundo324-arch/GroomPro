// Older tickets stored a package's name and service identity but no package ID.
// Recognize only an unambiguous exact match; never infer from breed or price.
export function identifyPackageLines<T extends {packageId?:string|null;petId?:string|null;serviceId?:string|null;description:string}>(lines:T[],packages:any[]){
 return lines.map(line=>{
  if(line.packageId||!line.petId||!line.serviceId)return line;
  const matches=packages.filter(pkg=>pkg.items.some((item:any)=>item.serviceId===line.serviceId&&line.description===pkg.name+' · '+item.service.name));
  if(matches.length!==1)return line;
  return{...line,packageId:matches[0].id,packageName:matches[0].name,packageGroupKey:line.petId+':'+matches[0].id};
 });
}
