import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Therapist dashboard data source.
//
// Security model: entity RLS deliberately does NOT grant the "therapist" role
// access to other users' Session / RiskEvent / AppUser records. All therapist
// access flows through THIS function, which:
//   1. verifies the caller's role is "therapist" (or "admin"),
//   2. for a THERAPIST, scopes strictly to THEIR OWN clients — i.e. AppUsers
//      reachable via a ClientLink(therapist_email = caller, consent_to_share
//      = true). For an ADMIN, scopes to all app-wide consented AppUsers
//      (oversight role).
//   3. returns sessions and flagged risk events strictly scoped to those
//      consented clients.
//
// FIX (was a real cross-tenant leak): this used to filter AppUser by the
// app-wide `consent_given` flag (consent to use the AI app at all), which has
// nothing to do with consenting to share data with THIS therapist — every
// therapist in the product saw every consented client of every OTHER
// therapist too. Client-specific sharing consent lives on ClientLink
// (consent_to_share), same model as the Talvira Pro section below it.

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (user.role !== 'therapist' && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 1. Resolve the set of client emails this caller may see.
    let allowedClientEmails;
    if (user.role === 'admin') {
      const consentedUsers = await base44.asServiceRole.entities.AppUser.filter({
        consent_given: true,
      });
      allowedClientEmails = new Set(consentedUsers.map((c) => c.email).filter(Boolean));
    } else {
      const links = await base44.asServiceRole.entities.ClientLink.filter({
        therapist_email: user.email,
        consent_to_share: true,
      });
      allowedClientEmails = new Set(links.map((l) => l.client_email).filter(Boolean));
    }

    // 2. Resolve those emails to AppUser records (small set — one lookup per
    // linked client is fine and avoids relying on unsupported $in filters).
    const consentedClients = [];
    for (const email of allowedClientEmails) {
      const rows = await base44.asServiceRole.entities.AppUser.filter({ email });
      if (rows[0]) consentedClients.push(rows[0]);
    }

    // Build a set of allowed identifiers. Session/RiskEvent link to AppUser via
    // AppUser.id (user_id) and Session records also carry created_by (email).
    const allowedIds = new Set(consentedClients.map((c) => c.id));
    const allowedEmails = new Set(consentedClients.map((c) => c.email).filter(Boolean));

    // 3. All sessions & risk events, then filter down to consented clients only.
    const allSessions = await base44.asServiceRole.entities.Session.list('-created_date', 1000);
    const allRiskEvents = await base44.asServiceRole.entities.RiskEvent.list('-detected_at', 1000);

    const isAllowed = (rec) =>
      (rec.user_id && allowedIds.has(rec.user_id)) ||
      (rec.created_by && allowedEmails.has(rec.created_by));

    const sessions = allSessions.filter(isAllowed);
    const flaggedRiskEvents = allRiskEvents
      .filter((e) => e.needs_human_review === true && isAllowed(e))
      .sort(
        (a, b) =>
          (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99) ||
          new Date(b.detected_at || 0).getTime() - new Date(a.detected_at || 0).getTime()
      );

    // 4. Compose per-client view
    const clients = consentedClients.map((c) => {
      const clientSessions = sessions.filter(
        (s) => s.user_id === c.id || (c.email && s.created_by === c.email)
      );
      const clientRisks = clientSessions.length
        ? flaggedRiskEvents.filter((e) => e.user_id === c.id || (c.email && e.created_by === c.email))
        : [];
      const edgeSignalCount = clientSessions.reduce(
        (sum, s) => sum + (s.edge_signal_count || (s.edge_signals || []).length || 0),
        0
      );
      return {
        id: c.id,
        name: c.name || c.email || 'Клиент',
        email: c.email,
        last_seen_at: c.last_seen_at,
        session_count: clientSessions.length,
        flagged_count: clientRisks.length,
        edge_signal_count: edgeSignalCount,
      };
    });

    return Response.json({
      clients,
      sessions: sessions.map((s) => ({
        id: s.id,
        user_id: s.user_id,
        created_by: s.created_by,
        mode_id: s.mode_id || s.mode,
        status: s.status,
        created_date: s.created_date,
        summary: s.summary,
        risk_flag: s.risk_flag,
        edge_signals: s.edge_signals || [],
        edge_signal_count: s.edge_signal_count || (s.edge_signals || []).length || 0,
      })),
      flaggedRiskEvents: flaggedRiskEvents.map((e) => ({
        id: e.id,
        user_id: e.user_id,
        created_by: e.created_by,
        session_id: e.session_id,
        risk_type: e.risk_type,
        severity: e.severity,
        trigger_text: e.trigger_text,
        detected_at: e.detected_at,
        status: e.status,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
