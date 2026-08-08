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
  it("keeps ordinary light/noise impact inside small u, not X image", () => {
    const stage = detectBodyProcessStage(primaryBase());
    expect(stage.stage).toBe("body_amplify_signal");
    expect(stage.x_image_emerged).toBe(false);
  });

  it("remembers a spontaneous X image but does not skip incomplete small u", () => {
    const stage = detectBodyProcessStage([
      u("Болит голова в висках, давление как каменная плита."),
    ]);
    expect(stage.stage).toBe("body_small_u");
    expect(stage.x_image_emerged).toBe(true);
    expect(stage.x_image).toContain("плита");
  });

  it("moves to identification after small u is sufficient and an image exists", () => {
    const stage = detectBodyProcessStage(primaryBase([
      u("И само давление похоже на каменную плиту."),
    ]));
    expect(stage.stage).toBe("body_identify_x");
    expect(stage.x_image_emerged).toBe(true);
  });

  it("detects all six Process Work channels without treating them as substitutes for the image", () => {
    const stage = detectBodyProcessStage(primaryBase([
      u("Давление похоже на монстра. Я вижу его чёрным, ощущаю жар в теле, слышу его голос, он смотрит на меня, я двигаюсь как он, и весь мир вокруг становится тяжёлым."),
    ]));
    expect(stage.x_image_emerged).toBe(true);
    expect(stage.x_channels).toEqual(expect.arrayContaining([
      "visual",
      "proprioceptive",
      "auditory",
      "relationship",
      "movement",
      "world",
    ]));
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
      a("Как тебе хочется двигаться или не двигаться, дышать или занимать пространство?"),
      u("Я стою очень устойчиво, блестю и чувствую себя красивой."),
    ]);
    expect(detectBodyProcessStage(messages).stage).toBe("body_discover_big_u");
  });

  it("treats big U as secondary only after the explicit big-U question is answered", () => {
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
