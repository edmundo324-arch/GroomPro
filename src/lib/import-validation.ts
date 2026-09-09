import { CUSTOMER_IMPORT_FIELDS, type ImportFieldKey } from "@/src/lib/import-fields";

export function validateImportMapping(mapping: Record<string, string>) {
  const allowed = new Set(Object.keys(CUSTOMER_IMPORT_FIELDS));
  const used = new Set<string>();
  const errors: string[] = [];

  for (const [sourceHeader, destination] of Object.entries(mapping)) {
    if (!sourceHeader.trim() || !destination) continue;
    if (!allowed.has(destination)) errors.push(`"${sourceHeader}" maps to an unknown GroomPro field.`);
    if (used.has(destination)) errors.push(`The GroomPro field "${destination}" is mapped more than once.`);
    used.add(destination);
  }

  const keys = Object.values(mapping).filter(Boolean) as ImportFieldKey[];
  if (!keys.includes("firstName") && !keys.includes("lastName")) errors.push("A First Name or Last Name field is required.");
  if (!keys.includes("phone") && !keys.includes("email")) errors.push("A Phone or Email field is required.");
  return errors;
}

export function getUnmappedHeaders(headers: string[], mapping: Record<string, string>) {
  return headers.filter(header => !mapping[header]);
}

export function isSourceHeaderUnknown(header: string, mapping: Record<string, string>) {
  return !mapping[header];
}
