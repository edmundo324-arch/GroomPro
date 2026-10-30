export type SettingsPanelPlace={top:number;left:number;open:Record<string,boolean>;nested?:Record<string,{top:number;left:number}>};
export type SettingsPlace={selected:string;panels:Record<string,SettingsPanelPlace>};
export function settingsPlaceKey(scope:string,id:string){return scope?'groompro:settings-place:v1:'+scope+':'+id:''}
export function settingsPlace(value:any,ids:string[],fallback:string):SettingsPlace{
 const selected=ids.includes(value?.selected)?value.selected:ids.includes(fallback)?fallback:ids[0]||'';
 const panels:SettingsPlace['panels']={};
 for(const id of ids){const panel=value?.panels?.[id];if(!panel)continue;const offset=(number:any)=>typeof number==='number'&&Number.isFinite(number)?Math.max(0,Math.min(1000000,number)):0;
  const nested=Object.fromEntries(Object.entries(panel.nested||{}).filter(([key])=>/^[a-z-]{1,50}$/.test(key)).map(([key,value])=>[key,{top:offset((value as any)?.top),left:offset((value as any)?.left)}]));
  panels[id]={top:offset(panel.top),left:offset(panel.left),open:Object.fromEntries(Object.entries(panel.open||{}).filter(([key,open])=>/^\d{1,3}$/.test(key)&&typeof open==='boolean')) as Record<string,boolean>,...(Object.keys(nested).length?{nested}:{})};
 }
 return {selected,panels};
}
