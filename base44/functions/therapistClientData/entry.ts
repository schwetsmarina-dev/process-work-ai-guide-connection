import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const therapist = await base44.auth.me();
    if (!therapist) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (therapist.role !== 'therapist' && therapist.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const payload = await req.json().catch(() => ({}));
    const clientEmail = String(payload?.clientEmail || '').trim().toLowerCase();
    if (!clientEmail) return Response.json({ error: 'clientEmail is required' }, { status: 400 });

    const links = await base44.asServiceRole.entities.ClientLink.filter({ therapist_email: therapist.email, client_email: clientEmail });
    const link = links[0];
    if (!link || link.consent_to_share !== true) return Response.json({ error: 'No consent to share', consent: false }, { status: 403 });

    const legacy = link.share_scope || 'summaries';
    const permissions = {
      summaries: link.share_session_summaries ?? (legacy === 'summaries' || legacy === 'both'),
      insights: link.share_insights ?? (legacy === 'insights' || legacy === 'both'),
      memory_profile: link.share_memory_profile === true,
      process_map: link.share_process_map === true,
      risk_flags: link.share_risk_flags === true,
    };

    // Session/UserMemory ownership uses the platform User.id, not AppUser.id.
    const users = await base44.asServiceRole.entities.User.filter({ email: clientEmail }).catch(() => []);
    const client = users[0];
    if (!client?.id) return Response.json({ error: 'Client not found' }, { status: 404 });

    let summaries: unknown[] = [];
    let insights: unknown[] = [];
    let memory_profile: unknown[] = [];
    let risk_flags: unknown[] = [];

    if (permissions.summaries) {
      const sessions = await base44.asServiceRole.entities.Session.filter({ user_id: client.id }, '-created_date', 100);
      summaries = sessions.filter((s) => s.summary).map((s) => ({ id: s.id, mode_id: s.mode_id || s.mode, status: s.status, created_date: s.created_date, summary: s.summary }));
    }

    if (permissions.insights) {
      // Insight ownership has historically used either user_id or created_by; support both and dedupe.
      const [byUser, byEmail] = await Promise.all([
        base44.asServiceRole.entities.Insight.filter({ user_id: client.id }, '-created_date', 100).catch(() => []),
        base44.asServiceRole.entities.Insight.filter({ created_by: clientEmail }, '-created_date', 100).catch(() => []),
      ]);
      const deduped = [...new Map([...byUser, ...byEmail].map((i) => [i.id, i])).values()];
      insights = deduped.filter((i) => !i.is_archived).map((i) => ({ id: i.id, title: i.title, insight_text: i.insight_text, source_mode: i.source_mode, created_date: i.created_date }));
    }

    if (permissions.memory_profile) {
      const rows = await base44.asServiceRole.entities.UserMemory.filter({ user_id: client.id, is_active: true }, '-updated_at', 100);
      memory_profile = rows
        .filter((m) => ['semantic', 'dynamic'].includes(m.memory_level))
        .filter((m) => m.excluded_from_ai !== true && m.user_status !== 'rejected')
        .map((m) => ({ id: m.id, level: m.memory_level, type: m.memory_type, value: m.memory_value, evidence_count: m.evidence_count, confidence: m.confidence, trend: m.trend, user_status: m.user_status, updated_at: m.updated_at }));
    }

    if (permissions.risk_flags) {
      const rows = await base44.asServiceRole.entities.RiskEvent.filter({ user_id: client.id }, '-detected_at', 100);
      risk_flags = rows.map((r) => ({ id: r.id, risk_type: r.risk_type, severity: r.severity, detected_at: r.detected_at, status: r.status, action_taken: r.action_taken }));
    }

    return Response.json({ consent: true, permissions, summaries, insights, memory_profile, risk_flags });
  } catch (error) {
    console.error('[therapistClientData] fatal:', error?.message, String(error));
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});
