import { shouldRemind } from "./time-policy.ts";

/**
 * Test-double types for the integration layer's clock, timer system, and notifier.
 * The real extension will use the system clock, setInterval/clearInterval,
 * and ctx.ui.notify. In tests we inject controlled fakes.
 */
export interface Clock {
  now(): Date;
}

export interface TimerSystem {
  setInterval(callback: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

export interface Notifier {
  notify(message: string, type?: string): void;
}

/**
 * ReminderController coordinates automatic late-night reminders.
 *
 * - Uses the injected clock, timer system, and notifier for testability.
 * - Calls shouldRemind from time-policy.ts for pure decision logic.
 * - Supports interactive and non-interactive modes.
 */
export class ReminderController {
  private clock: Clock;
  private timers: TimerSystem;
  private notifier: Notifier;
  private intervalHandle: unknown | null = null;
  private lastReminderDate: string | null = null;
  private checkMs: number;
  private isInteractive: boolean;

  constructor(params: {
    clock: Clock;
    timers: TimerSystem;
    notifier: Notifier;
    checkMs?: number;
    isInteractive?: boolean;
  }) {
    this.clock = params.clock;
    this.timers = params.timers;
    this.notifier = params.notifier;
    this.checkMs = params.checkMs ?? 30000;
    this.isInteractive = params.isInteractive ?? true;
  }

  /**
   * Start the reminder system: perform an immediate check and schedule
   * periodic checks. Safe to call multiple times (clears existing timer).
   */
  start(): void {
    // Defensive: clear any stale timer before starting new one.
    this.shutdown();

    // Only create timers in interactive mode.
    if (!this.isInteractive) {
      return;
    }

    // Immediate check on startup.
    this.checkAndNotify();

    // Schedule periodic checks.
    this.intervalHandle = this.timers.setInterval(() => {
      this.checkAndNotify();
    }, this.checkMs);
  }

  /**
   * Stop the reminder system. Safe to call multiple times (idempotent).
   */
  shutdown(): void {
    if (this.intervalHandle !== null) {
      this.timers.clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  /**
   * Preview command: show notification without recording automatic reminder history.
   * Does nothing in non-interactive mode.
   */
  bedtimeTest(): void {
    if (!this.isInteractive) {
      return;
    }
    this.notifier.notify("It's late! Save your work and get some sleep.", "warning");
  }

  /** Expose internal state for test assertions only. */
  getLastReminderDate(): string | null {
    return this.lastReminderDate;
  }

  hasActiveTimer(): boolean {
    return this.intervalHandle !== null;
  }

  getCheckMs(): number {
    return this.checkMs;
  }

  /** Core notification logic: read clock, decide via policy, notify if needed. */
  private checkAndNotify(): void {
    const now = this.clock.now();

    if (shouldRemind(now, this.lastReminderDate)) {
      this.sendReminder(now);
    }
  }

  private sendReminder(now: Date): void {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const today = `${year}-${month}-${day}`;

    this.notifier.notify("It's late! Save your work and get some sleep.", "warning");
    this.lastReminderDate = today;
  }
}
