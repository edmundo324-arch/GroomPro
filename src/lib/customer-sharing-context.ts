import {AsyncLocalStorage} from 'node:async_hooks';
export type SharingScope={tenantId:string;locationId:string;locations:string[]};
export const sharingScope=new AsyncLocalStorage<SharingScope>();
export type SharingGroup={id:string;name:string;locationIds:string[]};
export type SharingConfig={enabled:boolean;revision:number;groups:SharingGroup[]};
export const sharingKey='CUSTOMER_SHARING_GROUPS';
export function validateGroups(groups:SharingGroup[],locations:string[]){
 if(!Array.isArray(groups)||groups.length>locations.length)throw Error('Create one group for each set of shops that shares customers.');
 const seen=new Set<string>(),ids=new Set<string>();
 for(const group of groups){if(!group.id||ids.has(group.id)||!group.name?.trim()||!Array.isArray(group.locationIds)||!group.locationIds.length)throw Error('Each group needs a unique identifier, name and at least one shop.');ids.add(group.id);for(const id of group.locationIds){if(!locations.includes(id)||seen.has(id))throw Error('Place each shop in exactly one sharing group.');seen.add(id);}}
 if(seen.size!==locations.length)throw Error('Place every shop in a sharing group before saving.');
 return groups.map(g=>({id:g.id,name:g.name.trim(),locationIds:[...g.locationIds]}));
}
export function sharedLocations(config:SharingConfig,locationId:string){return config.groups.find(g=>g.locationIds.includes(locationId))?.locationIds||[];}
export function customerSharingWhere(scope=sharingScope.getStore()):any{return scope?{tenantId:scope.tenantId,locationAccess:{some:{tenantId:scope.tenantId,locationId:scope.locationId}}}:{};}
