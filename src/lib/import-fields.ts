export type ImportFieldKey =
  | "firstName" | "lastName" | "email" | "phone" | "address1" | "address2" | "city" | "state" | "postalCode"
  | "dog1Name" | "dog1Breed" | "dog2Name" | "dog2Breed" | "dog3Name" | "dog3Breed" | "dog4Name" | "dog4Breed" | "dog5Name" | "dog5Breed";

export const CUSTOMER_IMPORT_FIELDS: Record<ImportFieldKey, { label: string; description: string }> = {
  firstName: { label: "First Name", description: "Customer's first name." },
  lastName: { label: "Last Name", description: "Customer's last name." },
  email: { label: "Email", description: "Customer's email address." },
  phone: { label: "Phone", description: "Customer's primary phone number." },
  address1: { label: "Address", description: "Customer's street address." },
  address2: { label: "Address 2", description: "Apartment, suite, unit, or additional address information." },
  city: { label: "City", description: "Customer's city." },
  state: { label: "State", description: "Customer's state or province." },
  postalCode: { label: "ZIP / Postal Code", description: "Customer's ZIP or postal code." },
  dog1Name: { label: "1st Dog", description: "Name of the customer's first dog." },
  dog1Breed: { label: "1st Dog Breed", description: "Breed of the customer's first dog." },
  dog2Name: { label: "2nd Dog", description: "Name of the customer's second dog." },
  dog2Breed: { label: "2nd Dog Breed", description: "Breed of the customer's second dog." },
  dog3Name: { label: "3rd Dog", description: "Name of the customer's third dog." },
  dog3Breed: { label: "3rd Dog Breed", description: "Breed of the customer's third dog." },
  dog4Name: { label: "4th Dog", description: "Name of the customer's fourth dog." },
  dog4Breed: { label: "4th Dog Breed", description: "Breed of the customer's fourth dog." },
  dog5Name: { label: "5th Dog", description: "Name of the customer's fifth dog." },
  dog5Breed: { label: "5th Dog Breed", description: "Breed of the customer's fifth dog." },
};

// External column headers are never database field names. They are mapped into this
// canonical dictionary before anything is written to GroomPro.
export const IMPORT_FIELD_LABELS = Object.fromEntries(
  Object.entries(CUSTOMER_IMPORT_FIELDS).map(([key, value]) => [key, value.label]),
) as Record<ImportFieldKey, string>;
