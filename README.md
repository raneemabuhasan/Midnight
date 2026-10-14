# Midnight
480HW3_Midnight

A Pi extension lab developed from scratch by a pair of students using one Pi coding agent. No instructor starter repository was supplied.

## Acceptance criteria

- Use the machine's local calendar date and local time; late-night hours are 00:00 inclusive through 06:00 exclusive.
- Show a visible, nonblocking reminder to save work and get some sleep.
- While interactive Pi is open and the machine is awake, notify within 60 seconds of midnight, even without a new prompt.
- Check immediately on interactive session startup and periodically afterward (planned interval: 30 seconds).
- Read the real current time on every check. After a pause, notify if still in the window; skip a missed reminder after 06:00.
- Allow at most one automatic reminder per local date in an extension session. Repeated checks and prompts must not duplicate notifications.
- A new session or reload may remind again.
- Provide `/bedtime-test` to preview the notification without changing automatic reminder history.
- Stop timers on shutdown; reload must leave no old timer or captured session context.
- Noninteractive modes create no timer and show no notification.
- Delivery must not call a model, block tools, or terminate Pi.
- Use simulated time in tests. Do not change the computer clock or wait until midnight.

## Development status

Implementation and tests are complete:

| Component | Status |
|---|---|
| Time policy (`src/time-policy.ts`) | ✅ Implemented; 8 unit tests passing |
| Reminder controller (`src/reminder-controller.ts`) | ✅ Implemented; 12 integration tests passing |
| Pi extension entry point (`src/reminder.ts`) | ✅ Implemented; 8 wiring tests passing |
| Total automated test coverage | ✅ 28 tests pass |

Cross-restart or cross-process persistence of reminder history is **not implemented**.
Reminder history currently resets when Pi starts a new session or reloads.
This is our provisional scope choice, pending instructor clarification.

## Files

- `src/time-policy.ts` — Pure logic: decides whether a given Date is inside the 00:00–06:00 window and whether the date was already reminded.
- `src/reminder-controller.ts` — Injectable controller: clock, timers, notifier. Handles startup check, 30-second periodic checks, deduplication, shutdown, and `/bedtime-test` preview.
- `src/reminder.ts` — Pi extension factory. Registers `/bedtime-test`, wires `session_start` / `session_shutdown`, guards non-TUI modes.
- `tests/time-policy.test.ts` — Unit tests for the policy with fixed simulated dates.
- `tests/integration.test.ts` — Controller tests with fake timers, clock, and notifier.
- `tests/extension-wiring.test.ts` — Tests that the Pi extension factory registers commands and event handlers correctly. Uses a fake Pi API plus global `Date` and `setInterval` mocking to keep timing deterministic.

## How to run

### Automated tests

```bash
# Open a terminal in the cloned repository folder, then:
npm test
```

All tests run without an interactive session. The policy and controller tests use purely injected simulated time. The wiring tests additionally mock `globalThis.Date` and `globalThis.setInterval` so the real extension entry point is exercised against a fixed clock and fake timers.

### Interactive demonstration — preview verified October 5, 2026

We loaded the extension interactively and verified `/bedtime-test`:

```bash
# Configure Pi model credentials first
pi --extension ./src/reminder.ts
```

Inside Pi we typed `/bedtime-test` on October 5, 2026 and Pi displayed:
> Warning: It's late! Save your work and get some sleep.

This confirms the command wiring and notification rendering.

We did **not** manually verify automatic midnight delivery or shutdown cleanup during this session. Those behaviors are covered by the 28 automated tests.

### To attempt full automatic verification

- Start Pi with the extension between midnight and 6 a.m. local time.
- The reminder is checked **immediately on startup**; you should see the notification right away if the time is in the window and no reminder was shown today.
- Repeated-check and duplicate-prevention behavior are verified using simulated-time tests. The interactive preview verifies notification display.
- Confirm the reminder appears **at most once per calendar date**.
- Quit Pi and confirm the process exits cleanly with no dangling timers.

## API access

The provided group key is for the coding agent's model access, not the reminder logic itself. Confirm provider, model, and any custom API base URL with the instructor. Configure credentials locally; never commit keys or paste them into project documentation.

## ask_user — the second extension

A separate extension exposing a model-callable `ask_user` tool, so the agent can
put one unresolved choice to the human and use the answer. It shares no code with
the reminder; the two are independent extensions in one repository.

The agreed contract, asking policy and dependency plan are in
[`docs/ask-user-contract.md`](docs/ask-user-contract.md); the independent review
cases are in [`docs/ask-user-review-cases.md`](docs/ask-user-review-cases.md).

### Result states

| Status | Cause | `answer` |
| --- | --- | --- |
| `answered` | an offered option was chosen (`source: "option"`), or the human wrote their own answer (`source: "custom"`) | the label, or their text verbatim |
| `cancelled` | the dialog was dismissed, the answer was empty or whitespace-only, or the turn was aborted | `null` |
| `unavailable` | no dialog-capable UI in this session, or the dialog failed to open | `null` |

`cancelled` and `unavailable` mean no decision was supplied. The model-facing
text says so and tells the agent not to assume a default.

### Running it

```bash
pi --extension ./src/ask-user.ts
```

The dialog needs `ctx.hasUI`, which is true in both interactive and RPC modes.
In print or JSON mode the tool returns `unavailable` without opening anything.

For the demonstration scenarios and the prompts that produce them, see
[`docs/ask-user-demo.md`](docs/ask-user-demo.md).

### Testing it

```bash
npm test
npm run typecheck
```

48 tests across both extensions, none of which need a terminal or a model: the
dialog is injected, so option selection, custom answers, dismissal, empty
answers and unavailable UI are all exercised against a fake.

### What the tests prove, and what they do not

The automated tests verify the tool's **mechanics** — that each outcome produces
the right status and preserves the right answer. They are deterministic, and
they are proof.

The recorded demonstrations are **observations**. They show that one model asked
on one task on one day. A passing demonstration does not establish that the
agent will always ask when it should, and a model that fails to ask is not
necessarily a defect in the tool. Our reflection
([`docs/ask-user-reflection.md`](docs/ask-user-reflection.md)) keeps the two
apart.

## Assignment reference

https://github.com/baochunli/umass-lectures/blob/main/student-assignment.md
