import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const MIN_COMPLETED_SESSIONS = 5;

function normalize(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const entitlementRes = await base44.functions.invoke('getEntitlement', {});
    const entitlement = entitlementRes?.data || entitlementRes;
    if (!entitlement?.hasAccess) {
      return Response.json({ eligible_to_screen: false, reason: 'feature_requires_full_access' }, { status: 403 });
    }

    const sessions = await base44.asServiceRole.entities.Session.filter(
      { user_id: caller.id, status: 'completed' },
      '-created_date',
      30,
    );

    const practices = await base44.asServiceRole.entities.ProcessPractice.filter(
      { user_id: caller.id, is_test: false },
      '-generated_at',
      20,
    );

    const activePrograms = await base44.asServiceRole.entities.EdgeProgram.filter(
      { user_id: caller.id },
      '-started_at',
      10,
    ).catch(() => []);
    const activeProgram = activePrograms.find((p: any) => ['screening', 'active', 'paused'].includes(p.status));

    const recentRisk = await base44.asServiceRole.entities.RiskEvent.filter(
      { user_id: caller.id },
      '-detected_at',
      20,
    ).catch(() => []);
    const blockingRisk = recentRisk.find((r: any) => ['high', 'critical'].includes(r.severity) && r.status !== 'resolved');

    if (activeProgram) {
      const canRescreenCaution = activeProgram.status === 'paused' && activeProgram.safety_state === 'caution';
      return Response.json({
        eligible_to_screen: canRescreenCaution,
        reason: canRescreenCaution ? 'rescreen_caution' : 'program_already_exists',
        program: activeProgram,
        can_rescreen: canRescreenCaution,
      });
    }

    if (blockingRisk) {
      return Response.json({
        eligible_to_screen: false,
        reason: 'recent_unresolved_risk',
        message: 'A monthly self-guided edge program should not be started while a high-severity risk event is unresolved.',
      });
    }

    const latestPractice = practices[0] || null;
    const sourceIds = Array.isArray(latestPractice?.source_session_ids)
      ? latestPractice.source_session_ids.map(normalize).filter(Boolean)
      : [];

    const enoughLongitudinalData = sessions.length >= MIN_COMPLETED_SESSIONS;
    const hasPersonalPractice = Boolean(latestPractice?.id && sourceIds.length >= 2);

    return Response.json({
      eligible_to_screen: enoughLongitudinalData && hasPersonalPractice,
      reason: !enoughLongitudinalData
        ? 'not_enough_completed_sessions'
        : !hasPersonalPractice
          ? 'personal_practice_required'
          : 'ready_for_screening',
      completed_sessions: sessions.length,
      required_sessions: MIN_COMPLETED_SESSIONS,
      source_practice_id: latestPractice?.id || null,
      source_session_ids: sourceIds,
      theme_label: normalize(latestPractice?.theme_label),
      note: 'This endpoint only decides whether the user may be invited to screening. It does not determine clinical safety or suitability.',
    });
  } catch (error) {
    console.error('[checkEdgeProgramReadiness] fatal:', error?.message, String(error));
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
});
