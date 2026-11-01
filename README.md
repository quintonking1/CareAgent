# CareAgent

**The care admin agent for families.** CareAgent helps adult children look after an aging parent from a distance. It watches the parent's wearable, explains changes in plain language, and then *does the follow-up work*: it books the doctor's appointment on Zocdoc, puts it on the family calendar, and tells your sibling — with your approval before anything leaves the family.

> Class prototype for an AI product prototyping course. **All data is synthetic** and every outside service (Apple Watch, Zocdoc, calendar, notifications) is faked locally. The only real network call is to the OpenAI API. CareAgent does not give medical advice.

---

## The problem

63 million US adults are family caregivers, and most of them also work. Caregiver apps today stop at the alert: the caregiver still makes the calls, finds the time slot, and chases the refill. New health agents can act, but they're built around *your own* health. CareAgent closes the loop from **signal to action, on behalf of someone you care for**, with their consent.

**Who it's for**
- **Maya** (primary caregiver): 35–55, works, lives an hour from her dad. Wants to know "is Dad okay?" in 10 seconds and wants follow-ups handled.
- **David** (co-caregiver): Maya's brother. Can see everything and approve actions.
- **Robert** (parent, 75): wears an Apple Watch, has a long-time primary care doctor, and has consented to sharing.

## The demo journey

One customer journey, end to end, in **3 taps after the alert**:

1. Robert's watch uploads 5 days of rising resting heart rate.
2. Rules flag it; **the agent wakes up on its own**, reads the readings, writes a triage summary (75, 76, 78 bpm vs. his usual 64.9), shows a chart, and updates the "Is Robert okay?" line on Overview.
3. **Tap 1:** Maya taps **Book follow-up**. The agent looks up Robert's doctor, searches Zocdoc, and shows 3 open times as a calendar card.
4. **Tap 2:** Maya picks Thu Nov 5, 1:00 PM. The agent asks for approval.
5. **Tap 3:** Maya taps **Approve**. The agent books it on Zocdoc, adds it to the family calendar, notifies David, and shows the appointment card.
6. Switch to David's view: the booking is in his notifications and on Overview.

Urgent alerts (a fall with no movement afterward) go to a **Call 911 / Call Robert** card instead, never to booking.

## Quick start

Requires Node 20.12+ (developed on Node 24) and an OpenAI API key.

```bash
npm install
cp .env.example .env        # then add your OPENAI_API_KEY
npm run db:seed             # creates careagent.db with the demo family + 30 days of watch data
npm run dev                 # http://localhost:3000
```

Then open **Demo controls** (sidebar footer menu → Demo controls, or `/demo`) and trigger **Rising resting heart rate**. Without an API key the app still runs: alerts are posted with their rule description, and chat shows that the agent is offline.

**Tip for presenting:** open Chrome DevTools' device toolbar (iPhone 14) — the app is designed mobile-first, and the sidebar becomes a drawer on small screens.

### Environment

| Variable | Default | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | — | Required for the agent. Server-side only; never sent to the browser. |
| `OPENAI_MODEL` | `gpt-4.1-mini` | Any OpenAI chat model with tool calling. |
| `DATABASE_URL` | `careagent.db` | SQLite file for app state. |

`.env` is gitignored.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the app. |
| `npm run db:seed` | Reset everything: demo family, 30 days of readings, and all fake-service state (bookings, calendar, notifications). Same as **Reset demo data** on `/demo`. |
| `npm test` | Run the test suite (no network; the model is scripted). |
| `npm run db:generate` | Regenerate the SQL migration after editing `src/db/schema.ts`. |

## How it works

### One agent, many tools

CareAgent is a **single agent with one tool-use loop** (`src/agent/careagent.ts`). There are no scripted flows: every trigger becomes input to the same loop, and the model decides which tools to call.

| Trigger | Input to the agent |
|---|---|
| A chat message, or a tapped button / quick reply / time slot | The family member's message |
| A rule fires on new watch data | `[Automated event] Alert #1 fired: …` |
| Someone taps Approve or Decline | `[Automated event] Maya Hayes approved approval #1 …` |
| Daily review (button on `/demo`) | `[Automated event] Scheduled daily review …` |

Every reply shows a collapsible trace ("Worked for 4s · 5 steps") listing the tools the agent chose, so you can see it acting rather than following a script. Replies stream token by token.

**Tools** (`src/agent/tools.ts`)

| Kind | Tools |
|---|---|
| Read | `get_care_profile`, `get_readings`, `get_alerts`, `get_medications`, `get_appointments`, `get_providers`, `zocdoc_search_slots` |
| Write (internal) | `save_alert_summary`, `save_status_line` |
| Ask a person | `request_approval` |
| Act (approval required) | `zocdoc_book_appointment`, `zocdoc_cancel_appointment` |
| Family (inside the care circle) | `add_to_family_calendar`, `notify_care_circle` |
| Render UI in the chat | `show_alert_card`, `show_trend_chart`, `show_slot_picker`, `show_appointment_card`, `show_quick_replies` |

The render tools are how the agent puts **buttons, charts and calendars** into the conversation. The chat *is* the interface; Overview and Robert's profile are supporting pages.

### Guardrails live in code, not just the prompt

