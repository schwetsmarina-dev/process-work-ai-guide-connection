import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ─────────────────────────────────────────────────────────────────────────────
// Anonymized research data export.
//
// - Admin-only.
// - Includes ONLY users with research_consent_given === true (separate from the
//   general consent_given).
// - Replaces every identity key (email / user_id / created_by) with a random
//   per-user hash that cannot be linked back to the person. The mapping is NOT
//   returned, so the export is unlinkable.
// - Strips email and any direct identifiers from Session, Insight, SessionFeedback.
// ─────────────────────────────────────────────────────────────────────────────

function randomHash() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const svc = base44.asServiceRole;

    // 1. Consenting users only.
    const consenting = await svc.entities.AppUser.filter({ research_consent_given: true });
    if (consenting.length === 0) {
      return Response.json({ status: 'no_consenting_users', users: 0, sessions: 0, insights: 0, feedback: 0, data: [] });
    }

    // 2. Build unlinkable identity map keyed by both email and AppUser.id.
    //    Each real user gets ONE random hash used everywhere in the export.
    const emailToHash = new Map();
    const idToHash = new Map();
    for (const u of consenting) {
      const h = randomHash();
      if (u.email) emailToHash.set(u.email, h);
      if (u.id) idToHash.set(u.id, h);
    }

    const consentEmails = new Set(consenting.map((u) => u.email).filter(Boolean));
    const consentIds = new Set(consenting.map((u) => u.id).filter(Boolean));

    const hashFor = (record) => {
      // Sessions/Insights/Feedback link to a person via created_by (email) or user_id.
      if (record.created_by && emailToHash.has(record.created_by)) return emailToHash.get(record.created_by);
      if (record.user_id && idToHash.has(record.user_id)) return idToHash.get(record.user_id);
      if (record.user_email && emailToHash.has(record.user_email)) return emailToHash.get(record.user_email);
      return null;
    };

    const belongsToConsenting = (record) =>
      (record.created_by && consentEmails.has(record.created_by)) ||
      (record.user_id && consentIds.has(record.user_id)) ||
      (record.user_email && consentEmails.has(record.user_email));

    // 3. Pull entities, filter to consenting users, anonymize.
    const [allSessions, allInsights, allFeedback] = await Promise.all([
      svc.entities.Session.list('-created_date', 5000),
      svc.entities.Insight.list('-created_date', 5000),
      svc.entities.SessionFeedback.list('-created_date', 5000),
    ]);

    const sessions = allSessions.filter(belongsToConsenting).map((s) => ({
      anon_user: hashFor(s),
      mode: s.mode_id || s.mode || null,
      status: s.status,
      started_at: s.started_at || s.created_date,
      ended_at: s.ended_at || null,
      summary: s.summary || null,
      themes: s.themes || [],
      signals: s.signals || [],
      next_step_suggestion: s.next_step_suggestion || null,
      risk_flag: !!s.risk_flag,
    }));

    const insights = allInsights.filter(belongsToConsenting).map((i) => ({
      anon_user: hashFor(i),
      source_mode: i.source_mode || null,
      title: i.title || null,
      insight_text: i.insight_text || null,
      state_keywords: i.state_keywords || null,
      process_layer: i.process_layer || null,
      tags: i.tags || null,
      importance: i.importance ?? null,
      created_at: i.created_at || i.created_date,
    }));

    const feedback = allFeedback.filter(belongsToConsenting).map((f) => ({
      anon_user: hashFor(f),
      mode: f.mode_id || null,
      language: f.language || null,
      rating: f.rating ?? null,
      useful: f.useful || null,
      confusing: f.confusing || null,
      would_use_again: f.would_use_again ?? null,
      comment: f.comment || null,
      created_at: f.created_at || f.created_date,
    }));

    return Response.json({
      status: 'success',
      exported_at: new Date().toISOString(),
      users: consenting.length,
      counts: { sessions: sessions.length, insights: insights.length, feedback: feedback.length },
      sessions,
      insights,
      feedback,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});