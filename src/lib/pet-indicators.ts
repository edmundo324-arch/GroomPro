export const petIndicatorSymbols=['?','✓','★','⊘','✕','●','◆','⚑','⚠','✚','♥','✦','◉','✉','▣','💬'];
export const petIndicators={
 ASSESS:{label:'Needs VIP assessment',symbol:'?',color:'#946200',enabled:true},
 ELIGIBLE:{label:'VIP eligible',symbol:'✓',color:'#15803d',enabled:true},
 MEMBER:{label:'VIP member',symbol:'★',color:'#7e22ce',enabled:true},
 DO_NOT_OFFER:{label:'Ineligible for VIP',symbol:'✕',color:'#b91c1c',enabled:true},
 CONVERSATION:{label:'VIP conversation recorded',symbol:'💬',color:'#1d4ed8',enabled:true},
 VET:{label:'Veterinarian information missing',symbol:'✚',color:'#946200',enabled:false},
 GROOMING:{label:'Grooming instructions available',symbol:'◆',color:'#17324d',enabled:false},
 HANDLING:{label:'Special care information',symbol:'⚑',color:'#b91c1c',enabled:false},
};
export function petIndicatorSettings(value:any){
 return Object.fromEntries(Object.entries(petIndicators).map(([key,defaults])=>{
  const saved=value?.[key];
  return [key,{...defaults,enabled:typeof saved?.enabled==='boolean'?saved.enabled:defaults.enabled,
   symbol:petIndicatorSymbols.includes(saved?.symbol)?saved.symbol:defaults.symbol,
   color:typeof saved?.color==='string'&&/^#[0-9a-f]{6}$/i.test(saved.color)?saved.color:defaults.color}];
 }));
}
