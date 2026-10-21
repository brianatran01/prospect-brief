import { HttpError } from "./http";

/**
 * True for addresses that point at the server's own machine or a private network.
 * The brand loader fetches whatever URL a visitor types, so without this check it
 * could be used to probe internal services (server-side request forgery).
 * Note: this checks the hostname as written; it doesn't defend against DNS rebinding.
 */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".lan")) return true;

  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }

  if (host.includes(":")) {
    if (host === "::" || host === "::1") return true;
    if (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) return true;
    if (host.startsWith("::ffff:")) return true;
    return false;
  }

  // Single-label names like "intranet" only resolve inside private networks.
  return !host.includes(".");
}

export function assertPublicUrl(url: URL): void {
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new HttpError(400, "Use a web address that starts with http or https.");
  }
  if (url.username || url.password) {
    throw new HttpError(400, "Remove the username and password from the address.");
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new HttpError(400, "Use the site's normal address, without a port number.");
  }
  if (isPrivateHost(url.hostname)) {
    throw new HttpError(400, "That address points to a private network, so it can't be loaded.");
  }
}

/** Accept "gratsi.com" or a full URL and return a checked, public URL. */
export function normalizeStoreUrl(input: string): URL {
  const trimmed = input.trim();
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new HttpError(400, "That doesn't look like a web address. Try something like brand.com.");
  }
  assertPublicUrl(url);
  return url;
}
