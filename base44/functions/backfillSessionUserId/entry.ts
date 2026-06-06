import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Admin-only maintenance: backfill Session.user_id (null) by matching the
// session's created_by (email) to the AppUser record's email.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const sessions = await base44.asServiceRole.entities.Session.list('-created_date', 1000);
    // Fix any session whose user_id is missing OR inconsistent with its owner (created_by_id).
    // user_id is kept equal to created_by_id (the User id) — this is the id memory/history key on.
    const broken = sessions.filter((s) => s.created_by_id && s.user_id !== s.created_by_id);
    console.log('[backfillSessionUserId] sessions total:', sessions.length, 'to fix:', broken.length);

    let fixed = 0;
    let unresolved = 0;
    for (const s of broken) {
      if (!s.created_by_id) {
        unresolved++;
        continue;
      }
      await base44.asServiceRole.entities.Session.update(s.id, { user_id: s.created_by_id });
      fixed++;
    }

    console.log('[backfillSessionUserId] DONE — fixed:', fixed, 'unresolved:', unresolved);
    return Response.json({ total: sessions.length, broken: broken.length, fixed, unresolved });
  } catch (error) {
    console.error('[backfillSessionUserId] error:', error?.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});