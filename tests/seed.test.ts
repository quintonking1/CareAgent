import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, schema } from "@/db";
import { seedDemo } from "@/db/seed";

describe("seedDemo", () => {
  const db = createDb(":memory:");
  const { profileId } = seedDemo(db);

  it("creates the three-person care circle with the right roles", () => {
    const roles = db.select().from(schema.memberships).where(eq(schema.memberships.careProfileId, profileId)).all()
      .map((m) => m.role).sort();
    expect(roles).toEqual(["co_caregiver", "parent", "primary_caregiver"]);
  });

  it("seeds a PCP and a cardiologist", () => {
    const specialties = db.select().from(schema.providers).all().map((p) => p.specialty);
    expect(specialties).toEqual(["Primary Care", "Cardiology"]);
  });

  it("seeds 30 days of wearable history", () => {
    const days = new Set(db.select().from(schema.readings).all().map((r) => r.recordedAt.slice(0, 10)));
    expect(days.size).toBe(30);
  });

  it("is idempotent", () => {
    seedDemo(db);
    expect(db.select().from(schema.careProfiles).all()).toHaveLength(1);
  });
});
