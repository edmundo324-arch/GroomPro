export const calendarWidths=['fit','100','160','220'];
export function calendarWidth(saved:string|null,compact:boolean){return saved&&calendarWidths.includes(saved)?saved:compact?'100':'fit';}

export const calendarDeviceKinds = ['phone', 'tablet', 'narrow', 'pc'] as const;
type DeviceKind = typeof calendarDeviceKinds[number];
type CalendarRule = {
  category: 'jobTitle' | 'employee' | 'service';
  name: string;
  device: DeviceKind | 'all';
  remember: boolean;
  width: string;
};

export function calendarPreferencePolicy(value: any) {
  const rules: CalendarRule[] = [];
  if (Array.isArray(value?.rules)) {
    for (const rule of value.rules) {
      if (!rule || !['jobTitle', 'employee', 'service'].includes(rule.category) ||
          typeof rule.name !== 'string' || !rule.name.trim() || rule.name.length > 191 ||
          !['all', ...calendarDeviceKinds].includes(rule.device)) continue;
      rules.push({
        category: rule.category, name: rule.name.trim(), device: rule.device,
        remember: rule.remember !== false,
        width: calendarWidths.includes(rule.width) ? rule.width : ''
      });
    }
  }
  return { remember: value?.remember !== false, rules };
}

export function employeeCalendarPolicy(value: any, jobTitle: string | null, device: DeviceKind) {
  const policy = calendarPreferencePolicy(value);
  const title = jobTitle?.trim().toLowerCase() || '';
  const qualifications = title.split(',').map(part => part.trim());
  const matches = (rule: CalendarRule) => (rule.device === device || rule.device === 'all') &&
    (rule.category === 'jobTitle' ? title === rule.name.toLowerCase() : qualifications.includes(rule.name.toLowerCase()));
  const rule = policy.rules.find(item => item.device === device && matches(item)) || policy.rules.find(matches);
  return { remember: policy.remember && (rule?.remember ?? true), defaultWidth: rule?.width || calendarWidth(null, device !== 'pc') };
}

export function calendarDeviceKind(): DeviceKind {
  if (window.matchMedia('(max-width:700px)').matches) return 'phone';
  if (window.matchMedia('(pointer:coarse)').matches) return 'tablet';
  return window.matchMedia('(max-width:1000px)').matches ? 'narrow' : 'pc';
}
