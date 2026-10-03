import { describe, it, expect, vi } from "vitest";
vi.mock("@/api/base44Client", () => ({base44: {functions:{invoke:vi.fn()}, entities:{Term:{list:vi.fn(async()=>[])}}}}));
import { validateAssistantResponse } from "./sessionValidation";
import { getTurnIntent, validateFeedbackQuality } from "./sessionFeedbackGuards";
import { detectBodyProcessStage } from "./bodyProcess";
const u=content=>({role:"user",content}), a=content=>({role:"assistant",content});
const params=(mode="body")=>({currentMode:mode, conversationHistory:[u("Ощущаю беспокойство в плечах и груди")],lastUserMessage:"Плечи и грудь",dreamMappingComplete:false,mappingStageValue:"body_small_u",hasValidStep:false,resistanceCount:0});
describe("September body loop root cause",()=>{
 it.each(["Где именно в теле ты замечаешь этот сигнал?","Как ощущается скованность в плечах?","¿Dónde lo notas en el cuerpo?"])("allows Body clarification: %s",responseText=>expect(validateAssistantResponse({...params(),responseText}).isValid).toBe(true));
 it("keeps the Dream somatic gate",()=>expect(validateAssistantResponse({...params("dream"),mappingStageValue:"awaiting_secondary",responseText:"Где ты ощущаешь это в теле?"}).isValid).toBe(false));
 it("does not enforce advisory legacy step vocabulary in Body",()=>expect(validateAssistantResponse({...params(),responseText:"Как ощущается скованность?",hasValidStep:true,step:{goal:"Интегрировать вторичный процесс",question:"Как перенести найденное качество в жизнь?"}}).isValid).toBe(true));
 it.each(["Последнее время мучаюсь запорами","Прерывистый сон","Tengo estreñimiento","Tengo insomnio"])("recognizes the opening signal: %s",t=>expect(detectBodyProcessStage([u(t)]).stage).toBe("body_small_u"));
 it("recognizes short localization and quality replies",()=>{const s=detectBodyProcessStage([u("Прерывистый сон"),u("Когда встречаемся на несколько дней, последняя ночь беспокойная"),u("Плечи и грудь"),u("Плечи будто разворачиваются вовнутрь и появляется ощущение скованности и замирания")]);expect(s.body_primary_dimensions).toContain("localization");expect(s.body_primary_dimensions).toContain("quality");});
 it.each(["Я испытываю стыд, когда я не понимаю значение слов в общении","Me da vergüenza cuando no entiendo las palabras de otras personas"])("does not confuse life material with interface confusion",t=>expect(getTurnIntent(t).confusion).toBe(false));
 it.each(["Я не понимаю твой вопрос","No entiendo tu pregunta","Я с твоей помощью всё равно не могу понять, про что этот сон."])("recognizes actual confusion",t=>expect(getTurnIntent(t).confusion).toBe(true));
 it("rejects the old canned answer even when returned by the model",()=>{const t="Можем продолжать в твоём темпе. На чём тебе хочется сейчас остановиться подробнее?";expect(validateFeedbackQuality(t,[a(t),u("На плечах")],"На плечах").reason).toBe("repeated_response");});
 it("lets a different intervention repair old immersion repetition",()=>expect(validateAssistantResponse({...params(),conversationHistory:[a("Остаёшься рядом с этим состоянием?"),u("Да"),a("Что происходит рядом с этим состоянием?"),u("Тяжесть")],lastUserMessage:"Тяжесть",responseText:"Какая поза сейчас удобна?"}).isValid).toBe(true));
 it("does not suggest a physical symptom has an intention",()=>expect(validateAssistantResponse({...params(),responseText:"Если представить, что это удержание обладает собственной энергией или намерением, что оно делает?"}).reason).toBe("suggested_symptom_intention"));
});

import {base44} from "@/api/base44Client";
import {getAIResponse} from "./sessionAI";
import {feedbackFallback,normalize} from "./sessionFeedbackGuards";
describe("full turn recovery",()=>{
 it("accepts Body's next question in one model call",async()=>{
  vi.mocked(base44.functions.invoke).mockReset();
  vi.mocked(base44.functions.invoke).mockResolvedValue({data:{response:"Где именно в теле ты замечаешь этот сигнал?"}});
  const result=await getAIResponse({mode_id:"body",current_step:1,id:"test"}, {step_number:1,goal:"Интегрировать вторичный процесс",question:"Как перенести найденное качество в жизнь?"},[a("Что в теле хочешь исследовать?"),u("Прерывистый сон")],"Прерывистый сон","ru");
  expect(result).toContain("Где именно");
  expect(base44.functions.invoke).toHaveBeenCalledTimes(1);
 });
 it("uses a missing dimension after rejected responses",async()=>{
  vi.mocked(base44.functions.invoke).mockReset();
  vi.mocked(base44.functions.invoke).mockResolvedValue({data:{response:"Симптом защищает тебя."}});
  const result=await getAIResponse({mode_id:"body",current_step:1,id:"test"},null,[u("Прерывистый сон")],"Прерывистый сон","ru");
  expect(result).toContain("Где именно");
  expect(base44.functions.invoke).toHaveBeenCalledTimes(2);
 });
 it("surfaces Retry instead of repeating a recovery question",async()=>{
  vi.mocked(base44.functions.invoke).mockReset();
  vi.mocked(base44.functions.invoke).mockResolvedValue({data:{response:"Симптом защищает тебя."}});
  await expect(getAIResponse({mode_id:"body",current_step:1,id:"test"},null,[u("Прерывистый сон"),a("Где именно в теле ты замечаешь этот сигнал?"),u("Пока не знаю")],"Пока не знаю","ru")).rejects.toThrow("новый вопрос");
 });
 it("does not bypass repeat validation in continuation recovery",()=>{
  const first=feedbackFallback("ru","Непонятно",[]);
  expect(()=>feedbackFallback("ru","Непонятно",[a(first)])).toThrow();
 });
 it("preserves Cyrillic й while normalizing Spanish accents",()=>expect(normalize("Твой sueño")).toBe("твой sueno"));
});

import {bodyMedicalPause} from "./bodyProcess";
describe("physical-symptom boundary",()=>{
 it.each(["Попробовала слабительное и всё равно ничего не вышло","El laxante no funciona"])("suggests medical assessment after unsuccessful self-care",text=>expect(bodyMedicalPause([u("Запор несколько дней"),u(text)],text,"ru")).toContain("врачу"));
 it("does not trigger when a measure worked",()=>expect(bodyMedicalPause([u("Запор"),u("Слабительное помогло")],"Слабительное помогло","ru")).toBeNull());
 it("does not mistake a friend's symptoms for today's sleep focus",()=>expect(bodyMedicalPause([u("Прерывистый сон")],"Нет, не помогло","ru")).toBeNull());
});

describe("concrete process rather than lexical false positives",()=>{
 it("does not turn literal shoulder movement into an X figure",()=>{
 const s=detectBodyProcessStage([u("Прерывистый сон"),u("В плечах есть скованность, плечи будто разворачиваются вовнутрь")]);
 expect(s.x_image_emerged).toBe(false);
 });
 it("allows repeated reflections with a different next question",()=>{
 const reflection="Плечи разворачиваются вовнутрь, появляется ощущение скованности и замирания.";
 const result=validateAssistantResponse({...params(),conversationHistory:[u("Скованность"),a(reflection+" Какое у этого ощущение?")],responseText:reflection+" Что сейчас хочется делать?"});
 expect(result.isValid).toBe(true);
 });
});
