import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(nodeScrypt);
const KEY_LENGTH = 64;

export async function hashPin(pin: string): Promise<string> {
  validatePin(pin);
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(pin, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export function hasUsablePinHash(value:unknown):value is string { return typeof value==='string' && /^[a-f0-9]{32}:[a-f0-9]{128}$/i.test(value); }

export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  if (!/^\d{3,10}$/.test(pin)||!hasUsablePinHash(storedHash)) return false;
  const [salt, stored] = storedHash.split(":");
  if (!salt || !stored) return false;
  const expected = Buffer.from(stored, "hex");
  const derived = (await scrypt(pin, salt, KEY_LENGTH)) as Buffer;
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

function validatePin(pin: string) {
  if (!/^\d{3,10}$/.test(pin)) {
    throw new Error("Employee PIN must contain 3 to 10 digits.");
  }
}

// Prefixes use independent salted, slow hashes, never plaintext or fast digests.
export async function hashPinPrefixes(pin: string): Promise<string[]> {
  validatePin(pin);
  const result: string[] = [];
  for (let length = 3; length < pin.length; length++) result.push(await hashPin(pin.slice(0, length)));
  return result;
}

export async function pinAssignmentError(pin: string, users: {pinHash: string; pinPrefixHashes: unknown}[]): Promise<string | null> {
  if (!/^\d{6,10}$/.test(pin)) return 'PIN needs attention. Enter 6 to 10 digits.';
  const prefix = pin.slice(0, 6);
  for (const user of users) {
    if (!hasUsablePinHash(user.pinHash)) continue;
    const prefixes = Array.isArray(user.pinPrefixHashes) ? user.pinPrefixHashes : [];
    for (const hash of [user.pinHash, ...prefixes]) {
      if (await verifyPin(prefix, hash)) return 'PIN needs attention. Choose a different first six digits.';
    }
    if (pin !== prefix && await verifyPin(pin, user.pinHash)) return 'PIN needs attention. Choose a different first six digits.';
  }
  return null;
}
