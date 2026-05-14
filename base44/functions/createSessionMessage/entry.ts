import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { session_id, mode_id, step_number, role, content, created_at } = await req.json();

    if (!session_id || !role || !content) {
      return Response.json({ error: 'Missing required fields: session_id, role, content' }, { status: 400 });
    }

    // Verify the session belongs to this user (or user is admin)
    const sessions = await base44.asServiceRole.entities.Session.filter({ id: session_id });
    const session = sessions[0];

    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.created_by !== user.email && user.role !== 'admin') {
      return Response.json({ error: 'Access denied: session does not belong to current user' }, { status: 403 });
    }

    // Create message as service role (bypasses frontend RLS)
    const message = await base44.asServiceRole.entities.Message.create({
      session_id,
      mode_id: mode_id || null,
      step_number: step_number || null,
      role,
      content,
      created_at: created_at || new Date().toISOString(),
    });

    return Response.json({ message });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});