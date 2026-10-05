import { describe, it } from "node:test";
import assert from "node:assert";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import extensionFactory from "../src/reminder.ts";

/* ── helpers ─────────────────────────────────────────────── */

function makeDate(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(year, month, day, hour, minute, 0, 0);
}

function makeFakeTimers() {
  let nextId = 1;
  const callbacks = new Map<number, { callback: () => void; ms: number }>();
  return {
    setInterval(callback: () => void, ms: number): number {
      const id = nextId++;
      callbacks.set(id, { callback, ms });
      return id;
    },
    clearInterval(id: number): void {
      callbacks.delete(id);
    },
    tick(id: number): void {
      const entry = callbacks.get(id);
      if (!entry) throw new Error(`Tick failed: no timer with id ${id}`);
      entry.callback();
    },
    list() { return Array.from(callbacks.keys()); },
    count() { return callbacks.size; },
    getMs(id: number) { return callbacks.get(id)?.ms; },
  };
}

/** Fake Pi API that records commands and event handlers. */
function makeFakePi() {
  const commands = new Map<string, { description: string; handler: Function }>();
  const eventHandlers = new Map<string, Function[]>();

  const fakePi = {
    registerCommand(name: string, config: { description: string; handler: Function }) {
      commands.set(name, config);
    },
    on(event: string, handler: Function) {
      if (!eventHandlers.has(event)) eventHandlers.set(event, []);
      eventHandlers.get(event)!.push(handler);
      return () => {
        const arr = eventHandlers.get(event)!;
        const idx = arr.indexOf(handler);
        if (idx !== -1) arr.splice(idx, 1);
      };
    },
    getCommands() { return commands; },
    getEventHandlers(event: string) { return eventHandlers.get(event) ?? []; },
  } as unknown as ExtensionAPI;

  return fakePi;
}

/**
 * Minimal fake ExtensionContext with a notifier and a fixed clock.
 * The clockcontrols all Date values the extension reads.
 */
function makeFakeContext(
  mode: "tui" | "json" | "print" | "rpc",
  currentTime: Date,
) {
  const notifications: { message: string; type?: string }[] = [];
  const timers = makeFakeTimers();
  const fakeCtx = {
    mode,
    hasUI: mode === "tui" || mode === "rpc",
    ui: {
      notify(message: string, type?: string) { notifications.push({ message, type }); },
    },
    getNotifications() { return notifications; },
    timers,
  };
  return fakeCtx;
}

/**
 * Run a test with the real extension wired to fake globals.
 * Intercepts setInterval/clearInterval and Date so the extension
 * never touches real timers or the real clock.
 */
function withFakeGlobals<T>(fakeTimers: ReturnType<typeof makeFakeTimers>, fixedTime: Date, fn: () => T): T {
  const realSI = globalThis.setInterval;
  const realCI = globalThis.clearInterval;
  const realDate = globalThis.Date;

  (globalThis as any).setInterval = fakeTimers.setInterval.bind(fakeTimers);
  (globalThis as any).clearInterval = fakeTimers.clearInterval.bind(fakeTimers);
  (globalThis as any).Date = class extends Date {
    constructor(...args: any[]) {
      if (args.length === 0) {
        super(fixedTime);
      } else {
        super(...args);
      }
    }
  };

  try {
    return fn();
  } finally {
    globalThis.setInterval = realSI;
    globalThis.clearInterval = realCI;
    globalThis.Date = realDate;
  }
}

