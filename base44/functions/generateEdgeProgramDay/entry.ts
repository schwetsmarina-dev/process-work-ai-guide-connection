import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { RETURN_TO_SELF_DAYS, RETURN_TO_SELF_ENGINE_RULES } from '../../../src/lib/returnToSelfProgram.js';

type GenerationMode = 'standard' | 'soft_version' | 'resource_day' | 'rest_day' | 'repeat_previous';

const ALLOWED_MODES = new Set<GenerationMode>(['standard', 'soft_version', 'resource_day', 'rest_day', 'repeat_previous']);
const JARGON_PATTERN = /\b(edge|edge figure|primary process|secondary process|channel|amplification)\b|\b(край|краевая фигура|первичный процесс|вторичный процесс|канал|амплификац)/i;

function clean(value: unknown, max = 1600) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}
function arr(value: unknown): any[] { return Array.isArray(value) ? value : []; }
function languageRule(lang: string) {
  if (lang === 'es') return 'Escribe TODO el contenido visible para la persona en español natural.';
  if (lang === 'en') return 'Write ALL user-visible content in natural English.';
  return 'Пиши ВЕСЬ видимый пользователю текст естественно по-русски.';
}
function weekFor(day: number) { return Math.ceil(day / 7); }
function daySpec(day: number) { return RETURN_TO_SELF_DAYS.find((x: any) => Number(x.day) === day) || null; }

function compactDay(row: any) {
  return {
    day: row.day_number,
    title: clean(row.title, 200),
    reflection: clean(row.reflection, 1400),
    signal: clean(row.signal, 500),
    stopping_signal: clean(row.stopping_signal, 500),
    stopping_message: clean(row.stopping_message, 500),
    familiar_way: clean(row.familiar_way, 500),
    emerging_signal: clean(row.emerging_signal, 500),
    emerging_quality: clean(row.emerging_quality, 500),
    resource: clean(row.resource, 500),
    support_figure: clean(row.support_figure, 500),
    preferred_support: clean(row.preferred_support, 500),
    user_correction: clean(row.user_correction, 900),
    next_day_adjustment: clean(row.next_day_adjustment, 700),
    selected_story_elements: arr(row.selected_story_elements).map((x) => clean(x, 240)).filter(Boolean).slice(0, 12),
    distress_before: row.distress_before,
    distress_after: row.distress_after,
    felt_dissociated: row.felt_dissociated === true,
    felt_overwhelmed: row.felt_overwhelmed === true,
    safety_action: clean(row.safety_action, 80),
  };
}

function resourceCatalog(program: any, previousDays: any[]) {
  const fromProgram = arr(program.resource_library).map((x) => typeof x === 'string' ? x : x?.label || x?.text || x?.name).map((x) => clean(x, 300)).filter(Boolean);
  const fromDays = previousDays.flatMap((x) => [x.resource, x.support_figure, x.preferred_support]).map((x) => clean(x, 300)).filter(Boolean);
  return [...new Set([...fromProgram, ...fromDays])].slice(0, 30);
}

function recentRiskBlocks(risks: any[]) {
  return risks.some((r) => ['high', 'critical'].includes(String(r.severity)) && r.status !== 'resolved');
}

function validateGenerated(result: any, mode: GenerationMode) {
  if (!result || typeof result !== 'object') return { ok: false, reason: 'empty_result' };
  const title = clean(result.title, 180);
  const intro = clean(result.intro, 900);
  const steps = arr(result.steps).map((s) => ({ title: clean(s?.title, 160), text: clean(s?.text, 1600) })).filter((s) => s.text);
  const journal = arr(result.journal_questions).map((x) => clean(x, 500)).filter(Boolean).slice(0, 6);
  const closing = clean(result.closing, 900);
  const supportOptions = arr(result.support_options).map((x) => clean(x, 400)).filter(Boolean).slice(0, 6);
  const confirmation = clean(result.confirmation_prompt, 500);
  if (!title || !intro || steps.length < (mode === 'rest_day' ? 1 : 2) || !closing) return { ok: false, reason: 'missing_required_content' };
  const visible = [title, intro, closing, confirmation, ...steps.flatMap((s) => [s.title, s.text]), ...journal, ...supportOptions].join(' ');
  if (JARGON_PATTERN.test(visible)) return { ok: false, reason: 'user_facing_jargon_detected' };
  return { ok: true, value: { title, intro, steps, journal_questions: journal, closing, support_options: supportOptions, confirmation_prompt: confirmation } };
}

