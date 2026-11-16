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
 const candidate=fieldHint(name);
 const customerContext=!!element.closest('[data-customer-id],.gp-customer-window,.gp-pet-window,.gp-pos-window')||/customer|pet|pos|ticket/i.test(window||module);
 const known=candidate?.tab==='Details'&&!customerContext?undefined:candidate;
 const panels=[...element.closest('[data-settings-panel]')?.querySelectorAll(':scope > legend')||[]].map(e=>e.textContent).filter(Boolean);
 const path=[module,...(window&&window!==module?[window]:[]),...panels,name].join(' → ');
 const control=element.matches('input,select,textarea')?element:element.querySelector('input,select,textarea');
 const type=control?.getAttribute('type');
 const amount=element.matches('.gp-pos-account-link')?element.textContent?.match(/\$[\d,.]+/)?.[0]:undefined;
 const business=document.querySelector<HTMLElement>('[data-business-name]')?.dataset.businessName||'this business';
 const accountHelp=amount&&known?.name==='Balance Owed'?`This customer owes ${business} ${amount}. View and manage this balance in Customer Profile → Account → Balance Owed.`:amount&&known?.name==='Customer Credit'?`This customer has ${amount} available as Customer Credit with ${business}. View it in Customer Profile → Account → Customer Credit.`:undefined;
 const help=accountHelp||known?.help||control?.getAttribute('title')||element.getAttribute('title')||(
  type==='email'?'Enter the email address used to contact this person or business.':
  type==='tel'?'Enter the contact telephone number, including an area code.':
  type==='date'?'Choose the calendar date for this field.':
  type==='time'?'Choose the time of day for this field.':
  /password|pin/i.test(name)?'Authorization information. Keep it private and use the controls in this form to change it.':
  /price|amount|balance|credit|tax|cost/i.test(name)?'The monetary value for this field. Check the currency and any percentage sign before changing it.':
  /minutes|duration/i.test(name)?'The amount of time, in minutes, used for this part of the work.':
  /weight/i.test(name)?'The pet’s recorded weight. Check the displayed unit before entering a value.':
  /breed/i.test(name)?'The pet’s breed information used by the business when selecting appropriate services.':
  /veterinarian/i.test(name)?'The veterinarian or clinic caring for this pet.':
  /status/i.test(name)?'The current stage of the record. In Settings → Calendar & Workflow → Appointment Appearance, Status instead selects the stage whose colors you are editing.':
  /service type/i.test(name)?'The service classification, such as GR, FW or FFT, used to identify the kind of grooming service.':
  /name/i.test(name)?'The name identifying this person, pet or item in the current form.':
  control?.tagName==='SELECT'?'Choose one of the available values for this field. The available choices are shown in its menu.':
  type==='checkbox'?'This is an on/off choice. A check means the labeled option is selected.':
  control?.tagName==='TEXTAREA'?'Enter the information requested by this field. Its name and location below identify where to find it again.':
  'This field records the information named above. Use the location below to find it again.');
 return {name:known?.name||name,aliases:[name,...(known?.aliases||[])],path:known?.path||path,help,element,module};
}
export function discoverFields(){
 const seen=new Set<string>();
 return [...document.querySelectorAll<HTMLElement>('label,.gp-label,input[aria-label],select[aria-label],textarea[aria-label]')]
 .filter(e=>!e.closest('.gp-whiteboard,.gp-action-pin,.gp-help-popup,.gp-nav-context,[aria-label="Search"],[aria-label="Reorder tabs"]'))
 .flatMap(e=>{const field=describeField(e);if(!field)return [];const key=field.path;if(seen.has(key))return [];seen.add(key);return [field]});
}
export function revealField(element:HTMLElement){
 for(let parent:HTMLElement|null=element;parent;parent=parent.parentElement){
  if(parent instanceof HTMLDetailsElement)parent.open=true;
  if(parent.hidden&&parent.getAttribute('aria-labelledby'))document.getElementById(parent.getAttribute('aria-labelledby')!)?.click();
 }
 requestAnimationFrame(()=>{element.scrollIntoView({block:'nearest'});element.classList.add('gp-search-highlight');setTimeout(()=>element.classList.remove('gp-search-highlight'),5000)});
}
