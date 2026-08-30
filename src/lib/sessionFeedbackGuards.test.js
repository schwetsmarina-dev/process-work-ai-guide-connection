import { describe, it, expect } from "vitest";
import { detectCompletionState } from "./sessionSignals";
import { answeredIntegration, validateFeedbackQuality, feedbackFallback } from "./sessionFeedbackGuards";
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
  it("rejects a paraphrased integration loop", () => {
    const messages = [a("¿Qué cambiaría en tu vida cotidiana?"), u("Naturalidad")];
    expect(answeredIntegration(messages)).toBe(true);
    expect(validateFeedbackQuality("¿Qué aporta esa calma a tus decisiones?", messages, "Naturalidad").reason).toBe("repeated_integration");
    expect(feedbackFallback("es", "Naturalidad", messages)).toContain("Prefieres");
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
