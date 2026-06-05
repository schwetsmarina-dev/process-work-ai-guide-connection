import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Authenticate: only admins may trigger risk notifications
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const payload = await req.json();

    const { event, data } = payload;

    // Only process create events
    if (event?.type !== 'create') {
      return Response.json({ skipped: true, reason: 'not a create event' });
    }

    const riskEvent = data;

    // Only notify for high or critical severity
    if (!['high', 'critical'].includes(riskEvent?.severity)) {
      return Response.json({ skipped: true, reason: 'severity not high or critical' });
    }

    const teamEmail = Deno.env.get('TEAM_NOTIFICATION_EMAIL');
    if (!teamEmail) {
      console.error('[RiskNotify] TEAM_NOTIFICATION_EMAIL not set');
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
      ? new Date(riskEvent.detected_at).toLocaleString('ru-RU', { timeZone: 'UTC' })
      : new Date().toLocaleString('ru-RU', { timeZone: 'UTC' });

    const subject = `${severityLabel} Risk Event Detected — ${riskTypeLabel}`;
    const body = `A ${riskEvent.severity.toUpperCase()} severity risk event has been detected and requires immediate review.

────────────────────────────────────
Risk Type:   ${riskTypeLabel}
Severity:    ${riskEvent.severity.toUpperCase()}
Session ID:  ${riskEvent.session_id || 'N/A'}
Detected At: ${detectedAt} UTC
Status:      ${riskEvent.status || 'open'}
────────────────────────────────────

Trigger Text:
"${riskEvent.trigger_text || '(not recorded)'}"

────────────────────────────────────

Please log in to the admin panel to review and take appropriate action.

This is an automated safety notification.`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: teamEmail,
      subject,
      body,
      from_name: 'Process Work Safety Monitor',
    });

    console.log(`[RiskNotify] Notification sent for ${riskEvent.severity} risk event — session: ${riskEvent.session_id}`);
    return Response.json({ success: true, severity: riskEvent.severity, session_id: riskEvent.session_id });
  } catch (error) {
    console.error('[RiskNotify] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});