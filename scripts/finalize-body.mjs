import fs from 'node:fs';

const bpPath = 'src/lib/bodyProcess.js';
let bp = fs.readFileSync(bpPath, 'utf8');
const oldId = `const IDENTIFICATION_ASSISTANT = [\n  "стань этим", "побудь этим", "если ты —", "если ты становишься", "попробуй быть этим", "войти в этот образ",\n  "войти в это ощущение", "представь, что ты —", "sé eso", "si tú eres", "conviértete en",\n];`;
const newId = `const IDENTIFICATION_ASSISTANT = [\n  "стань эт", "стать эт", "побудь эт", "если ты —", "если ты становишься", "если ты сейчас", "попробуй быть эт",\n  "попробуй на мгновение стать", "войти в этот образ", "войти в эту", "войти в это ощущение", "представь, что ты —",\n  "sé eso", "si tú eres", "si ahora eres", "conviértete en",\n];`;
if (!bp.includes(oldId)) throw new Error('IDENTIFICATION_ASSISTANT block not found');
bp = bp.replace(oldId, newId);
fs.writeFileSync(bpPath, bp);

const aiPath = 'src/lib/sessionAI.js';
let ai = fs.readFileSync(aiPath, 'utf8');
const oldIdx = `  const secondaryAnswerIndex = messages.findLastIndex((m) => m.role === "user" && mappingStage.secondary_answer && m.content.includes(mappingStage.secondary_answer.substring(0, 30)));\n  const messagesAfterSecondary = secondaryAnswerIndex >= 0 ? messages.slice(secondaryAnswerIndex + 1) : [];`;
const newIdx = `  const secondaryAnswerIndex = modeKey === "body"\n    ? -1\n    : messages.findLastIndex((m) => m.role === "user" && mappingStage.secondary_answer && m.content.includes(mappingStage.secondary_answer.substring(0, 30)));\n  const messagesAfterSecondary = secondaryAnswerIndex >= 0 ? messages.slice(secondaryAnswerIndex + 1) : [];`;
if (!ai.includes(oldIdx)) throw new Error('secondaryAnswerIndex block not found');
ai = ai.replace(oldIdx, newIdx);

const warningOld = `  if (mappingStageComplete && mappingStage.primary_answer && mappingStage.secondary_answer && !assistantReflectedMap) {`;
const warningNew = `  if (modeKey !== "body" && mappingStageComplete && mappingStage.primary_answer && mappingStage.secondary_answer && !assistantReflectedMap) {`;
if (!ai.includes(warningOld)) throw new Error('energy selection warning block not found');
ai = ai.replace(warningOld, warningNew);

const contextOld = `  const mappingCompleteContext = mappingStageComplete && mappingStage.primary_answer && mappingStage.secondary_answer`;
const contextNew = `  const mappingCompleteContext = modeKey !== "body" && mappingStageComplete && mappingStage.primary_answer && mappingStage.secondary_answer`;
if (!ai.includes(contextOld)) throw new Error('mappingCompleteContext block not found');
ai = ai.replace(contextOld, contextNew);
fs.writeFileSync(aiPath, ai);
