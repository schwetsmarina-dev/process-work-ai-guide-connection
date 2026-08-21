import { createClientFromRequest } from 'npm:@base44/sdk@0.8.43';

function clean(value: unknown, max = 80) {
  return String(value ?? '').trim().slice(0, max);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const programId = clean(body.program_id, 160);
    const action = clean(body.action, 30);
    if (!programId || !['pause', 'resume', 'stop'].includes(action)) {
      return Response.json({ error: 'invalid_request' }, { status: 400 });
    }

    const program = await base44.asServiceRole.entities.EdgeProgram.get(programId).catch(() => null);
    if (!program || String(program.user_id) !== String(caller.id)) {
      return Response.json({ error: 'Program not found' }, { status: 404 });
    }
    if (program.status === 'completed') return Response.json({ error: 'program_completed' }, { status: 409 });
    if (program.status === 'stopped') return Response.json({ error: 'program_stopped' }, { status: 409 });

    const now = new Date().toISOString();
    let patch: Record<string, unknown> = {};

    if (action === 'pause') {
      patch = {
        status: 'paused',
        paused_at: now,
        paused_day: Math.max(1, Math.min(28, Number(program.current_day || 1))),
        last_progression_decision: 'pause',
      };
    } else if (action === 'resume') {
      if (program.safety_state === 'caution') {
        return Response.json({ error: 'rescreen_required_before_resume' }, { status: 409 });
      }
      if (program.safety_state === 'stop') {
        return Response.json({ error: 'program_safety_stop' }, { status: 409 });
      }
      const risks = await base44.asServiceRole.entities.RiskEvent.filter({ user_id: caller.id }, '-detected_at', 20).catch(() => []);
      const blockingRisk = risks.find((r: any) => ['high', 'critical'].includes(String(r.severity)) && r.status !== 'resolved');
      if (blockingRisk) return Response.json({ error: 'unresolved_high_risk' }, { status: 409 });
      patch = {
        status: 'active',
        paused_at: null,
        paused_day: null,
      };
    } else {
      patch = {
        status: 'stopped',
        stop_reason: 'user_chose_stop',
        paused_at: null,
        last_progression_decision: 'stop',
      };
    }

    const updated = await base44.asServiceRole.entities.EdgeProgram.update(program.id, patch);
    return Response.json({ ok: true, action, program: updated });
  } catch (error) {
    console.error('[updateEdgeProgramState]', error?.message, String(error));
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
});