// Smoke tests for getSafeFallback — the text shown to the user whenever the
// AI's own response fails validation (see validateAssistantResponse). If this
// ever returns an empty string, a validation failure would show the user a
// blank chat bubble instead of a safe recovery question.
import { describe, it, expect } from "vitest";
import { getSafeFallback, validateAssistantResponse } from "./sessionValidation";

describe("getSafeFallback", () => {
  it("always returns a non-empty question, for every stage x language combination", () => {
    const stages = [
      "awaiting_dream", "awaiting_body_signal", "awaiting_conflict_material",
      "awaiting_journaling_topic", "awaiting_primary", "awaiting_secondary",
      undefined,
    ];
    const modes = ["body", "dream", "conflict", "journaling"];
    for (const lang of ["ru", "es"]) {
      for (const mode of modes) {
        for (const stage of stages) {
          const result = getSafeFallback(mode, null, false, stage ? { stage } : null, false, false, lang);
          expect(typeof result).toBe("string");
          expect(result.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("prioritizes the integration lock over everything else", () => {
    const result = getSafeFallback("conflict", null, true, { stage: "awaiting_primary" }, false, false, "ru");
    expect(result).toContain("честным"); // conflict_integration fallback wording
  });

  it("falls back to the dream-invite recovery when the dream was already told and mismatched", () => {
    const result = getSafeFallback("dream", null, false, null, false, true, "ru");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns different wording per language for the same stage (language override actually applies)", () => {
    const ru = getSafeFallback("dream", null, false, { stage: "awaiting_primary" }, false, false, "ru");
    const es = getSafeFallback("dream", null, false, { stage: "awaiting_primary" }, false, false, "es");
    expect(ru).not.toBe(es);
  });
});

describe("non-resonance guard", () => {
  it("blocks repeating a rejected real-life hypothesis in Dream", () => {
    const result = validateAssistantResponse({
      responseText: "Есть ли в этом отказе качество, которое можно добавить в твои способы говорить нет в реальной жизни?",
      currentMode: "dream",
      conversationHistory: [],
      lastUserMessage: "Я и так говорю нет. Не вижу такой связи.",
      resistanceCount: 0,
      nonResonanceDetected: true,
      hasValidStep: false,
      userAlreadyAnswered: false,
      userChangedFocus: false,
    });
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain("User rejected");
  });

  it("allows returning to the dream-self after a rejected hypothesis", () => {
    const result = validateAssistantResponse({
      responseText: "Да, эта связь не подходит. Какая ты там, в школьном туалете, в тот момент, когда решаешь больше не мыть?",
      currentMode: "dream",
      conversationHistory: [],
      lastUserMessage: "Я не могу найти такие параллели.",
      resistanceCount: 0,
      nonResonanceDetected: true,
      hasValidStep: false,
      userAlreadyAnswered: false,
      userChangedFocus: false,
    });
    expect(result.isValid).toBe(true);
  });
});
