import { describe, expect, it } from 'vitest';
import {
  decideProgression,
  normalizeObservationCandidates,
  normalizeResourceCandidates,
  applyObservationReview,
  mergeResourceLibrary,
} from '../../base44/functions/completeEdgeProgramDay/completionRules.ts';

describe('Return to Self day completion rules', () => {
  it('advances one day only when no safety guard or user rollback choice blocks it', () => {
    expect(decideProgression({ dayNumber: 10 })).toMatchObject({ decision: 'advance', nextDay: 11 });
    expect(decideProgression({ dayNumber: 10, feltOverwhelmed: true })).toMatchObject({ decision: 'resource', nextDay: 10 });
    expect(decideProgression({ dayNumber: 10, feltDissociated: true })).toMatchObject({ decision: 'pause', nextDay: 10 });
    expect(decideProgression({ dayNumber: 10, unresolvedHighRisk: true })).toMatchObject({ decision: 'stop', nextDay: 10 });
    expect(decideProgression({ dayNumber: 10, userChoice: 'repeat' })).toMatchObject({ decision: 'repeat', nextDay: 10 });
  });

  it('does not let a user choice override a stronger safety guard', () => {
    expect(decideProgression({ dayNumber: 4, feltOverwhelmed: true, userChoice: 'advance' })).toMatchObject({ decision: 'resource' });
    expect(decideProgression({ dayNumber: 4, safetyState: 'stop', userChoice: 'advance' })).toMatchObject({ decision: 'stop' });
  });

  it('requires explicit review for every AI observation and stores corrections instead of AI guesses', () => {
    const candidates = normalizeObservationCandidates([
      { field: 'signal', value: 'AI guess', evidence: 'something happened' },
      { field: 'emerging_quality', value: 'more direct', evidence: 'said no' },
    ]);
    expect(() => applyObservationReview(candidates, [{ id: candidates[0].id, decision: 'confirm' }])).toThrow(/missing_review/);

    const reviewed = applyObservationReview(candidates, [
      { id: candidates[0].id, decision: 'correct', corrected_value: 'my actual signal' },
      { id: candidates[1].id, decision: 'reject' },
    ]);
    expect(reviewed.dayFields.signal).toBe('my actual signal');
    expect(reviewed.dayFields.emerging_quality).toBeUndefined();
    expect(reviewed.confirmed[0].value).toBe('my actual signal');
    expect(reviewed.rejected).toHaveLength(1);
  });

  it('ignores unsupported observation fields', () => {
    const candidates = normalizeObservationCandidates([
      { field: 'diagnosis', value: 'unsupported' },
      { field: 'signal', value: 'tight shoulders' },
    ]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].field).toBe('signal');
  });

  it('updates resource library only after explicit review and remembers avoid feedback', () => {
    const resources = normalizeResourceCandidates([
      { label: 'sunlight by the window', kind: 'sensory', proposed_effect: 'helpful' },
      { label: 'breath counting', kind: 'breathing', proposed_effect: 'helpful' },
    ]);
    const merged = mergeResourceLibrary([], resources, [
      { id: resources[0].id, decision: 'confirm', effect: 'helpful' },
      { id: resources[1].id, decision: 'confirm', effect: 'avoid' },
    ], 6, '2026-08-20T10:00:00.000Z');

    expect(merged.library.find((x) => x.label === 'sunlight by the window')?.helpful_count).toBe(1);
    const avoided = merged.library.find((x) => x.label === 'breath counting');
    expect(avoided?.avoid).toBe(true);
    expect(avoided?.avoid_count).toBe(1);
  });

  it('finishes day 28 without creating day 29', () => {
    expect(decideProgression({ dayNumber: 28 })).toEqual({ decision: 'advance', reason: 'program_complete', nextDay: 28 });
  });
});
