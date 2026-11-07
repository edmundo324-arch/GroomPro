export type BathTeamSettings={prepWithBather?:boolean;dryWithBather?:boolean};
export function bathTeamRoles(s:BathTeamSettings):string[]{return [...(s.prepWithBather?['PREP']:[]),'BATH',...(s.dryWithBather?['DRY']:[])];}
export function boardAssignmentRoles(role:string,s:BathTeamSettings):string[]{return role==='BATH'?bathTeamRoles(s):[role];}

export function employeeCanHandleBoardRoles(jobTitle: string | null | undefined, roles: string[]) {
  if (!jobTitle?.trim()) return true;
  const titles = jobTitle.split(',').map(value => value.trim().toUpperCase());
  const aliases: Record<string, string[]> = {
    PREP: ['PREP', 'PREPARATION'],
    BATH: ['BATH', 'BATHER', 'BATHING'],
    DRY: ['DRY', 'DRYER', 'DRYING'],
    GROOM: ['GROOM', 'GROOMER', 'GROOMING', 'FFT', 'MASTER GROOMER']
  };
  return roles.every(role => (aliases[role] || [role]).some(title => titles.includes(title)));
}
