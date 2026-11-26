export const businessChoices = [
  ['salon', 'Grooming Salon'], ['mobile', 'Mobile Grooming'], ['selfService', 'Self-Service Wash'],
] as const;
export const teamChoices = [['solo', 'Just Me'], ['small', '2–5 People'], ['medium', '6–15 People'], ['large', '16 or More People']] as const;
export const recordChoices = [['software', 'Business Software'], ['paper', 'Paper / Appointment Book'], ['spreadsheets', 'Spreadsheets'], ['starting', 'Starting a New Business']] as const;
export const bookingChoices = [['phone', 'Phone Calls'], ['text', 'Texts / Messages'], ['online', 'Online Booking'], ['checkout', 'Booking the Next Visit at Checkout'], ['walkin', 'Walk-Ins']] as const;
export const serviceChoices = [['grooming', 'Grooming / Haircuts'], ['wash', 'Full Wash / Bath'], ['selfService', 'Self-Service Wash'], ['addons', 'Add-On Services'], ['retail', 'Retail Products'], ['prepaid', 'PrePaid Packages'], ['vip', 'VIP Memberships']] as const;
export const goalChoices = [['booking', 'Organize Appointments'], ['notes', 'Keep Pet Notes Clear'], ['team', 'Coordinate My Team'], ['checkout', 'Simplify Checkout & Tips'], ['messages', 'Keep Customers Informed'], ['returns', 'Encourage Return Visits'], ['inventory', 'Manage Products'], ['reports', 'Understand Business Results']] as const;
type Choice = readonly (readonly [string, string])[];
export type SalesAnswers = {business: string[]; team: string; records: string[]; software: string; bookings: string[]; services: string[]; goals: string[]};
export const emptySalesAnswers: SalesAnswers = {business: [], team: '', records: [], software: '', bookings: [], services: [], goals: []};
export const questionnaireStorageKey = 'groompro:sales-questionnaire:v1';
const selected = (value: unknown, choices: Choice) => Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === 'string' && choices.some(([id]) => id === v)))] : [];
export function normalizeSalesAnswers(value: unknown): SalesAnswers {
  const row = value && typeof value === 'object' ? value as Partial<SalesAnswers> : {};
  return {business: selected(row.business, businessChoices), team: teamChoices.some(([id]) => id === row.team) ? row.team! : '', records: selected(row.records, recordChoices), software: typeof row.software === 'string' ? row.software.trim().slice(0, 100) : '', bookings: selected(row.bookings, bookingChoices), services: selected(row.services, serviceChoices), goals: selected(row.goals, goalChoices).slice(0, 3)};
}
export function questionError(answers: SalesAnswers, step: number): string {
  if (step === 0 && (!answers.business.length || !answers.team)) return 'Choose your business type and team size to continue.';
  if (step === 1 && (!answers.records.length || !answers.bookings.length)) return 'Choose how you keep records and how customers book. You can select more than one.';
  if (step === 2 && !answers.services.length) return 'Choose at least one service you offer or plan to offer.';
  if (step === 3 && (!answers.goals.length || answers.goals.length > 3)) return 'Choose one to three things you would most like to improve.';
  return '';
}
export type TourTopic = {id: string; title: string; sales: string; training: string[]; reason: string};
const topics: Record<string, Omit<TourTopic, 'reason'>> = {
  booking: {id: 'booking', title: 'A Clearer Appointment Calendar', sales: 'See how appointments, family dogs and assigned employees come together.', training: ['Create an appointment for one dog or a family.', 'Review the assigned employee and appointment time.', 'Move or rebook a visit using the existing scheduling checks.']},
  notes: {id: 'notes', title: 'Know the Dog Before You Begin', sales: 'Keep pet details, permanent notes and today’s grooming requests close at hand.', training: ['Find the customer and their dogs.', 'Review permanent notes and warnings.', 'Keep today’s grooming instructions separate from permanent notes.']},
  team: {id: 'team', title: 'Keep the Team on the Same Page', sales: 'Connect staff schedules, planned assignments and the employees doing each service.', training: ['Review staff working hours.', 'Assign the appointment’s grooming or bathing work.', 'Check the employees recorded on the ticket before distributing tips.']},
  checkout: {id: 'checkout', title: 'Bring the Ticket Together', sales: 'Review services, products, tax and tips in one ticket.', training: ['Review the services and products on the ticket.', 'Enter the tip and review its distribution.', 'Record payment and close a fully paid ticket.']},
  messages: {id: 'messages', title: 'Keep Families Informed', sales: 'Use editable reminders and pickup messages with your business’s wording. Sending requires a connected text or email service.', training: ['Choose or edit a saved message.', 'Review the dog’s name and appointment details.', 'Check queued messages and communication history.']},
  returns: {id: 'returns', title: 'Make the Next Visit Easier', sales: 'Keep rebooking and return-visit offers part of the grooming day.', training: ['Book the family’s next visit.', 'Review the business’s rebooking offer rules.', 'Check the future appointment and assigned employee.']},
  packages: {id: 'packages', title: 'Services That Fit Your Business', sales: 'Organize grooming packages and self-service choices so the team can find what each dog needs.', training: ['Find a service or package by typing its name or description.', 'Review which services the package includes.', 'Check the dog’s package eligibility before adding it.']},
  prepaid: {id: 'prepaid', title: 'PrePaid Visits Made Clear', sales: 'Offer prepaid visits and keep the remaining visits visible.', training: ['Review what a PrePaid package covers.', 'Choose whether the package covers one dog or the family.', 'Apply an eligible visit and review the remaining visits after closing.']},
  vip: {id: 'vip', title: 'Recognize Your VIP Customers', sales: 'Keep membership details and eligible benefits connected to each customer.', training: ['Review the available membership.', 'Find the customer’s membership status.', 'Check which services and benefits apply.']},
  inventory: {id: 'inventory', title: 'Keep Track of Retail Products', sales: 'Connect products sold at checkout with the inventory you manage.', training: ['Find a product by name or description.', 'Review stock and product details.', 'Add a product to the customer’s ticket.']},
  reports: {id: 'reports', title: 'See How the Business Is Doing', sales: 'Review business results using the records your team already enters.', training: ['Choose a report and date range.', 'Review sales, appointments or employee productivity.', 'Use the report’s filters to focus on the results you need.']},
};
const trainingOrder = ['booking', 'notes', 'packages', 'team', 'messages', 'checkout', 'returns', 'prepaid', 'vip', 'inventory', 'reports'];
export function personalizedTour(value: unknown, mode: 'sales' | 'training'): TourTopic[] {
  const answers = normalizeSalesAnswers(value);
  const reasons = new Map<string, string>();
  const include = (id: string, reason: string) => {if (!reasons.has(id)) reasons.set(id, reason);};
  for (const goal of answers.goals) include(goal, 'You chose “' + goalChoices.find(([id]) => id === goal)![1] + '.”');
  include('booking', answers.business.includes('mobile') ? 'You run a mobile business and need a clear appointment day.' : answers.records.some(id => ['paper', 'spreadsheets'].includes(id)) ? 'You currently keep records on paper or in spreadsheets.' : answers.records.includes('starting') ? 'You are setting up the booking routine for a new business.' : 'Appointments are the starting point for your grooming day.');
  include('notes', 'Keep the right details for each dog close at hand.');
  include('checkout', 'Checkout brings the visit’s charges and tips together.');
  if (answers.team && answers.team !== 'solo') include('team', 'You have more than one person working in the business.');
  if (answers.services.some(id => ['grooming', 'wash', 'selfService'].includes(id)) || answers.business.includes('selfService')) include('packages', 'You selected grooming, wash or self-service work.');
  if (answers.bookings.some(id => ['phone', 'text'].includes(id))) include('messages', 'Customers contact you by phone or message.');
  if (answers.bookings.includes('checkout')) include('returns', 'You book the next visit at checkout.');
  for (const [service, topic, reason] of [['retail', 'inventory', 'You offer retail products.'], ['prepaid', 'prepaid', 'You offer PrePaid packages.'], ['vip', 'vip', 'You offer VIP memberships.']]) {
    if (answers.services.includes(service)) include(topic, reason);
  }
  const ids = mode === 'sales' ? [...reasons.keys()] : trainingOrder.filter(id => reasons.has(id));
  return ids.map(id => ({...topics[id], reason: reasons.get(id)!}));
}
