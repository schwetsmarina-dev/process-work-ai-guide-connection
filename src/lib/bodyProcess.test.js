import { describe, expect, it } from "vitest";
import { detectBodyProcessStage } from "./bodyProcess";

const u = (content) => ({ role: "user", content });
const a = (content) => ({ role: "assistant", content });

function primaryBase(extra = []) {
  return [
    u("У меня болит голова в висках."),
    a("Как именно это ощущается изнутри?"),
    u("Это сильное давление."),
    a("Когда это появляется, как ты обычно это проживаешь?"),
    u("Мне хочется лечь, закрыть глаза, яркий свет и шум мешают."),
    ...extra,
  ];
}

describe("Mindell body state machine", () => {
  it("keeps ordinary light/noise impact inside small u, not X", () => {
    const stage = detectBodyProcessStage(primaryBase());
    expect(stage.stage).toBe("body_amplify_signal");
    expect(stage.x_channel).toBe(null);
  });

  it("remembers a spontaneous concrete X but does not skip incomplete small u", () => {
    const stage = detectBodyProcessStage([
      u("Болит голова в висках, давление как каменная плита."),
    ]);
    expect(stage.stage).toBe("body_small_u");
    expect(stage.x_channel).toBe("visual");
  });

  it("moves to identification after small u is sufficient and X exists", () => {
    const stage = detectBodyProcessStage(primaryBase([
      u("И само давление похоже на каменную плиту."),
    ]));
    expect(stage.stage).toBe("body_identify_x");
    expect(stage.x_channel).toBe("visual");
  });

  it("does not mark X identified until the user answers the identification prompt", () => {
    const messages = primaryBase([
      u("Давление похоже на каменную плиту."),
      a("Попробуй на мгновение стать этой каменной плитой. Что ты замечаешь изнутри?"),
    ]);
    expect(detectBodyProcessStage(messages).stage).toBe("body_identify_x");

    messages.push(u("Я очень плотная и стою неподвижно."));
    expect(detectBodyProcessStage(messages).stage).toBe("body_unfold_x");
  });

  it("requires lived X before discovering big U", () => {
    const messages = primaryBase([
      u("Давление похоже на каменную плиту."),
      a("Попробуй стать этой плитой. Что ты замечаешь изнутри?"),
      u("Я плотная и тяжёлая."),
      a("Если ты сейчас эта плита, как тебе хочется двигаться или не двигаться, дышать или занимать пространство?"),
      u("Я стою очень устойчиво, блестю и чувствую себя красивой."),
    ]);
    expect(detectBodyProcessStage(messages).stage).toBe("body_discover_big_u");
  });

  it("treats big U as secondary only after qualities are named", () => {
    const messages = primaryBase([
      u("Давление похоже на каменную плиту."),
      a("Попробуй стать этой плитой. Что ты замечаешь изнутри?"),
      u("Я плотная."),
      a("Как тебе хочется двигаться или не двигаться, дышать или занимать пространство?"),
      u("Я стою неподвижно и блестю."),
      a("Какие качества появляются в тебе, когда ты так живёшь эту плиту?"),
      u("Я красивая, центрированная, уверенная и очень опорная."),
    ]);
    const stage = detectBodyProcessStage(messages);
    expect(stage.stage).toBe("body_stabilize_big_u");
    expect(stage.secondary_answer).toContain("красивая");
  });

  it("requires a user response to stabilization before life integration", () => {
    const messages = primaryBase([
      u("Давление похоже на каменную плиту."),
      a("Попробуй стать этой плитой. Что ты замечаешь изнутри?"),
      u("Я плотная."),
      a("Как тебе хочется двигаться или не двигаться, дышать или занимать пространство?"),
      u("Я стою и блестю."),
      a("Какие качества появляются в тебе?"),
      u("Я центрированная и уверенная."),
      a("Побудь в этом состоянии. Как оно ощущается сейчас в теле?"),
    ]);
    expect(detectBodyProcessStage(messages).stage).toBe("body_stabilize_big_u");
    messages.push(u("Я чувствую устойчивость в ногах и спокойное дыхание."));
    expect(detectBodyProcessStage(messages).stage).toBe("body_integrate_big_u");
  });

  it("completes only after the user answers an integration question", () => {
    const messages = primaryBase([
      u("Давление похоже на каменную плиту."),
      a("Попробуй стать этой плитой. Что ты замечаешь изнутри?"),
      u("Я плотная."),
      a("Как тебе хочется двигаться или не двигаться, дышать или занимать пространство?"),
      u("Я стою и блестю."),
      a("Какие качества появляются в тебе?"),
      u("Я центрированная и уверенная."),
      a("Побудь в этом состоянии. Как оно ощущается сейчас в теле?"),
      u("Я чувствую опору."),
      a("Как ты могла бы привнести эту центрированность и опору в свою жизнь?"),
    ]);
    expect(detectBodyProcessStage(messages).stage).toBe("body_integrate_big_u");
    messages.push(u("Я могла бы спокойнее принимать решения и не торопиться."));
    expect(detectBodyProcessStage(messages).stage).toBe("complete");
  });
});
