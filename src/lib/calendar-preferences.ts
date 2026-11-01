export const calendarWidths=['fit','100','160','220'];
export function calendarWidth(saved:string|null,compact:boolean){return saved&&calendarWidths.includes(saved)?saved:compact?'100':'fit';}
