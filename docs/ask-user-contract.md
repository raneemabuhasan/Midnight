# ask_user — contract, asking policy, and dependency plan

W2-0. Agreed before any code is written. Everything downstream is checked
against this document.

The `ask_user` extension shares no code with the reminder extension. It adds a
model-callable tool so the agent can put one unresolved choice to the human and
use the answer in its next turn. It is not a chat system, a remote notification
service, or a multi-agent messaging framework.

Two things this assignment deliberately separates, and so does this document:
a tool makes consultation **possible**; the model-facing description guides
**when** it is used. Neither guarantees the model spots every important
decision. There is no enforced approval gate here.

## Dependency plan

| ID | Task | depends_on | Files the worker may edit | Completion evidence |
| --- | --- | --- | --- | --- |
| W2-0 | Agree the tool contract and asking policy | [] | `docs/ask-user-contract.md` | Input/result shapes and concrete ask/proceed examples, in this document |
| W2-1 | Worker briefs and failing contract tests | [W2-0] | `tests/ask-user-*.test.ts` | Worker briefs, file ownership, and tests failing on assertions rather than imports |
| W2-2 | Implement tool registration and interaction | [W2-1] | `src/ask-user*.ts` | Contract tests pass, a real dialog works, `npm run typecheck` clean |
| W2-3 | Independently prepare review cases | [W2-1] | `docs/ask-user-review-cases.md` | Cases and expected outcomes derived from this document alone, including one genuinely unresolved design choice and one fully specified task |
| W2-4 | Review the implementation and fix supported findings | [W2-2, W2-3] | any of the above | A reproduction per finding, findings resolved, tests pass |
| W2-5 | Demonstrate agent behavior and submit | [W2-4] | `README.md`, `docs/ask-user-reflection.md` | Four scenarios recorded, reviewed PR, and a reflection on one review finding and one asking-policy decision |

```text
W2-0 → W2-1 ─┬→ W2-2 ─┐
              └→ W2-3 ─┴→ W2-4 → W2-5
```

No task starts until its upstream tasks are complete. W2-2 and W2-3 run in
parallel; both finish before W2-4.

## Worker briefs

Two roles, kept separate so the review is independent. Herdr can orchestrate
them; the briefs below stand whether or not it does. The finished extension
needs no herdr and no cross-process communication.

**Implementer — owns W2-2.**
Repository `cs480/midnight`, branch `ask-user-tool`. May edit `src/ask-user*.ts`
only. Works to the interfaces in this document. Returns: the diff, red-then-green
test output, and a typecheck run. Does not write review cases.

**Reviewer — owns W2-3, then W2-4.**
Reads this document and never the implementation while preparing cases. May edit
`docs/ask-user-review-cases.md` only. Returns findings and *proposed* tests for
the implementer to integrate sequentially; does not edit the working tree, so
the two never produce conflicting edits. Each finding carries a reproduction or
it is not actionable.

**Only the implementer edits the working tree.** Questions from either worker go
to the orchestrator, which consolidates them for the human. Until `ask_user`
itself works, ordinary conversation is how that consolidation happens.

The human pair decides which findings affect the agreed requirements.

## Input

One question per call. An agent needing two answers calls the tool twice.

```ts
Type.Object({
  question:       Type.String(),            // one clear question
  why:            Type.String(),            // brief reason the choice matters
  options:        Type.Array(               // 2 or 3, each with its tradeoff
                    Type.Object({
                      label:    Type.String(),
                      tradeoff: Type.String(),
                    }),
                    { minItems: 2, maxItems: 3 },
                  ),
  recommendation: Type.Optional(Type.String()),
})
```

Input is validated before any dialog opens. A call with fewer than two or more
than three options, or with an empty `question`, is rejected as a failed tool
result naming the violated constraint — the human is never shown a malformed
question.

`why` and `recommendation` are displayed to the human, not merely recorded. The
human can always write an answer that is none of the offered options.

### Worked example

The question Lab 1 left unresolved, which is also this assignment's example:

- **question** — "Should the reminder remember previous notifications after Pi restarts?"
- **why** — "Lab 1 left this provisional. It changes user-visible behavior: with session-only state, someone who restarts Pi at 02:00 is reminded a second time the same night."
- **options**
  - "Session-only (current behavior)" — *no new files or formats; a restart re-reminds on the same date.*
  - "Persist one date key to disk" — *at most one reminder per local date across restarts; adds a state file, a format to maintain, and cleanup.*
- **recommendation** — "Session-only, unless cross-restart deduplication is required; it keeps the project free of runtime dependencies."

## Result

The tool returns a normal result in every case and never throws for a human
outcome. "No decision" is a result the agent must handle, not an error to retry.

| Status | Cause | `answer` | `source` |
| --- | --- | --- | --- |
| `answered` | Human picked an offered option | the option label | `option` |
| `answered` | Human wrote their own answer | their text, verbatim | `custom` |
| `cancelled` | Human dismissed the dialog, or submitted an empty or whitespace-only answer | `null` | — |
| `unavailable` | No dialog-capable UI in this session | `null` | — |

Model-facing text states the status explicitly. For `cancelled` and
`unavailable` it says that no decision was supplied and that the agent must not
assume a default; the agent identifies what remains undecided rather than
inventing an answer.

