# Midnight Reminder Extension — Requirements

## 1. What we are building

A small Pi extension that shows a visible, non-blocking reminder to stop working when the time is between midnight and 6 a.m. (late-night hours). The reminder must appear automatically while Pi is running interactively, without waiting for the user to type a new prompt. It must appear at most once per calendar date, and it must clean up its timer when the Pi session ends.

---

## 2. Requirements explicitly stated by the professor

These come directly from the W1 tasks and lecture description. They are our target for correctness.

| Requirement | Source |
|---|---|
| Use **one** Pi coding agent for the entire lab | Lecture and all W tasks |
| Work in pairs | Lecture |
| Build a Pi extension (not a skill, MCP server, or standalone tool) | Lecture: “differences between tools, skills, MCP, and Pi extensions” |
| Use a single AI coding agent; actively guide it, inspect, test, and correct | Lecture emphasis |
| Practice TDD: write failing tests first, then implement | W1-2, W1-3; lecture: “Introduction to test-driven development” |
| Use **simulated time** in tests | W1-2 explicitly: simulated time |
| The extension must show a visible reminder | W1-4, W1-5; “visible reminder” in acceptance criteria |
| The reminder must appear automatically while Pi is running | W1-4: “Connect the policy to Pi so that the reminder can appear automatically while Pi is running” |
| Prevent duplicate reminders | W1-5 explicitly lists “Duplicate-reminder prevention” |
| Clean up when the session ends | W1-4: “cleanup when the session ends”; W1-5: “Session cleanup behavior” |
| By first checkpoint: clear spec + working time-policy tests + visible reminder | W1-5 checkpoint |
| By end of lab: automatic checking + deduplication + cleanup + passing tests + reviewed diff + demo | W1-5 final deliverables |

### What the professor did NOT explicitly require

The following were not mentioned in the assignment text. Some are reasonable inferences; others are choices already recorded in our repository files.

- A specific check interval (30 seconds)
- A daytime preview /bedtime-test command
- Noninteractive modes must show no notification
- Exact wording of the visible reminder message
- TypeScript instead of JavaScript
- Node’s built-in test runner instead of Vitest or Jest
- Exact file names (`src/time-policy.ts`, `src/reminder.ts`)

These are fine choices, but they are **our choices**, not professor requirements.

---

## 3. Proposed design choices (our choices)

These are decisions we (the student pair) made or will make. We should agree on them before coding.

### 3.1 Late-night window
- **Choice**: Define late night as **00:00 inclusive through 06:00 exclusive**.
  - The **00:00 inclusive / 06:00 exclusive** boundaries are directly supported by the professor’s explicit W1-2 test examples (00:00 → true, 06:00 → false).
  - **Local wall-clock time** (using the machine’s timezone) is our choice, not a professor requirement. UTC or another timezone would also satisfy the explicit test cases if the test fixtures matched that zone.

### 3.2 Immediate startup check
- **Choice**: The extension should check the time immediately when an **interactive** session starts.
- **Rationale**: If the user opens Pi at 1 a.m., they should be reminded right away, not after the next interval tick.

### 3.3 Periodic idle checking
- **Choice**: After the initial check, re-check every **30 seconds** while the session is alive and interactive.
- **Rationale**: Keeps the reminder responsive without being noisy. This is our proposal; we could pick a different interval.

### 3.4 Visible, non-blocking reminder
- **Choice**: Use Pi’s `ctx.ui.notify` to show a notification.
- **Rationale**: The assignment says “visible reminder,” and Pi’s extension API provides a built-in notification mechanism that does not block tools or terminate the session.

### 3.5 Daytime preview command
- **Choice**: Provide a slash command `/bedtime-test` that shows the reminder UI at any time of day without recording that a reminder was shown.
- **Rationale**: Useful for demos and manual testing. This is our idea, not an explicit requirement.

### 3.6 Deduplication rule
- **Choice**: Allow **at most one automatic reminder per local calendar date** in a single Pi session.
- **Rationale**: The professor says “Already reminded today → no duplicate.” This rule targets automatic checks; the preview command must not count.

---

## 4. Unresolved questions and ambiguities

