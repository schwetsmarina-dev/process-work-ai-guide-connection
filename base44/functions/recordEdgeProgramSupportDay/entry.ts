import { createClientFromRequest } from 'npm:@base44/sdk@0.8.43';

function clean(value: unknown, max = 200) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const entitlementRes = await base44.functions.invoke('getEntitlement', {}).catch(() => null);
    const entitlement = entitlementRes?.data || entitlementRes;
    if (caller.role !== 'admin' && !entitlement?.hasAccess) return Response.json({ error: 'feature_requires_full_access' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const programId = clean(body.program_id, 160);
    const eventId = clean(body.event_id, 160);
    const kind = clean(body.kind, 40);
    if (!programId || !eventId || !['rest_day', 'resource_day'].includes(kind)) {
      return Response.json({ error: 'invalid_support_day_payload' }, { status: 400 });
    }

    const program = await base44.asServiceRole.entities.EdgeProgram.get(programId).catch(() => null);
    if (!program || String(program.user_id) !== String(caller.id)) return Response.json({ error: 'Program not found' }, { status: 404 });
    if (['completed', 'stopped'].includes(String(program.status))) return Response.json({ error: 'program_not_active' }, { status: 409 });

    const history = Array.isArray(program.support_day_history) ? [...program.support_day_history] : [];
    if (history.some((x: any) => String(x?.event_id) === eventId)) {
      return Response.json({
        ok: true,
        reused: true,
        rest_days_taken: Number(program.rest_days_taken || 0),
        resource_days_taken: Number(program.resource_days_taken || 0),
      });
    }

    const timestamp = new Date().toISOString();
    history.push({
      event_id: eventId,
      kind,
      program_day: Math.max(1, Math.min(28, Number(program.current_day || 1))),
      taken_at: timestamp,
    });

    const patch: any = { support_day_history: history.slice(-120) };
    if (kind === 'rest_day') patch.rest_days_taken = Number(program.rest_days_taken || 0) + 1;
    if (kind === 'resource_day') patch.resource_days_taken = Number(program.resource_days_taken || 0) + 1;

    const updated = await base44.asServiceRole.entities.EdgeProgram.update(program.id, patch);
    return Response.json({
      ok: true,
      reused: false,
      rest_days_taken: Number(updated.rest_days_taken || 0),
      resource_days_taken: Number(updated.resource_days_taken || 0),
      event: history[history.length - 1],
    });
  } catch (error) {
    console.error('[recordEdgeProgramSupportDay] fatal:', error?.message, String(error));
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
});