import {customRuleMatches,type CustomRuleDraft,type CustomRuleFacts,type CustomRuleEvent} from './custom-rule-policy';
export type ExecutableCustomRule=CustomRuleDraft&{state:'ACTIVE'|'PAUSED'|'DRAFT';priority:number;activatedAt:string;existingRecords:'INCLUDE'|'NEW_ONLY'};
export type CustomRuleEventContext={id:string;event:CustomRuleEvent;occurredAt:string;locationId:string;current:boolean;facts:CustomRuleFacts};
// Selecting the winner happens before applying its delay or delivery limit.
// Otherwise a general rule could send while the chosen specific rule is waiting.
export function selectCustomRule(rules:ExecutableCustomRule[],event:CustomRuleEventContext,now=new Date()){
 const occurred=Date.parse(event.occurredAt);if(!event.current||!Number.isFinite(occurred)||occurred>+now)return null;
 const candidates=rules.filter(rule=>{
  const active=Date.parse(rule.activatedAt);
  return rule.state==='ACTIVE'&&rule.event===event.event&&Number.isFinite(active)&&active<=+now&&(rule.existingRecords==='INCLUDE'||rule.existingRecords==='NEW_ONLY'&&occurred>=active)&&(!rule.locationIds.length||rule.locationIds.includes(event.locationId))&&customRuleMatches(rule,event.facts);
 }).sort((a,b)=>a.priority-b.priority||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
 const rule=candidates[0];if(!rule)return null;
 const dueAt=new Date(occurred+rule.delayMinutes*60000);
 return {rule,dueAt,ready:+dueAt<=+now,replacesStandardMessage:rule.actions.some(a=>a.kind==='MESSAGE')};
}
