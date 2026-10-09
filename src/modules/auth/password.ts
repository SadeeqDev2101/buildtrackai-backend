import crypto from "crypto";

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .scryptSync(password, salt, KEY_LENGTH)
    .toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, originalHash] = storedHash.split(":");
  if (!salt || !originalHash) return false;

  const hashedBuffer = crypto.scryptSync(password, salt, KEY_LENGTH);
  const originalBuffer = Buffer.from(originalHash, "hex");

  if (hashedBuffer.length !== originalBuffer.length) return false;
  return crypto.timingSafeEqual(hashedBuffer, originalBuffer);
}
