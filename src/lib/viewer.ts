import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import * as s from "@/db/schema";

export const VIEWER_COOKIE = "careagent_viewer";

// Who is using the app. The prototype has no login; the sidebar switcher sets a cookie.
export async function getViewer(db: Db, careProfileId: number) {
  const members = db.select({ id: s.users.id, name: s.users.name, role: s.memberships.role })
    .from(s.memberships).innerJoin(s.users, eq(s.users.id, s.memberships.userId))
    .where(eq(s.memberships.careProfileId, careProfileId)).all();
  const wanted = Number((await cookies()).get(VIEWER_COOKIE)?.value);
  const viewer = members.find((m) => m.id === wanted) ?? members.find((m) => m.role === "primary_caregiver") ?? members[0];
  return { viewer, members };
}
