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

/**
 * Puts one question to the human and reports what came back.
 *
 * W2-1 stub. Returns `unavailable` unconditionally so that the contract tests
 * fail on their assertions rather than on a missing import. W2-2 implements it.
 */
export async function askUser(
  _question: AskUserQuestion,
  _deps: AskUserDeps,
): Promise<AskUserOutcome> {
  return { status: "unavailable", answer: null, source: null };
}
