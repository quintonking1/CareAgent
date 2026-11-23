import { completeCheckout, rxDetails, WalgreensError, type RefillRequest } from "@/fakes/walgreens";

export const dynamic = "force-dynamic";

// Fake Walgreens Rx API. GET ?rx= returns demo-only details (price, refills left); POST refills by Rx number.
export async function GET(req: Request) {
  const rx = new URL(req.url).searchParams.get("rx") ?? "";
  try {
    return Response.json(rxDetails(rx));
  } catch (e) {
    if (e instanceof WalgreensError) return Response.json({ error: e.message }, { status: 404 });
    throw e;
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as RefillRequest;
  try {
    return Response.json(completeCheckout(body));
  } catch (e) {
    if (e instanceof WalgreensError) return Response.json({ error: e.message }, { status: 409 });
    throw e;
  }
}
