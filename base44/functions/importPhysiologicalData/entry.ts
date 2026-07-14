import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ─────────────────────────────────────────────────────────────────────────────
// STUB: Physiological data import (Apple HealthKit / Garmin Connect).
//
// IMPORTANT integration notes:
// - Apple HealthKit has NO web/OAuth API. Health data lives on-device and is only
//   reachable from a native iOS app (Swift/HealthKit) or via the user's manual
//   "Export Health Data" (an Apple Health export.zip containing export.xml).
//   For a web app, the practical path is: user uploads their export file, which is
//   parsed client-side or here, then written as PhysiologicalData records.
// - Garmin Connect offers a Health API, but it uses OAuth 1.0a and requires a
//   manually-approved Garmin developer partnership. It is not a platform connector.
//
// This function therefore accepts already-parsed records (from a file upload or a
// future native bridge) and persists them. When real OAuth becomes available,
// swap the `records` intake for a token exchange + provider fetch here.
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const source = body.source || 'other';
    const records = Array.isArray(body.records) ? body.records : [];

    if (records.length === 0) {
      return Response.json({
        status: 'no_data',
        message: 'No records provided. Apple HealthKit and Garmin require a native app or file export — upload parsed records here.',
        imported: 0,
      });
    }

    // Normalize + guard each record before persisting.
    const toCreate = records
      .filter((r) => r && r.metric_type && r.recorded_at)
      .map((r) => ({
        user_id: user.id,
        source,
        metric_type: String(r.metric_type),
        value: typeof r.value === 'number' ? r.value : Number(r.value) || 0,
        unit: r.unit ? String(r.unit) : '',
        recorded_at: r.recorded_at,
      }));

    if (toCreate.length === 0) {
      return Response.json({ status: 'no_valid_data', imported: 0 });
    }

    const created = await base44.entities.PhysiologicalData.bulkCreate(toCreate);
    return Response.json({ status: 'success', imported: created.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});