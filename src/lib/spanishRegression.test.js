import { describe, it, expect } from "vitest";
import { detectProcessMappingStage, detectResistanceCount } from "./sessionAI";
import { getSafeFallback } from "./sessionValidation";

const ai = (content) => ({ role: "assistant", content });
const user = (content) => ({ role: "user", content });
const CYRILLIC = /[А-Яа-яЁё]/;

describe("Spanish customer journey regression guards", () => {
  it("recognizes a Spanish dream narrative instead of asking for the dream again", () => {
    const result = detectProcessMappingStage([
      ai("Cuéntame tu sueño tal y como lo recuerdas."),
      user("He soñado que estaba en una casa enorme y de repente apareció un perro blanco."),
    ], "dream");
    expect(result.dream_shared).toBe(true);
    expect(result.stage).not.toBe("awaiting_dream");
  });

  it("recognizes Spanish primary and secondary questions and answers in journaling", () => {
    const result = detectProcessMappingStage([
      ai("¿Qué quieres explorar hoy?"),
      user("Quiero entender una situación en el trabajo que me ocupa mucho desde hace varios días."),
      ai("¿Qué parte de esta situación ya te resulta conocida o se parece a tu manera habitual de reaccionar?"),
      user("Me resulta familiar callarme para evitar problemas."),
      ai("¿Y qué aparece aquí como algo nuevo, extraño, vivo, inquietante, poco habitual o que todavía no entiendes del todo?"),
      user("Lo nuevo es que esta vez siento mucha rabia y quiero decir que no."),
    ], "journaling");
    expect(result.stage).toBe("complete");
    expect(result.primary_answer).toContain("familiar");
    expect(result.secondary_answer).toContain("nuevo");
  });

  it("never emits Cyrillic from any Spanish safe fallback", () => {
    const stages = [
      "awaiting_dream", "awaiting_body_signal", "awaiting_conflict_material",
      "awaiting_journaling_topic", "awaiting_primary", "awaiting_secondary",
      undefined,
    ];
    for (const mode of ["body", "dream", "conflict", "journaling"]) {
      for (const stage of stages) {
        const result = getSafeFallback(mode, null, false, stage ? { stage } : null, false, false, "es");
        expect(result).not.toMatch(CYRILLIC);
      }
    }
  });

  it("never emits Cyrillic from Spanish integration fallback", () => {
    const result = getSafeFallback("conflict", null, true, { stage: "complete" }, false, false, "es");
    expect(result).not.toMatch(CYRILLIC);
  });

  it("does not misclassify normal short Spanish answers as resistance", () => {
    expect(detectResistanceCount([
      user("sí"), user("vale"), user("en casa"), user("en el pecho"), user("un perro"),
    ])).toBe(0);
  });

  it("does count explicit Spanish stuck/refusal signals as resistance", () => {
    expect(detectResistanceCount([
      user("no sé"), user("no quiero seguir"), user("es demasiado"),
    ])).toBe(3);
  });
});
