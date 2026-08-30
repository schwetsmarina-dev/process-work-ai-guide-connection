import { describe, it, expect, vi, beforeEach } from "vitest";
import records from "../../docs/continuation-steps-ru-es.json";
import termRecords from "../../docs/continuation-term-references-ru-es.json";
import { SYSTEM_PROMPT_ES } from "./systemPrompt";
import { mainSteps, continuationRows, cycleMessages, buildContinuationPrompt, parseContinuationResponse, generateContinuationResponse } from "./sessionContinuation";
import { checkModeStepChain } from "./modeStepIntegrity";
const client = vi.hoisted(() => ({
  entities: {ModeStep:{list:vi.fn(), filter:vi.fn()}, Term:{list:vi.fn()}},
  functions:{invoke:vi.fn()},
}));
vi.mock("@/api/base44Client", () => ({base44:client}));
import { getAIResponse, fetchStep } from "./sessionAI";

const row = records.find(r => r.step_key === "dream_continue_sound");
const user = content => ({role:"user", content});
const assistant = content => ({role:"assistant", content});
const response = (text, key = row.step_key) => JSON.stringify({step_key:key, response:text});

beforeEach(() => {
  vi.clearAllMocks();
  client.entities.ModeStep.filter.mockResolvedValue(records);
  client.entities.ModeStep.list.mockResolvedValue(records);
  client.entities.Term.list.mockResolvedValue(termRecords);
});

describe("five-channel continuation", () => {
  it.each(["body","dream","conflict","journaling"])("%s has five linked channels and complete RU/ES instructions", mode => {
    const rows = continuationRows(records, mode);
    expect(rows).toHaveLength(13);
    expect(rows.filter(r => r.channel_key).map(r => r.channel_key).sort()).toEqual([
      "auditory_channel","movement_channel","proprioceptive_channel","relationship_channel","visual_channel"
    ]);
    for (const r of rows) {
      for (const field of ["goal","question","facilitator_hint","entry_condition","transition_hint"]) {
        expect(r[field]).toBeTruthy(); expect(r[field+"_es"]).toBeTruthy();
      }
      expect(r.allowed_next_keys.every(k => rows.some(x => x.step_key === k))).toBe(true);
    }
  });
  it("does not inflate main progress or make continuation rows linear-chain orphans", () => {
    const main = [{mode_id:"dream",step_number:1,step_key:"dream_1",next_step_on_answer:2},{mode_id:"dream",step_number:2,step_key:"dream_2"}];
    expect(mainSteps([...main,...records])).toEqual(main);
    expect(checkModeStepChain([...main,...continuationRows(records,"dream")])).toMatchObject({ok:true,stepCount:2,terminalStep:2});
  });
  it("step fallback never selects a continuation row", async () => {
    client.entities.ModeStep.list.mockResolvedValue([{mode_id:"dream",step_number:1,step_key:"dream_1"},...records]);
    expect((await fetchStep("dream", 99)).step_key).toBe("dream_1");
  });
  it("keeps early process material rather than only the final eight messages", () => {
    const messages = [user("Mi experiencia es magia azul, no fuerza."),...Array.from({length:12},(_,i)=>user("turno "+i))];
    const prompt = buildContinuationPrompt({rows:continuationRows(records,"dream"),terms:[],messages,language:"es",systemPrompt:"SAFE",startedAt:"2026-08-30T12:00:00Z"});
    expect(prompt).toContain("magia azul, no fuerza");
    expect(prompt).toContain("¿Qué sentimientos predominan?");
    expect(prompt).toContain("¿Con quién no?");
    expect(prompt).toContain("Si miras tu vida cotidiana con los ojos de esta fuerza");
    expect(prompt).not.toContain("Когда ты позволяешь");
  });
  it("reopens integration only for the new cycle, not the earlier final question", () => {
    const old = [
      {...assistant("¿Qué cambia en tu vida con esto?"),created_date:"2026-08-30T11:00:00Z"},
      {...user("Puedo elegir."),created_date:"2026-08-30T11:01:00Z"},
      {...user("Ahora noto algo diferente."),created_date:"2026-08-30T12:01:00Z"},
    ];
    const cycle = cycleMessages(old,"2026-08-30T12:00:00Z");
    expect(cycle).toHaveLength(1);
    expect(parseContinuationResponse(response("¿Qué cambia en tu vida con esto?"),[row],cycle,"Ahora noto algo diferente.").isValid).toBe(true);
    expect(parseContinuationResponse(response("¿Qué cambia en tu vida con esto?"),[row],old,"Ahora noto algo diferente.").isValid).toBe(false);
  });
  it("allows the approved visual intervention after the previous closure", async () => {
    const text = "Si miras tu vida cotidiana con los ojos de esta magia, ¿qué notas?";
    client.functions.invoke.mockResolvedValue({data:{response:response(text,"dream_continue_visual")}});
    const result = await getAIResponse({mode_id:"dream",continuation_requested:true},{question:"Закрой сессию"},[
      user("En el sueño encontré magia."),assistant("Podemos cerrar."),user("Quiero continuar con esta magia.")
    ],"Quiero continuar con esta magia.","es");
    expect(result).toBe(text);
    expect(client.entities.ModeStep.filter).toHaveBeenCalledWith({mode_id:"dream"});
  });
  it("does not override an explicit stop even when continuation is persisted", async () => {
    const result = await getAIResponse({mode_id:"dream",continuation_requested:true},{},[user("На сегодня достаточно")],"На сегодня достаточно","ru");
    expect(result).not.toContain("?");
    expect(client.functions.invoke).not.toHaveBeenCalled();
  });
  it("retains the safety stop without asking the model to deepen", async () => {
    const result = await generateContinuationResponse({client,session:{mode_id:"dream"},messages:[],userText:"",language:"ru",systemPrompt:"",resistanceCount:3});
    expect(result).toContain("паузу");
    expect(client.functions.invoke).not.toHaveBeenCalled();
  });
  it.each([
    response("¿Cómo es tu lugar en el mundo?"),
    response("¿Qué sientes? ¿Cómo te mueves?"),
    response("¿Qué sientes?", "dream_1"),
    "not JSON",
  ])("rejects malformed routes or disallowed interventions: %s", raw => {
    expect(parseContinuationResponse(raw,[row],[],"").isValid).toBe(false);
  });
  it("retries an invalid world-channel response using the same table and history", async () => {
    client.functions.invoke
      .mockResolvedValueOnce({data:{response:response("¿Cómo es tu lugar en el mundo?")}})
      .mockResolvedValueOnce({data:{response:response("Si empezaras a sonar como esta magia, ¿qué sonido sería?")}});
    const result=await generateContinuationResponse({client,session:{mode_id:"dream"},messages:[user("magia")],userText:"magia",language:"es",systemPrompt:"SAFE",resistanceCount:0});
    expect(result).toContain("esta magia");
    expect(client.functions.invoke).toHaveBeenCalledTimes(2);
    expect(client.functions.invoke.mock.calls[1][1].prompt).toContain("Do not ask a world-channel question");
  });
});
