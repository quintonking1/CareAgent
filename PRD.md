# PRD: Caregiver Care Agent (working name: CareAgent)

Status: Draft v0.4 for class prototype (MVP = core loop + pre-visit brief; single agent; fake Zocdoc)
Owner: Quinton
Date: November 1, 2026
Companion doc: Caregiver Health Agent: Competitive Brief

---

## 1. Summary

CareAgent is an AI agent app for adult children who manage an aging parent's health from a distance. It reads the parent's existing wearable (Apple Watch, WHOOP), shows the caregiver a plain-language care overview with any alerts, and when an alert needs follow-up, the agent books an appointment with the parent's doctor through Zocdoc. Before the visit it drafts a one-page brief for the doctor. After the visit, it tracks new or changed prescriptions and handles refill follow-through.

Positioning: the care admin agent for families. For adult children managing a parent's health, CareAgent turns the parent's wearable signals into booked appointments and filled prescriptions. Unlike health assistants built around your own data, it acts on behalf of someone you care for, with their consent.

This PRD scopes a **working prototype** for an advanced product management class. Every outside service (wearables, Zocdoc, pharmacy, patient portal) is faked inside the app with seeded data. **Nothing calls a real external API**, so the full loop can be demoed end to end without real health data, partner approvals, or network access (other than the Claude API).

---

## 2. Problem

- 63 million US adults are family caregivers (AARP, 2025). Most also work, and half of working caregivers report disruptions like leaving early or arriving late.
- Caregiver apps today stop at the alert or the to-do. The caregiver still makes the calls, finds the time slot, and chases the refill.
- New health agents (Amazon Health AI, ChatGPT Health, Epic Emmie) can act, but they are designed for the user's own health and identity.
- The only service that acts for caregivers end to end (Wellthy) uses human coordinators and is available only through employers.

**Core insight:** the gap is the loop from signal to action, run on behalf of another adult.

---

## 3. Target user

**Primary: the caregiver ("Maya")**
- 35 to 55, employed, lives 1+ hours from her parent, often also raising kids.
- Wants to know "is Dad okay?" in 10 seconds and wants follow-ups handled without spending her lunch break on hold.

**Secondary: the parent ("Robert")**
- 70+, wears an Apple Watch or WHOOP, sees a long-time primary care doctor and one or two specialists.
- Wants independence and dignity. Must consent to sharing.

**Tertiary: a sibling / co-caregiver**
- View access, can approve actions.

---

## 4. Goals and non-goals

### Goals (prototype)
1. Demo the full core loop: wearable alert, triage summary, caregiver approves, agent books through (fake) Zocdoc, pre-visit brief drafted, visit summary entered, med list updated, refill requested.
2. Show the proxy model in its simplest form: caregiver, co-caregiver and parent roles, plus a parent consent record.
3. Keep a human approval step before any external action (booking, sending the brief, refill request).
4. Produce a clear success metric: time from alert to booked appointment.

### Non-goals (prototype)
- Diagnosing conditions or giving medical advice.
- Real HIPAA-compliant data handling or real PHI. All demo data is synthetic.
- Any real external API call: no real Zocdoc, WHOOP, Apple HealthKit, pharmacy, or patient portal.
- Booking with doctors outside the fake Zocdoc directory.
- An action log or audit trail.
- Phase 2 features (section 14).
- Companion chat for the parent, custom hardware, native mobile apps.

---

## 5. Core user flow

```
Wearable signal (fake data)
   -> Alert engine flags it (rules, not diagnosis)
   -> CareAgent writes a plain-language triage summary
   -> Caregiver sees alert on dashboard
   -> Caregiver taps "Book follow-up"
   -> CareAgent searches fake Zocdoc for slots with the parent's doctor, proposes top 3
   -> Caregiver approves one
   -> CareAgent books it in fake Zocdoc; appointment appears on dashboard
   -> 48 hours before (or "advance clock" in demo): CareAgent drafts pre-visit brief
   -> Caregiver adds questions, approves, downloads or "sends" it to the office
   -> After visit: caregiver pastes visit summary
   -> CareAgent extracts med changes, caregiver confirms, med list updates
   -> CareAgent requests refills before supply runs out (with approval)
```

