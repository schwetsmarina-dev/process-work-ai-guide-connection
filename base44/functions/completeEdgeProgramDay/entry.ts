import { createClientFromRequest } from 'npm:@base44/sdk@0.8.43';
import {
  clean,
  clampDistress,
  weekFor,
  decideProgression,
  normalizeObservationCandidates,
  normalizeResourceCandidates,
  applyObservationReview,
  mergeResourceLibrary,
} from './completionRules.ts';

type Phase = 'analyze' | 'finalize';

function arr(value: unknown): any[] { return Array.isArray(value) ? value : []; }
function now() { return new Date().toISOString(); }
function recentRiskBlocks(risks: any[]) {
  return risks.some((r) => ['high', 'critical'].includes(String(r?.severity)) && r?.status !== 'resolved');
}
function languageRule(lang: string) {
  if (lang === 'es') return 'Escribe los textos visibles para la persona en español natural.';
  if (lang === 'en') return 'Write user-visible text in natural English.';
  return 'Пиши видимый пользователю текст естественно по-русски.';
}
function boundedHistory(existing: any[], additions: any[], max = 120) {
  return [...arr(existing), ...arr(additions)].slice(-max);
}
function safeSnapshot(row: any, fields: string[]) {
  const out: any = {};
  for (const field of fields) out[field] = row?.[field] ?? null;
  return out;
}