| # | Question | Current README choice | Our assessment |
|---|---|---|---|
| 1 | **Must duplicate prevention survive closing and reopening Pi?** | README says: “A new session or reload may remind again. No cross-process or restart persistence is required.” | We record reminder history only within the current session. This is a **provisional choice**, not an approved final decision. We may revisit it if the professor clarifies. |
| 2 | **What should happen when the extension is reloaded?** | README says: “Reload must leave no old timer or captured session context.” | This is our interpretation of lifecycle hygiene. We need to verify Pi’s extension reload behavior (does it call `session_shutdown` on the old instance before loading the new one?) before implementing. |
| 3 | **What about noninteractive modes?** | README says: “Noninteractive modes create no timer and show no notification.” | The professor did not mention this, but it is a sensible guard. We propose keeping it unless the professor clarifies otherwise. |
| 4 | **How soon after midnight is “within 60 seconds”?** | README says: “notify within 60 seconds of midnight, even without a new prompt.” | **Startup**: an immediate check runs as soon as the extension loads, so a session started right at midnight should notify at initialization (subject to normal load time). **Already running**: periodic checks every 30 seconds mean the first tick after midnight will fire within one interval (subject to system scheduling and the computer remaining awake). |
| 5 | **What happens after a pause/resume inside the window vs. after 06:00?** | README mentions pause/resume in integration tests. | The professor did not mention pause/resume explicitly. We should decide: if Pi was paused at 2 a.m. and resumed at 4 a.m., is a reminder still warranted? Our current thinking: yes, if no reminder was already shown today. If resumed at 7 a.m., skip because the window closed. |

**Bottom line**: Several behaviors in our README are well-reasoned design choices, not assignment gospel. We should be ready to defend or change them during review.

---

## 5. Acceptance criteria table

All tests use **simulated time** (a supplied `Date` object). The “Same local date” column refers to the calendar day in the machine’s local timezone.

| Starting condition | Expected result |
|---|---|
| Time is **23:59** on a given local date | **No reminder.** The window has not started yet (before 00:00). |
| Time is **00:00** on a given local date, and no reminder has been shown today | **Show reminder.** The window is open (00:00 inclusive) and this is the first reminder today. |
| Time is **05:59** on a given local date, and no reminder has been shown today | **Show reminder.** The window is still open (before 06:00 exclusive). |
| Time is **06:00** on a given local date | **No reminder.** The window is closed at and after 06:00. |
| An automatic reminder was already shown at 00:30, and a periodic check fires at 03:00 **on the same local date** | **No duplicate reminder.** Deduplication applies to automatic checks. |
| A new local calendar date begins (local midnight passes), and a check fires after 00:00 | **Show reminder again.** A new date resets the daily limit. |
| **Immediate startup check**: Pi starts interactively between 00:00 and 06:00, and no reminder has been shown today | **Show reminder as soon as the session starts.** The check is performed at startup, unless the computer is asleep or the extension loads slowly. |
| **Periodic idle check**: Pi is already running interactively; the user has not typed a prompt; a periodic check fires while Pi is idle and the computer is awake | **Show reminder if in window and not yet reminded today.** Must work without a new user prompt, subject to the 30-second check interval and normal system scheduling delays. |
| User types `/bedtime-test` at any time of day | **Show the reminder UI once.** Do **not** record that an automatic reminder was shown today. |
| **Noninteractive mode**: Pi runs in print, JSON, or scripted mode | **No timer created; no reminder shown.** This is a proposed guard, not an explicit professor requirement. |
| **Session shutdown**: Interactive session ends normally | **Clean up timer.** No stale timers, no leaked callbacks, no future checks after shutdown. |
| **Reload**: Extension is reloaded while Pi keeps running | **Old timer must be cleared.** No duplicate timers, no old callbacks. We need to verify Pi’s exact unload behavior (see Question 2 above). |

---

## 6. What is outside scope

These are limits we are setting, unless the professor clarifies otherwise.

| Out-of-scope item | Is it an explicit assignment instruction? | Our reasoning |
|---|---|---|
| Cross-session or cross-process persistence of reminder history | No — README chose this limit | We reset state on every new Pi session or reload. This is **provisional**; we may revisit if the professor clarifies. |
| Changing the computer clock | No — assignment says simulated time | We will only use simulated `Date` objects in tests. Supplying local `Date` values without changing the computer clock is our testing approach. |
| Timezone configuration; we use local system time | Not mentioned | Simplicity; the extension follows the machine’s local clock. |
| Customizing the reminder message text | Not mentioned | We will use a sensible default; customizing it is out of scope. |
| Sound, vibration, or OS-level notifications | Not mentioned | We will use Pi’s `ui.notify` only. |
| Deploying to npm or sharing as a Pi package | Not mentioned | This is a class lab, not a published extension. |

---

## What we need to agree on before W1-2

1. **Deduplication scope**: Do we agree that one-per-date only covers automatic timer checks, and `/bedtime-test` is exempt? (We propose **yes**.)
2. **Reload behavior**: Can we confirm whether Pi calls `session_shutdown` before reloading? If not, we may need defensive cleanup in the factory as well.
3. **Noninteractive guard**: Should we keep the rule “no timers in noninteractive modes,” or treat it as unnecessary? (We propose **keep it** because it prevents stray timers in scripts.)
4. **Test runner**: Are we committed to Node’s built-in `--test`? (We propose **yes** — no extra dependencies, and it supports TDD well enough.)
