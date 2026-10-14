import { describe, it } from "node:test";
import assert from "node:assert";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import extensionFactory from "../src/ask-user.ts";

/* ── helpers ─────────────────────────────────────────────── */

/** Fake Pi API that records registered tools. */
function makeFakePi() {
  const tools = new Map<string, Record<string, any>>();
  return {
    registerTool(definition: Record<string, any>) {
      tools.set(String(definition.name), definition);
    },
    registerCommand(_name: string, _options: unknown) {},
    on(_event: string, _handler: unknown) {
      return () => {};
    },
    getTool(name: string) {
      return tools.get(name);
    },
    toolNames() {
      return Array.from(tools.keys());
    },
  };
}

/** A tool context with no dialog-capable UI, whose dialogs must not be opened. */
function makeContextWithoutUI() {
  return {
    mode: "print",
    hasUI: false,
    cwd: "/tmp",
    ui: {
      async select() {
        throw new Error("select was opened although ctx.hasUI is false");
      },
      async input() {
        throw new Error("input was opened although ctx.hasUI is false");
      },
      notify() {},
    },
  };
}

function makeParams() {
  return {
    question: "Should the reminder remember previous notifications after Pi restarts?",
    why: "It changes user-visible behavior after a restart.",
    options: [
      { label: "Session-only (current behavior)", tradeoff: "No new files; a restart re-reminds." },
      { label: "Persist one date key to disk", tradeoff: "Survives restarts; adds a state file." },
    ],
    recommendation: "Session-only, unless cross-restart deduplication is required.",
  };
}

/* ── tests ───────────────────────────────────────────────── */

describe("ask_user extension wiring (fake Pi API)", () => {
  it("registers a tool named ask_user", () => {
    const fakePi = makeFakePi();

    extensionFactory(fakePi as unknown as ExtensionAPI);

    assert.ok(
      fakePi.toolNames().includes("ask_user"),
      `expected ask_user to be registered, found [${fakePi.toolNames().join(", ")}]`,
    );
  });

  it("describes to the model when to ask and when to proceed", () => {
    const fakePi = makeFakePi();
    extensionFactory(fakePi as unknown as ExtensionAPI);

    const tool = fakePi.getTool("ask_user");
    assert.ok(tool, "ask_user is not registered");

    const description = String(tool.description).toLowerCase();
    assert.ok(
      description.includes("unresolved"),
      "the description must tell the model to ask about unresolved choices",
    );
    assert.ok(
      description.includes("proceed"),
      "the description must tell the model when to proceed without asking",
    );
    assert.ok(
      description.includes("default"),
      "the description must tell the model not to assume a default when no answer comes back",
    );
  });

  it("reports unavailable through the tool result when ctx.hasUI is false", async () => {
    const fakePi = makeFakePi();
    extensionFactory(fakePi as unknown as ExtensionAPI);

    const tool = fakePi.getTool("ask_user");
    assert.ok(tool, "ask_user is not registered");

    const result = await tool.execute("call-1", makeParams(), undefined, undefined, makeContextWithoutUI());

    assert.strictEqual(result.details.status, "unavailable");
    assert.strictEqual(result.details.answer, null);

    const text = result.content.map((part: Record<string, any>) => part.text ?? "").join(" ");
    assert.ok(
      text.toLowerCase().includes("unavailable") || text.toLowerCase().includes("no interactive"),
      "the model-facing text must say the question could not be shown",
    );
  });
});
