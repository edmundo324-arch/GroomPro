export const coverageRanges={day:'Today',week:'Week',month:'Month',upcoming:'All Upcoming'} as const;
export type CoverageRange=keyof typeof coverageRanges;
export const coverageManagerRoles=['PLATFORM_OWNER','DEVELOPER','ADMIN','MANAGER','FLOOR_MANAGER'];

export function coverageQualified(employee:{role:string;jobTitle?:string|null},type:string){
 const titles=(employee.jobTitle||'').split(',').map(title=>title.trim().toUpperCase());
 const groomer=['GROOMER','MASTER_GROOMER'].includes(employee.role)||titles.some(title=>['GR','GROOM','GROOMER','GROOMING','MASTER GROOMER'].includes(title));
 const bather=titles.some(title=>['BATH','BATHER','BATHING','FW','FULL WASH'].includes(title));
 if(['GR','GR/FFT VIP','VIP GR'].includes(type))return groomer;
 if(['FW','FW VIP','VIP FW'].includes(type))return bather;
 if(['FFT','FFT VIP','VIP FFT'].includes(type))return bather&&(groomer||titles.includes('FFT'));
 return !!type&&titles.includes(type.toUpperCase());
}
