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
