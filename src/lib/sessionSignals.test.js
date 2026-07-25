import { describe, it, expect } from "vitest";
import { detectCompletionState, COMPLETION_SIGNALS } from "./sessionSignals";

function userMsg(content) {
  return { role: "user", content };
}
function aiMsg(content) {
  return { role: "assistant", content };
}

describe("detectCompletionState", () => {
  it("detects an explicit closure signal in the last user message", () => {
    const messages = [
      aiMsg("Что сейчас в теле?"),
      userMsg("Мне стало легче, напряжение ушло."),
    ];
    const result = detectCompletionState(messages);
    expect(result.isComplete).toBe(true);
    expect(result.matchedSignal).toBeTruthy();
  });

  it("does not flag an ordinary mid-exploration answer", () => {
    const messages = [
      aiMsg("Что ты замечаешь в теле сейчас?"),
      userMsg("Напряжение в груди, тяжело сказать что именно."),
    ];
    expect(detectCompletionState(messages).isComplete).toBe(false);
  });

  it("only looks at the last 3 user messages (closure must be fresh)", () => {
    const messages = [
      userMsg("Мне стало легче, отпустило."), // closure signal, but stale
      aiMsg("Что дальше?"),
      userMsg("На самом деле снова накрыло тревогой."),
      aiMsg("Расскажи об этом."),
      userMsg("Очень тяжело, ничего не понятно."),
      aiMsg("Хорошо, давай останемся здесь."),
      userMsg("Да, продолжаем, тут ещё много непонятного."),
    ];
    // The only closure phrase is 4 user-messages back — outside the 3-message window.
    expect(detectCompletionState(messages).isComplete).toBe(false);
  });

  it("has a non-trivial keyword list covering RU and ES", () => {
    expect(COMPLETION_SIGNALS.length).toBeGreaterThan(20);
    expect(COMPLETION_SIGNALS.some((s) => /[a-zA-Zñáéíóú]/.test(s))).toBe(true); // ES present
  });
});
