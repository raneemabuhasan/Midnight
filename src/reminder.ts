import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { ReminderController } from "./reminder-controller.ts";

/**
 * Pi extension entry point for the Midnight reminder.
 *
 * - Registers /bedtime-test command.
 * - Subscribes to session_start and session_shutdown.
 * - Only creates timers in TUI (interactive) mode.
 * - Does not start any timer in the factory; defers to session_start event.
 * - Clear controller reference on shutdown so old context is not retained after reload.
 */
export default function extensionFactory(pi: ExtensionAPI) {
  // Hold the controller instance for this extension runtime.
  let controller: ReminderController | null = null;

  // Register the preview command.
  pi.registerCommand("bedtime-test", {
    description: "Preview the late-night sleep reminder (daytime-safe).",
    handler: async (_args, _ctx) => {
      controller?.bedtimeTest();
    },
  });

  // Start on session_start — Pi docs say not to start timers in the factory.
  pi.on("session_start", (_event, ctx: ExtensionContext) => {
    const isTui = ctx.mode === "tui";

    // Defensive: if a controller exists from a prior session_start,
    // shut it down before creating a new one (same-instance reload protection).
    controller?.shutdown();

    controller = new ReminderController({
      clock: { now: () => new Date() },
      timers: {
        setInterval: (cb, ms) => globalThis.setInterval(cb, ms),
        clearInterval: (h: unknown) => globalThis.clearInterval(h as number | NodeJS.Timeout),
      },
      notifier: {
        notify: (message, type) => ctx.ui.notify(message, type),
      },
      isInteractive: isTui,
    });

    controller.start();
  });

  // Cleanup on session_shutdown — idempotent.
  pi.on("session_shutdown", () => {
    controller?.shutdown();
    controller = null;
  });
}
