# CareAgent demo script (~3 minutes)

**Before you start:** `npm run db:seed`, `npm run dev`, open http://localhost:3000 as **Maya Hayes**. Keep `/demo` open in a second tab.

---

### 1. The problem (20 sec)

> "Maya lives three hours from her dad, Robert. He wears an Apple Watch, but the data just sits there. When something changes, Maya has to notice it, work out whether it matters, book the doctor, and keep her brother David in the loop. CareAgent is an agent that does that admin work, and it asks before anything leaves the family."

*Show the Overview page: Robert's status line, his recent readings, no open alerts.*

### 2. Something changes (30 sec)

*Switch to the `/demo` tab → **Rising resting heart rate**. Go back to Chat.*

> "We've simulated five days of Robert's resting heart rate rising above his baseline. The watch data syncs, a rule flags it, and the agent picks it up on its own. Nobody had to ask."

*Point out the alert card and trend chart the agent posts, and the plain-language explanation.*

> "It explains what changed in plain English, compares it to Robert's own baseline, and doesn't diagnose anything. Then it suggests a next step."

### 3. Booking the follow-up (60 sec)

*Accept the suggestion to book (tap the quick reply, or type "Yes, book him with Dr. Patel").*

> "It goes to Robert's primary care doctor by default, searches Zocdoc for the next two weeks, and gives Maya three options spread across different days."

*Pick a slot. The Approve / Decline card appears.*

> "This is the key design choice. Booking reaches outside the family, so the agent can't do it alone. The booking tool refuses to run without an approved request. It's enforced in code, not just in the prompt."

*Click **Approve**.*

### 4. The follow-through (40 sec)

> "Once Maya approves, the agent finishes the job: it books the appointment, adds it to the family calendar, and tells David."

*Show the appointment card. Open the step trace to show the tool calls: book → calendar → notify.*

*Open **Overview**.*

> "And here's the whole picture at a glance. The resting heart rate chart is flagged against Robert's own baseline, the visit is on the calendar, and every step CareAgent took is in the updates feed. It's also flagging that his Lisinopril runs out in six days."

*Switch the viewer (sidebar footer) to **David Hayes**.*

> "From David's side he sees the same thread and the notification. He never had to chase anyone."

### 5. Close (20 sec)

> "So that's one journey: the watch notices something, the agent explains it, it books the visit with Maya's approval, and it tells the family. Everything here is synthetic and the outside services are faked locally. The only real call is to the model. Next up are medication refills and a pre-visit brief for the doctor."

---

**If something goes wrong:** `/demo` → **Reset demo data** and trigger the scenario again. If the API key is missing, the alert still posts but chat will show the agent as offline.

**If you have extra time:** trigger **Fall (no movement)** to show the urgent path. The agent shows Call 911 / Call Robert buttons and doesn't offer to book.
