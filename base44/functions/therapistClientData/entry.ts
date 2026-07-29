import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Talvira Pro — returns a single client's shared data to their therapist.
//
// GDPR gate: the therapist receives Session summaries / Insights of a client
// ONLY when a ClientLink exists between them with consent_to_share === true.
// The share_scope on that link decides whether summaries, insights, or both
// are returned. All reads use the service role, but every record is scoped to
// the consented client and filtered by the agreed scope — a therapist can
// never reach data of a client who has not consented.
//
// Payload: { clientEmail: "..." }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (user.role !== 'therapist' && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));
    const clientEmail = payload?.clientEmail;
    if (!clientEmail) {
      return Response.json({ error: 'clientEmail is required' }, { status: 400 });
    }

    // Verify a consenting link between THIS therapist and the client.
    const links = await base44.asServiceRole.entities.ClientLink.filter({
      therapist_email: user.email,
      client_email: clientEmail,
    });
    const link = links[0];
    if (!link || link.consent_to_share !== true) {
      return Response.json({ error: 'No consent to share', consent: false }, { status: 403 });
    }

    const scope = link.share_scope || 'summaries';
    const wantSummaries = scope === 'summaries' || scope === 'both';
    const wantInsights = scope === 'insights' || scope === 'both';

    let summaries: unknown[] = [];
    let insights: unknown[] = [];

    if (wantSummaries) {
      const sessions = await base44.asServiceRole.entities.Session.filter(
        { created_by: clientEmail },
        '-created_date',
        50,
      );
      summaries = sessions
        .filter((s) => s.summary)
        .map((s) => ({
          id: s.id,
          mode_id: s.mode_id || s.mode,
          status: s.status,
          created_date: s.created_date,
          summary: s.summary,
        }));
    }

    if (wantInsights) {
      const rows = await base44.asServiceRole.entities.Insight.filter(
        { created_by: clientEmail },
        '-created_date',
        50,
      );
      insights = rows
        .filter((i) => !i.is_archived)
        .map((i) => ({
          id: i.id,
          title: i.title,
          insight_text: i.insight_text,
          source_mode: i.source_mode,
          created_date: i.created_date,
        }));
    }

    return Response.json({ consent: true, scope, summaries, insights });
  } catch (error) {
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});