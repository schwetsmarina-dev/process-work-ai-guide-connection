import { base44 } from "@/api/base44Client";
import { MODE_STEPS, SYSTEM_PROMPT, CRISIS_KEYWORDS, CRISIS_MESSAGE } from "./modeSteps";

export function checkCrisis(text) {
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
}

export async function getAIResponse(session, messages, userMessage) {
  const steps = MODE_STEPS[session.mode] || [];
  const currentStep = session.current_step || 0;
  const step = steps[currentStep];

  const conversationHistory = messages
    .map((m) => `${m.role === "user" ? "Пользователь" : "Ассистент"}: ${m.content}`)
    .join("\n");

  let stepContext = "";
  if (step) {
    stepContext = `\n\nТекущий этап работы (${currentStep + 1}/${steps.length}):
Цель: ${step.goal}
Направляющий вопрос для этого этапа: "${step.question}"

Используй этот вопрос как ориентир, но адаптируй его к контексту разговора. Не задавай вопрос буквально если он не подходит — будь гибким.`;
  } else {
    stepContext = `\n\nВсе структурированные этапы пройдены. Мягко завершай сессию, предложив интеграцию опыта.`;
  }

  const modeShiftHint = `\n\nЕсли замечаешь, что пользователь:
- в режиме ТЕЛА начинает описывать яркие образы — мягко предложи перейти к работе со сном
- в ДНЕВНИКЕ раскрывает полярность — мягко предложи работу с конфликтом
- в любом режиме говорит о сильном телесном ощущении — предложи перейти к телу
Делай это деликатно, как предложение.`;

  const prompt = `${SYSTEM_PROMPT}${stepContext}${modeShiftHint}

Режим: ${session.mode}

История разговора:
${conversationHistory}

Пользователь: ${userMessage}

Ответь как заботливый проводник. Один осмысленный вопрос или отражение. Кратко.`;

  const response = await base44.integrations.Core.InvokeLLM({
    prompt,
  });

  return response;
}

export async function generateSessionSummary(session, messages) {
  const conversation = messages
    .map((m) => `${m.role === "user" ? "Пользователь" : "Ассистент"}: ${m.content}`)
    .join("\n");

  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `Проанализируй эту сессию самоисследования в стиле Process Work и создай краткое резюме.

Режим: ${session.mode}

Разговор:
${conversation}

Создай резюме на русском языке.`,
    response_json_schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Краткое резюме сессии, 3-5 предложений" },
        themes: {
          type: "array",
          items: { type: "string" },
          description: "Основные темы (2-4 слова каждая)",
        },
        signals: {
          type: "array",
          items: { type: "string" },
          description: "Замеченные сигналы",
        },
        next_step_suggestion: {
          type: "string",
          description: "Предложение для бережного следующего шага",
        },
        memories: {
          type: "array",
          items: {
            type: "object",
            properties: {
              key: { type: "string" },
              value: { type: "string" },
              category: { type: "string", enum: ["emotion", "body", "dream", "conflict", "pattern", "insight"] },
              importance: { type: "string", enum: ["low", "medium", "high"] },
            },
          },
          description: "Ключевые воспоминания для сохранения",
        },
      },
    },
  });

  return result;
}