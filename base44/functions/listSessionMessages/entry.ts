import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

    const sessions = await base44.asServiceRole.entities.Session.filter({ id: session_id });
    const session = sessions[0];
    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Continuation sessions are created together with a seeded assistant message.
    // Base44 reads can be eventually consistent, so an immediate first read may
    // temporarily return [] and cause the client to generate a brand-new mode
    // greeting. Retry only for continuation sessions before declaring the chat empty.
    const isContinuation = Boolean(session.continued_from_session_id || session.carry_over_context);
    const attempts = isContinuation ? 6 : 1;
    let messages = [];
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      messages = await base44.asServiceRole.entities.Message.filter(
        { session_id },
        'created_date'
      );
      if (messages.length > 0) break;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }

    return Response.json({ messages });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});