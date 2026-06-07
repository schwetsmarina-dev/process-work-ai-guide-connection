import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const STALE_HOURS = 24;

// Marks the current user's "active" sessions older than STALE_HOURS as abandoned.
// Called fire-and-forget on app load (see RequireAuth).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const active = await base44.entities.Session.filter({ status: 'active' }, '-created_date', 200);

    const cutoff = Date.now() - STALE_HOURS * 60 * 60 * 1000;
    const now = new Date().toISOString();
    let abandoned = 0;

    for (const s of active) {
      const started = s.started_at || s.created_date;
      if (started && new Date(started).getTime() < cutoff) {
        await base44.entities.Session.update(s.id, { status: 'abandoned', ended_at: now }).catch(() => {});
        abandoned++;
      }
    }

    return Response.json({ abandoned });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});