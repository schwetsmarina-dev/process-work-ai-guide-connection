import { describe, it, expect, vi } from "vitest";
import records from "../../docs/continuation-steps-ru-es.json";
import terms from "../../docs/continuation-term-references-ru-es.json";
import { SYSTEM_PROMPT, SYSTEM_PROMPT_ES } from "./systemPrompt";
import { generateContinuationResponse } from "./sessionContinuation";

function clientFor(rows = records, definitions = terms) {
  return {
    entities: { ModeStep: { filter: vi.fn().mockResolvedValue(rows) }, Term: { list: vi.fn().mockResolvedValue(definitions) } },
    functions: { invoke: vi.fn().mockResolvedValue({ data: { response: JSON.stringify({ step_key: "dream_continue_edge", response: "¿Qué intenta proteger esta figura?" }) } }) },
  };
}
const args = { session: { mode_id: "dream" }, messages: [], userText: "", language: "es", systemPrompt: SYSTEM_PROMPT_ES, resistanceCount: 0 };
describe("complete bilingual continuation linkage", () => {
  for (const language of ["ru", "es"]) {
    it.each(["body", "dream", "conflict", "journaling"])(language + " %s sends every row with localized linked definitions and distinct transitions", async mode => {
      const client = clientFor();
      const response = language === "es" ? "¿Qué intenta proteger esta figura?" : "Что пытается защитить эта фигура?";
      client.functions.invoke.mockResolvedValue({data:{response:JSON.stringify({step_key:mode+"_continue_edge",response})}});
      await generateContinuationResponse({...args,client,session:{mode_id:mode},language,systemPrompt:language==="es"?SYSTEM_PROMPT_ES:SYSTEM_PROMPT});
      const prompt = client.functions.invoke.mock.calls[0][1].prompt;
      const table = JSON.parse(prompt.split("\nTABLE:\n")[1].split("\nTERM REFERENCES:\n")[0]);
      const definitions = JSON.parse(prompt.split("\nTERM REFERENCES:\n")[1].split("\n")[0]);
      expect(table).toHaveLength(13);
      expect(new Set(table.map(row=>row.transitions)).size).toBe(13);
      expect(table.filter(row=>row.channel)).toHaveLength(5);
      expect(definitions.some(term=>term.key==="world_channel")).toBe(false);
      for (const row of table) {
        const stored = records.find(r=>r.step_key===row.step_key);
        expect(row.term_keys).toEqual(stored.related_term_ids.split(";").map(key=>key.trim()).filter(Boolean));
        for (const key of row.term_keys) {
          const term=definitions.find(t=>t.key===key);
          const source=terms.find(t=>t.latin_key===key);
          expect(term).toEqual({key,name:source[language==="es"?"term_es":"term"],definition:source[language==="es"?"short_definition_es":"short_definition"],application:source[language==="es"?"practical_application_es":"practical_application"]});
          expect(term.name && term.definition && term.application).toBeTruthy();
        }
      }
      expect(prompt).toContain(language==="es"?"La figura del borde protege algo importante":"Краевая фигура защищает что-то важное");
      expect(prompt).not.toContain("sin suponer que protege");
      expect(prompt).not.toContain("No atribuyas protección");
      expect(prompt).not.toContain("Не приписывай защиту");
      if(language==="es") expect(prompt).not.toMatch(/[А-Яа-яЁё]/u);
    });
  }
  it.each(["term_es","short_definition_es","practical_application_es"])("does not send incomplete Spanish %s to AI", async field => {
    const definitions=terms.map(t=>t.latin_key==="edge"?{...t,[field]:""}:t);
    const client=clientFor(records,definitions);
    await expect(generateContinuationResponse({...args,client})).rejects.toThrow("term methodology is unavailable");
    expect(client.functions.invoke).not.toHaveBeenCalled();
  });
  it.each(["missing","duplicate","foreign-route"])("rejects %s table corruption before calling AI", async issue => {
    const rows=records.map(row=>({...row}));
    const index=rows.findIndex(row=>row.step_key==="dream_continue_edge");
    if(issue==="missing") rows.splice(index,1);
    if(issue==="duplicate") rows.push({...rows[index]});
    if(issue==="foreign-route") rows[index].allowed_next_keys=["body_continue_edge"];
    const client=clientFor(rows);
    await expect(generateContinuationResponse({...args,client})).rejects.toThrow("methodology is unavailable");
    expect(client.functions.invoke).not.toHaveBeenCalled();
  });
});
