# CareAgent

**The care admin agent for families.** CareAgent helps adult children look after an aging parent from a distance. It watches the parent's wearable, explains changes in plain language, and then *does the follow-up work*: it books the doctor's appointment on Zocdoc, puts it on the family calendar, and tells your sibling, with your approval before anything leaves the family.

> Class prototype for AI Product Prototyping (Fall 2026). **All data is synthetic** and every outside service (Apple Watch, Zocdoc, calendar, notifications) is faked locally. The only real network call is to the OpenAI API. CareAgent does not give medical advice.

**Contents:** [Slide kit](#slide-kit) · [Run it](#run-it) · [How it works](#how-it-works) · [Tests](#tests) · [Status](#status)

---

## Slide kit

Everything below is written to be lifted into Google Slides. Each slide lists the rubric line it covers, then talking points. Items marked **[fill in]** need something only the group has.

### Suggested deck

| # | Slide | Rubric | Owner |
|---|---|---|---|
| 1 | Title + one-liner | — | [fill in] |
| 2 | The problem | I.A Vision | [fill in] |
| 3 | Who it's for | I.A Vision | [fill in] |
| 4 | The market gap | I.A Vision | [fill in] |
| 5 | Our solution | I.A Vision | [fill in] |
| 6 | How we used AI to build it | I.A, II.A | [fill in] |
| 7 | Prompt engineering | I.A, I.C | [fill in] |
| 8 | Wireframes & information architecture | I.B | [fill in] |
| 9 | Live prototype | I.C | [fill in] |
| 10 | Why you can trust it | I.C, II.D | [fill in] |
| 11 | Limitations & challenges | II.A | [fill in] |
| 12 | What's next | — | [fill in] |

The final presentation is graded on equal participation (II.C), so split the owners evenly.

---

### 1 · Title

**CareAgent: the care admin agent for families.**
For adult children managing a parent's health, CareAgent turns the parent's wearable signals into booked appointments and filled prescriptions. Unlike health assistants built around your own data, it acts on behalf of someone you care for, with their consent.

### 2 · The problem

- **63 million** US adults are family caregivers (AARP, 2025). Most also work, and half of working caregivers report disruptions like leaving early or arriving late.
- Caregiver apps stop at the alert or the to-do. **The caregiver still makes the calls**, finds the time slot, and chases the refill.
- Core insight: the gap is the loop **from signal to action, run on behalf of another adult.**

### 3 · Who it's for

- **Maya, primary caregiver.** 35–55, employed, lives an hour or more from her dad, often raising kids too. Wants to know "is Dad okay?" in 10 seconds and wants follow-ups handled without spending her lunch break on hold.
- **David, co-caregiver.** Maya's brother. Sees everything, can approve actions.
- **Robert, the parent.** 75, wears an Apple Watch, sees a long-time primary care doctor. Wants independence and dignity; must consent to sharing.

### 4 · The market gap

From our competitive analysis (see the companion *Caregiver Health Agent: Competitive Brief* **[fill in link]**):

| Who | What they do | Gap |
|---|---|---|
| Caregiver apps | Alerts and to-do lists | Stop before the action |
| Amazon Health AI, ChatGPT Health, Epic Emmie | Health agents that can act | Built for **your own** health and identity |
| Wellthy | Acts for caregivers end to end | Human coordinators, **employer-only** |

**Our niche:** an AI agent that takes care-admin actions **for another adult**, inside a family care circle, with consent and approvals.

### 5 · Our solution

A chat-first, mobile-first agent. The conversation is the interface; when it helps, the agent renders buttons, charts, and calendars right in the chat.

1. **Notice.** Rules watch the wearable data (e.g. resting heart rate 15%+ above the 14-day average for 3 days).
2. **Explain.** The agent investigates and writes a plain-language summary that cites the actual readings, with no diagnoses.
3. **Act.** It searches Zocdoc, proposes times, and books on approval.
4. **Coordinate.** It adds the visit to the family calendar and notifies the sibling.

**Success metric:** time from alert to booked appointment. In the prototype it takes **3 taps** after the alert: *Book follow-up → pick a time → Approve.*

### 6 · How we used AI to build it

Our workflow, from idea to working prototype:

1. **Competitive analysis.** We had AI write the research prompt, then used agent skills to run the analysis of the caregiver and health-agent market. **[fill in: tools/skills used]**
2. **Find the niche.** From that analysis we found the gap: acting on behalf of another adult (slide 4).
3. **Write the PRD.** We turned the niche into a product requirements doc (`PRD.md`) written to be handed to coding agents: features with acceptance criteria, the agent's tools, the data model, and build milestones in order.
4. **Build with a coding agent, one phase at a time.** We gave the PRD to Claude Code and built milestone by milestone. At each step the agent flagged open questions, we decided them together, and it verified the work with tests and in the browser before moving on.

**Tools**

| Stage | Tool |
|---|---|
| Market research and competitive brief | **[fill in]**, using agent skills |
| PRD | **[fill in]** |
| Prototype code | Claude Code |
| Wireframes | Claude with the Figma connector **[fill in when done]** |
| The agent inside the app | OpenAI `gpt-4.1-mini` |

**How AI accelerated the process:** **[fill in in your own words]**. Concrete examples from the build:
- Product pivots took minutes, not days: switching the stack from Python to TypeScript, the UI from bottom tabs to a ChatGPT-style sidebar, and the data from a database to editable JSON files.
- The coding agent wrote and ran 43 automated tests along the way, including a test proving no outbound network calls happen during booking.

### 7 · Prompt engineering

Two kinds of prompting shaped this project.

**A. Prompting the coding agent (building the app)**
- **A PRD as the master prompt.** Rather than describing the app in chat, we wrote a PRD with numbered milestones and acceptance criteria and asked the agent to build one milestone at a time and stop for review.
- **"Flag questions and decide together."** We told the agent to surface open decisions instead of guessing. It asked about pacing, the model, layout, alert handling, storage, and how much the agent may do without asking.
- **Show, don't describe.** For the interface we pointed the agent at a previous project's repo ("make it like this, but with shadcn") instead of writing a long design spec.
- **Ask the hard question.** Asking *"is this demo truly agentic, or is it just fake data?"* exposed that the early build was rules and data only, and led to the redesign around one agent that chooses its own tools.

**B. Prompting the agent inside the app**
What we changed after watching it run, and why:

| What we saw | What we changed |
|---|---|
| The agent listed the quick-reply buttons in its text ("Here are some options… please tap") | Added to the system prompt: never restate a card or list the options in text |
| Text written before a tool call and the final answer both appeared, so replies repeated | Code now treats pre-tool text as a temporary preamble, replaced by the final answer |
| After booking, it skipped the appointment card and drifted into an unrequested refill rundown | Prompt: "do all three" (calendar, notify, card) and "1–2 sentences, no unrelated topics"; the booking tool also returns the next steps |
| A prompt alone can't guarantee "no diagnoses" | Code checks every saved summary and every final reply for diagnostic or dosing language, and sends a bad reply back for one rewrite |
| A model could describe an approval inaccurately | The approval card's text is built by code from real booking data; the model only adds a one-line reason |
| The model needed to tell people apart from system triggers | Alerts, approvals, and scheduled reviews reach it as `[Automated event] …` messages |

The full system prompt is in `src/agent/system-prompt.ts`; each tool's description is also a prompt (`src/agent/tools.ts`).

### 8 · Wireframes & information architecture

**[fill in: Figma link and screenshots]**. The wireframes cover one journey across these screens:

1. Chat, empty state
2. Alert arrives (summary, chart, Book follow-up)
3. Agent working (visible step trace)
4. Pick a time (calendar card)
5. Approval card
6. Booked (appointment card, family calendar, David notified)
7. Overview ("Is Robert okay?", approvals, appointments, medications)

Edge cases: urgent fall (Call 911, no booking), declined approval, Overview as David, Robert's profile.

**Information architecture**
```
Sidebar
├── Chat (landing)  ← where all actions happen
├── Overview        ← status line, needs attention, approvals, notifications, appointments, meds
├── Robert's profile
└── Viewer switcher: Maya · David · Robert   (Demo controls: dev only)
```

### 9 · Live prototype

The journey we demo: **watch alert → agent explains → Book follow-up → pick a time → Approve → booked, on the family calendar, David notified.** Then switch to David's view to show his notification.

Points to make while demoing:
- The **"Worked for 5s · 6 steps"** trace shows the agent choosing its own tools; nothing is scripted.
- The agent woke up **on its own** when the alert fired.
- The approval card is the **only** way anything leaves the family.

### 10 · Why you can trust it

- **Approvals are enforced in code, not just the prompt.** The booking tool refuses to run without an approved approval, books exactly what was approved, and only once.
- **Rules detect, the AI explains.** The model never decides whether something is an alert.
- **Wellness language only.** Diagnostic or dosing language is blocked in code.
- **Urgent means call, not book.** A fall with no movement shows Call 911 / Call Robert and never a booking button.
- **Consent first.** If Robert revokes consent, every action is blocked; his consent can also require his own approval for bookings.
- **Proven by tests.** 43 automated tests, including a full alert-to-booking run with all network calls blocked.

### 11 · Limitations & challenges

Real ones we hit, useful for slide 11 and Q&A:

- **AI builds what you say, not what you mean.** The first interface was a conventional dashboard. We had to redirect twice (chat-first and mobile-first, then the VisionCart-style layout). Clear references beat descriptions.
- **"Working" isn't the same as "agentic."** The early build had no AI calls at all, just data and rules. We only caught it by asking directly.
- **LLM output needs supervision.** It repeated itself, skipped steps, and over-explained (slide 7). Each fix was a prompt change, a code guardrail, or both.
- **Speed and variability.** Each agent turn takes about 2–8 seconds, and the wording changes run to run, which makes live demos less predictable.
- **Safety can't live in the prompt alone.** Anything that must hold every time (approvals, no diagnoses) had to be enforced in code.
- **Coding agents act in your environment.** At one point the coding agent stopped a teammate's running dev server while restarting its own. It's powerful but needs review and sensible permissions.
- **Hosting has trade-offs.** The prototype stores data in local files, which serverless hosts like Vercel can't keep. On Vercel it falls back to /tmp, so the hosted demo resets often; the main demo runs locally.

### 12 · What's next

- Refills through a pharmacy, with status tracking (requested → ready → picked up)
- Medication changes pulled from a pasted visit summary, shown as a side-by-side diff to confirm
- A one-page pre-visit brief for the doctor
- Messaging the doctor's office (e.g. when a refill needs the prescriber's OK)
- Real integrations: the Zocdoc agent program, Apple HealthKit, a pharmacy partner
- Before real use: HIPAA posture, clinician review of alert thresholds, and FDA review of the alert logic

