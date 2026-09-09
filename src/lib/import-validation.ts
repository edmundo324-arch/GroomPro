import { CUSTOMER_IMPORT_FIELDS, type ImportFieldKey } from "@/src/lib/import-fields";

const allowed = new Set<ImportFieldKey>(Object.keys(CUSTOMER_IMPORT_FIELDS) as ImportFieldKey[]);

export function validateImportMapping(mapping: Record<string, string>) {
  const used = new Set<string>();
  const errors: string[] = [];
  for (const [sourceHeader, destination] of Object.entries(mapping)) {
    const source = sourceHeader.trim();
    const target = destination.trim();
    if (!source || !target) continue;
    if (!allowed.has(target as ImportFieldKey)) {
      errors.push(`"${sourceHeader}" maps to an unknown GroomPro field.`);
      continue;
    }
    if (used.has(target)) errors.push(`The GroomPro field "${CUSTOMER_IMPORT_FIELDS[target as ImportFieldKey].label}" is mapped more than once.`);
    used.add(target);
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
