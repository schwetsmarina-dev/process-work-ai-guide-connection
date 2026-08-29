// Smoke tests for the process-mapping state machine and loop detector in
// sessionAI.js. These two pieces are directly responsible for two of the bugs
// beta testers reported: the AI re-asking a question the user already
// answered (loop detection), and the primary/secondary orientation questions
// being asked out of order or merged into one confusing compound question
// (process-mapping stage). They are exported here specifically so they can be
// covered without mocking the AI gateway.
import { describe, it, expect } from "vitest";
import { detectProcessMappingStage, detectLoopInLastExchanges, getModeKey, detectResistanceCount, detectNonResonance, detectQuestionConfusion } from "./sessionAI";

function ai(content) {
  return { role: "assistant", content };
}
function user(content) {
  return { role: "user", content };
}

describe("getModeKey", () => {
  it("normalizes a Session.mode_id to a canonical mode key", () => {
    expect(getModeKey("journaling")).toBe("journaling");
    expect(getModeKey("dream")).toBe("dream");
    expect(getModeKey("body")).toBe("body");
    expect(getModeKey("conflict")).toBe("conflict");
  });

  it("returns null for an unrecognized mode", () => {
    expect(getModeKey("something_else")).toBeNull();
    expect(getModeKey(undefined)).toBeNull();
  });
});

describe("detectProcessMappingStage — journaling", () => {
  it("stays at the initial-material stage until the user has given a real topic", () => {
    const messages = [ai("О чём ты хочешь поисследовать сегодня?")];
    const result = detectProcessMappingStage(messages, "journaling");
    expect(result.stage).toBe("awaiting_journaling_topic");
    expect(result.primary_answer).toBeNull();
  });

  it("moves to awaiting_primary once the user has given substantive material", () => {
    const messages = [
      ai("О чём ты хочешь поисследовать сегодня?"),
      user("Меня беспокоит ситуация на работе, не знаю, как быть — это занимает почти все мои мысли последнюю неделю."),
    ];
    const result = detectProcessMappingStage(messages, "journaling");
    expect(result.stage).toBe("awaiting_primary");
  });

  it("moves to awaiting_secondary after the primary-process question is asked and answered", () => {
    const messages = [
      ai("О чём ты хочешь поисследовать сегодня?"),
      user("Меня беспокоит ситуация на работе, не знаю как быть, это занимает почти все мои мысли."),
      // This must stay in sync with the ModeStep journaling step-1 wording —
      // if the two drift apart, primary-answer detection silently breaks.
      ai("Что в этой ситуации для тебя уже понятно, знакомо или похоже на твой обычный способ реагировать?"),
      user("Мне знакомо это чувство беспомощности, так было и раньше."),
    ];
    const result = detectProcessMappingStage(messages, "journaling");
    expect(result.stage).toBe("awaiting_secondary");
    expect(result.primary_answer).toContain("беспомощности");
  });

  it("reaches complete only after both primary and secondary are answered separately", () => {
    const messages = [
      ai("О чём ты хочешь поисследовать сегодня?"),
      user("Меня беспокоит ситуация на работе, не знаю как быть, это занимает почти все мои мысли."),
      ai("Что в этой ситуации для тебя уже понятно, знакомо или похоже на твой обычный способ реагировать?"),
      user("Мне знакомо это чувство беспомощности, так было и раньше."),
      ai("А что здесь кажется новым, странным, живым, тревожащим, непривычным или пока не до конца понятным?"),
      user("Странно, что в этот раз я чувствую злость, а не грусть."),
    ];
    const result = detectProcessMappingStage(messages, "journaling");
    expect(result.stage).toBe("complete");
    expect(result.secondary_answer).toContain("злость");
  });
});

describe("detectProcessMappingStage — dream", () => {
  it("stays at awaiting_dream until the user actually tells the dream", () => {
    const messages = [ai("Расскажи мне свой сон так, как ты его помнишь.")];
    const result = detectProcessMappingStage(messages, "dream");
    expect(result.stage).toBe("awaiting_dream");
    expect(result.dream_shared).toBe(false);
  });

  it("moves past awaiting_dream once dream narrative content is present", () => {
    const messages = [
      ai("Расскажи мне свой сон так, как ты его помнишь."),
      user("Мне приснился сон, где я шла по лесу и увидела странный дом."),
    ];
    const result = detectProcessMappingStage(messages, "dream");
    expect(result.stage).not.toBe("awaiting_dream");
    expect(result.dream_shared).toBe(true);
  });
});

describe("correction / confusion / resistance separation", () => {
  it("recognizes Irina-style non-resonance as facilitator correction", () => {
    expect(detectNonResonance("Я и так говорю нет в реальности, и я не могу найти такие параллели.")).toBe(true);
    expect(detectNonResonance("Мне это не откликается, я не вижу связи.")).toBe(true);
  });

  it("recognizes request to rephrase a question", () => {
    expect(detectQuestionConfusion("Спроси по-другому, я не понимаю твой вопрос.")).toBe(true);
    expect(detectQuestionConfusion("No entiendo tu pregunta, pregúntamelo de otra manera.")).toBe(true);
  });

  it("does not count confusion or non-resonance as resistance/edge", () => {
    const messages = [
      user("Я не понимаю твой вопрос."),
      user("Я не могу найти такие параллели."),
      user("Мне пока не понятно послание сна."),
    ];
    expect(detectResistanceCount(messages)).toBe(0);
  });

  it("still counts explicit stop/overload as resistance", () => {
    const messages = [user("Мне слишком тяжело, я не хочу туда идти."), user("Стоп, давай закончим.")];
    expect(detectResistanceCount(messages)).toBeGreaterThanOrEqual(2);
  });
});

describe("detectLoopInLastExchanges", () => {
  it("returns false with fewer than 3 assistant turns", () => {
    const messages = [ai("Привет"), user("Привет"), ai("Что происходит?")];
    expect(detectLoopInLastExchanges(messages)).toBe(false);
  });

  it("detects the AI repeating essentially the same question", () => {
    const messages = [
      user("не знаю"),
      ai("Что ты чувствуешь в теле прямо сейчас, когда думаешь об этом?"),
      user("не уверена"),
      ai("Что ты чувствуешь в теле прямо сейчас, когда снова думаешь об этом?"),
      user("сложно сказать"),
      ai("Что ты чувствуешь в теле прямо сейчас в этот самый момент?"),
    ];
    expect(detectLoopInLastExchanges(messages)).toBe(true);
  });

  it("does not flag genuinely different follow-up questions", () => {
    const messages = [
      user("напряжение в груди"),
      ai("Где именно в теле ты это замечаешь?"),
      user("в груди, ближе к сердцу"),
      ai("Если бы это ощущение могло двигаться, куда бы оно пошло?"),
      user("вверх, к горлу"),
      ai("Есть ли звук или образ, связанный с этим движением?"),
    ];
    expect(detectLoopInLastExchanges(messages)).toBe(false);
  });
});
