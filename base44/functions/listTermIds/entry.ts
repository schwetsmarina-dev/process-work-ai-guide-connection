import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const page = Number(body?.page) || 1;
    const pageSize = 35;
    const terms = await base44.asServiceRole.entities.Term.list('term_id', 1000);
    const start = (page - 1) * pageSize;
    const slice = terms.slice(start, start + pageSize);
    const lines = slice.map((t, i) => `${start + i + 1}. ${t.data?.term_id ?? t.term_id ?? '(empty)'}`);
    return Response.json({ count: terms.length, page, totalPages: Math.ceil(terms.length / pageSize), text: lines.join('\n') });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});