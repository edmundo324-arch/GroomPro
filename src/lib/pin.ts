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

export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  if (!/^\d{3,10}$/.test(pin)) return false;
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
  validatePin(pin);
  if (users.some(user => !Array.isArray(user.pinPrefixHashes))) {
    return 'Existing employees must sign in once to finish the PIN security upgrade before another PIN can be assigned.';
  }
  for (const user of users) {
    for (let length = 3; length <= pin.length; length++) {
      if (await verifyPin(pin.slice(0, length), user.pinHash)) return 'Please choose a different starting number combination.';
    }
    for (const hash of user.pinPrefixHashes as string[]) {
      if (await verifyPin(pin, hash)) return 'Please choose a different starting number combination.';
    }
  }
  return null;
}
