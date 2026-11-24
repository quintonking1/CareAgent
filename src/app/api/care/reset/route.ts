import { getDb } from "@/db";
import { seedHomeDemo } from "@/db/seed";

export const dynamic = "force-dynamic";

// Demo only: wipes the database and fake-service state and reseeds the home demo.
export async function POST() {
  seedHomeDemo(getDb());
  return Response.json({ ok: true });
}