`details` carries `{ question, options, recommendation, status, answer, source }`
so the transcript can be reconstructed and the result rendered.

**An answer that contradicts the recommendation is returned exactly as given**,
with no warning, hedge, or re-prompt in the model-facing text. The human
overrules the recommendation by definition. The recommendation is kept in
`details` so a reviewer can see what was overruled; the tool draws no conclusion
from the difference and computes no agreement flag, because a recommendation is
prose and an option label is not.

## Behavior rules

1. Check dialog availability before showing anything. The guard is `ctx.hasUI`,
   true in both TUI and RPC modes — exactly where `ctx.ui.select` and
   `ctx.ui.input` work. `ctx.mode === "tui"` guards terminal-only custom
   components and is the wrong condition here.
2. When no UI is available, return `unavailable` without attempting a dialog.
3. Wait for the human before returning `answered`.
4. An empty or whitespace-only custom answer is `cancelled`, never `answered`
   with an empty string.
5. Preserve a custom answer verbatim apart from trimming surrounding whitespace.
6. Use Pi's existing dialogs, not a custom terminal component. A custom
   component returns `undefined` in RPC mode and cannot be tested without a
   terminal.
7. The interaction takes its dialog as an injected dependency, so every case
   above is testable without a terminal.
8. Option labels must stay distinguishable to the human after rendering; two
   options that render identically are a defect.

**Our choice, not a requirement:** no timeout and no auto-dismissal. Pi's
dialogs accept a `timeout` that resolves to `undefined`, which would map to
`cancelled` and so would not "silently select a default." We still decline it,
because a question worth asking is worth waiting for.

## Asking policy

This goes in the tool's model-facing description, not only in this document.
Asking about everything is as wrong as never asking.

**Ask when:**

- An unresolved choice materially changes user-visible behavior and the material
  does not settle it. *Example: the spec says reminders stop "at night" without
  defining the hours.*
- The choice changes scope or reaches an external service. *Example: a fix needs
  a new runtime dependency in a project that has none.*
- A missing fact would cause rework if guessed wrong. *Example: which of two
  incompatible file formats the grader expects.*
- A stop condition has been reached but finishing anyway looks harmless. The
  human set that boundary and owns moving it.

**Proceed without asking when:**

- The requirement is already stated. Re-confirming a written requirement wastes
  the human's attention.
- The detail is routine and reversible. *Example: a local variable name, the
  order of independent commits, the wording of a log line.*
- The answer is discoverable from the repository, the docs, or a test run. Go
  and look.

**When a question goes unanswered:** name the undecided choice in the reply,
state what is blocked by it, and stop short of the dependent work. Do not pick
an option, do not proceed on an assumption, and do not re-open the dialog on a
loop.

### The contrasting scenarios

Two promptings of the same underlying choice, which is where the policy earns
its keep:

> **A.** "Make reminders persist across restarts or not, as you think best."
>
> **B.** "Keep reminder state only for this session."

**B specifies the behavior. Proceed; asking would be noise.**

**A is the interesting one, and our reading is that it still warrants a question.**
"As you think best" delegates the *authority to choose*; it does not supply the
*knowledge of which is better*, and it does not make the consequence smaller.
The choice changes user-visible behavior and is expensive to reverse once a
state file and its format exist. So the tool should ask — with a recommendation,
so that delegation is honoured and the human can accept in a single keystroke.
Delegation lowers the cost of proceeding; it does not erase the ask when the
consequence is user-visible and hard to undo.

The general rule we take from this: **permission to decide is not the same as
the decision being unimportant.**

**Revised test prompt.** Because "as you think best" reads as permission, it is
a poor probe for the behavior we actually want to observe. The demo prompt is
instead worded to leave the behavior genuinely unresolved without granting
authority:

> "Finish the reminder so it behaves sensibly for someone who restarts Pi
> several times in one night."

That names a user-visible outcome, supplies no decision, and does not tell the
agent it may choose — so whether it asks is informative rather than
pre-authorised.

## What the tests prove, and what they do not

Kept distinct in the README and the reflection, because they answer different
questions:

- **Automated tests verify the tool's mechanics**: that each outcome produces
  the right status and preserves the right answer. These are deterministic and
  they are proof.
- **Model demonstrations are observations**, not proof. They show that one model
  asked on one task on one day. A passing demo does not establish that the agent
  will always ask when it should, and a model that fails to ask is not
  necessarily a defect in the tool.

Both get reported. Neither substitutes for the other.

## Demonstration scenarios

Four, per the assignment, plus the test run:

1. **Selection** — the agent calls `ask_user` on a genuinely unresolved choice,
   the human picks an option, and the agent's *subsequent work* uses it.
2. **Custom answer** — the human writes an answer that is none of the options,
   returned verbatim.
3. **Cancellation** — the human dismisses the dialog; the agent names the
   undecided choice instead of guessing.
4. **No question needed** — a fully specified task, where the agent proceeds
   without consulting.

A question asked in ordinary chat does not demonstrate the extension. Each
scenario must show the `ask_user` call and its result.

## Out of scope

Multiple questions in one call; remembering answers across calls or sessions;
timeouts and auto-defaults; notifying the human anywhere other than the active
session; an enforced approval gate; any dependency on the reminder extension.
The project has no runtime dependencies and this extension adds none.
