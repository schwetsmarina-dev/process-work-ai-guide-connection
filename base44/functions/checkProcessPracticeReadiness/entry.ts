import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Cheap, non-generative readiness check for the Personal Process Practice UX.
// This endpoint NEVER creates a practice and NEVER calls the LLM. It mirrors
// the generator's readiness scoring so the dashboard can offer a practice only
// when enough recurring process material has accumulated.

const READY_THRESHOLD = 70;
const EDGE_PATTERN = /край|edge|сопротивл|блок|стопор|не могу|избега|внутренн(?:ий|яя|ее)?\s+(?:критик|голос|част)|критик|запрещ|не позволяет|мешает|resisten|no puedo|bloque|evita|cr[ií]tic[oa]\s+interior|voz\s+interior|no me permite/i;

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function scoreFromMap(nodes, edges, sessionsCount) {
  if (!nodes.length) return 0;
  const candidates = nodes.filter((node) => node.type === 'theme' || node.type === 'signal');
  const dominant = [...candidates].sort((a, b) => Number(b.count || 0) - Number(a.count || 0))[0];
  if (!dominant) return 0;

  const recurrence = Math.min(50, Math.max(0, (Number(dominant.count || 0) - 1) * 25));
  const hasEdgeSignal = nodes.some((node) => EDGE_PATTERN.test(String(node.label || '')));
  const edgeBonus = hasEdgeSignal ? 20 : 0;
  const sessionsBonus = sessionsCount >= 3 ? 20 : sessionsCount === 2 ? 10 : 0;
  const strongEdges = edges.filter((edge) => Number(edge.weight || 0) >= 2).length;
  const cohesionBonus = Math.min(10, strongEdges * 5);
  return Math.min(100, recurrence + edgeBonus + sessionsBonus + cohesionBonus);
}

function dominantLabel(nodes) {
  const candidates = nodes.filter((node) => node.type === 'theme' || node.type === 'signal');
  const dominant = [...candidates].sort((a, b) => Number(b.count || 0) - Number(a.count || 0))[0];
  return normalizeText(dominant?.label);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const requestedUserId = normalizeText(body.user_id);
    if (requestedUserId && requestedUserId !== caller.id && caller.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const userId = caller.role === 'admin' && requestedUserId ? requestedUserId : caller.id;

    const sessions = await base44.asServiceRole.entities.Session.filter(
      { user_id: userId, status: 'completed' },
      '-created_date',
      10,
    );

    // No point building the map before there is enough longitudinal material.
    if (sessions.length < 2) {
      return Response.json({
        ready: false,
        confidence_score: 0,
        threshold: READY_THRESHOLD,
        completed_sessions: sessions.length,
        latest_session_id: sessions[0]?.id || null,
        theme_label: '',
      });
    }

    let nodes = [];
    let edges = [];
    try {
      const mapRes = await base44.functions.invoke('buildLifeProcessMap', { user_id: userId });
      nodes = Array.isArray(mapRes?.data?.nodes) ? mapRes.data.nodes : [];
      edges = Array.isArray(mapRes?.data?.edges) ? mapRes.data.edges : [];
    } catch (e) {
      console.warn('[checkProcessPracticeReadiness] buildLifeProcessMap failed:', e?.message);
    }

    const confidenceScore = scoreFromMap(nodes, edges, sessions.length);
    return Response.json({
      ready: confidenceScore >= READY_THRESHOLD,
      confidence_score: confidenceScore,
      threshold: READY_THRESHOLD,
      completed_sessions: sessions.length,
      latest_session_id: sessions[0]?.id || null,
      theme_label: dominantLabel(nodes),
    });
  } catch (error) {
    console.error('[checkProcessPracticeReadiness] fatal:', error?.message, String(error));
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
});
