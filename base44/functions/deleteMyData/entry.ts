import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// GDPR "right to erasure": permanently deletes ALL data belonging to the
// authenticated caller — and only the caller. Every query below is scoped to
// this user's own email / AppUser id; nothing global is ever touched.
// Returns per-type counts. The account row itself is left intact so the user
// stays logged in on an empty state (they can log out from Settings).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const email = user.email;

    // Resolve the AppUser id (used as user_id on most child records).
    let appUserId = null;
    try {
      const appUsers = await base44.asServiceRole.entities.AppUser.filter({ email });
      appUserId = appUsers[0]?.id || null;
    } catch (_) { /* non-fatal */ }

    const svc = base44.asServiceRole.entities;

    // Collect records from an entity across several owner filters, deduped by id.
    // Only owner-scoped filters are passed in, so results always belong to the caller.
    async function collect(entityName, filters) {
      const byId = new Map();
      for (const f of filters) {
        try {
          const rows = await svc[entityName].filter(f);
          for (const r of rows) byId.set(r.id, r);
        } catch (e) {
          console.warn(`[deleteMyData] filter ${entityName} ${JSON.stringify(f)} — ${e?.message}`);
        }
      }
      return [...byId.values()];
    }

    async function removeAll(entityName, records) {
      let n = 0;
      for (const r of records) {
        try {
          await svc[entityName].delete(r.id);
          n++;
        } catch (e) {
          console.warn(`[deleteMyData] delete ${entityName} ${r.id} — ${e?.message}`);
        }
      }
      return n;
    }

    const ownerFilters = [{ created_by: email }];
    if (appUserId) ownerFilters.push({ user_id: appUserId });

    // 1) Sessions owned by this user
    const sessions = await collect('Session', ownerFilters);
    const sessionIds = sessions.map((s) => s.id);

    // 2) Messages — scoped by the user's own session ids (reliable ownership)
    const messageMap = new Map();
    for (const sid of sessionIds) {
      try {
        const rows = await svc.Message.filter({ session_id: sid });
        for (const m of rows) messageMap.set(m.id, m);
      } catch (e) {
        console.warn(`[deleteMyData] messages for session ${sid} — ${e?.message}`);
      }
    }
    const messages = [...messageMap.values()];

    // 3) Other user-owned entities
    const insights = await collect('Insight', ownerFilters);
    const memory = appUserId ? await collect('UserMemory', [{ user_id: appUserId }]) : [];
    const feedback = await collect(
      'SessionFeedback',
      appUserId ? [{ user_email: email }, { user_id: appUserId }] : [{ user_email: email }]
    );
    const risk = appUserId ? await collect('RiskEvent', [{ user_id: appUserId }]) : [];
    const physio = appUserId ? await collect('PhysiologicalData', [{ user_id: appUserId }]) : [];

    // Delete children before parents.
    const deleted = {
      messages: await removeAll('Message', messages),
      insights: await removeAll('Insight', insights),
      memory: await removeAll('UserMemory', memory),
      feedback: await removeAll('SessionFeedback', feedback),
      risk_events: await removeAll('RiskEvent', risk),
      physiological: await removeAll('PhysiologicalData', physio),
      sessions: await removeAll('Session', sessions),
    };

    console.log('[deleteMyData] done', { email, appUserId, deleted });

    return Response.json({ ok: true, deleted });
  } catch (error) {
    console.error('[deleteMyData] fatal:', error?.message, String(error));
    return Response.json({ error: error.message }, { status: 500 });
  }
});
