function attribute(value:string){return value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
export function portalLink(origin:string,tenantId:string,locationId:string){
 const base=new URL(origin);if(base.username||base.password||!((base.protocol==='https:')||(base.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(base.hostname))))throw Error('Use the secure GroomPro website address for your booking link.');
 if(!tenantId.trim()||!locationId.trim())throw Error('Choose the shop for this booking link.');
 const url=new URL('/portal',base.origin);url.searchParams.set('tenant',tenantId);url.searchParams.set('location',locationId);return url.href;
}
export function portalEmbed(origin:string,tenantId:string,locationId:string){const url=attribute(portalLink(origin,tenantId,locationId));return '<iframe src="'+url+'" title="Customer appointments and booking" width="100%" height="760" style="border:0;max-width:100%;" loading="lazy"></iframe>\n<p><a href="'+url+'" target="_blank" rel="noopener noreferrer">Open appointments and booking in a new window</a></p>';}
