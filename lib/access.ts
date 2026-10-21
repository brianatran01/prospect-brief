import { createHash, timingSafeEqual } from "node:crypto";
import { HttpError } from "./http";

/**
 * Optional gate for public deployments. When DEMO_ACCESS_CODE is set, visitors
 * must enter it before the app reads sites or calls Claude on your API key.
 */
export function requiresAccessCode(): boolean {
  return Boolean(process.env.DEMO_ACCESS_CODE);
}

export function assertAccess(code: unknown): void {
  const expected = process.env.DEMO_ACCESS_CODE;
  if (!expected) return;
  const given = typeof code === "string" ? code : "";
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  if (!timingSafeEqual(a, b)) {
    throw new HttpError(401, "Enter the demo access code to use this deployment.");
  }
}
