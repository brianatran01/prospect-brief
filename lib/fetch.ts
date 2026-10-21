import { HttpError } from "./http";
import { assertPublicUrl } from "./safe-url";

/** Identify the tool honestly. Some stores block automated requests; the scan says so when they do. */
const USER_AGENT = "ProspectBrief/0.1 (portfolio demo; reads public pages only)";
const TIMEOUT_MS = 10_000;
const MAX_BYTES = 3_000_000;
const MAX_REDIRECTS = 4;

/** Fetch a public URL, re-checking every redirect so a public site can't bounce us to a private one. */
export async function fetchPublic(start: URL, accept: string): Promise<{ res: Response; url: URL }> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertPublicUrl(url);
    const res = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept },
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    return { res, url };
  }
  throw new HttpError(502, "The site redirected too many times.");
}

/** Read a response body, refusing anything absurdly large. */
export async function readCapped(res: Response): Promise<string> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BYTES) {
    throw new HttpError(502, "That page is too large to read.");
  }
  const text = await res.text();
  return text.length > MAX_BYTES ? text.slice(0, MAX_BYTES) : text;
}
