import { Type } from "typebox";
import type { Static } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { askUser } from "./ask-user-dialog.ts";
import type { AskUserOutcome, AskUserQuestion } from "./ask-user-dialog.ts";

/* ── parameter schema ────────────────────────────────────── */

const OptionSchema = Type.Object({
  label: Type.String({ description: "Short name for this option, as the human will see it." }),
  tradeoff: Type.String({ description: "What the human gains or gives up by choosing it." }),
});

const AskUserParams = Type.Object({
  question: Type.String({
    description: "One clear question about a single choice.",
  }),
  why: Type.String({
    description: "One or two sentences on why this choice matters.",
  }),
  options: Type.Array(OptionSchema, {
    minItems: 2,
    maxItems: 3,
    description: "Two or three options, each with its tradeoff.",
  }),
  recommendation: Type.Optional(
    Type.String({ description: "Optional. Which option you would choose, and why." }),
  ),
});

type AskUserParamsType = Static<typeof AskUserParams>;

/* ── model-facing instructions ───────────────────────────── */

/**
 * The asking policy from docs/ask-user-contract.md, written for the model.
 * Asking about everything is as wrong as never asking, so both halves are here.
 */
const DESCRIPTION = [
  "Put one question to the human when an unresolved choice materially changes user-visible behavior, scope, or the amount of rework, and the material you have does not settle it.",
  "",
  "Ask when: an important product choice is genuinely unresolved; the choice changes scope or reaches an external service; a wrong guess would cause rework; or a stop condition has been reached and only the human can move it.",
  "",
  "Proceed without asking when: the behavior is already specified; the detail is routine and reversible, such as a variable name, the order of independent commits, or the wording of a log line; or the answer is discoverable from the repository, the documentation, or a test run.",
  "",
  "The result is explicit. If it comes back cancelled or unavailable, no decision was supplied: do not assume a default, do not pick an option, and do not claim the human agreed. Name the choice that is still undecided, say what it blocks, and stop short of the dependent work.",
  "",
  "One question per call. Call again for a second question.",
].join("\n");

/* ── result mapping ──────────────────────────────────────── */

interface AskUserDetails {
  question: string;
  options: { label: string; tradeoff: string }[];
  recommendation: string | null;
  status: AskUserOutcome["status"];
  answer: string | null;
  source: AskUserOutcome["source"];
}

/**
 * Builds the text the model reads. Every branch states the status plainly;
 * the unanswered branches say so and forbid assuming a default.
 */
function modelText(outcome: AskUserOutcome, question: AskUserQuestion): string {
  switch (outcome.status) {
    case "answered":
      return outcome.source === "custom"
        ? `The user wrote their own answer to "${question.question}": ${outcome.answer}`
        : `The user selected: ${outcome.answer}`;
    case "cancelled":
      return `The user dismissed "${question.question}" without answering, so no decision was supplied. Do not assume a default and do not claim consent. Name this choice as undecided, say what it blocks, and stop short of the work that depends on it.`;
    case "unavailable":
      return `No interactive UI is available in this session, so "${question.question}" was never shown and no decision was supplied. Do not assume a default. Report the choice as undecided.`;
  }
}

/* ── extension ───────────────────────────────────────────── */

/**
 * Pi extension entry point. Registers the model-callable `ask_user` tool.
 *
 * Uses Pi's own `ctx.ui.select` and `ctx.ui.input` rather than a custom
 * terminal component, so the dialog also works in RPC mode, and gates on
 * `ctx.hasUI`, which is true wherever those dialogs can deliver.
 */
export default function askUserExtension(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "ask_user",
    label: "Ask the human",
    description: DESCRIPTION,
    parameters: AskUserParams,
    executionMode: "sequential",

    async execute(_toolCallId, params: AskUserParamsType, _signal, _onUpdate, ctx) {
      // The schema already constrains these; checked again so a provider that
      // ignores the constraints cannot put a malformed question to the human.
      if (params.question.trim() === "") {
        throw new Error("ask_user needs a non-empty question.");
      }
      if (params.options.length < 2 || params.options.length > 3) {
        throw new Error(
          `ask_user needs two or three options; received ${params.options.length}.`,
        );
      }

      const outcome = await askUser(params, {
        hasUI: ctx.hasUI,
        ui: {
          select: (title, options) => ctx.ui.select(title, options),
          input: (title, placeholder) => ctx.ui.input(title, placeholder),
        },
      });

      const details: AskUserDetails = {
        question: params.question,
        options: params.options,
        recommendation: params.recommendation ?? null,
        status: outcome.status,
        answer: outcome.answer,
        source: outcome.source,
      };

      return {
        content: [{ type: "text", text: modelText(outcome, params) }],
        details,
      };
    },
  });
}
