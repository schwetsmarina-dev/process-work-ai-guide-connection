import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function arr(value: unknown): string[] {
  return Array.isArray(value) ? value.map((x) => String(x || '').trim()).filter(Boolean) : [];
}

function bucket(count: number): '0' | '1' | '2' | '3-4' | '5+' {
  if (count <= 0) return '0';
  if (count === 1) return '1';
  if (count === 2) return '2';
  if (count <= 4) return '3-4';
  return '5+';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Not authenticated' }, { status: 401 });
    if (caller.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const [terms, exercises] = await Promise.all([
      base44.asServiceRole.entities.Term.filter({}, 'latin_key', 500),
      base44.asServiceRole.entities.ProcessExercise.filter({ active: true }, 'exercise_id', 500),
    ]);

    const keyedTerms = terms.filter((term: any) => String(term.latin_key || '').trim());
    const missingLatinKey = terms.filter((term: any) => !String(term.latin_key || '').trim());

    const totalCount = new Map<string, number>();
    const usableCount = new Map<string, number>();
    const selfGuidedCount = new Map<string, number>();
    const conditionalCount = new Map<string, number>();
    const liveCount = new Map<string, number>();
    const exerciseIds = new Map<string, string[]>();

    for (const exercise of exercises as any[]) {
      const level = String(exercise.delivery_level || 'conditional');
      const keys = [...new Set(arr(exercise.term_keys))];
      for (const key of keys) {
        totalCount.set(key, (totalCount.get(key) || 0) + 1);
        if (!exerciseIds.has(key)) exerciseIds.set(key, []);
        exerciseIds.get(key)!.push(String(exercise.exercise_id || ''));
        if (level === 'ai_self_guided') {
          selfGuidedCount.set(key, (selfGuidedCount.get(key) || 0) + 1);
          usableCount.set(key, (usableCount.get(key) || 0) + 1);
        } else if (level === 'live_specialist') {
          liveCount.set(key, (liveCount.get(key) || 0) + 1);
        } else {
          conditionalCount.set(key, (conditionalCount.get(key) || 0) + 1);
          usableCount.set(key, (usableCount.get(key) || 0) + 1);
        }
      }
    }

    const coverage = keyedTerms.map((term: any) => {
      const key = String(term.latin_key).trim();
      const total = totalCount.get(key) || 0;
      const usable = usableCount.get(key) || 0;
      return {
        latin_key: key,
        term_id: term.term_id || '',
        term: term.term || '',
        total_exercises: total,
        usable_by_ai: usable,
        ai_self_guided: selfGuidedCount.get(key) || 0,
        conditional: conditionalCount.get(key) || 0,
        live_specialist: liveCount.get(key) || 0,
        bucket_total: bucket(total),
        bucket_usable: bucket(usable),
        exercise_ids: exerciseIds.get(key) || [],
      };
    }).sort((a: any, b: any) => a.usable_by_ai - b.usable_by_ai || a.total_exercises - b.total_exercises || a.latin_key.localeCompare(b.latin_key));

    const summary = {
      terms_total: terms.length,
      terms_with_latin_key: keyedTerms.length,
      terms_missing_latin_key: missingLatinKey.length,
      active_exercises: exercises.length,
      usable_coverage: {
        zero: coverage.filter((x: any) => x.usable_by_ai === 0).length,
        one: coverage.filter((x: any) => x.usable_by_ai === 1).length,
        two: coverage.filter((x: any) => x.usable_by_ai === 2).length,
        three_to_four: coverage.filter((x: any) => x.usable_by_ai >= 3 && x.usable_by_ai <= 4).length,
        five_plus: coverage.filter((x: any) => x.usable_by_ai >= 5).length,
      },
      total_coverage: {
        zero: coverage.filter((x: any) => x.total_exercises === 0).length,
        one: coverage.filter((x: any) => x.total_exercises === 1).length,
        two: coverage.filter((x: any) => x.total_exercises === 2).length,
        three_to_four: coverage.filter((x: any) => x.total_exercises >= 3 && x.total_exercises <= 4).length,
        five_plus: coverage.filter((x: any) => x.total_exercises >= 5).length,
      },
    };

    return Response.json({
      summary,
      coverage,
      terms_missing_latin_key: missingLatinKey.map((term: any) => ({ term_id: term.term_id || '', term: term.term || '' })),
    });
  } catch (error) {
    console.error('[getExerciseCoverageMap]', error);
    return Response.json({ error: 'coverage_map_failed' }, { status: 500 });
  }
});