- **Approval gate.** External tools call `requireApproved()` (`src/lib/approvals.ts`) and refuse to run without an approved approval for that exact action. They act on the *approved payload*, not on whatever the model passes, and an approval can be used once.
- **Approval cards are written by code** from real data (time, address, in-network check), so the model can't misdescribe what you're approving.
- **Who can approve:** a caregiver (Maya or David); if Robert's consent says bookings need his approval, Robert too. Any decline wins. Revoked consent blocks all actions.
- **Wellness language.** Text the agent saves or sends is checked for diagnostic or dosing language and rejected; a final reply that diagnoses is sent back for one rewrite. Triage summaries are capped at 120 words and always end with "This is not medical advice."
- **Rules detect, the agent explains.** Alert thresholds are deterministic (`src/rules/alerts.ts`); the model never decides whether something is an alert.
- **15 tool calls per run**, then the run stops and says so.
- **Urgent alerts never offer booking.**

### Fake services backed by JSON files

The agent reaches every outside service through an adapter, exactly as it would a real API. The data behind them is plain JSON you can open and edit:

| Service | Seed (committed, hand-editable) | State (written by the service, reset with the demo) |
|---|---|---|
| Apple Watch / WHOOP | generated by a simulator | `data/fakes/state/wearables/apple_health.json` |
| Zocdoc | `data/fakes/zocdoc.json`: doctors, accepted insurance, weekly hours | `data/fakes/state/zocdoc_bookings.json` |
| Family calendar | — | `data/fakes/state/family_calendar.json` |
| Push notifications | — | `data/fakes/state/outbox.json` |

Try it: edit a reading in the watch file and press **Sync from device file** on `/demo`, or change Dr. Patel's hours in `zocdoc.json` and ask the agent to book. Dr. Marcus Lee (cardiology) has nothing for 18 days, and Dr. Samuel Ortiz doesn't take Robert's insurance, so you can see the agent handle both.

App state (chat, alerts, approvals, appointments, medications) lives in SQLite via Drizzle.

## Tech stack

- **Next.js 15** (App Router), **TypeScript**, React 19
- **shadcn/ui** (Radix, Nova preset) + Tailwind CSS 4; ChatGPT-style layout with light/dark mode
- **OpenAI** Chat Completions with tool calling (`gpt-4.1-mini` by default), streamed as NDJSON from `/api/chat` and `/api/approvals`
- **SQLite** (better-sqlite3) + **Drizzle ORM**
- **Vitest** for tests

## Project structure

```
src/
  agent/        careagent.ts (the tool loop), tools.ts, system-prompt.ts, safety.ts,
                events.ts (alerts / approvals / daily review wake the agent), llm.ts
  app/          pages: / (chat), /home (Overview), /profile, /demo; api/chat, api/approvals
  components/   chat UI (messages, trace, cards), sidebar, shadcn ui/
  db/           schema.ts, seed.ts
  fakes/        wearables.ts, zocdoc.ts, family-calendar.ts, messaging.ts, store.ts
  lib/          approvals.ts (the gate), ingest.ts (watch sync), thread.ts, blocks.ts, clock.ts
  rules/        alerts.ts (rule engine)
data/fakes/     zocdoc.json (seed) and state/ (generated, gitignored)
tests/          agent, alerts, booking, wearables, seed
PRD.md          product requirements
```

## Tests

```bash
npm test
```

43 tests, no network. The agent tests use a scripted model (`tests/scripted-llm.ts`) to check the loop itself:

- the model chooses tools and sees their results; render tools attach cards
- an alert event leads to a saved triage summary and status line
- diagnostic language is rejected; over-long summaries are rejected; a diagnosing reply is rewritten
- the 15-call cap; unknown tools and bad arguments come back as errors instead of crashing
- the booking tool refuses without approval, while pending, after decline, for the wrong action, or after revoked consent; it books exactly the approved slot, once
- parent approval when consent requires it
- the full alert → slots → approval → booked → calendar → David notified journey, with `fetch`, `http` and `https` stubbed to fail, proving **no outbound HTTP** during booking

## Status

**Built**
- Care circle with roles and a viewer switcher (Maya, David, Robert)
- Fake wearables, 30-day history, 5 demo scenarios, rule-based alerts
- Chat-first agent: triage summaries, status line, charts, quick replies
- Approvals, Zocdoc search / book / cancel, family calendar, care-circle notifications
- Overview (status, approvals, notifications, appointments, medications) and Robert's profile

**Next**
- Refills through a fake pharmacy, with status tracking
- Medication changes extracted from a pasted visit summary (side-by-side diff, confirm to save)
- Pre-visit brief for the doctor (printable, one page)
- Messaging the doctor's office through a fake patient portal
- Consent revoke flow in the UI; scheduled daily review

## Built with AI

This prototype was built with **Claude Code** from `PRD.md`, iterating milestone by milestone: Claude flagged open questions, we decided them together, and each step was verified with tests and in the browser. The agent inside the app runs on **OpenAI `gpt-4.1-mini`**. A collection of the prompts we used (to build the app and to shape the agent's behavior) is planned under `docs/prompts/`.

## Disclaimer

CareAgent is a class prototype. It uses synthetic data only, makes no real bookings or calls, and does not provide medical advice. In an emergency, call 911.