### Q&A prep

- **Is it really an agent, or a scripted flow?** One model, one loop, 19 tools. Every message, button tap, alert, and approval goes to the same loop, and the model picks the tools. The step trace on every reply shows it.
- **What stops it from booking on its own?** The booking tool checks for an approved approval in code and refuses otherwise. We tested premature booking attempts.
- **Why rules for alerts instead of AI?** Thresholds need to be predictable and testable. The AI's job is to explain and act, not to decide what counts as a health alert.
- **Is this medical advice?** No. It describes changes in readings, never diagnoses, and every summary says "This is not medical advice."
- **What's real and what's fake?** The agent and its reasoning are real (live OpenAI calls). The watch, Zocdoc, calendar, and notifications are local fakes behind the same interfaces a real integration would use.
- **Why OpenAI `gpt-4.1-mini`?** A small, fast, inexpensive model with reliable tool calling is enough when the tools and code guardrails do the heavy lifting.
- **What if the doctor has no openings?** The agent says so, gives the next available date, and offers another in-network doctor (Dr. Lee in cardiology has nothing for 18 days).
- **What about the parent's privacy?** Robert consents to what's shared, can require his own approval for bookings, and can revoke consent, which blocks all actions.

---

## Run it

Requires Node 20.12+ (developed on Node 24) and an OpenAI API key.

