import { describe, it } from "node:test";
import assert from "node:assert";
import { askUser, CUSTOM_ANSWER_LABEL } from "../src/ask-user-dialog.ts";
import type { AskUserQuestion, AskUserUI } from "../src/ask-user-dialog.ts";

/** Findings raised by the independent reviewer; see docs/ask-user-review-cases.md. */

const question: AskUserQuestion = {
  question: "Should the reminder remember notifications after Pi restarts?",
  why: "It changes user-visible behavior after a restart.",
  options: [
    { label: "Session-only", tradeoff: "No new files; a restart re-reminds." },
    { label: "Persist to disk", tradeoff: "Survives restarts; adds a state file." },
  ],
};

function ui(
  select: (rows: string[], opts?: { signal?: AbortSignal }) => string | undefined,
  inputReturns?: string,
): AskUserUI {
  return {
    async select(_title, rows, opts) {
      return select(rows, opts);
    },
    async input() {
      return inputReturns;
    },
  };
}

const pickCustom = (rows: string[]) => rows.find((row) => row.includes(CUSTOM_ANSWER_LABEL));

describe("ask_user review findings", () => {
  for (const [name, blank] of [
    ["zero-width space", "​"],
    ["no-break space", " "],
    ["ideographic space", "　"],
    ["byte-order mark", "﻿"],
  ] as const) {
    it(`case 9: a custom answer of only a ${name} is cancelled`, async () => {
      const outcome = await askUser(question, { hasUI: true, ui: ui(pickCustom, blank) });

      assert.strictEqual(
        outcome.status,
        "cancelled",
        `a visually empty answer must not be reported as answered (answer was ${JSON.stringify(outcome.answer)})`,
      );
      assert.strictEqual(outcome.answer, null);
    });
  }

  it("case 27: a dialog that throws yields unavailable, not a propagated error", async () => {
    const throwing: AskUserUI = {
      async select() {
        throw new Error("tty closed");
      },
      async input() {
        return undefined;
      },
    };

    const outcome = await askUser(question, { hasUI: true, ui: throwing });

    assert.strictEqual(outcome.status, "unavailable");
    assert.strictEqual(outcome.answer, null);
  });

  it("case 40: an aborted turn resolves as cancelled and the signal reaches the dialog", async () => {
    const controller = new AbortController();
    controller.abort();
    let sawSignal = false;

    const outcome = await askUser(question, {
      hasUI: true,
      signal: controller.signal,
      ui: ui((rows, opts) => {
        sawSignal = opts?.signal?.aborted === true;
        return opts?.signal?.aborted ? undefined : rows[0];
      }),
    });

    assert.ok(sawSignal, "the turn's abort signal must be passed to the dialog");
    assert.strictEqual(outcome.status, "cancelled");
  });

  it("case 41: the caller's question object is not mutated", async () => {
    const before = JSON.stringify(question);

    await askUser(question, { hasUI: true, ui: ui((rows) => rows[0]) });

    assert.strictEqual(JSON.stringify(question), before);
  });
});
