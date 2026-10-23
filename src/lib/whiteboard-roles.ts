export type BathTeamSettings={prepWithBather?:boolean;dryWithBather?:boolean};
export function bathTeamRoles(s:BathTeamSettings):string[]{return [...(s.prepWithBather?['PREP']:[]),'BATH',...(s.dryWithBather?['DRY']:[])];}
export function boardAssignmentRoles(role:string,s:BathTeamSettings):string[]{return role==='BATH'?bathTeamRoles(s):[role];}