```bash
npm install
cp .env.example .env        # add your OPENAI_API_KEY
npm run db:seed             # demo family + 30 days of watch data
npm run dev                 # http://localhost:3000
```

Open **Demo controls** (sidebar footer menu → Demo controls, or `/demo`) and trigger **Rising resting heart rate**. The agent posts the alert in Chat. Use **Reset demo data** to start over. For a phone-sized view, use Chrome DevTools' device toolbar.

Without an API key the app still runs: alerts are posted with their rule description and chat shows that the agent is offline.

| Variable | Default | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | — | Required for the agent. Server-side only. |
| `OPENAI_MODEL` | `gpt-4.1-mini` | Any OpenAI chat model with tool calling. |
| `DATABASE_URL` | `careagent.db` (`/tmp/careagent.db` on Vercel) | SQLite file for app state. |
| `FAKES_STATE_DIR` | `data/fakes/state` (`/tmp/careagent-fakes` on Vercel) | Where the fake services record bookings, calendar and messages. |
| `DEMO_PASSWORD` | — | Optional. Password-protects the whole site (any username). |

### Deploying to Vercel

Set `OPENAI_API_KEY` (and optionally `DEMO_PASSWORD`) in Project → Settings → Environment Variables. Data lives in `/tmp`, so each server instance starts from a fresh seeded demo and state can reset at any time. That's fine for a demo but not for real use. Without `DEMO_PASSWORD` anyone with the URL can use the agent, so use a short-lived key with a spend limit.

