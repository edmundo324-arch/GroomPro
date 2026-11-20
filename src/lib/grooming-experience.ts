export const groomingExperienceFeature='SEVEN_STAGE_GROOMING';
export type CareStage={id:string;name:string;instructions:string;customerExplanation:string};
// Care pacing is separate from billable PREP/BATH/DRY/GROOM roles and booked time.
export const defaultCareStages:CareStage[]=[
 {id:'acclimation',name:'Acclimation Station',instructions:'Give the dog time to settle in, sniff and observe before demanding handling begins.',customerExplanation:'We give {pet} a little time to settle in and get comfortable before we begin.'},
 {id:'prep',name:'Pre-Bath Prep',instructions:'Read the Name Tag and notes first: name, haircut or service, added services, behavior and shampoo needs. Prepare tools before handling. Prep can include brushing, nails, appropriate ear care, a matting check with the groomer, authorized anal gland service and specialty shampoo preparation.',customerExplanation:'We review {pet}’s care instructions and prepare for the bath.'},
 {id:'chillax',name:'Chillax Time',instructions:'Give the dog time to settle after prep and before bathing. This is an intentional comfort and pacing stage.',customerExplanation:'{pet} gets a little Chillax Time between prep and the bath.'},
 {id:'bath',name:'Splash Zone',instructions:'Wet appropriately, shampoo thoroughly, clean the face carefully and rinse. Repeat as the coat needs. Follow the required process for deshedding, medicated or coat-specific treatments and the shop’s washing standard.',customerExplanation:'We bathe {pet} using the services and coat-care instructions agreed at check-in.'},
 {id:'dry',name:'Fluff ’n’ Puff',instructions:'Towel dry thoroughly, then dry appropriately for the dog and the shop’s approved process. Check paws, face, tail and other easily missed areas. Brush through after drying. Adjust technique, intensity, positioning and pacing to the dog’s comfort and behavior.',customerExplanation:'We dry and brush {pet}, adjusting the pace to their comfort.'},
 {id:'chillax2',name:'Chillax Time 2',instructions:'Give the dog another opportunity to decompress after bathing and drying, before finishing work.',customerExplanation:'{pet} gets another Chillax break before the finishing work.'},
 {id:'finish',name:'Hairdo Deluxe',instructions:'Read the notes again and follow the customer’s documented request. Complete body and paws carefully before the head; finish face, ears and tail as requested. For FFT or body-line work, fully dry and brush, complete sanitary areas, tidy under paws and finish the requested face, feet, tail and body line.',customerExplanation:'We finish {pet}’s look using the instructions recorded at check-in.'},
];
// Explicit business-specific standards; these are not universal tenant defaults.
export const rubberDoggiesCareInstructions={bath:'Wash until the water rinses clear. Use as many shampoo cycles as the coat needs to meet the Rubber Doggies standard; two or three may be needed. Continue when the coat feels oily or the rinse does not meet the standard. Follow each specialized treatment’s required process.',dry:'Towel dry thoroughly, then use appropriate hand-held drying or blowout. No kennel dryers. Check paws, face, tail and other easily missed areas. Brush through after drying and adapt technique, intensity, positioning and pacing to the dog.'};

export function careInstructions(input:unknown):CareStage[]{
 if(!Array.isArray(input)||input.length!==defaultCareStages.length)throw Error('Keep all seven stages and enter their care instructions.');
 return defaultCareStages.map((stage,index)=>{const item=input[index];if(item?.id!==stage.id||item.name!==stage.name)throw Error('The seven stage names and order stay unchanged.');
 const instructions=typeof item.instructions==='string'?item.instructions.trim():'',customerExplanation=typeof item.customerExplanation==='string'?item.customerExplanation.trim():'';
 if(!instructions||instructions.length>5000||!customerExplanation||customerExplanation.length>1200)throw Error('Enter care instructions up to 5,000 characters and a customer explanation up to 1,200 characters for each stage.');
 if([...customerExplanation.matchAll(/\{([^{}]+)\}/g)].some(m=>m[1]!=='pet'))throw Error('Use {pet} for the dog’s name in a customer explanation.');
 return {...stage,instructions,customerExplanation};});
}
