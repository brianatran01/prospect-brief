import { assertAccess } from "@/lib/access";
import { errorResponse, HttpError, readJson } from "@/lib/http";
import { scanStore } from "@/lib/scan";

export const runtime = "nodejs";
// One homepage and one catalog request, each with a 10-second timeout, run in parallel.
export const maxDuration = 30;

/** Scan one store. The page calls this once per store, a few at a time, so rows fill in as they finish. */
export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    assertAccess(body.accessCode);
    const url = typeof body.url === "string" ? body.url.trim().slice(0, 300) : "";
    if (!url) throw new HttpError(400, "Add a store address.");
    const { scan } = await scanStore(url);
    return Response.json(scan);
  } catch (err) {
    return errorResponse(err);
  }
}
