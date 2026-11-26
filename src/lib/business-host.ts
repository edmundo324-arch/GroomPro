// Deployment-only, opt-in routing. A hostname selects context, never permissions.
export const reservedBusinessNames=new Set(['www','app','admin','dev','staging','api','mail','smtp','portal','support','status','localhost']);
export type BusinessHostRoute={kind:'legacy'}|{kind:'business';tenantId:string}|{kind:'unknown'};
type Environment={GROOMPRO_SUBDOMAIN_ROUTING_ENABLED?:string;GROOMPRO_SUBDOMAIN_ROUTING?:string};
function hostname(value:string){
 const host=value.toLowerCase().replace(/\.$/,'');
 if(host.length>253||!host.split('.').every(part=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part)))throw Error('Invalid hostname.');
 return host;
}
export function businessHostRoute(hostHeader:string|null,environment:Environment={GROOMPRO_SUBDOMAIN_ROUTING_ENABLED:process.env.GROOMPRO_SUBDOMAIN_ROUTING_ENABLED,GROOMPRO_SUBDOMAIN_ROUTING:process.env.GROOMPRO_SUBDOMAIN_ROUTING}):BusinessHostRoute{
 if(environment.GROOMPRO_SUBDOMAIN_ROUTING_ENABLED!=='true')return {kind:'legacy'};
 const raw=JSON.parse(environment.GROOMPRO_SUBDOMAIN_ROUTING||'null');
 if(!raw||typeof raw.baseDomain!=='string'||!raw.businesses||Array.isArray(raw.businesses)||typeof raw.businesses!=='object'||!Array.isArray(raw.legacyHosts))throw Error('Subdomain routing needs a base domain, business map and existing hostnames.');
 const base=hostname(raw.baseDomain);if(!base.includes('.')||base==='localhost')throw Error('Choose the registered base domain.');
 const mapping=new Map<string,string>();
 for(const [label,id] of Object.entries(raw.businesses)){
  if(label!==hostname(label)||label.includes('.')||reservedBusinessNames.has(label)||typeof id!=='string'||!id.trim()||id.length>191||id!==id.trim())throw Error('Review the business subdomain mappings.');
  mapping.set(label+'.'+base,id);
 }
 const legacy=new Set<string>(raw.legacyHosts.map((h:unknown)=>{if(typeof h!=='string')throw Error('Invalid existing hostname.');return hostname(h)}));
 for(const h of mapping.keys())if(legacy.has(h))throw Error('A business address cannot also be a shared address.');
 if(!hostHeader||/[\s,/@?#\\]/.test(hostHeader))return {kind:'unknown'};
 // Host is supplied by the actual HTTP request; do not trust X-Forwarded-Host.
 let host:string;try{host=hostname(hostHeader.replace(/:\d{1,5}$/,''))}catch{return {kind:'unknown'}}
 const tenantId=mapping.get(host);return tenantId?{kind:'business',tenantId}:legacy.has(host)?{kind:'legacy'}:{kind:'unknown'};
}
export function requestBusinessHost(request:{headers:{get:(key:string)=>string|null}}){return businessHostRoute(request.headers.get('host'))}
export function conflictsWithBusiness(tenantId:string,values:unknown[]){return values.some(value=>value!==undefined&&value!==null&&value!==''&&value!==tenantId)}
