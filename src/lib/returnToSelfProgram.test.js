import { describe, expect, it } from 'vitest';
import { RETURN_TO_SELF_DAYS, RETURN_TO_SELF_ENGINE_RULES, getReturnToSelfDay, validateReturnToSelfProgram } from './returnToSelfProgram';
import { RETURN_TO_SELF_DAYS as SERVER_DAYS, RETURN_TO_SELF_ENGINE_RULES as SERVER_RULES } from '../../base44/functions/generateEdgeProgramDay/methodology.ts';

describe('Return to Self 28-day methodology', () => {
  it('contains exactly days 1–28 once', () => {
    expect(validateReturnToSelfProgram()).toEqual({ valid: true, count: 28 });
  });

  it('has weekly integration and celebration on 7, 14, 21 and whole-path celebration on 27', () => {
    for (const day of [7, 14, 21, 27]) expect(getReturnToSelfDay(day)?.celebration).toBe(true);
  });

  it('day 24 is the positive emerging-process story, not another edge confrontation', () => {
    const day = getReturnToSelfDay(24);
    expect(day.key).toBe('positive_secondary_story');
    expect(day.steps.join(' ')).toContain('story');
    expect(day.steps.join(' ')).toContain('must not erase the emerging quality');
  });

  it('day 26 is adaptive', () => {
    expect(getReturnToSelfDay(26)?.adaptive).toBe(true);
  });

  it('keeps support distributed across the program', () => {
    const supported = RETURN_TO_SELF_DAYS.filter((x) => x.support).map((x) => x.day);
    expect(supported.length).toBeGreaterThanOrEqual(8);
    expect(supported).toContain(2);
    expect(supported).toContain(11);
    expect(supported).toContain(24);
  });

  it('keeps rollback and resource support available at all times', () => {
    expect(RETURN_TO_SELF_ENGINE_RULES.resourceProtocol.alwaysAvailable).toBe(true);
    expect(RETURN_TO_SELF_ENGINE_RULES.resourceProtocol.modes).toEqual(
      expect.arrayContaining(['rest_day', 'resource_day', 'soft_version', 'repeat_previous', 'pause_program'])
    );
    expect(RETURN_TO_SELF_ENGINE_RULES.resourceProtocol.starterExercises.length).toBeGreaterThanOrEqual(8);
    expect(RETURN_TO_SELF_ENGINE_RULES.safety.join(' ')).toContain('unconditional right to step back');
  });

  it('keeps backend generator methodology synchronized with the approved client contract', () => {
    expect(SERVER_DAYS).toEqual(RETURN_TO_SELF_DAYS);
    expect(SERVER_RULES).toEqual(RETURN_TO_SELF_ENGINE_RULES);
  });
});
