import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SYSTEM_PROMPT_ES } from "./systemPrompt";
import { buildBodyStageInstruction } from "./bodyProcess";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const cyrillic = /[А-Яа-яЁё]/;

const bodyStages = [
  { stage: "awaiting_body_signal", body_primary_dimensions: [] },
  { stage: "body_small_u", body_primary_dimensions: ["localization"] },
  { stage: "body_amplify_signal", body_primary_dimensions: ["localization", "quality", "impact"] },
  { stage: "body_identify_x", x_image: "piedra", x_channels: ["visual"] },
  { stage: "body_unfold_x", x_image: "piedra", x_channels: ["visual", "movement"] },
  { stage: "body_discover_big_u", x_image: "piedra", x_channels: ["movement"] },
  { stage: "body_stabilize_big_u", secondary_answer: "firmeza" },
  { stage: "body_integrate_big_u", secondary_answer: "firmeza" },
];

describe("Spanish chat prompt source", () => {
  it("has a dedicated Spanish system prompt with no Cyrillic", () => {
    expect(SYSTEM_PROMPT_ES.length).toBeGreaterThan(1000);
    expect(cyrillic.test(SYSTEM_PROMPT_ES)).toBe(false);
  });

  it("keeps every Body runtime stage fully Spanish", () => {
    for (const stage of bodyStages) {
      const instruction = buildBodyStageInstruction(stage, "es");
      expect(instruction.length).toBeGreaterThan(20);
      expect(cyrillic.test(instruction)).toBe(false);
    }
  });

  it("routes Spanish chat to SYSTEM_PROMPT_ES instead of a language override on the Russian prompt", () => {
    const source = readFileSync(path.join(root, "src/lib/sessionAI.js"), "utf8");
    expect(source).toContain('const systemPrompt = isEsRuntime ? SYSTEM_PROMPT_ES : SYSTEM_PROMPT');
    expect(source).toContain('const languageOverride = isEsRuntime ? "" : buildLanguageOverride(language)');
    expect(source).toContain('━━━ RUNTIME METODOLÓGICO ES ━━━');
    expect(source).toContain('const summaryPrompt = (lang === "es" ? spanishSummaryPrompt : russianSummaryPrompt)');
  });
});
