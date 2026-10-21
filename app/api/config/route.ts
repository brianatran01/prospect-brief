import { requiresAccessCode } from "@/lib/access";
import { modelSettings } from "@/lib/claude";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** What the page needs to know about this deployment. Never returns secrets. */
export async function GET() {
  const { model, effort } = modelSettings();
  return Response.json({
    model,
    effort,
    requiresAccessCode: requiresAccessCode(),
    hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
  });
}
