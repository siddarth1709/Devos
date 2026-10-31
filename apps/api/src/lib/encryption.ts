import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const DEFAULT_KEY = "devos-master-encryption-key-32b!";

function getKey(secret?: string): Buffer {
  const source = secret || process.env.APP_SECRET || DEFAULT_KEY;
  return crypto.createHash("sha256").update(source).digest();
}

export function encrypt(text: string, secret?: string): string {
  const iv = crypto.randomBytes(12);
  const key = getKey(secret);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decrypt(cipherText: string, secret?: string): string {
  const parts = cipherText.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid cipher format");
  }
  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex!, "hex");
  const authTag = Buffer.from(authTagHex!, "hex");
  const key = getKey(secret);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedHex!, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

