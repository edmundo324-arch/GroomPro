export const GROOMPRO_ROLES = [
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
