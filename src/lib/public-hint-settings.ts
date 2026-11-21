import {hintHighlightColor} from './hint-appearance';
export type PublicHintSettings={enabled:boolean;highlightColor:string};
// Expose only presentation preferences, never the rest of the tenant workflow settings.
export async function readPublicHintSettings(client:any,tenantId:string):Promise<PublicHintSettings>{
 const row=await client.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:'WORKFLOW'}}});
 return {enabled:row?.value?.helpfulHints!==false,highlightColor:hintHighlightColor(row?.value?.hintHighlightColor)};
}
