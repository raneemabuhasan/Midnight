import { describe, it } from "node:test";
import assert from "node:assert";
import { ReminderController, type Clock, type TimerSystem, type Notifier } from "../src/reminder-controller.ts";

/**
 * Helper to build a simulated local Date. month is 0-based.
 */
function makeDate(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(year, month, day, hour, minute, 0, 0);
}

/**
 * Helper to build an ISO local date string YYYY-MM-DD from a Date.
 */
function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Build a fake timer system that records setInterval calls
 * and allows test-controlled ticking.
 */
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
      if (!entry) {
        throw new Error(`Tick failed: no timer with id ${id}`);
      }
      entry.callback();
    },
    list(): number[] {
      return Array.from(callbacks.keys());
    },
    count(): number {
      return callbacks.size;
    },
    getMs(id: number): number | undefined {
      return callbacks.get(id)?.ms;
    },
  };
}

function makeFakeNotifier() {
  const calls: { message: string; type?: string }[] = [];
  return {
    notify(message: string, type?: string) {
      calls.push({ message, type });
    },
    getCalls() {
      return calls;
    },
  };
}

describe("ReminderController integration", () => {
  it("startup inside the window sends one notification", () => {
    const now = makeDate(2024, 5, 15, 2, 0);
    const clock: Clock = { now: () => now };
    const timers = makeFakeTimers();
    const notifier = makeFakeNotifier();

    const ctrl = new ReminderController({ clock, timers, notifier });
    ctrl.start();

    assert.strictEqual(notifier.getCalls().length, 1, "should notify once on startup inside window");
    assert.strictEqual(notifier.getCalls()[0]?.message.includes("sleep"), true, "notification should mention sleep");
    assert.strictEqual(ctrl.getLastReminderDate(), toDateString(now), "should record today's date");
  });

  it("startup outside the window sends none", () => {
    const now = makeDate(2024, 5, 15, 12, 0);
    const clock: Clock = { now: () => now };
    const timers = makeFakeTimers();
    const notifier = makeFakeNotifier();

    const ctrl = new ReminderController({ clock, timers, notifier });
    ctrl.start();

    assert.strictEqual(notifier.getCalls().length, 0, "should not notify outside window");
    assert.strictEqual(ctrl.getLastReminderDate(), null, "should not record a date");
  });

  it("periodic check crossing midnight sends a notification without user prompt", () => {
    const june14_2359 = makeDate(2024, 5, 14, 23, 59);
    const june15_0015 = makeDate(2024, 5, 15, 0, 15);

    let current = june14_2359;
    const clock: Clock = { now: () => current };
    const timers = makeFakeTimers();
    const notifier = makeFakeNotifier();

    const ctrl = new ReminderController({ clock, timers, notifier });
    ctrl.start();

    // Before midnight: no reminder yet
    assert.strictEqual(notifier.getCalls().length, 0, "should not notify before midnight");

    // Simulate time crossing to after midnight; tick the registered timer.
    current = june15_0015;
    const activeTimers = timers.list();
    assert.strictEqual(activeTimers.length >= 1, true, "a periodic timer should have been registered");
    timers.tick(activeTimers[0]);

    assert.strictEqual(notifier.getCalls().length, 1, "should notify after midnight via periodic check");
    assert.strictEqual(ctrl.getLastReminderDate(), toDateString(june15_0015), "should record new date");
  });

  it("repeated checks on the same date do not send duplicates", () => {
    const now = makeDate(2024, 5, 15, 2, 0);
    const clock: Clock = { now: () => now };
    const timers = makeFakeTimers();
    const notifier = makeFakeNotifier();

    const ctrl = new ReminderController({ clock, timers, notifier });
    ctrl.start();
    assert.strictEqual(notifier.getCalls().length, 1, "first check notifies");

    const activeTimers = timers.list();
    assert.strictEqual(activeTimers.length >= 1, true, "periodic timer should exist");
    timers.tick(activeTimers[0]); // second periodic check
    timers.tick(activeTimers[0]); // third periodic check

    assert.strictEqual(notifier.getCalls().length, 1, "subsequent checks on same date must not duplicate");
  });

  it("a new local date allows another automatic reminder", () => {
    const june15 = makeDate(2024, 5, 15, 2, 0);
    const june16 = makeDate(2024, 5, 16, 2, 0);

    let current = june15;
    const clock: Clock = { now: () => current };
    const timers = makeFakeTimers();
    const notifier = makeFakeNotifier();

    const ctrl = new ReminderController({ clock, timers, notifier });
    ctrl.start();
    assert.strictEqual(notifier.getCalls().length, 1, "reminds on June 15");

    current = june16;
    const activeTimers = timers.list();
    assert.strictEqual(activeTimers.length >= 1, true, "timer should exist");
    timers.tick(activeTimers[0]);

    assert.strictEqual(notifier.getCalls().length, 2, "should remind again on June 16");
    assert.strictEqual(ctrl.getLastReminderDate(), toDateString(june16));
  });

  it("check at 06:00 sends no reminder", () => {
    const now = makeDate(2024, 5, 15, 6, 0);
    const clock: Clock = { now: () => now };
    const timers = makeFakeTimers();
    const notifier = makeFakeNotifier();

    const ctrl = new ReminderController({ clock, timers, notifier });
    ctrl.start();

    assert.strictEqual(notifier.getCalls().length, 0, "06:00 is outside window");
  });

  it("shutdown clears the timer and prevents further notifications", () => {
    const june15_0200 = makeDate(2024, 5, 15, 2, 0);
    const june16_0300 = makeDate(2024, 5, 16, 3, 0);

    let current = june15_0200;
    const clock: Clock = { now: () => current };
    const timers = makeFakeTimers();
    const notifier = makeFakeNotifier();

    const ctrl = new ReminderController({ clock, timers, notifier });
    ctrl.start();

    // Verify timer exists before shutdown.
    const activeBefore = timers.list();
    assert.strictEqual(activeBefore.length, 1, "one timer should exist after startup");

    // Shutdown once.
    ctrl.shutdown();
    assert.strictEqual(timers.count(), 0, "fake timer system should have zero active timers after shutdown");

    // Advance to the next eligible calendar date (not same-day deduplication).
    current = june16_0300;
    // Attempting to tick the old timer id should throw because it was cleared.
    assert.throws(
      () => timers.tick(activeBefore[0]),
      /Tick failed/,
      "ticking a cleared timer should fail"
    );

    // No further notifications should have occurred.
    assert.strictEqual(notifier.getCalls().length, 1, "only the startup notification should exist");

    // Calling shutdown twice should be harmless.
    ctrl.shutdown();
    assert.strictEqual(timers.count(), 0, "timer count should remain zero after repeated shutdown");
  });

  it("repeated initialization does not leave multiple active timers", () => {
    const now = makeDate(2024, 5, 15, 2, 0);
    const clock: Clock = { now: () => now };
    const timers = makeFakeTimers();
    const notifier = makeFakeNotifier();

    const ctrl = new ReminderController({ clock, timers, notifier });
    ctrl.start();
    assert.strictEqual(notifier.getCalls().length, 1, "first start triggers one automatic notification");
    assert.strictEqual(timers.list().length, 1, "first start creates one timer");

    ctrl.start(); // simulate second startup / reload on same controller

    assert.strictEqual(notifier.getCalls().length, 1, "repeated start should not send another automatic notification");
    assert.strictEqual(timers.list().length, 1, "only one timer should exist after repeated start");
  });

  it("noninteractive mode creates no timer and sends no notification", () => {
    const now = makeDate(2024, 5, 15, 2, 0);
    const clock: Clock = { now: () => now };
    const timers = makeFakeTimers();
    const notifier = makeFakeNotifier();

    const ctrl = new ReminderController({
      clock,
      timers,
      notifier,
      isInteractive: false,
    });
    ctrl.start();

    assert.strictEqual(timers.list().length, 0, "no timer in noninteractive mode");
    assert.strictEqual(notifier.getCalls().length, 0, "no notification in noninteractive mode");
  });

  it("default timer interval is exactly 30,000 milliseconds", () => {
    const now = makeDate(2024, 5, 15, 2, 0);
    const clock: Clock = { now: () => now };
    const timers = makeFakeTimers();
    const notifier = makeFakeNotifier();

    const ctrl = new ReminderController({ clock, timers, notifier });
    ctrl.start();

    const activeTimers = timers.list();
    assert.strictEqual(activeTimers.length, 1, "timer should be registered");
    // Verify the interval passed to setInterval is exactly 30000 ms.
    assert.strictEqual(timers.getMs(activeTimers[0]), 30000, "timer interval should be 30000 ms");
  });

  it("/bedtime-test previews the notification without changing automatic reminder history", () => {
    const noon = makeDate(2024, 5, 15, 12, 0); // outside window
    const june16_0200 = makeDate(2024, 5, 16, 2, 0); // next day inside window

    let current = noon;
    const clock: Clock = { now: () => current };
    const timers = makeFakeTimers();
    const notifier = makeFakeNotifier();

    const ctrl = new ReminderController({ clock, timers, notifier });
    ctrl.start();
    assert.strictEqual(notifier.getCalls().length, 0, "no automatic notification at noon");
    assert.strictEqual(ctrl.getLastReminderDate(), null, "no automatic date recorded");

    ctrl.bedtimeTest();
    assert.strictEqual(notifier.getCalls().length, 1, "bedtimeTest should show one notification");
    assert.strictEqual(ctrl.getLastReminderDate(), null, "bedtimeTest must not update automatic reminder history");

    // Move to the next day at 02:00 (eligible window) and tick the timer.
    current = june16_0200;
    const activeTimers = timers.list();
    assert.strictEqual(activeTimers.length >= 1, true, "timer should exist even though startup was at noon");
    timers.tick(activeTimers[0]);

    assert.strictEqual(notifier.getCalls().length, 2, "automatic reminder should appear on next eligible date");
    assert.strictEqual(ctrl.getLastReminderDate(), toDateString(june16_0200), "automatic date should be recorded");
  });

  it("preview does not erase an existing automatic reminder date", () => {
    const june15_0200 = makeDate(2024, 5, 15, 2, 0);
    const june15_0300 = makeDate(2024, 5, 15, 3, 0);

    let current = june15_0200;
    const clock: Clock = { now: () => current };
    const timers = makeFakeTimers();
    const notifier = makeFakeNotifier();

    const ctrl = new ReminderController({ clock, timers, notifier });
    ctrl.start();
    assert.strictEqual(notifier.getCalls().length, 1, "startup triggers automatic reminder");
    assert.strictEqual(ctrl.getLastReminderDate(), toDateString(june15_0200), "date recorded");

    // Preview at the same time.
    ctrl.bedtimeTest();
    assert.strictEqual(notifier.getCalls().length, 2, "preview adds one more notification");

    // The automatic date should still be recorded.
    assert.strictEqual(ctrl.getLastReminderDate(), toDateString(june15_0200), "preview must not erase automatic date");

    // Advance time inside the same date and tick; no duplicate automatic reminder.
    current = june15_0300;
    const activeTimers = timers.list();
    assert.strictEqual(activeTimers.length >= 1, true, "timer should exist");
    timers.tick(activeTimers[0]);

    assert.strictEqual(notifier.getCalls().length, 2, "should not duplicate automatic reminder after preview");
  });
});
