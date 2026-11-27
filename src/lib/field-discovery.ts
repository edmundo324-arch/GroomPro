import {fieldPurposes} from './field-purpose';
import {fieldHint} from './field-guide';
export function fieldLabel(element:HTMLElement):string{
 if(element.matches('.gp-pos-account-link'))return element.querySelector('strong')?.textContent?.trim()||'';
 if(element.matches('input,select,textarea')){
  const control=element as HTMLInputElement;
  return control.getAttribute('aria-label')||control.labels?.[0]&&fieldLabel(control.labels[0])||'';
 }
 const copy=element.cloneNode(true) as HTMLElement;
 copy.querySelectorAll('input,select,textarea,button,small,[role="tooltip"],.gp-help-trigger').forEach(e=>e.remove());
 return copy.textContent?.replace(/\s+/g,' ').trim()||'';
}
export function describeField(element:HTMLElement){
 const name=fieldLabel(element);if(!name||name.length>100)return null;
 const window=element.closest('[role="dialog"]')?.getAttribute('aria-label');
 const module=element.closest<HTMLElement>('[data-module-name]')?.dataset.moduleName||window||'Current form';
 const candidate=fieldHint(name,{pet:!!element.closest('.gp-pet-window')});
 const customerContext=!!element.closest('[data-customer-id],.gp-customer-window,.gp-pet-window,.gp-pos-window')||/customer|pet|pos|ticket/i.test(window||module);
 const known=candidate?.tab==='Details'&&!customerContext?undefined:candidate;
 const panels:string[]=[];for(let panel=element.closest<HTMLElement>('[data-settings-panel]');panel;panel=panel.parentElement?.closest<HTMLElement>('[data-settings-panel]')||null){const label=document.getElementById(panel.getAttribute('aria-labelledby')||'')?.textContent?.trim();if(label)panels.unshift(label);}
 const path=[module,...(window&&window!==module?[window]:[]),...panels,name].join(' → ');
 const control=element.matches('input,select,textarea')?element:element.querySelector('input,select,textarea');
 const amount=element.matches('.gp-pos-account-link')?element.textContent?.match(/\$[\d,.]+/)?.[0]:undefined;
 const business=document.querySelector<HTMLElement>('[data-business-name]')?.dataset.businessName||'the business';
 const customer=element.dataset.customerName||'This customer';
 const accountHelp=amount&&known?.name==='Balance Owed'?`${customer} owes ${business} ${amount}. Open Account & Rewards to review the balance.`:amount&&known?.name==='Customer Credit'?`${customer} has ${amount} in Customer Credit with ${business}. Open Account & Rewards to review it.`:undefined;
 const appearance=!!element.closest('[data-settings-scroll="appearance-choices"]');
 const purpose:Record<string,string>={
  'Show helpful hints':'Show short explanations while staff work. Turn this off when they no longer need the guidance.',
  'Primary':'Use this as the customer’s main contact number. Texting must also be enabled for this number to receive texts.',
  'SMS':'Allow texts to this number. Leave this off if the contact should not receive texts.',
  'Call':'Allow calls to this number when calling is available for this business.',
  'Save as this dog’s usual haircut':'Use these grooming instructions as this dog’s usual haircut when preparing a future visit.',
  "Save as this dog's usual haircut":'Use these grooming instructions as this dog’s usual haircut when preparing a future visit.',
  'Remember warning window position':'Reopen appointment warnings where you last moved them, so they stay out of your way.',
  'Show Inactive':'Include inactive pets when reviewing this customer’s records. This does not make them available for new bookings.',
  'Copy from status':'Choose the appointment stage whose colors you want to reuse. Nothing changes until you copy the appearance.',
  'Copy from service type':'Choose the service type whose colors you want to reuse. Nothing changes until you copy the appearance.',
 };
 // Do not infer business rules from input types or loose words such as "status".
 // Unreviewed fields retain their searchable location, without an invented explanation.
 const contextHelp=name==='Status'&&appearance?'Choose the appointment stage whose colors you want to edit. This does not change an appointment’s status.':
  name==='Status'&&/pos|ticket/i.test(window||module)?'Set the stage this appointment has reached. Its appearance follows this business’s configured colors.':
  name==='Service type'&&appearance?'Choose the service type whose appointment colors you want to edit, such as GR, FW or FFT.':undefined;
 const ownerLabel=element.matches('input,select,textarea')?(element as HTMLInputElement).labels?.[0]:undefined;
 const help=element.dataset.help||ownerLabel?.dataset.help||control?.getAttribute('data-help')||accountHelp||contextHelp||(['Primary','SMS','Call','Show Inactive'].includes(name)&&!customerContext?undefined:purpose[name])||known?.help||fieldPurposes[control?.getAttribute('aria-label')||'']||fieldPurposes[name]||(ownerLabel&&fieldPurposes[fieldLabel(ownerLabel)])||control?.getAttribute('title')||element.getAttribute('title')||'';
 const relatedPath=element.dataset.relatedPath||control?.getAttribute('data-related-path')||ownerLabel?.dataset.relatedPath||element.closest<HTMLElement>('[data-related-path]')?.dataset.relatedPath||
  (known?.path.startsWith('Customer Profile →')&&element.closest('.gp-pos-window')?known.path:'');
 return {relatedPath,name:element.dataset.helpName||known?.name||name,aliases:[name,...(known?.aliases||[])],path:element.dataset.helpPath||known?.path||path,help:help.trim().toLowerCase()===name.toLowerCase()?'':help,element,module};
}
export function discoverFields(){
 const seen=new Set<string>();
 return [...document.querySelectorAll<HTMLElement>('label,.gp-label,input[aria-label],select[aria-label],textarea[aria-label]')]
 .filter(e=>!e.closest('.gp-whiteboard,.gp-action-pin,.gp-help-popup,.gp-nav-context,[aria-label="Search"],[aria-label="Reorder Menu"]'))
 .flatMap(e=>{const field=describeField(e);if(!field)return [];const key=field.path;if(seen.has(key))return [];seen.add(key);return [field]});
}
export function revealField(element:HTMLElement){
 for(let parent:HTMLElement|null=element;parent;parent=parent.parentElement){
  if(parent instanceof HTMLDetailsElement)parent.open=true;
  if(parent.hidden&&parent.getAttribute('aria-labelledby'))document.getElementById(parent.getAttribute('aria-labelledby')!)?.click();
 }
 requestAnimationFrame(()=>{element.scrollIntoView({block:'nearest'});element.classList.add('gp-search-highlight');setTimeout(()=>element.classList.remove('gp-search-highlight'),5000)});
}
