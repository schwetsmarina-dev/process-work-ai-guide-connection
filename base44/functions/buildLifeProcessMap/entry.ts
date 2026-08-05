import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Life Process Map builder.
// For one client, collects nodes (themes + signals + edge_signals from Session,
// tags from Insight, high/critical RiskEvents, and cross-cutting Terms) and
// edges based on co-occurrence within the same session.
// Returns { nodes, edges } — pure computation, nothing is saved to the DB.
//
// SECURITY — two ways to call this:
//   1. { } or { user_id: <own id> }        — the caller's OWN map. Always allowed.
//   2. { clientEmail: "client@x.com" }      — a THERAPIST/ADMIN requesting a
//      client's map. Requires role therapist/admin AND (unless admin) a
//      ClientLink between caller and that client with consent_to_share === true
//      and share_scope === 'both' (the map merges session + insight + risk
//      data, so it only unlocks under the broadest consent tier).
// A raw user_id for someone other than the caller is REJECTED unless the
// caller is admin — passing an arbitrary user_id used to return that
// person's data with no check at all.

const norm = (s) => String(s || '').trim();
const keyOf = (label) => norm(label).toLowerCase();

// Split a stored tag string (Insight.tags) into individual tokens.
function splitTags(raw) {
  return norm(raw)
    .split(/[,;|\n]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

const RISK_NODE_SEVERITIES = new Set(['high', 'critical']);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const me = await base44.auth.me().catch(() => null);

    const clientEmail = body.clientEmail ? String(body.clientEmail).trim().toLowerCase() : null;
    let userId = body.user_id || null;

    if (clientEmail) {
      if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const isSelf = me.email && me.email.toLowerCase() === clientEmail;
      if (!isSelf) {
        if (me.role !== 'therapist' && me.role !== 'admin') {
          return Response.json({ error: 'Forbidden' }, { status: 403 });
        }
        if (me.role !== 'admin') {
          const links = await base44.asServiceRole.entities.ClientLink.filter({
            therapist_email: me.email,
            client_email: clientEmail,
          });
          const link = links[0];
          if (!link || link.consent_to_share !== true || link.share_scope !== 'both') {
            return Response.json({ error: 'No consent to share', consent: false }, { status: 403 });
          }
        }
      }
      const owners = await base44.asServiceRole.entities.AppUser.filter({ email: clientEmail });
      userId = owners[0]?.id || null;
      if (!userId) {
        return Response.json({ error: 'Client not found' }, { status: 404 });
      }
    } else if (!userId) {
      // No explicit target — the caller's own map.
      if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      userId = me.id;
    } else if (userId !== me?.id && me?.role !== 'admin') {
      // Explicit user_id for someone else, caller not admin — reject.
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!userId) {
      return Response.json({ error: 'Missing user_id' }, { status: 400 });
    }

    // ── Load this user's sessions, insights, and notable risk events ──────────
    // NOTE: Session ownership is the plain custom field `user_id` — sessions are
    // created server-side (startSession) so created_by/created_by_id are always
    // stamped with the SERVICE ROLE's identity, never the real owner. Filtering
    // by created_by_id here silently returned nothing for real users.
    const sessions = await base44.asServiceRole.entities.Session.filter(
      { user_id: userId },
      '-created_date',
      500
    );
    const insights = await base44.asServiceRole.entities.Insight.filter(
      { user_id: userId, is_archived: false },
      '-created_date',
      500
    );
    const terms = await base44.asServiceRole.entities.Term.list('term', 1000);
    const riskEvents = await base44.asServiceRole.entities.RiskEvent.filter(
      { user_id: userId },
      '-detected_at',
      200
    );

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

    // Risk events (high/critical only — this map is a clinical overview, not
    // the full incident log) grouped by session for co-occurrence.
    const risksBySession = new Map();
    const orphanRisks = [];
    for (const r of riskEvents) {
      if (!RISK_NODE_SEVERITIES.has(r.severity)) continue;
      const label = r.risk_type || 'other';
      if (r.session_id) {
        if (!risksBySession.has(r.session_id)) risksBySession.set(r.session_id, []);
        risksBySession.get(r.session_id).push(label);
      } else {
        orphanRisks.push(label);
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
      for (const edgeSig of s.edge_signals || []) {
        const k = addNode(edgeSig, 'edge');
        if (k) labelsInSession.push(k);
      }
      for (const tag of tagsBySession.get(s.id) || []) {
        const k = addNode(tag, 'tag');
        if (k) labelsInSession.push(k);
      }
      for (const riskLabel of risksBySession.get(s.id) || []) {
        const k = addNode(riskLabel, 'risk');
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

    // Tags/risks with no session still appear as standalone nodes.
    for (const tag of orphanTags) addNode(tag, 'tag');
    for (const riskLabel of orphanRisks) addNode(riskLabel, 'risk');

    const nodeList = [...nodes.values()];
    const edgeList = [...edges.entries()].map(([k, weight]) => {
      const [source, target] = k.split('|');
      return { source, target, weight };
    });

    console.log(
      '[buildLifeProcessMap] user',
      userId,
      '— nodes:',
      nodeList.length,
      'edges:',
      edgeList.length,
      'risk nodes:',
      nodeList.filter((n) => n.type === 'risk').length,
      'edge nodes:',
      nodeList.filter((n) => n.type === 'edge').length
    );
    return Response.json({ user_id: userId, nodes: nodeList, edges: edgeList });
  } catch (error) {
    console.error('[buildLifeProcessMap] fatal:', error?.message, String(error));
    return Response.json({ error: error.message }, { status: 500 });
  }
});
