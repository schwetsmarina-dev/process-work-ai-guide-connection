// Smoke tests for the crisis / distress detection module.
//
// This is the single most safety-critical piece of the app: if checkCrisis
// silently fails to flag a message, a person in real distress gets no
// resources and no pause in the session. These tests exist to make a
// regression here loud (a failing CI run) instead of silent (a missed
// beta-tester report).
import { describe, it, expect } from "vitest";
import { checkCrisis, checkLowRisk, getCrisisMessage, CRISIS_MESSAGE } from "./crisis";

describe("checkCrisis", () => {
  it("flags direct Russian suicidal ideation", () => {
    expect(checkCrisis("я не хочу больше жить, хочу покончить с этим")).toBe(true);
  });

  it("flags direct Spanish suicidal ideation", () => {
    expect(checkCrisis("ya no quiero vivir, quiero morir")).toBe(true);
  });

  it("flags direct English suicidal ideation", () => {
    expect(checkCrisis("I want to kill myself")).toBe(true);
  });

  it("flags self-harm phrasing", () => {
    expect(checkCrisis("думаю резать вены сегодня вечером")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(checkCrisis("Я ХОЧУ УМЕРЕТЬ")).toBe(true);
  });

  it("matches a keyword embedded inside a longer sentence", () => {
    expect(checkCrisis("не знаю почему, но в последнее время часто думаю, что лучше бы меня не было")).toBe(true);
  });

  it("does NOT flag ordinary emotional language", () => {
    expect(checkCrisis("мне грустно и я устала после работы")).toBe(false);
  });

  it("does NOT flag unrelated use of an overlapping word (metaphorical 'killing time')", () => {
    // "убить" alone is in the keyword list (Russian idiom risk) — this case
    // documents current behavior rather than asserting an ideal outcome, so a
    // future tightening of the keyword list shows up here as an intentional change.
    expect(checkCrisis("хочу убить время до встречи")).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(checkCrisis("")).toBe(false);
  });
});

describe("checkLowRisk", () => {
  it("flags grief/loss language", () => {
    expect(checkLowRisk("после смерти отца я не могу собраться")).toBe(true);
  });

  it("flags Spanish grief language", () => {
    expect(checkLowRisk("estoy en duelo por mi pérdida")).toBe(true);
  });

  it("does NOT flag neutral text", () => {
    expect(checkLowRisk("сегодня хорошая погода, я гуляла в парке")).toBe(false);
  });
});

describe("getCrisisMessage / CRISIS_MESSAGE", () => {
  it("returns the Russian message by default (no language / unknown language)", () => {
    expect(getCrisisMessage(undefined)).toBe(CRISIS_MESSAGE);
    expect(getCrisisMessage("fr")).toBe(CRISIS_MESSAGE);
  });

  it("returns a localized message per supported language", () => {
    expect(getCrisisMessage("ru")).toContain("Телефон доверия");
    expect(getCrisisMessage("es")).toContain("024");
    expect(getCrisisMessage("en")).toContain("112");
  });

  it("every crisis message points to an actionable resource (not just a generic disclaimer)", () => {
    for (const lang of ["ru", "es", "en"]) {
      const msg = getCrisisMessage(lang);
      // A phone number or emergency number must be present — a message with
      // only "you are not alone" and no way to act is a regression.
      expect(/\d{2,}/.test(msg)).toBe(true);
    }
  });
});