---

## 6. MVP features and acceptance criteria

### F1. Care circle and consent
- Seeded demo family: Maya (primary caregiver), her brother (co-caregiver), Robert (parent).
- Roles: `primary_caregiver`, `co_caregiver` (view + approve), `parent` (view everything, revoke).
- Parent consent record: what data is shared and whether bookings need the parent's in-app approval.

**Acceptance criteria**
- A co-caregiver can see the dashboard but cannot change consent settings.
- Revoking consent hides wearable data and blocks agent actions.

### F2. Wearable ingest (fake)
- `WearableAdapter` interface with `FakeAppleHealthAdapter` and `FakeWhoopAdapter`, both generating data locally.
- Fake data: resting heart rate, HRV, sleep duration, steps, irregular rhythm notifications, fall events.
- Demo scenarios to inject events (e.g., 5 days of rising resting heart rate, a fall, an irregular rhythm notification).

**Acceptance criteria**
- Seeding produces 30 days of plausible history.
- Triggering a scenario produces new readings within one refresh.

### F3. Alert engine
- Rule-based thresholds, configurable per parent (e.g., resting HR 15%+ above 14-day baseline for 3+ days; any fall event; any irregular rhythm notification; sleep under 4 hours for 3 nights).
- Severity: `info`, `watch`, `follow_up`, `urgent`.
- `urgent` alerts (e.g., fall with no movement) show a call-911 / call-parent prompt and **never** route to booking.

**Acceptance criteria**
- Each alert stores the rule that fired and the data points behind it.
- No alert text claims a diagnosis.

### F4. Caregiver dashboard
- "Is Dad okay?" header: one-sentence status written by the agent.
- Cards: active alerts, upcoming appointments, medications and next refill dates, pending approvals.
- 30-day trend sparkline per metric.

**Acceptance criteria**
- Dashboard loads with seeded data in under 2 seconds locally.
- Every agent-written sentence links to the data it summarizes.

### F5. Triage summary
- For each `watch` or `follow_up` alert, the agent writes: what changed, over what period, why it might matter, and a suggested next step ("consider a check-in with Dr. Patel").
- Uses wellness language and includes a standard "not medical advice" line.

**Acceptance criteria**
- Summary is under 120 words.
- Summary cites the specific readings (values and dates) behind it.

