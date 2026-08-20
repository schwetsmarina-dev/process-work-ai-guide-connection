export const ALLOWED_OBSERVATION_FIELDS = new Set([
  'theme',
  'experience_type',
  'signal',
  'stopping_signal',
  'stopping_message',
  'familiar_way',
  'emerging_signal',
  'emerging_quality',
  'resource',
  'support_figure',
  'preferred_support',
  'next_day_adjustment',
]);

export type ProgressionDecision = 'advance' | 'repeat' | 'resource' | 'pause' | 'stop';

export function clean(value: unknown, max = 1600) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function clampDistress(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(10, Math.round(n)));
}

export function weekFor(day: number) {
  return Math.max(1, Math.min(4, Math.ceil(day / 7)));
}

export function decideProgression(input: {
  dayNumber: number;
  safetyState?: string;
  unresolvedHighRisk?: boolean;
  feltDissociated?: boolean;
  feltOverwhelmed?: boolean;
  distressBefore?: number | null;
  distressAfter?: number | null;
  userChoice?: string;
}): { decision: ProgressionDecision; reason: string; nextDay: number } {
  const day = Math.max(1, Math.min(28, Number(input.dayNumber || 1)));
  const before = input.distressBefore ?? null;
  const after = input.distressAfter ?? null;

  if (input.safetyState === 'stop' || input.unresolvedHighRisk) {
    return { decision: 'stop', reason: 'safety_stop', nextDay: day };
  }
  if (input.feltDissociated) {
    return { decision: 'pause', reason: 'dissociation_reported', nextDay: day };
  }
  if (input.feltOverwhelmed) {
    return { decision: 'resource', reason: 'overwhelm_reported', nextDay: day };
  }
  if (after !== null && after >= 8) {
    return { decision: 'resource', reason: 'high_distress_after', nextDay: day };
  }
  if (before !== null && after !== null && after >= 7 && after - before >= 2) {
    return { decision: 'resource', reason: 'distress_increased', nextDay: day };
  }

  const choice = String(input.userChoice || '').trim();
  if (choice === 'pause') return { decision: 'pause', reason: 'user_chose_pause', nextDay: day };
  if (choice === 'resource') return { decision: 'resource', reason: 'user_chose_resource', nextDay: day };
  if (choice === 'repeat') return { decision: 'repeat', reason: 'user_chose_repeat', nextDay: day };
  if (choice === 'stop') return { decision: 'stop', reason: 'user_chose_stop', nextDay: day };

  if (day >= 28) return { decision: 'advance', reason: 'program_complete', nextDay: 28 };
  return { decision: 'advance', reason: 'ready_to_continue', nextDay: day + 1 };
}

export function normalizeObservationCandidates(raw: any[]) {
  const out: any[] = [];
  let index = 1;
  for (const item of Array.isArray(raw) ? raw : []) {
    const field = clean(item?.field, 80);
    const value = clean(item?.value, 700);
    if (!ALLOWED_OBSERVATION_FIELDS.has(field) || !value) continue;
    out.push({
      id: clean(item?.id, 80) || `obs_${index++}`,
      field,
      value,
      evidence: clean(item?.evidence, 700),
      confidence: ['low', 'medium', 'high'].includes(item?.confidence) ? item.confidence : 'medium',
    });
  }
  return out.slice(0, 16);
}

export function normalizeResourceCandidates(raw: any[]) {
  const out: any[] = [];
  let index = 1;
  for (const item of Array.isArray(raw) ? raw : []) {
    const label = clean(item?.label, 500);
    if (!label) continue;
    out.push({
      id: clean(item?.id, 80) || `res_${index++}`,
      label,
      kind: clean(item?.kind, 100) || 'other',
      proposed_effect: ['helpful', 'neutral', 'not_helpful', 'avoid'].includes(item?.proposed_effect) ? item.proposed_effect : 'helpful',
      evidence: clean(item?.evidence, 700),
    });
  }
  return out.slice(0, 12);
}

export function applyObservationReview(candidates: any[], review: any[]) {
  const reviewMap = new Map((Array.isArray(review) ? review : []).map((r) => [String(r?.id), r]));
  const confirmed: any[] = [];
  const rejected: any[] = [];
  const dayFields: Record<string, string> = {};
  const audit: any[] = [];

  for (const candidate of candidates) {
    const r: any = reviewMap.get(String(candidate.id));
    if (!r) throw new Error(`missing_review:${candidate.id}`);
    const decision = String(r.decision || '');
    if (!['confirm', 'correct', 'reject'].includes(decision)) throw new Error(`invalid_review:${candidate.id}`);

    if (decision === 'reject') {
      rejected.push({ ...candidate, decision: 'reject' });
      audit.push({ id: candidate.id, decision: 'reject' });
      continue;
    }

    const finalValue = decision === 'correct' ? clean(r.corrected_value, 700) : candidate.value;
    if (!finalValue) throw new Error(`empty_correction:${candidate.id}`);
    const row = { ...candidate, value: finalValue, original_value: candidate.value, decision };
    confirmed.push(row);
    dayFields[candidate.field] = finalValue;
    audit.push({ id: candidate.id, decision, corrected_value: decision === 'correct' ? finalValue : '' });
  }

  return { confirmed, rejected, dayFields, audit };
}

export function mergeResourceLibrary(existing: any[], candidates: any[], review: any[], dayNumber: number, nowIso: string) {
  const library = Array.isArray(existing) ? existing.map((x) => ({ ...x })) : [];
  const reviewMap = new Map((Array.isArray(review) ? review : []).map((r) => [String(r?.id), r]));
  const audit: any[] = [];

  const slug = (s: string) => clean(s, 500).toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

  for (const candidate of candidates) {
    const r: any = reviewMap.get(String(candidate.id));
    if (!r) throw new Error(`missing_resource_review:${candidate.id}`);
    const decision = String(r.decision || '');
    if (!['confirm', 'correct', 'reject'].includes(decision)) throw new Error(`invalid_resource_review:${candidate.id}`);
    if (decision === 'reject') {
      audit.push({ id: candidate.id, decision: 'reject' });
      continue;
    }

    const label = decision === 'correct' ? clean(r.corrected_label, 500) : candidate.label;
    if (!label) throw new Error(`empty_resource_correction:${candidate.id}`);
    const effect = ['helpful', 'neutral', 'not_helpful', 'avoid'].includes(r.effect) ? r.effect : candidate.proposed_effect;
    const key = slug(label);
    let item = library.find((x) => slug(x?.label || '') === key);
    if (!item) {
      item = {
        label,
        kind: candidate.kind || 'other',
        helpful_count: 0,
        neutral_count: 0,
        not_helpful_count: 0,
        avoid_count: 0,
        avoid: false,
        first_seen_day: dayNumber,
      };
      library.push(item);
    }
    item.label = label;
    item.kind = candidate.kind || item.kind || 'other';
    item.last_seen_day = dayNumber;
    item.last_seen_at = nowIso;
    if (effect === 'helpful') item.helpful_count = Number(item.helpful_count || 0) + 1;
    if (effect === 'neutral') item.neutral_count = Number(item.neutral_count || 0) + 1;
    if (effect === 'not_helpful') item.not_helpful_count = Number(item.not_helpful_count || 0) + 1;
    if (effect === 'avoid') {
      item.avoid_count = Number(item.avoid_count || 0) + 1;
      item.avoid = true;
    }
    item.last_effect = effect;
    audit.push({ id: candidate.id, decision, label, effect });
  }

  return { library: library.slice(-100), audit };
}