function deterministicRest(lang: string) {
  if (lang === 'es') return {
    title: 'Día de descanso', intro: 'Hoy no tienes que explorar nada ni ponerte al día. Tu lugar en el programa queda guardado.',
    steps: [{ title: 'Solo por hoy', text: 'Si quieres, pregúntate únicamente qué haría este día un poco más amable o fácil para ti. También puedes no hacer nada.' }],
    journal_questions: [], closing: 'Descansar también forma parte del proceso. Volverás cuando tú decidas.', support_options: [], confirmation_prompt: ''
  };
  if (lang === 'en') return {
    title: 'Rest day', intro: 'You do not need to explore anything or catch up today. Your place in the program is saved.',
    steps: [{ title: 'Just for today', text: 'If you want, ask only what could make today a little gentler or easier. Doing nothing is also allowed.' }],
    journal_questions: [], closing: 'Rest is part of the process too. You can return when you choose.', support_options: [], confirmation_prompt: ''
  };
  return {
    title: 'День отдыха', intro: 'Сегодня ничего не нужно исследовать и ничего не нужно догонять. Твоё место в программе сохранено.',
    steps: [{ title: 'Только на сегодня', text: 'Если хочется, можно спросить себя только об одном: что сделает сегодняшний день чуть мягче или легче? Можно также ничего не делать.' }],
    journal_questions: [], closing: 'Отдых тоже часть процесса. Ты вернёшься тогда, когда сама решишь.', support_options: [], confirmation_prompt: ''
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const entitlementRes = await base44.functions.invoke('getEntitlement', {});
    const entitlement = entitlementRes?.data || entitlementRes;
    if (!entitlement?.hasAccess) return Response.json({ error: 'feature_requires_full_access' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const programId = clean(body.program_id, 160);
    const mode = (clean(body.mode, 40) || 'standard') as GenerationMode;
    if (!programId) return Response.json({ error: 'program_id_required' }, { status: 400 });
    if (!ALLOWED_MODES.has(mode)) return Response.json({ error: 'invalid_generation_mode' }, { status: 400 });

    const program = await base44.asServiceRole.entities.EdgeProgram.get(programId).catch(() => null);
    if (!program || String(program.user_id) !== String(caller.id)) return Response.json({ error: 'Program not found' }, { status: 404 });
    if (['completed', 'stopped'].includes(program.status)) return Response.json({ error: 'program_not_active' }, { status: 409 });
    if (program.safety_state === 'stop') return Response.json({ error: 'program_safety_stop' }, { status: 409 });

    const risks = await base44.asServiceRole.entities.RiskEvent.filter({ user_id: caller.id }, '-detected_at', 20).catch(() => []);
    if (recentRiskBlocks(risks)) return Response.json({ error: 'unresolved_high_risk', action: 'stop_and_seek_support' }, { status: 409 });

    let lang = 'ru';
    try {
      const appUsers = caller.email ? await base44.asServiceRole.entities.AppUser.filter({ email: caller.email }) : [];
      if (['ru', 'es', 'en'].includes(appUsers[0]?.language)) lang = appUsers[0].language;
    } catch {}

    const allDays = await base44.asServiceRole.entities.EdgeProgramDay.filter({ user_id: caller.id, program_id: program.id }, 'day_number', 100).catch(() => []);
    const completedDays = allDays.filter((x: any) => x.completed === true).sort((a: any,b: any) => a.day_number - b.day_number);
    const previousDays = completedDays.map(compactDay);
    const currentDay = Math.min(28, Math.max(1, Number(program.current_day || 1)));
    const requestedDay = mode === 'repeat_previous' ? Math.max(1, currentDay - 1) : currentDay;
    const spec = daySpec(requestedDay);
    if (!spec) return Response.json({ error: 'methodology_day_not_found' }, { status: 500 });

    if (mode === 'rest_day') {
      const content = deterministicRest(lang);
      return Response.json({ ok: true, mode, day_number: currentDay, advances_program: false, content });
    }

    const resources = resourceCatalog(program, previousDays);
    const sourcePractice = program.source_practice_id
      ? await base44.asServiceRole.entities.ProcessPractice.get(program.source_practice_id).catch(() => null)
      : null;
    const sourceSessions = arr(program.source_session_ids).slice(0, 20);
    const sessions = sourceSessions.length
      ? (await Promise.all(sourceSessions.map((id) => base44.asServiceRole.entities.Session.get(id).catch(() => null)))).filter(Boolean)
      : [];

    const recentDaysBlock = previousDays.slice(-10).map((x) => JSON.stringify(x)).join('\n') || '(пока нет завершённых дней)';
    const corrections = previousDays.filter((x) => x.user_correction).map((x) => `Day ${x.day}: ${x.user_correction}`).join('\n') || '—';
    const usedPracticeTitles = allDays.map((x: any) => clean(x.title, 180)).filter(Boolean).join(' | ') || '—';
    const sessionBlock = sessions.map((s: any) => ({
      mode: s.mode_id || s.mode, summary: clean(s.summary, 650), themes: arr(s.themes).slice(0,8), signals: arr(s.signals).slice(0,8),
      edge_signals: arr(s.edge_signals).slice(0,8), primary_process: arr(s.primary_process).slice(0,8), secondary_process: arr(s.secondary_process).slice(0,8)
    }));

    const resourceModeRule = mode === 'resource_day'
      ? `RESOURCE-ONLY MODE. Do not reopen difficult material, prohibiting figures, early memories, conflict or exposure. Build a low-demand replenishing practice only from confirmed resources where possible. If confirmed resources are sparse, offer 3 gentle choices from the starter resource library and let the user choose. No required journaling.`
      : mode === 'soft_version'
        ? `SOFT VERSION. Preserve today's methodological purpose but reduce intensity, number of steps and depth. No forced movement, role-taking, amplification, early-memory work or confrontation. Offer easy exits and resource returns throughout.`
        : mode === 'repeat_previous'
          ? `REPEAT MODE. Revisit day ${requestedDay} without copying the prior text verbatim. Use the user's corrections and what helped/overwhelmed them last time. Repetition must feel familiar and safer, not more advanced.`
          : `STANDARD MODE. Follow the approved day methodology while adapting it to the user's confirmed material.`;

    const prompt = `You generate ONE day of Talvira's 28-day program “Возвращение к себе / Return to Self”.

${languageRule(lang)}

INTERNAL METHODOLOGY FOR DAY ${requestedDay} — ${spec.title}
Purpose: ${spec.purpose}
Approved steps:\n- ${spec.steps.join('\n- ')}
Approved journal prompts:\n- ${spec.journal.join('\n- ')}
Flags: support=${Boolean(spec.support)} celebration=${Boolean(spec.celebration)} adaptive=${Boolean(spec.adaptive)} risk=${spec.risk || 'low'}

GENERATION MODE: ${mode}
${resourceModeRule}

GLOBAL RULES (mandatory):
${[...RETURN_TO_SELF_ENGINE_RULES.language, ...RETURN_TO_SELF_ENGINE_RULES.safety, ...RETURN_TO_SELF_ENGINE_RULES.support, ...RETURN_TO_SELF_ENGINE_RULES.weekly].map((x) => `- ${x}`).join('\n')}

RESOURCE STARTER LIBRARY (only choices, never prescriptions):
${RETURN_TO_SELF_ENGINE_RULES.resourceProtocol.starterExercises.map((x) => `- ${x}`).join('\n')}

USER/PROGRAM CONTEXT:
Theme label from source practice: ${clean(program.theme_label, 300) || '—'}
Source practice offer/context: ${clean(sourcePractice?.offer_text || program.personalization_context, 1000) || '—'}
Confirmed resource catalog: ${resources.join(' | ') || '—'}
Previous user corrections (AUTHORITATIVE):\n${corrections}
Recent completed program days:\n${recentDaysBlock}
Source sessions (background only; never expose Process Work jargon):\n${JSON.stringify(sessionBlock)}
Already generated day titles/practices: ${usedPracticeTitles}

STRICT CONTENT RULES:
1. Do not use Process Work technical terms in anything user-visible. Never say edge, edge figure, primary/secondary process, channel, amplification, or Russian/Spanish equivalents.
2. Use the person's own confirmed words whenever possible. A user correction overrides all prior AI interpretation.
3. Do not invent childhood causes, trauma, diagnoses, hidden emotions, motives or relationships.
4. Avoid repeating an exercise already used unless today's approved methodology explicitly calls for it, the user chose repeat mode, or repetition is needed as support. If repeating, acknowledge continuity and adapt it.
5. Support must be available throughout. Never make progression sound mandatory. The person may switch to soft/resource/rest/pause at any time.
6. Match verbs to experience: feelings are felt, thoughts are considered/thought, images are seen/explored, body sensations are sensed, movements are physically performed if possible.
7. If today's method includes a hypothesis or synthesis, explicitly ask the user whether it fits and invite correction.
8. If physical movement is invited, say “if physically possible” and allow remaining seated or choosing another form.
9. Do not promise calm, healing, cure, trauma resolution, symptom reduction or safety.
10. For day 24, keep the emerging quality available and agentic in the story; difficulty may exist but must not erase it. If an old prohibition returns, notice it briefly and redirect rather than building a battle.
11. Return JSON only.

Return structure:
- title: natural user-facing title
- intro: 1–3 short paragraphs introducing today without jargon
- steps: 2–7 sequential objects {title,text}; text should be concrete enough to follow, not abstract AI filler
- journal_questions: 0–5 questions; no mandatory journaling in resource mode
- closing: reorientation/return and explicit permission to stop or take a resource/rest day
- support_options: 0–5 concrete support options relevant to this user/day
- confirmation_prompt: optional question asking user to confirm/correct an AI observation
- extraction: structured candidate fields to save after the user completes the day: expected keys are signal, stopping_signal, stopping_message, familiar_way, emerging_signal, emerging_quality, resource, support_figure, preferred_support, next_day_adjustment. Put empty strings for unknown values; these are CANDIDATES only and must later be confirmed from user responses.`;

    const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object', required: ['title','intro','steps','journal_questions','closing','support_options','extraction'],
        properties: {
          title: { type: 'string' }, intro: { type: 'string' },
          steps: { type: 'array', minItems: 1, maxItems: 7, items: { type: 'object', required: ['text'], properties: { title: {type:'string'}, text:{type:'string'} } } },
          journal_questions: { type: 'array', maxItems: 5, items: { type: 'string' } },
          closing: { type: 'string' }, support_options: { type: 'array', maxItems: 5, items: { type: 'string' } },
          confirmation_prompt: { type: 'string' },
          extraction: { type: 'object', properties: {
            signal:{type:'string'}, stopping_signal:{type:'string'}, stopping_message:{type:'string'}, familiar_way:{type:'string'}, emerging_signal:{type:'string'}, emerging_quality:{type:'string'}, resource:{type:'string'}, support_figure:{type:'string'}, preferred_support:{type:'string'}, next_day_adjustment:{type:'string'}
          }}
        }
      }
    });

    const validated = validateGenerated(llm, mode);
    if (!validated.ok) return Response.json({ error: 'generated_day_failed_validation', reason: validated.reason }, { status: 502 });

    const extraction = llm.extraction || {};
    const content = validated.value;
    const fullPractice = [content.intro, ...content.steps.map((s) => `${s.title ? `${s.title}\n` : ''}${s.text}`), content.closing].join('\n\n').trim();

    const existingGenerated = allDays.find((x: any) => Number(x.day_number) === requestedDay && x.completed !== true);
    let record = existingGenerated || null;
    if (mode === 'standard' || mode === 'soft_version' || mode === 'repeat_previous') {
      const payload: any = {
        user_id: caller.id, program_id: program.id, day_number: requestedDay, week_number: weekFor(requestedDay),
        title: content.title, practice_text: fullPractice, journal_questions: content.journal_questions,
        completed: false, safety_action: mode === 'soft_version' ? 'soft_version' : mode === 'repeat_previous' ? 'repeat_previous' : 'none',
        signal: clean(extraction.signal, 500), stopping_signal: clean(extraction.stopping_signal, 500), stopping_message: clean(extraction.stopping_message, 500),
        familiar_way: clean(extraction.familiar_way, 500), emerging_signal: clean(extraction.emerging_signal, 500), emerging_quality: clean(extraction.emerging_quality, 500),
        resource: clean(extraction.resource, 500), support_figure: clean(extraction.support_figure, 500), preferred_support: clean(extraction.preferred_support, 500), next_day_adjustment: clean(extraction.next_day_adjustment, 700),
      };
      if (record?.id) record = await base44.asServiceRole.entities.EdgeProgramDay.update(record.id, payload);
      else record = await base44.asServiceRole.entities.EdgeProgramDay.create(payload);
    }

    return Response.json({
      ok: true, mode, day_number: requestedDay, week_number: weekFor(requestedDay), advances_program: false,
      methodology_key: spec.key, content, extraction_candidates: extraction, day_record: record,
      note: 'Generation does not advance the program. Progress advances only after an explicit completion action in a separate endpoint.'
    });
  } catch (error) {
    console.error('[generateEdgeProgramDay] fatal:', error?.message, String(error));
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
});
