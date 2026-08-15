import { describe, expect, it } from "vitest";
import { detectProcessMappingStage, getModeKey } from "./sessionAI";

describe("four-mode regression guard", () => {
  const cases = [
    ["body", "awaiting_body_signal"],
    ["dream", "awaiting_dream"],
    ["conflict", "awaiting_conflict_material"],
    ["journaling", "awaiting_journaling_topic"],
  ];

  it.each(cases)("%s starts in its own initial-material stage", (mode, stage) => {
    expect(getModeKey(mode)).toBe(mode);
    expect(detectProcessMappingStage([], mode).stage).toBe(stage);
  });

  it.each(["body_signal", "dream_work", "conflict_process", "free_journaling"])("normalizes configured id %s", (modeId) => {
    expect(["body", "dream", "conflict", "journaling"]).toContain(getModeKey(modeId));
  });
});
