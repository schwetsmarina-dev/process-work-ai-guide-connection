import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// GDPR "right to erasure": permanently deletes ALL data belonging to the
// authenticated caller — and only the caller. Every query below is scoped to
// this user's own email / AppUser id; nothing global is ever touched.
// Returns per-type counts. The Base44 authentication identity is retained by
// the platform, but the Talvira AppUser profile and all user-generated or
// derived content are removed. Billing records are retained only where needed
// for subscription/accounting obligations.
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
    let appUsers = [];
    try {
      appUsers = await base44.asServiceRole.entities.AppUser.filter({ email });
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
          console.warn(`[deleteMyData] filter failed for ${entityName}: ${e?.message}`);
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
          console.warn(`[deleteMyData] delete failed for ${entityName}: ${e?.message}`);
        }
      }
      return n;
    }

    // NOTE: Session.user_id (and UserMemory.user_id) hold the platform
    // User.id (user.id below), NOT AppUser.id — those are different records.
    // created_by is also unreliable for Session: it's stamped with the
    // SERVICE ROLE's identity since sessions are created server-side
    // (startSession), so it never matches the real user. user.id is the
    // filter that actually works for Session ownership.
    const ownerFilters = [{ created_by: email }, { user_id: user.id }];
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
        console.warn(`[deleteMyData] message lookup failed: ${e?.message}`);
      }
    }
    const messages = [...messageMap.values()];

    // 3) Other user-owned entities
    const insights = await collect('Insight', ownerFilters);
    const memory = await collect('UserMemory', [{ user_id: user.id }]);
    const feedback = await collect(
      'SessionFeedback',
      appUserId ? [{ user_email: email }, { user_id: appUserId }] : [{ user_email: email }]
    );
    // RiskEvent.user_id is also the platform User.id (set from currentUser.id
    // client-side in SessionChat.jsx), not AppUser.id.
    const risk = await collect('RiskEvent', [{ user_id: user.id }]);
    const physioFilters = [{ user_id: user.id }];
    if (appUserId) physioFilters.push({ user_id: appUserId });
    const physio = await collect('PhysiologicalData', physioFilters);
    const practiceFilters = [{ user_id: user.id }];
    if (appUserId) practiceFilters.push({ user_id: appUserId });
    const practices = await collect('ProcessPractice', practiceFilters);
    const clientLinks = await collect('ClientLink', [
      { client_email: email },
      { therapist_email: email },
    ]);
    const assignments = await collect('Assignment', [
      { client_email: email },
      { therapist_email: email },
    ]);

    // Delete children before parents. Entitlement/payment references are not
    // removed here because active cancellation and statutory billing retention
    // must be handled through Paddle and the applicable accounting workflow.
    const deleted = {
      messages: await removeAll('Message', messages),
      insights: await removeAll('Insight', insights),
      memory: await removeAll('UserMemory', memory),
      feedback: await removeAll('SessionFeedback', feedback),
      risk_events: await removeAll('RiskEvent', risk),
      physiological: await removeAll('PhysiologicalData', physio),
      practices: await removeAll('ProcessPractice', practices),
      client_links: await removeAll('ClientLink', clientLinks),
      assignments: await removeAll('Assignment', assignments),
      sessions: await removeAll('Session', sessions),
      app_user_profiles: await removeAll('AppUser', appUsers),
    };

    console.log('[deleteMyData] completed', { deleted });

    return Response.json({ ok: true, deleted });
  } catch (error) {
    console.error('[deleteMyData] fatal:', error?.message, String(error));
    return Response.json({ error: error.message }, { status: 500 });
  }
});
