import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id || !user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    if (body.confirm !== 'RESET_MEMORY') {
      return Response.json({ error: 'Confirmation required' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const memories = await base44.asServiceRole.entities.UserMemory.filter({ user_id: user.id }, '-updated_at', 1000);
    let deleted = 0;
    for (const row of memories) {
      try {
        await base44.asServiceRole.entities.UserMemory.delete(row.id);
        deleted++;
      } catch (e) {
        console.warn('[resetMyMemory] memory delete failed:', e?.message);
      }
    }

    // A permanent reset must not allow the same historical sessions to silently
    // recreate the deleted profile later. Preserve the sessions for the user's
    // history, but mark all existing sessions as excluded from future memory.
    const sessions = await base44.asServiceRole.entities.Session.filter({ user_id: user.id }, '-created_date', 1000);
    let excluded = 0;
    for (const session of sessions) {
      if (session.memory_excluded === true && session.memory_exclusion_reason === 'memory_reset') continue;
      try {
        await base44.asServiceRole.entities.Session.update(session.id, {
          memory_excluded: true,
          memory_excluded_at: now,
          memory_exclusion_reason: 'memory_reset',
        });
        excluded++;
      } catch (e) {
        console.warn('[resetMyMemory] session exclusion failed:', e?.message);
      }
    }

    const profiles = await base44.asServiceRole.entities.AppUser.filter({ email: user.email }).catch(() => []);
    for (const profile of profiles) {
      await base44.asServiceRole.entities.AppUser.update(profile.id, { memory_enabled: false }).catch(() => {});
    }

    return Response.json({ ok: true, memory_deleted: deleted, sessions_excluded: excluded, memory_enabled: false });
  } catch (error) {
    console.error('[resetMyMemory] fatal:', error?.message, String(error));
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});
