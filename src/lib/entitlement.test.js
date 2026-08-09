import { describe, expect, it } from "vitest";
import { FEATURES, canUseFeature } from "./entitlement";

const NOW = new Date("2026-08-09T12:00:00.000Z");

function entitlement(plan, overrides = {}) {
  return {
    plan,
    status: "active",
    expires_at: null,
    ...overrides,
  };
}

describe("personal process practice entitlement", () => {
  it("keeps chat available in the free trial", () => {
    expect(canUseFeature(entitlement("free"), FEATURES.CHAT, NOW)).toBe(true);
  });

  it("does not include personal practices in the free trial", () => {
    expect(canUseFeature(entitlement("free"), FEATURES.PRACTICE, NOW)).toBe(false);
  });

  it("unlocks personal practices for beta and paid access", () => {
    expect(canUseFeature(entitlement("beta"), FEATURES.PRACTICE, NOW)).toBe(true);
    expect(canUseFeature(entitlement("paid"), FEATURES.PRACTICE, NOW)).toBe(true);
  });

  it("locks personal practices when paid access has expired", () => {
    expect(
      canUseFeature(
        entitlement("paid", { expires_at: "2026-08-08T12:00:00.000Z" }),
        FEATURES.PRACTICE,
        NOW,
      ),
    ).toBe(false);
  });
});
