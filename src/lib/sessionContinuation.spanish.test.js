import { describe, it, expect, vi, beforeEach } from "vitest";
import records from "../../docs/continuation-steps-ru-es.json";
import termRecords from "../../docs/continuation-term-references-ru-es.json";
import { SYSTEM_PROMPT_ES } from "./systemPrompt";
import { generateContinuationResponse } from "./sessionContinuation";
const client = vi.hoisted(() => ({
  entities: {ModeStep:{filter:vi.fn()}, Term:{list:vi.fn()}},
  functions:{invoke:vi.fn()},
}));
vi.mock("@/api/base44Client", () => ({base44:client}));
import { getAIResponse } from "./sessionAI";
beforeEach(() => {
  vi.clearAllMocks();
  client.entities.ModeStep.filter.mockResolvedValue(records);
  client.entities.Term.list.mockResolvedValue(termRecords);
});

describe("Spanish methodology reaching the AI gateway", () => {
  it.each(["body", "dream", "conflict", "journaling"])("%s sends Spanish rules, all steps and term applications", async mode => {
    client.functions.invoke.mockResolvedValue({data:{response:JSON.stringify({step_key:mode+"_continue_positions",response:"¿Qué ha cambiado dentro de ti entre esos dos estados?"})}});
    await getAIResponse({mode_id:mode,continuation_requested:true},{},[
      {role:"user",content:"Antes aceptaba hacerlo. Ahora me niego. Quiero explorar qué ha cambiado."}
    ],"Quiero explorar qué ha cambiado.","es");
    const prompt=client.functions.invoke.mock.calls[0][1].prompt;
    const table=JSON.parse(prompt.split("\nTABLE:\n")[1].split("\nTERM REFERENCES:\n")[0]);
    expect(table).toHaveLength(13);
    expect(table.every(r=>r.goal && r.enter && r.example && r.instructions && r.transitions)).toBe(true);
    expect(prompt).not.toMatch(/[А-Яа-яЁё]/u);
    expect(prompt).toContain("explora por separado ambas posiciones");
    expect(prompt).toContain("¿Qué ha cambiado dentro de ti entre esos dos estados?");
    expect(prompt).toContain("No identifiques automáticamente la posición anterior");
    expect(prompt).toContain("Puede aparecer un borde propio en cada canal");
    expect(prompt).toContain("Los ejemplos de fuerza NO autorizan introducir fuerza");
    expect(prompt).toContain("Canal de experiencia y expresión mediante el movimiento");
    expect(prompt).toContain("Sigue la experiencia concreta de la persona.");
    expect(prompt).toContain("Explora con curiosidad qué intenta proteger");
    expect(prompt).toContain("La figura del borde protege algo importante");
    expect(prompt).not.toContain("sin suponer que protege");
    expect(SYSTEM_PROMPT_ES).toContain("tabla de continuación");
  });
  it.each(["goal_es","entry_condition_es","transition_hint_es","facilitator_hint_es","question_es"])("rejects missing %s before calling AI", async field => {
    const rows=records.map(r=>({...r}));
    delete rows.find(r=>r.step_key==="dream_continue_positions")[field];
    client.entities.ModeStep.filter.mockResolvedValue(rows);
    await expect(generateContinuationResponse({client,session:{mode_id:"dream"},messages:[],userText:"",language:"es",systemPrompt:SYSTEM_PROMPT_ES,memoriesBlock:"",resistanceCount:0})).rejects.toThrow("methodology is unavailable");
    expect(client.functions.invoke).not.toHaveBeenCalled();
  });
  it("rejects a broken Spanish Term reference before calling AI", async () => {
    client.entities.Term.list.mockResolvedValue(termRecords.filter(t=>t.latin_key!=="movement_channel"));
    await expect(generateContinuationResponse({client,session:{mode_id:"dream"},messages:[],userText:"",language:"es",systemPrompt:SYSTEM_PROMPT_ES,memoriesBlock:"",resistanceCount:0})).rejects.toThrow("term methodology is unavailable");
    expect(client.functions.invoke).not.toHaveBeenCalled();
  });
});
