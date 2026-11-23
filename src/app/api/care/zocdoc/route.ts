import { getDb } from "@/db";
import { book, getAvailability, getProvider, ZocdocPartnerError, type ZdBookingRequest } from "@/fakes/zocdoc-partner";
import { getCurrentProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

// Fake Zocdoc Partner API. GET ?provider_id= returns availability; POST books and returns an appointment_id.
export async function GET(req: Request) {
  const providerId = new URL(req.url).searchParams.get("provider_id") ?? "zd_cardio_001";
  try {
    const profile = getCurrentProfile(getDb());
    return Response.json({ provider: getProvider(providerId), availability: getAvailability(providerId, profile.insurancePlan) });
  } catch (e) {
    if (e instanceof ZocdocPartnerError) return Response.json({ error: e.message }, { status: 404 });
    throw e;
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as Pick<ZdBookingRequest, "provider_id" | "start_time" | "visit_type">;
  const profile = getCurrentProfile(getDb());
  const [first_name, ...rest] = profile.parentName.split(" ");
  try {
    const booking = book({
      provider_id: body.provider_id, start_time: body.start_time, visit_type: body.visit_type ?? "in_person",
      patient: { first_name, last_name: rest.join(" "), date_of_birth: profile.dob },
      insurance: { plan: profile.insurancePlan },
    });
    return Response.json(booking);
  } catch (e) {
    if (e instanceof ZocdocPartnerError) return Response.json({ error: e.message }, { status: 409 });
    throw e;
  }
}
