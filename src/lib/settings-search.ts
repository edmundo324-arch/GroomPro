export type SettingsSearchEntry = {
  path: string[];
  title: string;
  description: string;
  keywords: string;
  access?: 'admin' | 'manager' | 'platform';
  anchor?: string;
  steps?: string[];
};

export const preparedImportLabels = {
  heading: 'Prepared data from the local site',
  scope: 'Load',
  addresses: 'Demo customer addresses only',
  check: 'Check prepared data',
  load: 'Load prepared data',
  upload: 'Choose Related Files',
};

const sections: Record<string, [label: string, description: string, keywords: string]> = {
  'visual-layouts': ['Visual module settings', 'Preview and customize how GroomPro screens are arranged and labeled.', 'layout labels colors preview'],
  workflow: ['Calendar & workflow', 'Find appointment appearance, booking rules, and ticket layout.', 'calendar appointment workflow'],
  'workflow/appearance': ['Appointment appearance', 'Choose Calendar appointment colors, text, borders, and gradients.', 'status service colors contrast factory reset'],
  'workflow/popup': ['Popup content', 'Choose the details shown in a Calendar appointment preview and put them in order.', 'hover popup pet weight breed VIP preview'],
  'workflow/ticket-layout': ['POS ticket layout', 'Arrange the existing ticket controls and tabs for desktop and phone.', 'ticket tabs mobile placement'],
  'workflow/profiles': ['Customer / Pet profiles', 'Choose whether Show Inactive starts checked for pets.', 'inactive pets visibility'],
  'workflow/booking': ['Booking rules', 'Set appointment timing and nearby appointment warnings.', 'same time add up time rebook scheduling warning'],
  'workflow/calendar-preferences': ['Calendar lanes and devices', 'Set lane order and how employee column widths are remembered.', 'column width fit all 100 pixels unassigned'],
  'workflow/business-hours-rule': ['Business hours rule', 'Choose whether appointments must start during business hours.', 'outside business hours warning opening closing'],
  'workflow/whiteboard': ['Whiteboard', 'Choose whether the bather also handles prep or drying.', 'prep bath dry assignment'],
  'workflow/authorization': ['PIN & approvals', 'Choose when employee PINs and commission approvals are required.', 'security permissions inactivity second PIN'],
  'workflow/billing': ['VIP billing', 'Choose which weekly or monthly billing dates are offered when enrolling a dog.', 'membership billing weekday'],
  locations: ['Locations & hours', 'Find business locations, hours, and customer sharing.', 'shop address schedule holiday'],
  'locations/hours': ['Operating hours', 'Set business hours for the selected location.', 'open close opening closing holiday schedule'],
  'locations/locations': ['Locations', 'Choose or add a business location.', 'store address add location'],
  'locations/sharing': ['Customer sharing', 'Choose how customer records are shared between locations.', 'client location access'],
  pricing: ['Pricing', 'Adjust base service and package prices or set a price rule for a location.', 'rates bulk price markup discount'],
  breeds: ['Breeds', 'Manage breed records and their grooming defaults.', 'breed dog default package'],
  categories: ['Service categories', 'Manage categories used for services and employee qualifications.', 'job title employee categories'],
  rewards: ['Rewards', 'Manage referral credit and customer rewards.', 'loyalty referral credit dollars points'],
  communications: ['Communications', 'Manage the HeyRosie connection and its settings.', 'rosie phone integration'],
  data: ['Data & integrations', 'Find file imports, the 123Pet connection, and the starter library.', 'migration data upload'],
  'data/imports': ['Import & migration', 'Stage and review files or open the prepared data loader.', 'data migration files'],
  'data/123pet': ['123Pet connection', 'Configure the connection between GroomPro and 123Pet.', 'daysmart connector sync'],
  'data/library': ['Starter library', 'Browse available starter packages.', 'catalog starter grooming package'],
  administration: ['Access & subscription', 'Find business access settings and subscription plans.', 'roles permissions plans'],
  'administration/access': ['Platform access', 'View feature availability and manage role access.', 'security administrator developer permissions'],
  'administration/subscription': ['Subscription', 'View plans and included features. Developers and Owners can configure plans.', 'upgrade plan pricing texting calling'],
};

const businessOnly = new Set(['ticket-layout', 'profiles', 'booking', 'calendar-preferences', 'business-hours-rule', 'whiteboard', 'authorization', 'billing']);
const importPath = ['data', 'imports'];
export const settingsSearchEntries: SettingsSearchEntry[] = [
  {
    path: importPath, title: 'Upload customer, pet, or appointment files',
    description: 'Stage a file for review before importing. This upload uses your private import secret.',
    keywords: 'import customers upload CSV Excel XLSX move from 123Pet choose related files client list pet appointment',
    access: 'manager', anchor: 'import-files', steps: [preparedImportLabels.upload],
  },
  {
    path: importPath, title: preparedImportLabels.addresses,
    description: 'Fill completely blank demo addresses after a successful check.',
    keywords: 'prepared data demo customer addresses test customers check prepared data load prepared data',
    access: 'admin', anchor: 'prepared-data-scope',
    steps: [preparedImportLabels.heading, preparedImportLabels.scope + ' → ' + preparedImportLabels.addresses, preparedImportLabels.check, preparedImportLabels.load],
  },
  ...Object.entries(sections).map(([key, [title, description, keywords]]): SettingsSearchEntry => {
    const path = key.split('/');
    const access = key === 'data/123pet' ? 'platform' : key === 'data/imports' ? 'manager' : businessOnly.has(path[1]) && path[0] === 'workflow' ? 'admin' : undefined;
    return { path, title, description, keywords, access };
  }),
];

export function settingsBreadcrumb(entry: SettingsSearchEntry) {
  return ['Settings', ...entry.path.map((_, index) => sections[entry.path.slice(0, index + 1).join('/')][0]), ...(entry.steps || [])].join(' → ');
}

const terms = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function findSettings(query: string, role?: string) {
  const normalized = terms(query);
  if (!normalized) return [];
  const platform = role === 'PLATFORM_OWNER' || role === 'DEVELOPER';
  const admin = platform || role === 'ADMIN';
  return settingsSearchEntries.flatMap(entry => {
    if (role && entry.access && !(entry.access === 'platform' ? platform : admin || entry.access === 'manager' && role === 'MANAGER')) return [];
    const title = terms(entry.title), keywords = terms(entry.keywords);
    const haystack = [title, keywords, terms(entry.description), terms(settingsBreadcrumb(entry))].join(' ');
    if (!normalized.split(' ').every(word => haystack.includes(word))) return [];
    const score = (title === normalized ? 8 : 0) + (title.includes(normalized) ? 4 : 0) + (keywords.includes(normalized) ? 2 : 0) + entry.path.length;
    return [{ entry, score }];
  }).sort((a, b) => b.score - a.score).slice(0, 7).map(({ entry }) => entry);
}
