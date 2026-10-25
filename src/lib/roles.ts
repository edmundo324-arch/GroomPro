export const GROOMPRO_ROLES = [
  "PLATFORM_OWNER",
  "DEVELOPER",
  "ADMIN",
  "MANAGER",
  "FLOOR_MANAGER",
  "FRONT",
  "BACK",
  "MASTER_GROOMER",
  "GROOMER",
  "SALES",
] as const;

export const GROOMPRO_PERMISSIONS = ["VIEW", "CREATE", "EDIT", "DELETE", "CONFIGURE"] as const;

export type GroomProRole = typeof GROOMPRO_ROLES[number];
export type GroomProPermission = typeof GROOMPRO_PERMISSIONS[number];

export function isPlatformRole(role:unknown){return role==='PLATFORM_OWNER'||role==='DEVELOPER';}
export function canManageRole(actor:unknown,target:unknown){
  if(target==='PLATFORM_OWNER')return actor==='PLATFORM_OWNER';
  if(target==='DEVELOPER')return isPlatformRole(actor);
  return true;
}

// Preserve the edited account's existing role; platform staff may also assign Developer.
export function employeeEditorRoles(actor:unknown,current:string):string[]{
 const roles:string[]=GROOMPRO_ROLES.filter(role=>!isPlatformRole(role));
 if(isPlatformRole(actor))roles.unshift('DEVELOPER');
 if(isPlatformRole(current)&&!roles.includes(current))roles.unshift(current);
 return roles;
}
