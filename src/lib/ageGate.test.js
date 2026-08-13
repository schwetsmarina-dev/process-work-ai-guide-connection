import { describe, expect, it, vi } from "vitest";

import { MIN_AGE, ageThisYear, birthYearOptions, isOldEnough } from "./ageGate";

describe("age gate", () => {
  it("uses 18 as the product minimum age", () => {
    expect(MIN_AGE).toBe(18);
  });

  it("admits adults and rejects users below 18", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T12:00:00Z"));
    expect(ageThisYear(2008)).toBe(18);
    expect(isOldEnough(2008)).toBe(true);
    expect(isOldEnough(2009)).toBe(false);
    vi.useRealTimers();
  });

  it("keeps ineligible years visible so users can answer honestly", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T12:00:00Z"));
    const years = birthYearOptions();
    expect(years).toContain(2008);
    expect(years).toContain(2009);
    vi.useRealTimers();
  });
});
