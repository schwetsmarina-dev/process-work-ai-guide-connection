import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function bool(value: unknown) {
  return value === true;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const entitlementRes = await base44.functions.invoke('getEntitlement', {});
    const entitlement = entitlementRes?.data || entitlementRes;
    if (!entitlement?.hasAccess) {
      return Response.json({ error: 'feature_requires_full_access' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const answers = {
      current_crisis: bool(body.current_crisis),
      recent_dissociation: bool(body.recent_dissociation),
      practice_worsens_state: bool(body.practice_worsens_state),
      has_human_support: bool(body.has_human_support),
      understands_can_stop: bool(body.understands_can_stop),
    };

    const practices = await base44.asServiceRole.entities.ProcessPractice.filter(
      { user_id: caller.id, is_test: false },
      '-generated_at',
      20,
    );
    const latestPractice = practices[0] || null;
    if (!latestPractice?.id) {
      return Response.json({ error: 'personal_practice_required' }, { status: 400 });
    }

    const sessions = await base44.asServiceRole.entities.Session.filter(
      { user_id: caller.id, status: 'completed' },
      '-created_date',
      30,
    );
    if (sessions.length < 5) {
      return Response.json({ error: 'not_enough_completed_sessions' }, { status: 400 });
    }

    const risks = await base44.asServiceRole.entities.RiskEvent.filter(
      { user_id: caller.id },
      '-detected_at',
      20,
    ).catch(() => []);
    const blockingRisk = risks.find((r: any) => ['high', 'critical'].includes(r.severity) && r.status !== 'resolved');
    if (blockingRisk) {
      return Response.json({ result: 'stop', reason: 'recent_unresolved_risk' });
    }

    const existingPrograms = await base44.asServiceRole.entities.EdgeProgram.filter(
      { user_id: caller.id },
      '-started_at',
      20,
    ).catch(() => []);
    const existing = existingPrograms.find((p: any) => ['screening', 'active', 'paused'].includes(p.status));
    if (existing?.status === 'active') {
      return Response.json({ result: 'proceed', program: existing, reused: true });
    }
    const resumableCautionProgram = existing?.status === 'paused' && existing?.safety_state === 'caution' ? existing : null;

    let result: 'proceed' | 'caution' | 'stop' = 'proceed';
    let reason = 'screening_clear';
    if (answers.current_crisis || answers.recent_dissociation || answers.practice_worsens_state) {
      result = 'stop';
      reason = answers.current_crisis
        ? 'current_crisis'
        : answers.recent_dissociation
          ? 'recent_dissociation'
          : 'practice_worsens_state';
    } else if (!answers.understands_can_stop) {
      result = 'stop';
      reason = 'must_understand_can_stop';
    } else if (!answers.has_human_support) {
      result = 'caution';
      reason = 'no_human_support';
    }

    const now = new Date().toISOString();
    const sourceSessionIds = Array.isArray(latestPractice.source_session_ids)
      ? latestPractice.source_session_ids.map(String).filter(Boolean)
      : [];

    const programPayload: Record<string, unknown> = {
      user_id: caller.id,
      source_practice_id: latestPractice.id,
      source_session_ids: sourceSessionIds,
      theme_label: String(latestPractice.theme_label || ''),
      program_key: 'safe_return_to_self',
      status: result === 'proceed' ? 'active' : result === 'caution' ? 'paused' : 'stopped',
      current_day: result === 'proceed' ? 1 : 0,
      current_week: result === 'proceed' ? 1 : 0,
      stop_reason: result === 'stop' ? reason : '',
      safety_state: result === 'proceed' ? 'clear' : result === 'caution' ? 'caution' : 'stop',
      screening_answers: answers,
      personalization_context: String(latestPractice.offer_text || '').slice(0, 5000),
    };
    if (result === 'proceed') {
      programPayload.started_at = now;
      programPayload.paused_at = null;
    }
    if (result === 'caution') programPayload.paused_at = now;
    if (result === 'stop') programPayload.paused_at = null;

    const program = resumableCautionProgram
      ? await base44.asServiceRole.entities.EdgeProgram.update(resumableCautionProgram.id, programPayload)
      : await base44.asServiceRole.entities.EdgeProgram.create(programPayload);

    const screening = await base44.asServiceRole.entities.EdgeProgramScreening.create({
      user_id: caller.id,
      program_id: program.id,
      completed_at: now,
      ...answers,
      result,
      notes: reason,
    });

    return Response.json({ result, reason, program, screening });
  } catch (error) {
    console.error('[submitEdgeProgramScreening] fatal:', error?.message, String(error));
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
});