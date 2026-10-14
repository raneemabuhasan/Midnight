# ask_user — reflection

W2-5. One review finding and one asking-policy decision, as the assignment asks,
plus what the tests settle and what they cannot.

## One review finding: a visually empty answer counted as a decision

The independent reviewer, working from the contract and without reading the
implementation, asked what happens when the custom answer is only a zero-width
space. We had a rule for it — rule 4, "an empty or whitespace-only custom answer
is `cancelled`, never `answered` with an empty string" — and a test for it, which
passed. The test used `"   \n  "`.

The reproduction took one case:

```
input returns "​"  →  status "answered", answer "​"
```

`String.prototype.trim` removes the Unicode whitespace set, which includes the
no-break space and the ideographic space, but **not** the zero-width characters.
So U+200B survived the trim, failed the emptiness check because it was no longer
an empty string, and came back as a decision the agent would have acted on. The
dialog would have looked, to the human, exactly like submitting nothing.

The fix was to define one whitespace class — `\s` plus U+200B, U+200C, U+200D and
U+FEFF — and use it for both the trim and the emptiness test, in that order. Four
regression tests now cover the zero-width space, the no-break space, the
ideographic space and the byte-order mark.

What we took from it is not "handle Unicode". It is that **the defect was in the
contract, not only in the code.** Rule 4 said "whitespace-only" and never said
what whitespace was, so an implementation could satisfy it literally and still
return a blank answer as consent. Our own test had quietly chosen a definition —
spaces and newlines — and then proved that definition against itself. A reviewer
who had read our implementation would likely have read our test and inherited
the same blind spot. The independence was what found it, and the reviewer raised
it as a specification risk before it was a code defect. Two of the other three
findings were the same shape: behaviors the contract had not pinned down at all
(a dialog that throws, an aborted turn), rather than code that disagreed with it.

Three findings were fixed and recorded as contract rules 9 to 12. Two of the
reviewer's cases turned out to be already correct, and one — whether two options
with identical labels should be rejected or merely rendered distinguishably — we
resolved in the implementation by numbering the rows, which makes every row
unique by construction rather than by validation.

## One asking-policy decision: permission to decide is not the decision being unimportant

The assignment asks whether `"make reminders persist across restarts or not, as
you think best"` genuinely delegates the choice, or calls for clarification. We
decided it still calls for a question, and this was the decision we argued about
most.

The case for proceeding is real: the human used the words "as you think best",
and an agent that asks anyway is ignoring a plain instruction and spending
attention the human explicitly tried to save. The case for asking is that "as you
think best" grants the *authority* to choose but supplies none of the
*information* that would make one choice better, and it does not shrink the
consequence. Persistence changes user-visible behavior, and once a state file and
its format exist, reversing it is expensive.

We resolved it as: delegation lowers the cost of proceeding, it does not erase
the ask when the consequence is user-visible and hard to undo. The tool should
ask, *with a recommendation*, so the delegation is honoured and the human can
accept in one keystroke. Asking with a recommendation costs the human a single
keypress; guessing wrong costs a migration.

That also made us change the demo prompt. "As you think best" reads as
permission, so an agent that proceeds on it has not necessarily shown bad
judgement, which makes it a poor probe for the behavior we wanted to observe. We
reworded it to leave the behavior unresolved without granting authority:
"Finish the reminder so it behaves sensibly for someone who restarts Pi several
times in one night."

The same rule has a precedent in this repository. During Lab 1 we told an agent
to stop at a specific gate; it finished three commits first and then told us
why — its reasoning was sound and the work was good, but it had decided our
boundary was wrong on our behalf. That is the fourth clause in our "ask when"
list: a stop condition has been reached but finishing anyway looks harmless. The
human set the boundary and owns moving it.

## What the tests settle, and what they do not

The 48 automated tests settle the tool's **mechanics**. Every outcome in the
contract is reachable from a test because the dialog is injected: option
selection, a custom answer, dismissal, an empty answer, unavailable UI, an
aborted turn, a dialog that throws, and an answer that contradicts the
recommendation. None of them need a terminal or a model. They are deterministic
and they are proof.

The recorded demonstrations settle nothing of the kind. They show one model, on
one task, on one day. A model that asks correctly in the video may fail to ask
tomorrow, and a model that does not ask is not evidence the tool is broken. The
dividing line we used throughout W2-4 was: anything reproducible with a fake
dialog and no model is a tool defect; anything that needs a live model to observe
is a defect in the asking policy's wording, or simply the model's judgement.

This is also the honest limit of the assignment. The tool makes consultation
possible and the description makes it likely. Neither makes it certain, and we
did not build an enforced approval gate.
