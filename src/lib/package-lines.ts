export function allocatePackage(total:number,quantities:number[]){
 if(!Number.isSafeInteger(total)||total<0||!quantities.length||quantities.some(q=>!Number.isInteger(q)||q<1||q>1000))throw Error('Invalid package price or quantities.');
 const units=quantities.reduce((a,b)=>a+b,0);let remaining=total;
 return quantities.map((quantity,i)=>{const share=i===quantities.length-1?remaining:Math.floor(total*quantity/units);remaining-=share;const unitPriceCents=Math.ceil(share/quantity);return{quantity,unitPriceCents,discountCents:unitPriceCents*quantity-share,totalCents:share}});
}
export function expandPackage(pkg:any,services:any[],petId:string){
 if(!pkg.items.length)throw Error('This package has no included services.');
 const prices=allocatePackage(pkg.priceCents,pkg.items.map((i:any)=>i.quantity));
 return pkg.items.map((item:any,index:number)=>{const service=services.find(s=>s.id===item.serviceId&&s.active);if(!service)throw Error('An included service is unavailable.');return{type:'SERVICE',id:service.id,serviceId:service.id,packageId:pkg.id,packageGroupKey:petId+':'+pkg.id,packageName:pkg.name,petId,role:item.role||'ADD_ON',description:pkg.name+' · '+service.name,reportCardDescription:service.description,durationMin:service.durationMin,...prices[index]}});
}
