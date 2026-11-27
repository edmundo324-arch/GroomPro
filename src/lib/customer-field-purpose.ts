import {fieldLabel} from './field-discovery';
export const customerFieldPurposes:Record<string,string>={
 'First name':'Use the first name the shop knows you by so the team can recognize your family.',
 'Last name':'Enter your last name to help the shop identify the correct family.',
 'Email':'Use the email where you want the shop to send updates and your signed agreement copies.',
 'Street address':'Include your house or building number and street name.',
 'Apartment or suite':'Add the apartment, suite or unit number when your address has one.',
 'City':'Enter the city for your address.',
 'State':'Enter the state or province for your address.',
 'ZIP code':'Enter the ZIP or postal code for your address.',
 'Additional phone':'Add another number the shop can use to reach your family.',
 'Third phone':'Add another family contact number if the shop needs one.',
 'Mobile phone':'Use the mobile number your family gives the shop so the form can find the right customer profile.',
 'Verification code':'Enter the code sent to your phone to open your saved details.',
 'Printed name':'Enter your full name as the person signing this agreement.',
 'Add a dog':'Enter the name of another dog in your family whose information you want to add.',
 'Waitlist through date':'Choose the latest date that would work for your visit. The shop will review suitable openings; joining the waitlist does not reserve an appointment.',
 'Waitlist notes':'Tell the shop about timing preferences or anything else that helps them offer a suitable opening.',
 'Mobile number':'Use your mobile number to find your profile and receive a sign-in text code.',
 'Text code':'Enter the code from the shop’s sign-in text. Request a new code if it has expired.',
 'Phone number':'Use the phone number your family gives the shop so your details stay on the same customer profile.',
 'Dog name':'Use the name your dog responds to so the team can greet them comfortably.',
 'Breed':'Enter your dog’s breed or mix as you know it. Ask the shop if you are unsure.',
 'Weight (lb)':'Enter your dog’s current weight in pounds to help the shop prepare for their visit.',
 'Color':'Describe your dog’s coat color to help the team recognize them.',
 'Special grooming instructions':'Tell the shop how you would like your dog groomed and anything you want the groomer to discuss with you.',
 'Medical conditions':'Tell the shop about known conditions or care needs that could affect your dog’s grooming visit.',
 'Special behaviors':'Share anything that helps the team handle your dog comfortably, such as sensitivity around their paws or fear of the dryer.',
 'Veterinarian':'Provide your dog’s veterinarian or clinic so the shop has the correct contact information.',
 'Preferred date':'Choose the day you would like to visit. Check available times before sending your booking.',
 'Available time':'Choose one of the offered openings for your selected services. Follow the booking confirmation shown after you submit.',
 'Message to the shop':'Tell the team what you would like to change or what they should know about this request.',
 'I understand the fee and that the shop must review my request.':'Read the cancellation notice and fee shown above before acknowledging it. The booking stays in place while the shop reviews your request.',
 'I acknowledge this section':'Read this section and watch its video, if included, before acknowledging that you have reviewed it.',
 'I adopt this signature and agree to the terms above':'Review the agreement and the name you entered before choosing this. Submit only when you are ready to sign.',
 'Clock time':'Choose when you would like this reminder to arrive, using the shop’s time zone.',
 'Add dog photo':'Choose a clear photo of your dog to help the team recognize them.',
 'Replace dog photo':'Choose the photo you would like the shop to keep on your dog’s profile instead of the current one.',
 'How did you hear about us? Include the referrer’s name if applicable.':'Tell us how you found the shop. If a friend referred you, include their name so the team can recognize the referral.'
};
export function describeCustomerField(element:HTMLElement){
 const name=fieldLabel(element);if(!name||name.length>150)return null;
 const control=element.matches('input,select,textarea')?element:element.querySelector('input,select,textarea');
 const help=element.dataset.customerHelp||control?.getAttribute('data-customer-help')||customerFieldPurposes[name];
 if(!help)return null;
 return {name,aliases:[name],relatedPath:'',path:'',help,element,module:'Customer form'};
}
