import { randomBytes, createHash } from "crypto";

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function getTokenLookupValues(token: string): string[] {
  const hashed = hashToken(token);
  return hashed === token ? [token] : [hashed, token];
}