const DAY_ROLLBACK_FIELDS = [
  'reflection','distress_after','felt_dissociated','felt_overwhelmed','completed','completed_at','safety_action',
  'theme','experience_type','signal','stopping_signal','stopping_message','familiar_way','emerging_signal','emerging_quality',
  'resource','support_figure','preferred_support','user_correction','next_day_adjustment','ai_observations','observation_review',
  'resource_updates','resource_review','progression_decision','progression_reason','next_day_number','completion_phase','completion_version','reflection_summary'
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const entitlementRes = await base44.functions.invoke('getEntitlement', {}).catch(() => null);
    const entitlement = entitlementRes?.data || entitlementRes;
    if (!entitlement?.hasAccess && caller.role !== 'admin') {
      return Response.json({ error: 'feature_requires_full_access' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const phase = clean(body.phase, 30) as Phase;
    const programId = clean(body.program_id, 160);
    const dayId = clean(body.day_id, 160);
    if (!['analyze', 'finalize'].includes(phase)) return Response.json({ error: 'invalid_phase' }, { status: 400 });
    if (!programId || !dayId) return Response.json({ error: 'program_id_and_day_id_required' }, { status: 400 });

    const program = await base44.asServiceRole.entities.EdgeProgram.get(programId).catch(() => null);
    const day = await base44.asServiceRole.entities.EdgeProgramDay.get(dayId).catch(() => null);
    if (!program || String(program.user_id) !== String(caller.id)) return Response.json({ error: 'Program not found' }, { status: 404 });
    if (!day || String(day.user_id) !== String(caller.id) || String(day.program_id) !== String(program.id)) {
      return Response.json({ error: 'Day not found' }, { status: 404 });
    }
    if (String(program.status) === 'stopped') return Response.json({ error: 'program_stopped' }, { status: 409 });

    // Idempotency: a finalized day can be safely submitted again without mutating anything.
    if (day.completed === true || day.completion_phase === 'finalized') {
      return Response.json({
        ok: true,
        already_finalized: true,
        phase: 'finalized',
        day_number: day.day_number,
        progression_decision: day.progression_decision || program.last_progression_decision || null,
        next_day_number: day.next_day_number || program.current_day || day.day_number,
        program_status: program.status,
      });
    }

    const recordDay = Math.max(1, Math.min(28, Number(day.day_number || 1)));
    const programDay = Math.max(1, Math.min(28, Number(program.current_day || 1)));
    const isRepeatPractice = day.generation_mode === 'repeat_previous' && recordDay === Math.max(1, programDay - 1);
    if (!isRepeatPractice && recordDay !== programDay) {
      return Response.json({ error: 'stale_or_wrong_day', expected_day: programDay, received_day: recordDay }, { status: 409 });
    }

    const risks = await base44.asServiceRole.entities.RiskEvent.filter({ user_id: caller.id }, '-detected_at', 20).catch(() => []);
    const unresolvedHighRisk = recentRiskBlocks(risks);

    let lang = 'es';
    try {
      const appUsers = caller.email ? await base44.asServiceRole.entities.AppUser.filter({ email: caller.email }) : [];
      if (['ru', 'es', 'en'].includes(appUsers[0]?.language)) lang = appUsers[0].language;
    } catch {}

    if (phase === 'analyze') {
      if (day.completion_phase === 'awaiting_review') {
        return Response.json({
          ok: true,
          phase: 'awaiting_review',
          reused_existing_analysis: true,
          day_number: recordDay,
          reflection_summary: day.reflection_summary || '',
          observations: arr(day.ai_observations),
          resource_candidates: arr(day.resource_updates),
          safety_preview: decideProgression({
            dayNumber: isRepeatPractice ? programDay : recordDay,
            safetyState: program.safety_state,
            unresolvedHighRisk,
            feltDissociated: day.felt_dissociated === true,
            feltOverwhelmed: day.felt_overwhelmed === true,
            distressBefore: clampDistress(day.distress_before),
            distressAfter: clampDistress(day.distress_after),
          }),
        });
      }

      const reflection = clean(body.reflection, 6000);
      const distressAfter = clampDistress(body.distress_after);
      const feltDissociated = body.felt_dissociated === true;
      const feltOverwhelmed = body.felt_overwhelmed === true;
      if (!reflection && day.generation_mode !== 'rest_day') {
        return Response.json({ error: 'reflection_required' }, { status: 400 });
      }

      // Safety takes precedence over interpretation. We still save the person's own reflection,
      // but in a stop/high-risk state we do not ask the model to mine deeper psychological meaning.
      const safetyPreview = decideProgression({
        dayNumber: isRepeatPractice ? programDay : recordDay,
        safetyState: program.safety_state,
        unresolvedHighRisk,
        feltDissociated,
        feltOverwhelmed,
        distressBefore: clampDistress(day.distress_before),
        distressAfter,
      });

      let summary = '';
      let observations: any[] = [];
      let resourceCandidates: any[] = [];

      if (safetyPreview.decision === 'stop') {
        summary = lang === 'es'
          ? 'La reflexión se ha guardado. Hoy no vamos a profundizar en interpretaciones.'
          : lang === 'en'
            ? 'Your reflection has been saved. We will not deepen interpretation today.'
            : 'Рефлексия сохранена. Сегодня мы не будем углубляться в интерпретации.';
      } else {
        const confirmed = arr(program.confirmed_observations).slice(-40);
        const rejected = arr(program.rejected_observations).slice(-40);
        const prompt = `You analyze a person's reflection after ONE day of Talvira's 28-day self-exploration program.
${languageRule(lang)}

CRITICAL EPISTEMIC RULES:
- Produce hypotheses/candidates only. Nothing you infer becomes true until the person confirms it.
- Use only what is supported by the reflection and already-confirmed program memory.
- Never infer trauma, diagnosis, childhood cause, hidden aggression/emotion, motive, abuse, attachment style, or causal explanation.
- Do not resurrect a previously rejected observation unless the person explicitly states it now in substantially new words.
- Keep observations concrete and close to the person's language.
- No Process Work jargon in user-visible values: do not say edge, edge figure, primary/secondary process, channel, amplification, or Russian/Spanish equivalents.
- A resource candidate is something that the person reports as supportive/pleasant/helpful OR explicitly reports as unhelpful/aversive. Do not assume a technique worked merely because it was offered.

DAY ${recordDay}
Title: ${clean(day.title, 300)}
Practice: ${clean(day.practice_text, 3000)}
Journal questions: ${JSON.stringify(arr(day.journal_questions).slice(0, 6))}
Person's reflection: ${reflection}
Distress before: ${clampDistress(day.distress_before)}
Distress after: ${distressAfter}
Reported overwhelm: ${feltOverwhelmed}
Reported dissociation/disconnection: ${feltDissociated}
Already confirmed observations: ${JSON.stringify(confirmed)}
Previously rejected observations (do not reassert): ${JSON.stringify(rejected)}

Return JSON:
summary: 1-3 short sentences summarizing ONLY what the person explicitly described, without interpretation.
observations: 0-12 objects {field,value,evidence,confidence}. Allowed field values only: theme, experience_type, signal, stopping_signal, stopping_message, familiar_way, emerging_signal, emerging_quality, resource, support_figure, preferred_support, next_day_adjustment.
resources: 0-8 objects {label,kind,proposed_effect,evidence}. proposed_effect one of helpful, neutral, not_helpful, avoid.

The evidence must be a short paraphrase, not a fabricated quote. Return JSON only.`;

        const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt,
          response_json_schema: {
            type: 'object',
            required: ['summary','observations','resources'],
            properties: {
              summary: { type: 'string' },
              observations: { type: 'array', maxItems: 12, items: { type: 'object', properties: {
                field: { type: 'string' }, value: { type: 'string' }, evidence: { type: 'string' }, confidence: { type: 'string' }
              }}},
              resources: { type: 'array', maxItems: 8, items: { type: 'object', properties: {
                label: { type: 'string' }, kind: { type: 'string' }, proposed_effect: { type: 'string' }, evidence: { type: 'string' }
              }}},
            }
          }
        });
        summary = clean(llm?.summary, 1600);
        observations = normalizeObservationCandidates(arr(llm?.observations));
        resourceCandidates = normalizeResourceCandidates(arr(llm?.resources));
      }

      const updated = await base44.asServiceRole.entities.EdgeProgramDay.update(day.id, {
        reflection,
        distress_after: distressAfter,
        felt_dissociated: feltDissociated,
        felt_overwhelmed: feltOverwhelmed,
        reflection_summary: summary,
        ai_observations: observations,
        resource_updates: resourceCandidates,
        completion_phase: 'awaiting_review',
        completion_version: Number(day.completion_version || 0) + 1,
      });

      return Response.json({
        ok: true,
        phase: 'awaiting_review',
        day_number: recordDay,
        reflection_summary: summary,
        observations,
        resource_candidates: resourceCandidates,
        review_required: observations.length > 0 || resourceCandidates.length > 0,
        safety_preview: safetyPreview,
        day_record: updated,
        note: 'No observation has been added to confirmed memory and the program has not advanced.',
      });
    }

    // FINALIZE PHASE
    if (day.completion_phase !== 'awaiting_review') {
      return Response.json({ error: 'analyze_phase_required_first' }, { status: 409 });
    }

    const observationCandidates = normalizeObservationCandidates(arr(day.ai_observations));
    const resourceCandidates = normalizeResourceCandidates(arr(day.resource_updates));
    let reviewedObservations;
    let mergedResources;
    try {
      reviewedObservations = applyObservationReview(observationCandidates, arr(body.observation_review));
      mergedResources = mergeResourceLibrary(
        arr(program.resource_library),
        resourceCandidates,
        arr(body.resource_review),
        recordDay,
        now()
      );
    } catch (reviewError) {
      return Response.json({ error: reviewError?.message || 'review_incomplete' }, { status: 400 });
    }

    const distressAfter = clampDistress(day.distress_after);
    let progression = decideProgression({
      dayNumber: isRepeatPractice ? programDay : recordDay,
      safetyState: program.safety_state,
      unresolvedHighRisk,
      feltDissociated: day.felt_dissociated === true,
      feltOverwhelmed: day.felt_overwhelmed === true,
      distressBefore: clampDistress(day.distress_before),
      distressAfter,
      userChoice: clean(body.progression_choice, 30),
    });

    // Repeating the previous practice is support for the CURRENT program day;
    // it must never skip over that current day.
    if (isRepeatPractice && progression.decision === 'advance') {
      progression = { decision: 'repeat', reason: 'repeat_practice_completed_return_to_current_day', nextDay: programDay };
    }

    const timestamp = now();
    const dayPatch: any = {
      ...reviewedObservations.dayFields,
      observation_review: reviewedObservations.audit,
      resource_review: mergedResources.audit,
      progression_decision: progression.decision,
      progression_reason: progression.reason,
      next_day_number: progression.nextDay,
      completed: true,
      completed_at: timestamp,
      completion_phase: 'finalized',
      completion_version: Number(day.completion_version || 0) + 1,
      safety_action: progression.decision === 'resource' ? 'resource_day'
        : progression.decision === 'pause' ? 'pause'
          : progression.decision === 'repeat' ? 'repeat_previous'
            : progression.decision === 'stop' && progression.reason === 'safety_stop' ? 'stop_and_seek_support'
              : day.safety_action || 'none',
    };

    const confirmedToStore = reviewedObservations.confirmed.map((x: any) => ({
      day_number: recordDay,
      field: x.field,
      value: x.value,
      evidence: x.evidence,
      confirmed_at: timestamp,
      corrected: x.decision === 'correct',
    }));
    const rejectedToStore = reviewedObservations.rejected.map((x: any) => ({
      day_number: recordDay,
      field: x.field,
      value: x.value,
      rejected_at: timestamp,
    }));

    const programPatch: any = {
      resource_library: mergedResources.library,
      confirmed_observations: boundedHistory(program.confirmed_observations, confirmedToStore),
      rejected_observations: boundedHistory(program.rejected_observations, rejectedToStore),
      last_reflection: clean(day.reflection, 5000),
      last_progression_decision: progression.decision,
    };

    if (!isRepeatPractice && progression.decision === 'advance') {
      programPatch.last_completed_day = Math.max(Number(program.last_completed_day || 0), recordDay);
    }

    if (progression.decision === 'advance') {
      if (recordDay >= 28) {
        programPatch.status = 'completed';
        programPatch.current_day = 28;
        programPatch.current_week = 4;
        programPatch.completed_at = timestamp;
        programPatch.paused_at = null;
        programPatch.paused_day = null;
      } else {
        programPatch.status = 'active';
        programPatch.current_day = recordDay + 1;
        programPatch.current_week = weekFor(recordDay + 1);
        programPatch.paused_at = null;
        programPatch.paused_day = null;
      }
    } else if (progression.decision === 'pause') {
      programPatch.status = 'paused';
      programPatch.paused_at = timestamp;
      programPatch.paused_day = programDay;
    } else if (progression.decision === 'stop') {
      programPatch.status = 'stopped';
      programPatch.stop_reason = progression.reason;
      programPatch.paused_at = null;
    } else {
      // repeat/resource: stay on current day; progression is explicitly non-calendar based.
      programPatch.status = 'active';
      programPatch.current_day = programDay;
      programPatch.current_week = weekFor(programDay);
    }

    // Base44 entities do not expose a multi-entity DB transaction in this SDK.
    // We therefore use guarded two-phase finalization plus compensating rollback:
    // day is finalized first; if program update fails, restore the day snapshot.
    const daySnapshot = safeSnapshot(day, DAY_ROLLBACK_FIELDS);
    let finalizedDay: any = null;
    try {
      finalizedDay = await base44.asServiceRole.entities.EdgeProgramDay.update(day.id, dayPatch);
      await base44.asServiceRole.entities.EdgeProgram.update(program.id, programPatch);
    } catch (writeError) {
      if (finalizedDay) {
        await base44.asServiceRole.entities.EdgeProgramDay.update(day.id, daySnapshot).catch((rollbackError: any) => {
          console.error('[completeEdgeProgramDay] compensating rollback FAILED', rollbackError?.message);
        });
      }
      console.error('[completeEdgeProgramDay] finalize write failed', writeError?.message);
      return Response.json({ error: 'finalization_write_failed', retryable: true }, { status: 500 });
    }

    return Response.json({
      ok: true,
      phase: 'finalized',
      day_number: recordDay,
      confirmed_observations: confirmedToStore,
      rejected_observations: rejectedToStore,
      resource_library: mergedResources.library,
      progression_decision: progression.decision,
      progression_reason: progression.reason,
      next_day_number: progression.nextDay,
      program_status: programPatch.status,
      completed_program: programPatch.status === 'completed',
      day_record: finalizedDay,
    });
  } catch (error) {
    console.error('[completeEdgeProgramDay] fatal:', error?.message, String(error));
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
});
