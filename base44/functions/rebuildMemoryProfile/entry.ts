import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const MAX_EPISODIC_FOR_ANALYSIS = 120;
const MAX_SEMANTIC = 12;
const MAX_DYNAMIC = 8;

function normalizeArray(value) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id || !user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const profiles = await base44.asServiceRole.entities.AppUser.filter({ email: user.email }).catch(() => []);
    if (profiles[0]?.memory_enabled === false) {
      return Response.json({ skipped: true, reason: 'memory_disabled' });
    }

    const sessions = await base44.asServiceRole.entities.Session.filter(
      { user_id: user.id, status: 'completed' },
      '-ended_at',
      500,
    );
    const allowedSessions = sessions.filter((s) => s.memory_excluded !== true);
    const allowedIds = new Set(allowedSessions.map((s) => String(s.id)));

    const allMemory = await base44.asServiceRole.entities.UserMemory.filter({ user_id: user.id }, '-updated_at', 1000);
    const episodic = allMemory
      .filter((m) => (m.memory_level || 'episodic') === 'episodic')
      .filter((m) => m.is_active !== false && m.excluded_from_ai !== true && m.user_status !== 'rejected')
      .filter((m) => !m.source_session_id || allowedIds.has(String(m.source_session_id)))
      .slice(0, MAX_EPISODIC_FOR_ANALYSIS);

    if (episodic.length < 2 || allowedSessions.length < 2) {
      return Response.json({ rebuilt: false, reason: 'not_enough_longitudinal_data', episodic: episodic.length });
    }

    const protectedUserMemories = allMemory.filter(
      (m) => ['semantic', 'dynamic'].includes(m.memory_level) && ['confirmed', 'corrected'].includes(m.user_status),
    );

    const evidenceLines = episodic.map((m) => {
      return `[${m.source_session_id || 'unknown'}] ${m.memory_type || m.memory_key}: ${m.memory_value}`;
    }).join('\n');

    const protectedLines = protectedUserMemories.length
      ? protectedUserMemories.map((m) => `- ${m.memory_value}`).join('\n')
      : '(none)';

    let result;
    try {
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Build a cautious longitudinal process-memory profile from the evidence below.

This is NOT diagnosis and NOT a fixed personality description. Every semantic item must be a provisional, revisable hypothesis supported by at least 2 distinct session IDs. Dynamic items describe change over time, not traits.

Rules:
- Never invent evidence.
- Use the same natural language as the evidence (Russian or Spanish).
- Return at most ${MAX_SEMANTIC} semantic hypotheses and ${MAX_DYNAMIC} dynamic observations.
- confidence is 0..1 and must reflect evidence strength.
- semantic kinds may include theme, pattern, edge, primary_process, secondary_process, body_signal, resource.
- dynamic trend must be one of: new, stable, strengthening, weakening, changed, resolved.
- evidence_session_ids may ONLY contain IDs shown in square brackets in the evidence.
- User-confirmed/corrected memories below are authoritative anchors and must not be contradicted without strong newer evidence.

USER-CONFIRMED/CORRECTED ANCHORS:
${protectedLines}

EPISODIC EVIDENCE:
${evidenceLines}`,
        response_json_schema: {
          type: 'object',
          properties: {
            semantic: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  kind: { type: 'string' },
                  key: { type: 'string' },
                  value: { type: 'string' },
                  evidence_session_ids: { type: 'array', items: { type: 'string' } },
                  confidence: { type: 'number' },
                  importance: { type: 'string' },
                },
              },
            },
            dynamic: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  kind: { type: 'string' },
                  key: { type: 'string' },
                  value: { type: 'string' },
                  evidence_session_ids: { type: 'array', items: { type: 'string' } },
                  confidence: { type: 'number' },
                  trend: { type: 'string' },
                },
              },
            },
          },
        },
      });
    } catch (e) {
      console.error('[rebuildMemoryProfile] LLM failed:', e?.message);
      return Response.json({ error: 'profile_generation_failed' }, { status: 500 });
    }

    const now = new Date().toISOString();

    // Retire only auto-generated longitudinal memories. User-confirmed/corrected
    // rows remain untouched and continue to serve as authoritative anchors.
    for (const row of allMemory) {
      if (!['semantic', 'dynamic'].includes(row.memory_level)) continue;
      if (['confirmed', 'corrected'].includes(row.user_status)) continue;
      if (row.is_active !== false) {
        await base44.asServiceRole.entities.UserMemory.update(row.id, { is_active: false, updated_at: now }).catch(() => {});
      }
    }

    const validEvidence = (ids) => [...new Set(normalizeArray(ids).filter((id) => allowedIds.has(id)))];
    let semanticSaved = 0;
    let dynamicSaved = 0;

    for (const item of (result?.semantic || []).slice(0, MAX_SEMANTIC)) {
      const evidence = validEvidence(item.evidence_session_ids);
      if (!item?.value || evidence.length < 2) continue;
      await base44.asServiceRole.entities.UserMemory.create({
        user_id: user.id,
        memory_level: 'semantic',
        memory_type: item.kind || 'pattern',
        memory_key: item.key || item.kind || 'pattern',
        memory_value: String(item.value),
        evidence_session_ids: evidence,
        evidence_count: evidence.length,
        confidence: Math.max(0, Math.min(1, Number(item.confidence ?? 0.5))),
        importance: ['low', 'medium', 'high'].includes(item.importance) ? item.importance : 'medium',
        first_seen_at: now,
        last_seen_at: now,
        user_status: 'unreviewed',
        excluded_from_ai: false,
        is_active: true,
        created_at: now,
        updated_at: now,
      });
      semanticSaved++;
    }

    for (const item of (result?.dynamic || []).slice(0, MAX_DYNAMIC)) {
      const evidence = validEvidence(item.evidence_session_ids);
      if (!item?.value || evidence.length < 2) continue;
      const trend = ['new', 'stable', 'strengthening', 'weakening', 'changed', 'resolved'].includes(item.trend)
        ? item.trend
        : 'changed';
      await base44.asServiceRole.entities.UserMemory.create({
        user_id: user.id,
        memory_level: 'dynamic',
        memory_type: item.kind || 'change',
        memory_key: item.key || item.kind || 'change',
        memory_value: String(item.value),
        evidence_session_ids: evidence,
        evidence_count: evidence.length,
        confidence: Math.max(0, Math.min(1, Number(item.confidence ?? 0.5))),
        trend,
        importance: 'medium',
        first_seen_at: now,
        last_seen_at: now,
        user_status: 'unreviewed',
        excluded_from_ai: false,
        is_active: true,
        created_at: now,
        updated_at: now,
      });
      dynamicSaved++;
    }

    return Response.json({ rebuilt: true, semantic_saved: semanticSaved, dynamic_saved: dynamicSaved });
  } catch (error) {
    console.error('[rebuildMemoryProfile] fatal:', error?.message, String(error));
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});
