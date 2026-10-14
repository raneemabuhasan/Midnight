import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Pi extension entry point for the `ask_user` tool.
 *
 * W2-1 stub. Registers nothing yet, so the wiring tests fail on their
 * assertions rather than on a missing import. W2-2 registers the tool, adapts
 * `ctx.ui` onto `AskUserUI`, and gates the dialog on `ctx.hasUI`.
 */
export default function askUserExtension(_pi: ExtensionAPI): void {
  // W2-2: pi.registerTool({ name: "ask_user", ... })
}
