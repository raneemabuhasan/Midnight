import { describe, it } from "node:test";
import assert from "node:assert";
import { shouldRemind } from "../src/time-policy.ts";

/**
 * Helper to build a simulated local Date.
 * month is 0-based (0 = January, 11 = December).
 */
function makeDate(year, month, day, hour, minute) {
  return new Date(year, month, day, hour, minute, 0, 0);
}

/**
 * Helper to build an ISO date string YYYY-MM-DD from a Date.
 */
function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

describe("shouldRemind", () => {
  it("returns false at 23:59 (before the window)", () => {
    const now = makeDate(2024, 5, 15, 23, 59);
    const result = shouldRemind(now, /* lastReminderDate */ null);
    assert.strictEqual(result, false, "23:59 should not trigger a reminder");
  });

  it("returns true at 00:00 with no previous reminder", () => {
    const now = makeDate(2024, 5, 15, 0, 0);
    const result = shouldRemind(now, /* lastReminderDate */ null);
    assert.strictEqual(result, true, "00:00 with no prior reminder should trigger");
  });

  it("returns true at 05:59 with no previous reminder", () => {
    const now = makeDate(2024, 5, 15, 5, 59);
    const result = shouldRemind(now, /* lastReminderDate */ null);
    assert.strictEqual(result, true, "05:59 with no prior reminder should trigger");
  });

  it("returns false at 06:00 (window closed)", () => {
    const now = makeDate(2024, 5, 15, 6, 0);
    const result = shouldRemind(now, /* lastReminderDate */ null);
    assert.strictEqual(result, false, "06:00 should not trigger a reminder");
  });

  it("returns false when already reminded on the same local date", () => {
    const now = makeDate(2024, 5, 15, 3, 0);
    const last = toDateString(now);
    const result = shouldRemind(now, last);
    assert.strictEqual(
      result,
      false,
      "should not duplicate on the same local date"
    );
  });

  it("returns true when reminded yesterday but now inside today's window", () => {
    const now = makeDate(2024, 5, 15, 2, 30);
    const yesterday = makeDate(2024, 5, 14, 2, 30);
    const last = toDateString(yesterday);
    const result = shouldRemind(now, last);
    assert.strictEqual(
      result,
      true,
      "a new local date should reset the reminder limit"
    );
  });

  it("handles month boundaries correctly", () => {
    // June 30 -> July 1
    const june30 = makeDate(2024, 5, 30, 2, 0);
    const july1 = makeDate(2024, 6, 1, 2, 0);
    const last = toDateString(june30);
    const result = shouldRemind(july1, last);
    assert.strictEqual(
      result,
      true,
      "month boundary should be treated as a new date"
    );
  });

  it("handles year boundaries correctly", () => {
    // Dec 31 -> Jan 1
    const dec31 = makeDate(2024, 11, 31, 2, 0);
    const jan1 = makeDate(2025, 0, 1, 2, 0);
    const last = toDateString(dec31);
    const result = shouldRemind(jan1, last);
    assert.strictEqual(
      result,
      true,
      "year boundary should be treated as a new date"
    );
  });
});
