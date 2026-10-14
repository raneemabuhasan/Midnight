/**
 * Interaction layer for the `ask_user` tool.
 *
 * Holds no Pi types and reads no global state: the dialog is injected, so every
 * outcome in docs/ask-user-contract.md is reachable from a test without a
 * terminal. Pi's own dialogs are adapted onto `AskUserUI` in src/ask-user.ts.
 */

/** The choice that lets the human write an answer of their own. */
export const CUSTOM_ANSWER_LABEL = "Let me write a different answer";

/** One offered option and the tradeoff it carries. */
export interface AskUserOption {
  label: string;
  tradeoff: string;
}

/** A single question put to the human. Two or three options, per the contract. */
export interface AskUserQuestion {
  question: string;
  why: string;
  options: AskUserOption[];
  recommendation?: string;
}

export type AskUserStatus = "answered" | "cancelled" | "unavailable";
export type AskUserSource = "option" | "custom";

/** The explicit result of one consultation. `answer` is null unless answered. */
export interface AskUserOutcome {
  status: AskUserStatus;
  answer: string | null;
  source: AskUserSource | null;
}

/**
 * The subset of Pi's `ExtensionUIContext` this layer needs. Declaring it here
 * rather than importing it keeps the module testable, and keeps it compiling
 * against both the installed Pi (0.87.1) and the published types (1.0.4).
 */
export interface AskUserUI {
  select(title: string, options: string[]): Promise<string | undefined>;
  input(title: string, placeholder?: string): Promise<string | undefined>;
}

/** Injected dependencies. `hasUI` mirrors Pi's `ctx.hasUI`. */
export interface AskUserDeps {
  hasUI: boolean;
  ui: AskUserUI;
}

/** Title of the free-text dialog shown after the custom-answer choice. */
const CUSTOM_ANSWER_PROMPT = "Your answer";

/** Placeholder inside the free-text dialog. */
const CUSTOM_ANSWER_PLACEHOLDER = "Describe what you want instead";

function cancelled(): AskUserOutcome {
  return { status: "cancelled", answer: null, source: null };
}

function unavailable(): AskUserOutcome {
  return { status: "unavailable", answer: null, source: null };
}

/**
 * Builds the block the human reads above the options: the question, why it
 * matters, and the recommendation when one was offered.
 */
function renderPrompt(question: AskUserQuestion): string {
  const lines = [question.question, "", question.why];
  if (question.recommendation) {
    lines.push("", `Recommended: ${question.recommendation}`);
  }
  return lines.join("\n");
}

/**
 * Builds one row per option, then the custom-answer row.
 *
 * Rows are numbered so that two options whose text is identical still render
 * distinctly, which keeps the row-to-option mapping unambiguous.
 */
function renderRows(question: AskUserQuestion): string[] {
  const rows = question.options.map(
    (option, index) => `${index + 1}. ${option.label} \u2014 ${option.tradeoff}`,
  );
  rows.push(`${rows.length + 1}. ${CUSTOM_ANSWER_LABEL}`);
  return rows;
}

/**
 * Puts one question to the human and reports what came back.
 *
 * Returns `unavailable` without opening anything when no dialog-capable UI
 * exists, `cancelled` when the human supplies no decision, and `answered` only
 * once a human has actually chosen or written something.
 *
 * @param question - The single question to put to the human.
 * @param deps - Injected dialog and availability flag.
 * @returns The explicit outcome defined in docs/ask-user-contract.md.
 */
export async function askUser(
  question: AskUserQuestion,
  deps: AskUserDeps,
): Promise<AskUserOutcome> {
  if (!deps.hasUI) {
    return unavailable();
  }

  const rows = renderRows(question);
  const picked = await deps.ui.select(renderPrompt(question), rows);

  // The human dismissed the selector: no decision was supplied.
  if (picked === undefined) {
    return cancelled();
  }

  const index = rows.indexOf(picked);

  if (index >= 0 && index < question.options.length) {
    return { status: "answered", answer: question.options[index].label, source: "option" };
  }

  // Anything other than the custom-answer row is a row we never offered.
  // Treat it as no decision rather than guessing which option was meant.
  if (index !== rows.length - 1) {
    return cancelled();
  }

  const written = await deps.ui.input(CUSTOM_ANSWER_PROMPT, CUSTOM_ANSWER_PLACEHOLDER);
  const answer = (written ?? "").trim();

  // An empty or whitespace-only answer is not consent to anything.
  if (answer === "") {
    return cancelled();
  }

  return { status: "answered", answer, source: "custom" };
}
