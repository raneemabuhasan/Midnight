# W1-5 Reflection Draft

This draft captures actual decisions and corrections from our pair's work with one Pi coding agent. We also used Codex to explain the assignment text, review generated files, and independently run tests. Personalize before submitting.

---

## What we built

A Pi extension that shows a single late-night reminder (00:00–06:00 local time) per calendar date while Pi is running interactively. It checks immediately on startup, then every 30 seconds, and cleans up its timer when the session ends.

---

## Requirements work (W1-1)

### What we did

We separated **what the professor explicitly required** from **what we decided ourselves**:

- Explicit: one agent, pair work, TDD, simulated time, automatic reminders, duplicate prevention, cleanup
- Our choice: local timezone (not UTC), 30-second interval, `/bedtime-test` preview command, non-TUI guard
- Left unresolved: whether duplicate prevention should survive a Pi restart (we chose session-only, provisional)

This separation is recorded in `docs/requirements.md`. We learned that a README in a repository can contain reasonable assumptions that are not assignment requirements, and we must be ready to defend or change them.

---

## Test-driven development (W1-2 → W1-3)

### What we did

We wrote 8 policy tests against a stub that returned `false`:

| Starting condition | Expected |
|---|---|
| 23:59 | no reminder |
| 00:00, no prior reminder | reminder |
| 05:59, no prior reminder | reminder |
| 06:00 | no reminder |
| Already reminded today | no duplicate |
| Reminded yesterday, now in window | reminder again |

With the stub, **3 passed** (expecting false, got false) and **5 failed** (expecting true, got false). After implementing the policy, **all 8 passed**.

---

## Integration and wiring (W1-4)

### What we did

We built three layers:

1. **Policy** (`time-policy.ts`): pure function, no side effects
2. **Controller** (`reminder-controller.ts`): accepts clock, timers, notifier as injectable dependencies; testable without Pi
3. **Extension** (`reminder.ts`): Pi-generated code under our direction; calls Pi's `registerCommand`, `on("session_start")`, `on("session_shutdown")`; defers all timers to the event handler

### A mistake we corrected

The first wiring tests only verified that handlers were **registered**, not that they **behaved correctly**. The agent initially wrote tests like:

```typescript
assert.strictEqual(handlers.length, 1); // only checks registration
```

We caught this and asked the agent to strengthen them. The corrected tests:

- Intercept `globalThis.setInterval` **before** loading the factory and assert zero calls
- Invoke `session_start` with a fake TUI context and assert exactly one 30000 ms timer is created
- Invoke `session_shutdown` and assert the timer count drops to zero
- Use a fixed `globalThis.Date` so `new Date()` returns a simulated time

Another correction: the agent initially placed timer mock logic on a `.clock` property on the fake context, which `reminder.ts` never read. The real extension calls `new Date()` inside the **clock callback**, which is invoked on each check, not directly inside the controller constructor. We fixed this by mocking `globalThis.Date` in the wiring tests.

### A policy decision we verified

The agent initially duplicated the time-window logic inside `reminder-controller.ts` with a private `shouldSendReminder` method. We directed it to import and reuse `shouldRemind` from `time-policy.ts` instead, keeping one tested source of truth.

---

## Scope boundary we are aware of

Cross-session persistence is **not implemented**. If Pi restarts, the reminder history resets. This is our provisional scope limit, not a professor requirement. Remains **provisional pending professor clarification**.

---

## Interactive demonstration

We launched:

```bash
pi --extension ./src/reminder.ts
```

and ran `/bedtime-test` on **October 5, 2026**. Pi displayed:

> Warning: It's late! Save your work and get some sleep.

This confirmed the command wiring and notification delivery. We did **not** manually verify automatic midnight delivery or shutdown cleanup; those are covered by the 28 automated tests.

---

## For your pair-mate to personalize

Add:
- One specific point where you disagreed with the agent or each other
- One assumption you had to look up in the Pi docs yourself (e.g., `session_start` vs factory timer restriction)
- One thing you would do differently next time

---

## Review pass: the mode guard, typechecking, and reload

### A wrong guard we found by reading the type definitions

`session_start` created the reminder's timer only when `ctx.mode === "tui"`.
Reading Pi's own type definitions for the extension context showed that this was
the wrong condition. `mode` is documented as the guard for terminal-only UI such
as custom components, while `hasUI` is documented as whether dialog-capable UI is
available, and it is true in both TUI and RPC modes. Because `ctx.ui.notify`
works in RPC, the `mode` check left the reminder silently dead for every RPC
session: the timer was never created, so no reminder could ever fire.

We fixed it red-green. First we added a wiring test asserting that an RPC
session creates exactly one timer; it failed with 0 timers against the expected
1. Then we changed the guard to `ctx.hasUI` and the test passed. The existing
non-interactive test still passes, so print and JSON modes remain silent as the
acceptance criteria require.

The lesson is that reviewing our code against the host's documented type
definitions, rather than against our own assumptions about what "interactive"
means, is what surfaced this. The 28 tests we already had all passed with the
wrong guard in place, because none of them exercised RPC mode.

### The project had no typechecking

The sources are TypeScript, but nothing ever ran a compiler over them. `npm test`
uses Node's built-in test runner, which strips type annotations and executes the
code without checking them, so type errors could not fail the build. Adding a
`typecheck` script and a `tsconfig.json` immediately surfaced a real error, not a
cosmetic one: `Notifier.notify` declared its second parameter as `type?: string`,
while Pi's `ctx.ui.notify` accepts only `"info" | "warning" | "error"`. Passing
our wider type into Pi's narrower one was rejected by the compiler. We narrowed
the interface to that union. Everything we pass is `"warning"`, so runtime
behavior is unchanged, but the interface now states the real contract and a typo
in a notification level would be caught at compile time.

Two type errors in the test helpers were also hidden by the same gap: untyped
helper parameters in the policy tests, and a spread into the `Date` constructor
in the wiring tests. Both were annotation-only fixes.

We also noticed the same YYYY-MM-DD string being built in two places, once in
the policy and once when recording a sent reminder. Two copies of the same date
arithmetic can drift apart, and "the same local day" is the single idea the
deduplication rule rests on. We extracted `localDateKey` and now call it from
both places, with tests covering the month and year boundaries.

### Reload resets the once-per-day state, and we accept that

Reloading the extension destroys the controller, and with it the in-memory
`lastReminderDate`. A reload inside the late-night window can therefore produce
a second reminder on the same calendar date. We are accepting this rather than
adding persistence: Pi treats a reload as a new session, and our acceptance
criteria already say a new session or reload may remind again. Shutdown clears
the timer and drops the controller reference, so a reload leaves no stale timer
or captured session context behind; only the reminder history resets. Making
deduplication survive a reload would require storing state outside the process,
which remains outside our chosen scope.
