import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Safety escalation: emails the on-call address when a high or critical risk
 * event is recorded.
 *
 * WHY THIS SHAPE
 * This function was originally written as an entity-automation webhook and
 * required the caller to be an admin. That made it unusable from the app: the
 * only person who can trigger a risk event is the user in distress, and they
 * are never an admin, so every real call would have returned 403. It is now
 * callable by any authenticated user, but ONLY for a risk event that belongs
 * to them.
 *
 * The client sends nothing but an id. The event is re-read server-side with
 * service-role access and every decision — ownership, severity, contents of
 * the email — is made from the stored record. A client cannot fabricate an
 * alert, spoof someone else's event, or inject text into the email body.
 *
 * PRIVACY NOTE
 * The email contains the trigger text (already truncated to 500 chars when the
 * event is created). This is personal data of a special category leaving the
 * platform by email, justified under GDPR Art. 9(2)(c) — protection of vital
 * interests — and it must be described in the DPIA and the privacy policy.
 * Set TEAM_NOTIFICATION_EMAIL to an address that only the responsible person
 * can read.
 *
 * Accepts either:
 *   { riskEventId: "..." }                       ← called from the app
 *   { event: { type: "create" }, data: { id } }  ← platform automation shape
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));

    // Automation payloads only matter on create; app calls have no event block.
    if (payload?.event && payload.event.type !== 'create') {
      return Response.json({ skipped: true, reason: 'not a create event' });
    }

    const riskEventId = payload?.riskEventId || payload?.data?.id;
    if (!riskEventId) {
      return Response.json({ error: 'riskEventId is required' }, { status: 400 });
    }

    // Re-read from the database. Never trust risk details sent by the client.
    let riskEvent;
    try {
      riskEvent = await base44.asServiceRole.entities.RiskEvent.get(riskEventId);
    } catch (e) {
      console.error('[RiskNotify] could not load risk event', riskEventId, e?.message);
      return Response.json({ error: 'Risk event not found' }, { status: 404 });
    }
    if (!riskEvent) {
      return Response.json({ error: 'Risk event not found' }, { status: 404 });
    }

    // Authorize: the owner of the event, or an admin.
    const isOwner = riskEvent.user_id && riskEvent.user_id === user.id;
    const isAdmin = user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!['high', 'critical'].includes(riskEvent.severity)) {
      return Response.json({ skipped: true, reason: 'severity not high or critical' });
    }

    const teamEmail = Deno.env.get('TEAM_NOTIFICATION_EMAIL');
    if (!teamEmail) {
      // Loud, because a missing address means nobody is being told.
      console.error('[RiskNotify] TEAM_NOTIFICATION_EMAIL not set — alert NOT delivered', {
        riskEventId,
        severity: riskEvent.severity,
      });
      return Response.json({ error: 'TEAM_NOTIFICATION_EMAIL not configured' }, { status: 500 });
    }

    const severityLabel = riskEvent.severity === 'critical' ? '🚨 CRITICAL' : '⚠️ HIGH';
    const riskTypeLabels = {
      suicide_mention: 'Suicidal ideation',
      self_harm: 'Self-harm',
      violence: 'Violence',
      psychotic: 'Psychotic episode',
      medical_emergency: 'Medical emergency',
      other: 'Other risk',
    };
    const riskTypeLabel = riskTypeLabels[riskEvent.risk_type] || riskEvent.risk_type;
    const detectedAt = riskEvent.detected_at
      ? new Date(riskEvent.detected_at).toISOString()
      : new Date().toISOString();

    const subject = `${severityLabel} Risk event — ${riskTypeLabel}`;
    const body = `A ${String(riskEvent.severity).toUpperCase()} severity risk event was recorded and needs review.

────────────────────────────────────
Risk type:   ${riskTypeLabel}
Severity:    ${String(riskEvent.severity).toUpperCase()}
Session ID:  ${riskEvent.session_id || 'N/A'}
Event ID:    ${riskEventId}
Detected at: ${detectedAt} (UTC)
Status:      ${riskEvent.status || 'open'}
────────────────────────────────────

Trigger text:
"${riskEvent.trigger_text || '(not recorded)'}"

────────────────────────────────────

Open the therapist dashboard or the admin panel to review.

Automated safety notification. This mailbox is not monitored by the user.`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: teamEmail,
      subject,
      body,
      from_name: 'Process Work Safety Monitor',
    });

    // Mark the event so a delivered alert is distinguishable from an unsent one.
    try {
      await base44.asServiceRole.entities.RiskEvent.update(riskEventId, {
        needs_human_review: true,
      });
    } catch (e) {
      console.warn('[RiskNotify] could not flag event for review:', e?.message);
    }

    console.log('[RiskNotify] alert sent', {
      riskEventId,
      severity: riskEvent.severity,
      session_id: riskEvent.session_id,
    });
    return Response.json({ success: true, severity: riskEvent.severity, riskEventId });
  } catch (error) {
    console.error('[RiskNotify] Error:', error?.message, String(error));
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});
