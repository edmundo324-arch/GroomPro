export const defaultHintHighlightColor='#c18b16';
export function hintHighlightColor(value:unknown){return typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value:defaultHintHighlightColor;}
