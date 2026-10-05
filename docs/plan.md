# Plan and evidence

Use one Pi coding agent. Students inspect and explain each stage before continuing. This preparation was written in Codex; do not represent it as a Pi development session.

| Task | Depends on | Work | Completion evidence |
| --- | --- | --- | --- |
| W1-0 | none | Create a branch; verify Pi/model, Git, gh, rg; establish a minimal test runner because no starter was provided | Version checks, successful model response, runnable test setup |
| W1-1 | W1-0 | Review README criteria, create issue, inspect installed Pi documentation | Issue, API notes, student review |
| W1-2 | W1-1 | Agree on pure policy interface and write failing tests | Meaningful failures, not import errors |
| W1-3 | W1-2 | Implement minimal local-time policy | Passing tests and reviewed diff |
| W1-4 | W1-3 | Preview command; failing integration tests; automatic startup/idle checks and cleanup | Fake-clock checks plus real notification preview |
| W1-5 | W1-4 | Review, demonstrate, document, commit and open PR | Test evidence, demo, student reflection, PR |

## Proposed files and test setup

- package.json: Node built-in test runner; avoid new dependencies unless needed.
- src/time-policy.ts: pure decision using supplied Date and reminder history.
- src/reminder.ts: extension entry point; command, lifecycle, injected clock/timer for testing.
- tests/: Node tests, outside extension discovery.
- docs/evidence.md: actual failing/passing output and review notes; never invent evidence.

Installed Node 24 supports erasable TypeScript syntax; validate that setup before writing policy tests. Load only src/reminder.ts in Pi, not the test directory.

## Policy test cases

23:59 -> no reminder; 00:00 -> reminder; 00:01 already reminded today -> no duplicate; 05:59 -> reminder; 06:00 and noon -> no reminder; next local date at midnight -> reminder again. Construct fixtures with local date components. Verify date handling in a non-UTC timezone.

## Integration test cases

Immediate late-night startup; idle crossing of midnight within 60 simulated seconds; repeated checks do not duplicate; preview does not consume automatic reminder; next date can remind; pause/resume inside window; pause/resume after 06:00; shutdown clears timer; repeated cleanup is safe; reload has no old callbacks/context; noninteractive modes create no timer or notification.

## First Pi prompt

Read README.md, docs/plan.md, and the installed Pi documentation. We have no instructor starter. Use one agent. Start by verifying the environment and proposing the smallest test setup. Do not implement reminder behavior yet. Then work through the task IDs in order, writing failing tests before each implementation stage. Explain unfamiliar TypeScript and ask us to inspect each diff. Do not retrieve or copy a finished reminder extension.

## Human review notes (to complete during the lab)

- One tool call: what the agent requested, what executed, what came back.
- One decision checked or actual agent mistake corrected.
- Explanation of why a timer can check while the model is idle.
- Instructor-provided documentation/review skill and lecture MCP example: complete if supplied; no substitute claimed here.