| Command | What it does |
|---|---|
| `npm run dev` | Start the app |
| `npm run db:seed` | Reset all demo data, including fake-service state |
| `npm test` | Run the tests (no network) |
| `npm run db:generate` | Regenerate the migration after editing `src/db/schema.ts` |

## How it works

**One agent, one loop** (`src/agent/careagent.ts`). Chat messages, tapped buttons, alerts, approvals, and the daily review all become input to the same tool-use loop; the model chooses the tools. Replies stream to the browser with a step trace.

| Kind | Tools (`src/agent/tools.ts`) |
|---|---|
| Read | `get_care_profile`, `get_readings`, `get_alerts`, `get_medications`, `get_appointments`, `get_providers`, `zocdoc_search_slots` |
| Write (internal) | `save_alert_summary`, `save_status_line` |
| Ask a person | `request_approval` |
| Act (approval required) | `zocdoc_book_appointment`, `zocdoc_cancel_appointment` |
| Family | `add_to_family_calendar`, `notify_care_circle` |
| Render in chat | `show_alert_card`, `show_trend_chart`, `show_slot_picker`, `show_appointment_card`, `show_quick_replies` |

**The approval gate** (`src/lib/approvals.ts`). External tools call `requireApproved()` and act only on the approved payload. A caregiver must approve, plus Robert when his consent requires it; any decline wins; revoked consent blocks everything.

**Fake services as JSON files.** The agent reaches each service through an adapter, as it would a real API:

| Service | Seed (committed, editable) | State (reset with the demo) |
|---|---|---|
| Apple Watch / WHOOP | generated by a simulator | `data/fakes/state/wearables/apple_health.json` |
| Zocdoc | `data/fakes/zocdoc.json` | `data/fakes/state/zocdoc_bookings.json` |
| Family calendar | — | `data/fakes/state/family_calendar.json` |
| Notifications | — | `data/fakes/state/outbox.json` |

App state (chat, alerts, approvals, appointments, medications) is in SQLite.

**Stack:** Next.js 15, TypeScript, shadcn/ui + Tailwind CSS 4, OpenAI tool calling, SQLite + Drizzle ORM, Vitest.

```
src/agent/    the loop, tools, system prompt, safety checks, event triggers
src/app/      pages (Chat, Overview, Profile, Demo) and API routes
src/fakes/    wearables, Zocdoc, family calendar, messaging
src/lib/      approval gate, watch sync, chat thread, shared types
src/rules/    alert rules
tests/        43 tests with a scripted model
PRD.md        product requirements
```

## Tests

`npm test` runs 43 tests with no network access. The agent tests use a scripted model to check the loop, the safety checks, the 15-call cap, the approval gate (no approval, pending, declined, wrong action, revoked consent, used twice), parent approval, and the full alert → booked → calendar → David notified journey with all network calls blocked.

## Status

**Built:** care circle and viewer switcher; fake wearables and alert rules; chat-first agent with summaries, charts, and the Overview status line; approvals; Zocdoc search, book, and cancel; family calendar; care-circle notifications; Overview and Robert's profile.

**Next:** refills, medication changes from visit summaries, the pre-visit brief, messaging the doctor's office, and a consent-revoke flow in the UI.

## Disclaimer

A class prototype. Synthetic data only, no real bookings or calls, and no medical advice. In an emergency, call 911.
