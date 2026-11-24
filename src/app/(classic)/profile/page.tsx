import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { DAY_MS, fmtDay, now } from "@/lib/clock";
import { getCurrentProfile } from "@/lib/profile";
import { MemberAvatar } from "@/components/app-sidebar";
import { Topbar } from "@/components/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const WEARABLE_NAMES = { apple_health: "Apple Watch (Apple Health)", whoop: "WHOOP" } as const;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 text-sm first:pt-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

export default function ProfilePage() {
  const db = getDb();
  const profile = getCurrentProfile(db);
  const age = Math.floor((now().getTime() - new Date(profile.dob).getTime()) / (365.25 * DAY_MS));
  const providers = db.select().from(schema.providers).where(eq(schema.providers.careProfileId, profile.id)).all();
  const members = db.select({ id: schema.users.id, name: schema.users.name, role: schema.memberships.role })
    .from(schema.memberships).innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(eq(schema.memberships.careProfileId, profile.id)).all();
  const consent = db.select().from(schema.consents).where(eq(schema.consents.careProfileId, profile.id)).get();
  const parent = members.find((m) => m.role === "parent");

  return (
    <div className="flex h-full flex-col">
      <Topbar title="Profile" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pb-8 pt-2 sm:px-6">
          <div className="flex flex-col items-center py-4">
            {parent && <MemberAvatar member={parent} className="size-20 text-2xl" />}
            <h2 className="mt-3 font-heading text-2xl">{profile.parentName}</h2>
            <p className="text-sm text-muted-foreground">{age} years old</p>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
            <CardContent className="divide-y">
              <Row label="Date of birth">{fmtDay(profile.dob)}, {profile.dob.slice(0, 4)}</Row>
              <Row label="Phone"><a href={`tel:${profile.parentPhone}`} className="underline-offset-4 hover:underline">{profile.parentPhone}</a></Row>
              <Row label="Address">{profile.address}</Row>
              <Row label="Allergies">{profile.allergies.join(", ") || "None recorded"}</Row>
              <Row label="Insurance">{profile.insurancePlan}</Row>
              <Row label="Pharmacy">{profile.pharmacy}</Row>
              <Row label="Wearable">{WEARABLE_NAMES[profile.wearableSource]}</Row>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Care team</CardTitle></CardHeader>
            <CardContent className="divide-y">
              {providers.map((p) => <Row key={p.id} label={p.specialty}>{p.name}</Row>)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Care circle</CardTitle></CardHeader>
            <CardContent className="divide-y">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <MemberAvatar member={m} />
                  <span className="flex-1 text-sm">{m.name}</span>
                  <span className="text-sm text-muted-foreground">{m.role.replace("_", " ")}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Consent</CardTitle></CardHeader>
            <CardContent className="text-sm">
              {consent && !consent.revokedAt ? (
                <>
                  <p>Shared since {fmtDay(consent.grantedAt)}: {consent.sharedData.join(", ").replaceAll("_", " ")}.</p>
                  <p className="mt-1 text-muted-foreground">
                    {consent.parentApprovalRequired ? `Bookings need ${profile.parentName.split(" ")[0]}'s approval.` : "Caregivers can approve bookings."}
                  </p>
                </>
              ) : (
                <p className="text-destructive">Consent revoked. Wearable data is hidden.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
