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

    // Load session via service role to check ownership
    const sessions = await base44.asServiceRole.entities.Session.filter({ id: session_id });
    const session = sessions[0];
    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    // Only owner or admin can read messages
    if (session.created_by !== user.email && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Load all messages for this session via service role
    const messages = await base44.asServiceRole.entities.Message.filter(
      { session_id },
      'created_date'
    );

    return Response.json({ messages });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});