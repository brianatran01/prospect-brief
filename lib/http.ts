/** An error whose message is safe and useful to show in the UI. */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return Response.json(
    { error: "Something went wrong on the server. Check the terminal or your Vercel logs." },
    { status: 500 },
  );
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await req.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // Fall through to the error below.
  }
  throw new HttpError(400, "The request body must be a JSON object.");
}
