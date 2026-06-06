import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Build email -> AppUser.id map
    const appUsers = await base44.asServiceRole.entities.AppUser.list('-created_date', 1000);
    const emailToAppUserId = {};
    for (const au of appUsers) {
      if (au.email) emailToAppUserId[au.email.toLowerCase()] = au.id;
    }

    const insights = await base44.asServiceRole.entities.Insight.list('-created_date', 2000);

    let updated = 0;
    let unresolved = 0;

    for (const ins of insights) {
      if (ins.user_id) continue;

      // Resolve creator email from created_by, then map to AppUser.id
      const email = (ins.created_by || '').toLowerCase();
      const appUserId = email ? emailToAppUserId[email] : null;

      if (appUserId) {
        await base44.asServiceRole.entities.Insight.update(ins.id, { user_id: appUserId });
        updated++;
      } else {
        unresolved++;
      }
    }

    console.log('[backfillInsightUserId]', { total: insights.length, updated, unresolved });

    return Response.json({ total: insights.length, updated, unresolved });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});