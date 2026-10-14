# ask_user — demonstration script

W2-5. Four scenarios in 60–90 seconds, plus the test run. Each must show the
`ask_user` call and its result; a question asked in ordinary chat does not
demonstrate the extension.

Load it with `pi --extension ./src/ask-user.ts`. Record the terminal.

## Before recording

The agent has to *choose* to call the tool in scenarios 1–3, so use a model that
tool-calls reliably. A model that never calls it, or calls it on everything,
tells you nothing about the extension — see the note at the end.

Have `npm test` ready in a second pane so the final shot needs no typing.

## Scenario 1 — selection, and the agent using the answer (~25 s)

Prompt:

> Finish the reminder so it behaves sensibly for someone who restarts Pi several
> times in one night.

This names a user-visible outcome, supplies no decision, and does not tell the
agent it may choose — so whether it asks is informative rather than
pre-authorised. Deliberately *not* worded "as you think best"; see the
contrasting scenarios in the contract.

Show: the `ask_user` call → the dialog with the question, the reason, both
tradeoffs and the recommendation → select an option → the result returned → **the
agent's next turn acting on that answer.** The last part is the one the
assignment names explicitly and the easiest to cut short.

## Scenario 2 — a custom answer (~15 s)

Same prompt, fresh session. At the dialog, choose the last row
("Let me write a different answer") and type something that is none of the
offered options, for example:

> Keep it session-only but log the skipped reminder

Show: the free-text dialog → the answer returned verbatim → the agent using it.

## Scenario 3 — cancellation (~15 s)

Same prompt, fresh session. At the dialog, press Escape.

Show: `status: cancelled` → **the agent naming the choice as undecided and
stopping**, rather than picking an option. If the model instead proceeds on an
assumption, record that and say so; it is an honest observation about the model,
not a reason to re-shoot until it behaves.

## Scenario 4 — no question needed (~10 s)

Fresh session. Prompt:

> In `src/time-policy.ts`, keep reminder state only for this session. Add a
> comment above `shouldRemind` saying so.

Fully specified: the behavior is stated and the rest is routine and reversible.

Show: the agent making the edit with **no `ask_user` call**. The absence is the
point, so keep the tool list or the transcript visible enough that a viewer can
see nothing was called.

## Scenario 5 — the tests (~10 s)

Switch panes and run:

```bash
npm test
```

Show the summary line: 48 tests, 48 pass, 0 fail. Cancellation, empty answers
and unavailable UI are all covered here, which is why the video does not need to
stage every edge case.

## If the model will not call the tool

Record scenarios 4 and 5 as they are, then demonstrate the plumbing directly by
instructing the agent to call the tool:

> Call the ask_user tool to ask me whether the reminder should remember
> notifications after Pi restarts, with session-only and persist-to-disk as the
> options.

That still shows the call, the dialog and the result returned, which is what the
assignment requires of the demonstration. State plainly in the submission that
scenarios 1–3 were produced by instructing the call rather than by the model
choosing to make it. The distinction matters: the tool's mechanics are proven by
the tests either way, and whether a given model asks unprompted is a separate
observation.
