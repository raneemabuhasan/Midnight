import { describe, it } from "node:test";
import assert from "node:assert";
import { askUser, CUSTOM_ANSWER_LABEL } from "../src/ask-user-dialog.ts";
import type { AskUserQuestion, AskUserUI } from "../src/ask-user-dialog.ts";

/* ── helpers ─────────────────────────────────────────────── */

/**
 * The question Lab 1 left provisional, which is also the example question in
 * the assignment. See docs/ask-user-contract.md.
 */
function makeQuestion(overrides: Partial<AskUserQuestion> = {}): AskUserQuestion {
  return {
    question: "Should the reminder remember previous notifications after Pi restarts?",
    why: "Lab 1 left this provisional. With session-only state, someone who restarts Pi at 02:00 is reminded a second time the same night.",
    options: [
      {
        label: "Session-only (current behavior)",
        tradeoff: "No new files or formats; a restart re-reminds on the same date.",
      },
      {
        label: "Persist one date key to disk",
        tradeoff: "At most one reminder per local date across restarts; adds a state file to maintain.",
      },
    ],
    recommendation: "Session-only, unless cross-restart deduplication is required.",
    ...overrides,
  };
}

/**
 * Fake dialog that records every call.
 *
 * `selectReturns` receives the option rows it was shown, so a test can choose
 * by position or by content without depending on how rows are rendered.
 */
function makeFakeUI(
  opts: {
    selectReturns?: (shown: string[]) => string | undefined;
    inputReturns?: string | undefined;
  } = {},
) {
  const selectCalls: { title: string; options: string[] }[] = [];
  const inputCalls: { title: string; placeholder?: string }[] = [];

  const ui: AskUserUI = {
    async select(title, options) {
      selectCalls.push({ title, options });
      return opts.selectReturns ? opts.selectReturns(options) : undefined;
    },
    async input(title, placeholder) {
      inputCalls.push({ title, placeholder });
      return opts.inputReturns;
    },
  };

  return { ui, selectCalls, inputCalls };
}

/** A dialog that must never be opened. */
function makeForbiddenUI(): AskUserUI {
  return {
    async select() {
      throw new Error("select was opened when no dialog UI is available");
    },
    async input() {
      throw new Error("input was opened when no dialog UI is available");
    },
  };
}

/* ── tests ───────────────────────────────────────────────── */

describe("ask_user dialog (fake dialog interface)", () => {
  it("returns the selected option's label", async () => {
    const { ui, inputCalls } = makeFakeUI({ selectReturns: (shown) => shown[1] });

    const outcome = await askUser(makeQuestion(), { hasUI: true, ui });

    assert.strictEqual(outcome.status, "answered");
    assert.strictEqual(outcome.source, "option");
    assert.strictEqual(
      outcome.answer,
      "Persist one date key to disk",
      "the answer must be the option label, not the rendered row",
    );
    assert.strictEqual(inputCalls.length, 0, "choosing an option must not open the text input");
  });

  it("returns a custom answer verbatim, trimmed of surrounding whitespace", async () => {
    const { ui, inputCalls } = makeFakeUI({
      selectReturns: (shown) => shown.find((row) => row.includes(CUSTOM_ANSWER_LABEL)),
      inputReturns: "   keep it in memory but log the skip   ",
    });

    const outcome = await askUser(makeQuestion(), { hasUI: true, ui });

    assert.strictEqual(outcome.status, "answered");
    assert.strictEqual(outcome.source, "custom");
    assert.strictEqual(outcome.answer, "keep it in memory but log the skip");
    assert.strictEqual(inputCalls.length, 1, "the custom choice must open the text input exactly once");
  });

  it("reports cancelled when the human dismisses the selector", async () => {
    const { ui, inputCalls } = makeFakeUI({ selectReturns: () => undefined });

    const outcome = await askUser(makeQuestion(), { hasUI: true, ui });

    assert.strictEqual(outcome.status, "cancelled");
    assert.strictEqual(outcome.answer, null);
    assert.strictEqual(outcome.source, null);
    assert.strictEqual(inputCalls.length, 0, "a dismissed selector must not fall through to the input");
  });

  it("reports cancelled when the custom answer is empty or whitespace", async () => {
    const { ui } = makeFakeUI({
      selectReturns: (shown) => shown.find((row) => row.includes(CUSTOM_ANSWER_LABEL)),
      inputReturns: "   \n  ",
    });

    const outcome = await askUser(makeQuestion(), { hasUI: true, ui });

    assert.strictEqual(
      outcome.status,
      "cancelled",
      "an empty answer must never be reported as answered; that would claim consent",
    );
    assert.strictEqual(outcome.answer, null);
    assert.strictEqual(outcome.source, null);
  });

  it("reports unavailable without opening a dialog when there is no UI", async () => {
    const outcome = await askUser(makeQuestion(), { hasUI: false, ui: makeForbiddenUI() });

    assert.strictEqual(outcome.status, "unavailable");
    assert.strictEqual(outcome.answer, null);
    assert.strictEqual(outcome.source, null);
  });

  it("returns an answer that contradicts the recommendation exactly as given", async () => {
    // The recommendation favours session-only; the human picks persistence.
    const { ui } = makeFakeUI({ selectReturns: (shown) => shown[1] });

    const outcome = await askUser(makeQuestion(), { hasUI: true, ui });

    assert.deepStrictEqual(
      outcome,
      { status: "answered", answer: "Persist one date key to disk", source: "option" },
      "an answer against the recommendation is returned as given, with nothing added",
    );
  });

  it("shows the question, the reason, every tradeoff, and a way to write an answer", async () => {
    const { ui, selectCalls } = makeFakeUI({ selectReturns: () => undefined });

    await askUser(makeQuestion(), { hasUI: true, ui });

    assert.strictEqual(selectCalls.length, 1, "the selector must be opened once");
    const { title, options } = selectCalls[0]!;

    assert.ok(title.includes("remember previous notifications"), "the question must be shown");
    assert.ok(title.includes("reminded a second time"), "the reason it matters must be shown");
    assert.ok(title.includes("unless cross-restart deduplication"), "the recommendation must be shown");

    const rows = options.join("\n");
    assert.ok(rows.includes("No new files or formats"), "the first tradeoff must be shown");
    assert.ok(rows.includes("adds a state file"), "the second tradeoff must be shown");
    assert.ok(
      options.some((row) => row.includes(CUSTOM_ANSWER_LABEL)),
      "the human must be offered a way to write their own answer",
    );
  });
});
