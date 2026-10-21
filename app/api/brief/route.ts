import { assertAccess } from "@/lib/access";
import { generateBrief, requireApiKey } from "@/lib/claude";
import { checkBrief } from "@/lib/grounding";
import { errorResponse, HttpError, readJson } from "@/lib/http";
import { scanStore } from "@/lib/scan";
import type { BriefResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Write one store's brief. The server scans the store again instead of trusting
 * scan data from the browser, so the fact check always runs against what the
 * site actually serves.
 */
export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    assertAccess(body.accessCode);
    requireApiKey();
    const url = typeof body.url === "string" ? body.url.trim().slice(0, 300) : "";
    if (!url) throw new HttpError(400, "Add a store address.");

    const internals = await scanStore(url);
    const { brief, stats } = await generateBrief(internals);
    const result: BriefResult = { scan: internals.scan, brief, check: checkBrief(brief, internals), stats };
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
