import { describe, it, expect } from "vitest";
import { detectCompletionState } from "./sessionSignals";
import { answeredIntegration, getTurnIntent, validateFeedbackQuality, feedbackFallback } from "./sessionFeedbackGuards";
const u = content => ({ role: "user", content });
const a = content => ({ role: "assistant", content });
describe("feedback regressions", () => {
  it.each(["No me siento tranquila", "Я поняла, но хочу продолжить", "Me doy cuenta de que sigo bloqueada y quiero explorar esto", "Alivio, no hay rigidez", "Tal vez la rigidez iría menguando"])("does not force closure: %s", text => {
    expect(detectCompletionState([u(text)]).isComplete).toBe(false);
  });
  it.each(["Quiero terminar", "Хочу завершить", "На сегодня достаточно"])("respects explicit ending: %s", text => {
    expect(detectCompletionState([u(text)]).isComplete).toBe(true);
  });
  it("does not carry an old ending over a new request", () => {
    expect(detectCompletionState([u("Хочу завершить"), a("Хорошо"), u("Нет, хочу продолжить")]).isComplete).toBe(false);
  });
  it("Tsusi: relief is a lived shift, not automatic closure or another integration loop", () => {
    const messages = [a("¿Qué cambiaría en tu vida cotidiana?"), u("Alivio, no hay rigidez")];
    expect(detectCompletionState([u("Alivio, no hay rigidez")]).isComplete).toBe(false);
    expect(answeredIntegration(messages)).toBe(true);
    expect(validateFeedbackQuality("¿Qué aporta ese alivio a tus decisiones?", messages, "Alivio, no hay rigidez").reason).toBe("repeated_integration");
    expect(feedbackFallback("es", "Alivio, no hay rigidez", messages)).toContain("Prefieres");
  });

  it("Esther: «Libertad» answers integration and must not trigger its paraphrase", () => {
    const messages = [a("¿Qué llevarías de esta experiencia a tu vida cotidiana?"), u("Libertad")];
    expect(answeredIntegration(messages)).toBe(true);
    expect(validateFeedbackQuality("¿Qué cambiaría esa libertad en tu día a día?", messages, "Libertad").reason).toBe("repeated_integration");
  });

  it("Irina: explicit confusion triggers a concrete reformulation, not closure", () => {
    const text = "Я с твоей помощью всё равно не могу понять, про что этот сон.";
    expect(getTurnIntent(text).confusion).toBe(true);
    expect(detectCompletionState([u(text)]).isComplete).toBe(false);
    expect(feedbackFallback("ru", text, [])).toContain("Скажу иначе и конкретнее");
  });
  it("does not count confusion as an integration answer", () => {
    expect(answeredIntegration([a("¿Qué cambiaría en tu vida?"), u("No entiendo")])).toBe(false);
  });
  it("rejects converting a possible result into an achieved one", () => {
    expect(validateFeedbackQuality("Ahora esa rigidez empieza a menguar.", [], "Tal vez la rigidez iría menguando").reason).toBe("hypothesis_as_result");
  });
  it("rejects invented recurring dreams", () => {
    expect(validateFeedbackQuality("Exploramos un sueño recurrente.", [u("Pinto una puerta")], "").reason).toBe("invented_recurrence");
    expect(validateFeedbackQuality("Exploramos un sueño recurrente.", [u("Este sueño se repite")], "").isValid).toBe(true);
  });
});
