import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Life Process Map builder.
// For one user_id, collects nodes (themes + signals from Session, tags from Insight,
// and cross-cutting Terms) and edges based on co-occurrence within the same session.
// Returns { nodes, edges } — pure computation, nothing is saved to the DB.

const norm = (s) => String(s || '').trim();
const keyOf = (label) => norm(label).toLowerCase();

// Split a stored tag string (Insight.tags) into individual tokens.
function splitTags(raw) {
  return norm(raw)
    .split(/[,;|\n]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Resolve the target user: explicit user_id, else the caller themselves.
    let userId = body.user_id;
    if (!userId) {
      const me = await base44.auth.me().catch(() => null);
      userId = me?.id;
    }
    if (!userId) {
      return Response.json({ error: 'Missing user_id' }, { status: 400 });
    }

    // ── Load this user's sessions and insights ────────────────────────────────
    const sessions = await base44.asServiceRole.entities.Session.filter(
      { created_by_id: userId },
      '-created_date',
      500
    );
    const insights = await base44.asServiceRole.entities.Insight.filter(
      { user_id: userId, is_archived: false },
      '-created_date',
      500
    );
    const terms = await base44.asServiceRole.entities.Term.list('term', 1000);

    // ── Node registry: key -> { id, label, type, count } ──────────────────────
    const nodes = new Map();
    const addNode = (label, type) => {
      const lbl = norm(label);
      if (!lbl) return null;
      const k = `${type}:${keyOf(lbl)}`;
      if (!nodes.has(k)) {
        nodes.set(k, { id: k, label: lbl, type, count: 0 });
      }
      const n = nodes.get(k);
      n.count += 1;
      return k;
    };

    // Edge registry: "a|b" (sorted) -> weight
    const edges = new Map();
    const addEdge = (a, b) => {
      if (!a || !b || a === b) return;
      const [x, y] = a < b ? [a, b] : [b, a];
      const k = `${x}|${y}`;
      edges.set(k, (edges.get(k) || 0) + 1);
    };

    // Cross-cutting term labels (lowercased) for tagging matches as term nodes.
    const crossCuttingTerms = terms
      .filter((t) => t.is_cross_cutting && norm(t.term))
      .map((t) => ({ label: norm(t.term), key: keyOf(t.term) }));

    // ── Per-session: gather the labels present, then connect them pairwise ─────
    // Build a map session_id -> insight tag labels for co-occurrence.
    const tagsBySession = new Map();
    const orphanTags = []; // insight tags with no session_id — still become nodes
    for (const ins of insights) {
      const tags = splitTags(ins.tags);
      if (!tags.length) continue;
      if (ins.session_id) {
        if (!tagsBySession.has(ins.session_id)) tagsBySession.set(ins.session_id, []);
        tagsBySession.get(ins.session_id).push(...tags);
      } else {
        orphanTags.push(...tags);
      }
    }

    for (const s of sessions) {
      const labelsInSession = [];

      for (const th of s.themes || []) {
        const k = addNode(th, 'theme');
        if (k) labelsInSession.push(k);
      }
      for (const sig of s.signals || []) {
        const k = addNode(sig, 'signal');
        if (k) labelsInSession.push(k);
      }
      for (const tag of tagsBySession.get(s.id) || []) {
        const k = addNode(tag, 'tag');
        if (k) labelsInSession.push(k);
      }

      // Add cross-cutting term nodes when a term label appears among this session's labels.
      const sessionText = labelsInSession
        .map((k) => nodes.get(k)?.label || '')
        .join(' ')
        .toLowerCase();
      for (const term of crossCuttingTerms) {
        if (sessionText.includes(term.key)) {
          const k = addNode(term.label, 'term');
          if (k) labelsInSession.push(k);
        }
      }

      // Co-occurrence edges: connect every pair present in this session.
      const uniq = [...new Set(labelsInSession)];
      for (let i = 0; i < uniq.length; i++) {
        for (let j = i + 1; j < uniq.length; j++) {
          addEdge(uniq[i], uniq[j]);
        }
      }
    }

    // Insight tags with no session still appear as standalone nodes.
    for (const tag of orphanTags) addNode(tag, 'tag');

    const nodeList = [...nodes.values()];
    const edgeList = [...edges.entries()].map(([k, weight]) => {
      const [source, target] = k.split('|');
      return { source, target, weight };
    });

    console.log('[buildLifeProcessMap] user', userId, '— nodes:', nodeList.length, 'edges:', edgeList.length);
    return Response.json({ user_id: userId, nodes: nodeList, edges: edgeList });
  } catch (error) {
    console.error('[buildLifeProcessMap] fatal:', error?.message, String(error));
    return Response.json({ error: error.message }, { status: 500 });
  }
});