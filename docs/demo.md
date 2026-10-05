# Midnight Reminder Extension — Demonstration Procedure

## Automated tests

Run all tests from the repository root:

```bash
# Open a terminal in the cloned repository folder, then:
npm test
```

Expected: 28 tests pass (8 policy + 12 integration + 8 wiring), zero failures.

### What the tests cover

| Test suite | What it proves |
|---|---|
| `tests/time-policy.test.ts` | Pure decision logic: `shouldRemind` correctly identifies the 00:00–06:00 window and prevents same-date duplicates |
| `tests/integration.test.ts` | The controller sends notifications on startup, deduplicates, crosses midnight, guards noninteractive mode, and cleans up on shutdown |
| `tests/extension-wiring.test.ts` | The Pi extension factory registers `/bedtime-test`, defers timers to `session_start`, honors TUI-only mode, and drops its controller reference on shutdown |

All policy and controller tests use **simulated time** — no waiting for midnight or changing the system clock. The wiring tests additionally mock `globalThis.Date` and `globalThis.setInterval` so the real extension entry point runs against a fixed clock.

---

## Interactive demonstration

### Verified preview (October 5, 2026)

```bash
pi --extension ./src/reminder.ts
```

Inside the Pi session:
```
/bedtime-test
```

Pi displayed:
> Warning: It's late! Save your work and get some sleep.

This confirms the slash command reaches the controller, the notification is visible, and the controller does not crash when invoked outside the automatic reminder window.

### What this did NOT verify

We did **not** manually verify:
- Automatic midnight delivery (requires running Pi at 00:00–06:00 local time)
- Cleanup on shutdown (we trust the `session_shutdown` event handler; automated tests verify the timer is cleared)
- Calendar-date deduplication across midnight (automated tests cover date rollover)

### To verify automatic midnight behavior

1. Open Pi with the extension at 00:00–06:00 local time:
   ```bash
   pi --extension ./src/reminder.ts
   ```
2. The reminder is checked **immediately on startup**; expect the notification right away if the time is in the window and no reminder was shown today.
3. In an already-running session, the timer checks every **30 seconds** without needing a new user prompt.
4. Confirm the reminder appears **at most once per calendar date**.
5. Quit Pi; confirm the process exits cleanly.

---

## Quick reference

| File | Purpose |
|---|---|
| `src/time-policy.ts` | Pure function: given a Date and last-reminder date, decide whether to remind |
| `src/reminder-controller.ts` | Injectable coordinator: startup check, 30 s timer, dedup, preview, shutdown |
| `src/reminder.ts` | Pi extension factory: wires events, registers `/bedtime-test`, guards non-TUI |
