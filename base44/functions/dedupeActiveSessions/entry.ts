import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Finds users with multiple active sessions in the same mode, keeps the most
// recent one (by created_date) and marks the rest as "abandoned".
// Admin-only.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const active = await base44.asServiceRole.entities.Session.filter(
      { status: 'active' },
      '-created_date',
      2000
    );

    // Group by owner + mode
    const groups = {};
    for (const s of active) {
      const owner = s.created_by_id || s.created_by || s.user_id || 'unknown';
      const mode = s.mode_id || s.mode || 'unknown';
      const key = `${owner}::${mode}`;
      (groups[key] ||= []).push(s);
    }

    let abandoned = 0;
    for (const key of Object.keys(groups)) {
      const list = groups[key];
      if (list.length < 2) continue;
      // list is already sorted desc by created_date — keep [0], abandon the rest
      for (const s of list.slice(1)) {
        await base44.asServiceRole.entities.Session.update(s.id, {
          status: 'abandoned',
          ended_at: new Date().toISOString(),
        });
        abandoned++;
      }
    }

    console.log('[dedupeActiveSessions]', { activeChecked: active.length, abandoned });
    return Response.json({ activeChecked: active.length, abandoned });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});