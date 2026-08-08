import { describe, expect, it } from "vitest";
import { detectEdgeFigure, extractStageAnswersFromUserMessages } from "./stageExtraction";

describe("edge figure detection", () => {
  it("recognizes an explicitly named internal critic", () => {
    const text = "Мой внутренний критик мешает мне принимать себя.";
    expect(detectEdgeFigure(text)).toContain("внутренний критик");
  });

  it("recognizes a generic internal voice when it performs a blocking function", () => {
    const text = "Внутренний голос не позволяет мне показывать эту часть себя.";
    expect(detectEdgeFigure(text)).toContain("Внутренний голос");
  });

  it("does not label a neutral internal voice as an edge figure", () => {
    expect(detectEdgeFigure("Я слышу внутренний голос, который просто напоминает мне отдохнуть.")).toBeNull();
  });

  it("promotes a detected edge figure to the active focus", () => {
    const result = extractStageAnswersFromUserMessages([
      { role: "user", content: "Есть внутренний критик, который запрещает мне принимать себя." },
    ]);

    expect(result.edge_figure).toContain("внутренний критик");
    expect(result.selected_focus).toContain("внутренний критик");
  });

  it("supports Spanish edge-figure language", () => {
    expect(detectEdgeFigure("Mi crítico interior no me permite aceptar esta parte de mí.")).toContain("crítico interior");
  });
});