describe("Extension wiring (fake Pi API)", () => {
  it("factory registers /bedtime-test command", () => {
    const fakePi = makeFakePi();
    extensionFactory(fakePi);

    const commands = (fakePi as any).getCommands();
    assert.strictEqual(commands.has("bedtime-test"), true, "should register /bedtime-test");
    const cmd = commands.get("bedtime-test");
    assert.strictEqual(cmd!.description.includes("sleep"), true, "description should mention sleep");
  });

  it("factory schedules no timer before session_start fires", () => {
    // Intercept setInterval BEFORE loading the factory so we can count
    // any calls the factory itself makes.
    const fakeTimers = makeFakeTimers();
    const realSI = globalThis.setInterval;
    globalThis.setInterval = fakeTimers.setInterval.bind(fakeTimers) as any;

    try {
      extensionFactory(makeFakePi());
      assert.strictEqual(fakeTimers.count(), 0, "factory must not create any timer");
    } finally {
      globalThis.setInterval = realSI;
    }
  });

  it("session_start creates one 30000 ms timer in TUI mode", () => {
    const fakePi = makeFakePi();
    extensionFactory(fakePi);

    const noon = makeDate(2024, 5, 15, 12, 0);
    const fakeCtx = makeFakeContext("tui", noon);
    const handlers = (fakePi as any).getEventHandlers("session_start");
    assert.strictEqual(handlers.length, 1, "exactly one session_start handler");

    withFakeGlobals(fakeCtx.timers, noon, () => {
      handlers[0]!({ type: "session_start", reason: "startup" }, fakeCtx);
    });

    const ids = fakeCtx.timers.list();
    assert.strictEqual(ids.length, 1, "one periodic timer created");
    assert.strictEqual(fakeCtx.timers.getMs(ids[0]), 30000, "interval exactly 30000 ms");
  });

  it("session_shutdown clears the timer and repeated shutdown is harmless", () => {
    const fakePi = makeFakePi();
    extensionFactory(fakePi);

    const noon = makeDate(2024, 5, 15, 12, 0);
    const fakeCtx = makeFakeContext("tui", noon);
    const startHandlers = (fakePi as any).getEventHandlers("session_start");
    const shutdownHandlers = (fakePi as any).getEventHandlers("session_shutdown");

    withFakeGlobals(fakeCtx.timers, noon, () => {
      startHandlers[0]!({ type: "session_start", reason: "startup" }, fakeCtx);
      assert.strictEqual(fakeCtx.timers.count(), 1, "timer exists after startup");

      shutdownHandlers[0]!({ type: "session_shutdown", reason: "quit" });
      assert.strictEqual(fakeCtx.timers.count(), 0, "timer cleared after shutdown");

      shutdownHandlers[0]!({ type: "session_shutdown", reason: "quit" });
      assert.strictEqual(fakeCtx.timers.count(), 0, "still zero after repeated shutdown");
    });
  });

  it("non-TUI startup creates no timer", () => {
    const fakePi = makeFakePi();
    extensionFactory(fakePi);

    const noon = makeDate(2024, 5, 15, 12, 0);
    const fakeCtx = makeFakeContext("print", noon);
    const startHandlers = (fakePi as any).getEventHandlers("session_start");

    withFakeGlobals(fakeCtx.timers, noon, () => {
      startHandlers[0]!({ type: "session_start", reason: "startup" }, fakeCtx);
      assert.strictEqual(fakeCtx.timers.count(), 0, "no timer in non-TUI mode");
      assert.strictEqual(fakeCtx.getNotifications().length, 0, "no notification in non-TUI mode");
    });
  });

  it("preview after shutdown does not notify", async () => {
    const fakePi = makeFakePi();
    extensionFactory(fakePi);

    const twoAM = makeDate(2024, 5, 15, 2, 0);
    const fakeCtx = makeFakeContext("tui", twoAM);
    const startHandlers = (fakePi as any).getEventHandlers("session_start");
    const shutdownHandlers = (fakePi as any).getEventHandlers("session_shutdown");
    const commands = (fakePi as any).getCommands();

    withFakeGlobals(fakeCtx.timers, twoAM, () => {
      startHandlers[0]!({ type: "session_start", reason: "startup" }, fakeCtx);
      // Startup inside window triggers one automatic notification.
      assert.strictEqual(fakeCtx.getNotifications().length, 1, "startup notifies");

      shutdownHandlers[0]!({ type: "session_shutdown", reason: "quit" });
      assert.strictEqual(fakeCtx.timers.count(), 0, "timer cleared");
    });

    // After shutdown the controller reference is null; preview must not notify.
    const cmd = commands.get("bedtime-test");
    assert.ok(cmd, "command exists");
    await cmd.handler("", fakeCtx);
    // Still only the startup notification.
    assert.strictEqual(fakeCtx.getNotifications().length, 1, "preview after shutdown must not add notification");
  });

  it("preview in noninteractive mode does not notify", async () => {
    const fakePi = makeFakePi();
    extensionFactory(fakePi);

    const noon = makeDate(2024, 5, 15, 12, 0);
    const fakeCtx = makeFakeContext("print", noon);
    const startHandlers = (fakePi as any).getEventHandlers("session_start");
    const commands = (fakePi as any).getCommands();

    withFakeGlobals(fakeCtx.timers, noon, () => {
      startHandlers[0]!({ type: "session_start", reason: "startup" }, fakeCtx);
      assert.strictEqual(fakeCtx.getNotifications().length, 0, "noninteractive startup: no notification");
    });

    const cmd = commands.get("bedtime-test");
    assert.ok(cmd, "command exists");
    await cmd.handler("", fakeCtx);
    assert.strictEqual(fakeCtx.getNotifications().length, 0, "preview must not notify in noninteractive mode");
  });

  it("interactive preview at noon shows one visible notification", async () => {
    const fakePi = makeFakePi();
    extensionFactory(fakePi);

    const noon = makeDate(2024, 5, 15, 12, 0);
    const fakeCtx = makeFakeContext("tui", noon);
    const startHandlers = (fakePi as any).getEventHandlers("session_start");
    const commands = (fakePi as any).getCommands();

    withFakeGlobals(fakeCtx.timers, noon, () => {
      startHandlers[0]!({ type: "session_start", reason: "startup" }, fakeCtx);
      // Noon is outside window, so no automatic startup notification.
      assert.strictEqual(fakeCtx.getNotifications().length, 0, "startup at noon: no automatic notification");
    });

    const cmd = commands.get("bedtime-test");
    assert.ok(cmd, "command exists");
    await cmd.handler("", fakeCtx);

    assert.strictEqual(fakeCtx.getNotifications().length, 1, "preview sends one notification");
    assert.strictEqual(fakeCtx.getNotifications()[0].message.includes("sleep"), true, "preview mentions sleep");
  });
});
