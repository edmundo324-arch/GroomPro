export type ProfileColumn = { key: string; label: string; type?: string };
export const customerColumns: ProfileColumn[] = [
  { key: 'name', label: 'Name' }, { key: 'email', label: 'Email' },
  { key: 'phones', label: 'Phones' }, { key: 'contacts', label: 'Contacts' },
  { key: 'pets', label: 'Pets' }, { key: 'balance', label: 'Balance' },
  { key: 'upcoming', label: 'Upcoming appointment' }, { key: 'sourceId', label: 'Source ID' },
  { key: 'address', label: 'Address' }, { key: 'referralSource', label: 'How they found us' },
  { key: 'referredBy', label: 'Referred by' },
];
export const petColumns: ProfileColumn[] = [
  { key: 'name', label: 'Name' }, { key: 'breed', label: 'Breed' },
  { key: 'customer', label: 'Owner' }, { key: 'vaccinations', label: 'Vaccinations' },
  { key: 'weightLbs', label: 'Weight', type: 'Decimal' },
  { key: 'active', label: 'Active', type: 'Boolean' },
];
export const customerDefaultColumns = ['name', 'email', 'phones', 'pets'];
export const petDefaultColumns = ['name', 'breed', 'customer'];

export function validProfileColumns(value: unknown, options: ProfileColumn[]): value is string[] {
  return Array.isArray(value) && value.every(key => options.some(column => column.key === key)) && new Set(value).size === value.length;
}
