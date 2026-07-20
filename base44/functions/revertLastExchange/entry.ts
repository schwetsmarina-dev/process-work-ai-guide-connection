import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Reverts the last exchange in an active session:
//   • removes the user's most recent message AND everything created after it
//     (the facilitator's follow-up reply, and any system message that followed),
//   • rolls Session.current_step back to the step under which the user answered,
//   • returns the removed user text so the UI can put it back in the input box
//     for the user to correct and resend.
//
// Memory is NOT touched here — UserMemory is only persisted at session close
// (persistSessionMemory), so nothing needs to be reverted mid-session.
// RiskEvents are intentionally left in place: safety signals stay logged for review.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { session_id } = await req.json();
    if (!session_id) {
      return Response.json({ error: 'session_id is required' }, { status: 400 });
    }

    // Load session and verify ownership (mirror createSessionMessage / listSessionMessages)
    const sessions = await base44.asServiceRole.entities.Session.filter({ id: session_id });
    const session = sessions[0];
    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }
    if (session.created_by !== user.email && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Can't step back in a finished session.
    if (session.status === 'completed') {
      return Response.json({ reverted: false, reason: 'session_completed' });
    }

    // Messages oldest → newest (same ordering the chat UI shows).
    const messages = await base44.asServiceRole.entities.Message.filter(
      { session_id },
      'created_date'
    );

    // Find the last user message.
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserIdx = i;
        break;
      }
    }

    // Nothing to undo (only the opening greeting exists, or no messages yet).
    if (lastUserIdx === -1) {
      return Response.json({ reverted: false, reason: 'no_user_message' });
    }

    const lastUserMsg = messages[lastUserIdx];
    // Remove the user's answer plus everything after it (facilitator reply, any system msg).
    const toRemove = messages.slice(lastUserIdx);

    // Roll back to the step under which the user answered. handleSend records the
    // user message with step_number = the step that was current at answer time.
    const rollbackStep = Number(lastUserMsg.step_number) || Number(session.current_step) || 1;

    let removedCount = 0;
    for (const m of toRemove) {
      try {
        await base44.asServiceRole.entities.Message.delete(m.id);
        removedCount++;
      } catch (delErr) {
        console.error('[revertLastExchange] delete failed for', m.id, '—', delErr?.message);
      }
    }

    // Mirror handleSend: only Session.current_step is moved (AppUser is untouched there too).
    await base44.asServiceRole.entities.Session.update(session_id, { current_step: rollbackStep });

    console.log('[revertLastExchange] reverted', {
      session_id,
      removedCount,
      rollbackStep,
    });

    return Response.json({
      reverted: true,
      removed_user_text: lastUserMsg.content || '',
      removed_count: removedCount,
      new_current_step: rollbackStep,
    });
  } catch (error) {
    console.error('[revertLastExchange] fatal:', error?.message, String(error));
    return Response.json({ error: error.message }, { status: 500 });
  }
});
