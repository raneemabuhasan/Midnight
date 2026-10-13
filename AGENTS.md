# AGENTS.md

Conventions already in use in this repository. Follow them when making changes.

## Workflow

- **Red, green, review.** Write a failing test first and show that it fails.
  Make it pass with the smallest change that does so. Review the diff before
  pushing.
- **One behavior change per commit.** A commit that changes behavior carries the
  test that proves it. Tooling, documentation, and pure refactors go in their own
  commits.
- **Run both checks before committing**: `npm test` and `npm run typecheck`.

## Layering

- **Time logic is a pure function of `(now, lastReminderDate)`.** `shouldRemind`
  and `localDateKey` in `src/time-policy.ts` take the current time as an
  argument. There is no `new Date()` inside the policy — it reads no clock, sets
  no timer, and performs no I/O. This is what makes the window and
  deduplication rules testable with simulated time.
- **The Pi layer owns timers and session state, never time rules.**
  `src/reminder.ts` and `src/reminder-controller.ts` hold the interval handle,
  the per-session `lastReminderDate`, and the notifier; they ask the policy for
  decisions instead of re-deriving them. Any date arithmetic that both layers
  need lives in `time-policy.ts` and is imported, not duplicated.
- **Dependencies are injected.** The controller takes `clock`, `timers`, and
  `notifier` so tests can supply fakes without Pi.

## Testing

- **Simulated time only.** Tests pass explicit `Date` values; the wiring tests
  additionally replace `globalThis.Date` and `globalThis.setInterval`. Never
  change the machine clock and never wait for real time to pass.
- **Assert behavior, not just registration.** A wiring test should check that a
  handler does the right thing when invoked, not merely that it was registered.
- Guard the extension on `ctx.hasUI`, which is true wherever `ctx.ui.notify` can
  deliver. `ctx.mode === "tui"` is the guard for terminal-only UI such as custom
  components, not for notifications.

## Out of scope

Do not add any of the following without a decision from the repository owners:
cross-session or cross-process persistence of reminder history, snooze,
configurable late-night hours, timezone configuration, customizable reminder
message text, OS-level notifications or sound, new slash commands, or new
runtime dependencies. The project has no runtime dependencies; everything in
`devDependencies` is types or tooling.