### F6. Appointment booking through fake Zocdoc
- Zocdoc is the only booking channel, and for the demo it is **fully faked**. `FakeZocdocAdapter` lives in the app and reads a seeded JSON file of doctors (including Robert's primary care doctor and a cardiologist), accepted insurance plans, and open slots for the next 21 days. No network calls.
- Fake operations: search slots, check insurance, book, cancel. Booking removes the slot from the fake calendar and returns a confirmation number.
- CareAgent picks the right provider for the alert type (default: primary care), searches that provider's fake availability, checks insurance, and proposes 3 slots.
- Booking happens only after explicit approval.

**Acceptance criteria**
- From "Book follow-up" tap to 3 proposed slots: under 15 seconds.
- An approved booking appears on the dashboard with a fake confirmation number.
- A booked slot no longer shows up in later searches.
- If no slots in 14 days, CareAgent says so and offers another provider from the fake directory.
- The test suite confirms no outbound HTTP calls happen during booking.

### F7. Pre-visit brief
- 48 hours before an appointment (or when the demo clock is advanced), CareAgent drafts a one-page brief for the doctor:
  - Reason for visit (the alert that triggered it, in plain language)
  - 30-day trends for the relevant metrics, with the specific readings behind the alert
  - Current medication list and any changes since the last visit
  - Questions from the family (caregivers can add questions until the day before)
- Output: a printable page and a PDF. "Send to office" goes through `FakePortalAdapter`, which just marks the brief as sent. Approval required.

**Acceptance criteria**
- Brief fits on one printed page.
- Every number in the brief comes from stored readings or medication records.
- Sending requires an approval.
- Uses descriptive wellness language; no diagnoses.

### F8. Visit summary and medication changes
- Caregiver pastes or types the after-visit summary (the seed includes 3 sample summaries).
- CareAgent extracts medication changes (new, stopped, dose changed) into a structured diff and asks the caregiver to confirm.
- Confirmed changes update the medication list.

**Acceptance criteria**
- Extraction shows a side-by-side diff before saving.
- Nothing is saved without caregiver confirmation.

### F9. Refills
- `FakePharmacyAdapter` in the app; refill statuses advance on a timer or the demo clock.
- Tracks days of supply per medication, flags a refill 7 days before running out, asks for approval, then submits.

**Acceptance criteria**
- Refill status shows on the medications screen (`requested`, `ready`, `picked_up`).
- A failed refill (e.g., "needs prescriber approval") shows as a to-do on the dashboard.

---

## 7. Agent design

**One agent, many tools.** CareAgent is a single Claude agent with one system prompt and one tool-use loop. There are no sub-agents and no orchestrator. Every feature is the same agent working on a different task with a different set of tool calls.

**How the agent is invoked.** App code starts a run with a short task message and the care profile id.

| Trigger | Example task message |
| --- | --- |
| New alert | "Alert 42 fired. Summarize it for the caregiver." |
| Caregiver taps "Book follow-up" | "Find 3 Zocdoc slots for alert 42." |
| Slot approved | "Book approved slot, approval 17." |
| 48 hours before appointment | "Draft the pre-visit brief for appointment 5." |
| Visit summary pasted | "Extract medication changes from visit summary 9." |
| Daily scheduler | "Run daily review: status line and refills due." |

**Tools**

| Tool | Type | What it does |
| --- | --- | --- |
| `get_care_profile` | Read | Parent details, consent settings, care circle members |
| `get_readings` | Read | Wearable readings for a metric over a date range |
| `get_alerts` | Read | Alerts with their rule and evidence |
| `get_medications` | Read | Current med list, days of supply, refill status |
| `get_appointments` | Read | Upcoming and past appointments |
| `get_providers` | Read | The parent's doctors and their fake Zocdoc ids |
| `get_brief_questions` | Read | Questions family members added for a visit |
| `save_alert_summary` | Internal write | Stores the triage summary on an alert |
| `save_status_line` | Internal write | Stores the dashboard "Is Dad okay?" sentence |
| `save_previsit_brief` | Internal write | Stores a draft brief for caregiver review |
| `propose_med_changes` | Internal write | Stores a medication diff pending confirmation |
| `request_approval` | Internal write | Creates an approval request for the caregiver (and the parent when consent requires it) |
| `zocdoc_search_slots` | Fake external, read only | Searches fake Zocdoc slots and checks insurance |
| `zocdoc_book_appointment` | Fake external, approval required | Books a fake Zocdoc slot |
| `zocdoc_cancel_appointment` | Fake external, approval required | Cancels a fake booking and frees the slot |
| `send_brief_to_office` | Fake external, approval required | Marks the brief as sent |
| `request_refill` | Fake external, approval required | Submits a fake pharmacy refill |

**Rules**
- Every external tool except `zocdoc_search_slots` requires a valid `approval_id`. The check lives inside the tool function, so the tool refuses even if the model calls it early.
- The agent never outputs diagnoses or dosing advice.
- Model: `claude-sonnet-5-5`. One run handles one task and stops.
- Tool loop cap: 15 tool calls per run, then the run ends and shows an error to the caregiver.

---

## 8. Data model (SQLite)

- `users` (id, name, email)
- `care_profiles` (id, parent_name, dob, timezone, insurance_plan)
- `memberships` (user_id, care_profile_id, role)
- `consents` (care_profile_id, shared_data JSON, parent_approval_required bool, granted_at, revoked_at)
- `providers` (id, care_profile_id, name, specialty, zocdoc_provider_id)
- `readings` (id, care_profile_id, source, metric, value, recorded_at)
- `alerts` (id, care_profile_id, rule_id, severity, status, summary, evidence JSON, created_at)
- `appointments` (id, care_profile_id, provider_id, alert_id, start_at, zocdoc_confirmation, status)
- `previsit_briefs` (id, appointment_id, content JSON, status: draft | approved | sent, created_at)
- `brief_questions` (id, appointment_id, author_id, text, created_at)
- `visit_summaries` (id, appointment_id, text, created_at)
- `medications` (id, care_profile_id, name, dose, frequency, days_supply, last_fill_at, active)
- `med_change_proposals` (id, visit_summary_id, diff JSON, status: pending | confirmed | rejected)
- `refills` (id, medication_id, status, requested_at, updated_at)
- `approvals` (id, care_profile_id, action_type, payload JSON, requested_at, approved_by, approved_at)

Fake Zocdoc data lives in `app/fakes/zocdoc_seed.json` (doctors, insurance plans, slots) and is loaded into memory on startup.

---

## 9. Architecture and stack

Chosen to stay in Python end to end.

- **Backend:** Python 3.12, FastAPI, SQLModel on SQLite.
- **Agent:** one CareAgent built on the Anthropic Python SDK tool-use loop; tools are plain Python functions over the database and fake adapters.
- **Frontend:** server-rendered Jinja2 templates + HTMX, Tailwind via CDN. No React build step.
- **Fakes:** `app/fakes/wearables.py`, `zocdoc.py`, `pharmacy.py`, `portal.py`. Each implements a small interface so a real integration could replace it later, but the prototype only ships fakes.
- **PDF:** WeasyPrint for the pre-visit brief.
- **Scheduler:** APScheduler for daily ingest, alert evaluation, brief drafting and refill checks, plus a demo "advance clock" control.
- **Config:** `.env` with `ANTHROPIC_API_KEY` (the only external call the app makes).
- **Tests:** pytest for alert rules, approval gating, fake Zocdoc booking, and a check that no other outbound HTTP happens.

```
careagent/
  app/
    main.py
    models.py
    db.py
    routes/            # dashboard, alerts, booking, briefs, meds, consent, demo
    agent/             # careagent.py (single tool loop), tools.py, system_prompt.md
    fakes/             # wearables.py, zocdoc.py, zocdoc_seed.json, pharmacy.py, portal.py
    rules/alerts.py
    templates/
    static/
  scripts/seed_demo.py # Maya, her brother, Robert, 30 days of data, sample visit summaries
  tests/
  .env.example
  README.md
```

---

## 10. Key screens

1. **Dashboard:** status sentence, alert cards, appointments, meds, pending approvals.
2. **Alert detail:** triage summary, chart of the readings behind it, "Book follow-up" button.
3. **Booking review:** 3 proposed slots with provider and reasoning, approve button.
4. **Pre-visit brief:** draft preview, family questions box, approve and send, download PDF.
5. **Visit summary:** paste box, extracted med diff, confirm.
6. **Medications:** list with days of supply and refill status.
7. **Care circle and consent:** members, roles, consent toggles, revoke.
8. **Demo controls (dev only):** trigger scenarios, advance clock, reset demo data.

---

## 11. Safety, consent and privacy

- Synthetic data only; no real PHI.
- Wellness framing: alerts describe changes, never diagnoses. Every summary includes "This is not medical advice."
- `urgent` alerts route to emergency guidance, never to booking.
- Approval gate on every external action, enforced in code at the tool layer.
- Parent can view all data and revoke consent at any time.
- Future production work (out of scope): HIPAA posture, BAAs with partners, an audit trail, FDA software-as-a-medical-device review of alert logic.

---

## 12. Success metrics

| Metric | Prototype target | Why |
| --- | --- | --- |
| Time from alert to booked appointment | Under 2 minutes of caregiver time in the demo | The core promise |
| Caregiver actions per completed loop | 3 or fewer taps after the alert | Proves delegation |
| External actions with a matching approval | 100% | Trust and safety |
| Brief ready 24h before each appointment | 100% in demo | Shows value to the doctor |
| Med extraction accuracy | 90%+ fields correct on the 3 seeded summaries plus 7 more test summaries | Refill step depends on it |

---

## 13. Build milestones (order for Claude Code)

1. **Scaffold:** FastAPI app, SQLModel models, SQLite, base templates, seed script with demo family.
2. **Fake wearables + alerts:** fake adapters, 30-day seed, alert rules, alert list page, scenario triggers.
3. **CareAgent core:** single tool loop, system prompt, read tools, 15-call cap; dashboard with status line, cards, sparklines.
4. **Triage summary:** `save_alert_summary` with evidence citations; alert detail page.
5. **Approvals:** approval model, tool-layer gating, pending approvals card.
6. **Fake Zocdoc booking:** seed JSON, search, insurance check, book, cancel; booking review screen; no-outbound-HTTP test.
7. **Pre-visit brief:** drafting, family questions, approval, PDF export, fake send, advance-clock trigger.
8. **Meds:** visit summary paste, extraction diff, medication list.
9. **Refills:** days-of-supply tracking, scheduler, fake pharmacy, refill approvals.
10. **Consent and roles:** care circle page, revoke flow, permission checks.
11. **Polish + tests:** pytest coverage for rules, gating and fake booking; README with a 3-minute demo script.

---

## 14. Phase 2 (after the prototype)

Kept for later; not part of the MVP build.

- **Sibling load-sharing:** the agent turns appointments and refills into tasks (drive, attend, pick up, call after), proposes who takes each based on availability, and keeps a fair-share ledger.
- **Parent check-ins:** the agent texts the parent to confirm plans ("Reply YES, NO, or CALL ME"); a NO cancels the action, unclear replies never count as approval, and silence escalates to the caregiver. Optional wellness check-ins feed the pre-visit brief.
- **Emergency card:** one tap shows meds, allergies, doctors, contacts and recent vitals, with an expiring share link for ER staff.
- **Action log:** a visible record of every agent action, approval and consent change.
- **Real integrations:** Zocdoc agent program, WHOOP API, Apple HealthKit via a companion iOS app, a pharmacy partner.

---

## 15. Open questions

- Who pays: caregiver, siblings splitting a plan, or an employer benefit?
- What happens when the parent declines consent partway through?
- Which alert thresholds are clinically meaningful enough to suggest a visit? (Validate with a clinician before any real use.)
- What share of parents' long-time doctors are on Zocdoc, and how should the product handle the ones who are not?
- Will doctors' offices accept a family-generated pre-visit brief, and in what format?
- Where does alert logic cross into regulated medical device territory?

---

## 16. Claude Code kickoff prompt

Paste this into Claude Code from an empty folder containing this file:

> Read PRD.md. Build the MVP described in sections 6 to 13, following the milestones in section 13 in order. Do not build anything in section 14. Use the stack in section 9 exactly (Python, FastAPI, SQLModel/SQLite, Jinja2 + HTMX, Anthropic Python SDK). Build exactly one agent (CareAgent) with one tool-use loop and the tools in section 7; no sub-agents or orchestrator. Zocdoc, wearables, pharmacy and portal are all fakes inside the app with seeded data; the only outbound network call is to the Claude API. Enforce the approval gate in the tool layer, not just the UI. After each milestone, run the tests, show me how to run the app, and stop so I can review before the next one. Start with milestone 1.
