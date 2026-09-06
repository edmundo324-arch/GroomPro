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
  if (!/^\d{4,10}$/.test(pin)) return false;
  const [salt, stored] = storedHash.split(":");
  if (!salt || !stored) return false;
  const expected = Buffer.from(stored, "hex");
  const derived = (await scrypt(pin, salt, KEY_LENGTH)) as Buffer;
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

function validatePin(pin: string) {
  if (!/^\d{4,10}$/.test(pin)) {
    throw new Error("Employee PIN must contain 4 to 10 digits.");
  }
}
