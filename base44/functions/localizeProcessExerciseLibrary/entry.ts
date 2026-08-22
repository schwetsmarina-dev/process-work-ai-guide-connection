import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const BATCH_SIZE = 18;

function clean(v: unknown) {
  return String(v || '').trim();
}

function eligible(row: any) {
  return row?.active !== false
    && clean(row?.author)
    && row?.requires_live_facilitator !== true
    && row?.delivery_level !== 'live_specialist'
    && row?.intensity !== 'high';
}

function alreadyLocalized(row: any) {
  return clean(row?.title_es)
    && clean(row?.purpose_es)
    && Array.isArray(row?.steps_es)
    && row.steps_es.length === (Array.isArray(row?.steps) ? row.steps.length : 0)
    && row.steps_es.every((x: unknown) => clean(x));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const entitlementRes = await base44.functions.invoke('getEntitlement', {}).catch(() => null);
    const entitlement = entitlementRes?.data || entitlementRes;
    if (caller.role !== 'admin' && !entitlement?.hasAccess) {
      return Response.json({ error: 'feature_requires_full_access' }, { status: 403 });
    }

    const rows = await base44.asServiceRole.entities.ProcessExercise.list('exercise_id', 500);
    const missing = rows.filter(eligible).filter((x: any) => !alreadyLocalized(x));
    if (!missing.length) {
      return Response.json({ ok: true, translated: 0, remaining: 0, complete: true });
    }

    let translated = 0;
    for (let offset = 0; offset < missing.length; offset += BATCH_SIZE) {
      const batch = missing.slice(offset, offset + BATCH_SIZE);
      const payload = batch.map((x: any) => ({
        exercise_id: x.exercise_id,
        title_ru: x.title_ru,
        purpose_ru: x.purpose,
        steps_ru: Array.isArray(x.steps) ? x.steps : [],
      }));

      const prompt = `Translate the following Process Work exercise library records from Russian into natural professional Spanish used in Spain. Talvira addresses the user with tú.\n\nSTRICT RULES:\n- Translate ONLY title_ru, purpose_ru and every item of steps_ru.\n- Preserve the exact psychological/process-work meaning, order, intensity and methodological framing. Do not simplify, reinterpret, add warnings, remove claims, soften concepts or insert your own clinical commentary.\n- Do not translate or modify exercise_id.\n- Keep terminology consistent across exercises. Prefer natural Spanish such as proceso primario/secundario, borde, figura interna, señal corporal, amplificación, canal, polaridad, esencia, mente procesual, democracia profunda when those concepts are present.\n- The number and order of steps_es MUST exactly match steps_ru.\n- Return only JSON matching the schema.\n\nRECORDS:\n${JSON.stringify(payload)}`;

      const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          required: ['items'],
          properties: {
            items: {
              type: 'array',
              minItems: batch.length,
              maxItems: batch.length,
              items: {
                type: 'object',
                required: ['exercise_id', 'title_es', 'purpose_es', 'steps_es'],
                properties: {
                  exercise_id: { type: 'string' },
                  title_es: { type: 'string' },
                  purpose_es: { type: 'string' },
                  steps_es: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
      });

      const items = Array.isArray(llm?.items) ? llm.items : [];
      const byId = new Map(batch.map((x: any) => [x.exercise_id, x]));
      for (const item of items) {
        const original: any = byId.get(clean(item?.exercise_id));
        if (!original) continue;
        const stepsEs = Array.isArray(item?.steps_es) ? item.steps_es.map(clean).filter(Boolean) : [];
        if (!clean(item?.title_es) || !clean(item?.purpose_es) || stepsEs.length !== (original.steps || []).length) {
          console.warn('[localizeProcessExerciseLibrary] invalid translated item', original.exercise_id);
          continue;
        }
        await base44.asServiceRole.entities.ProcessExercise.update(original.id, {
          title_es: clean(item.title_es),
          purpose_es: clean(item.purpose_es),
          steps_es: stepsEs,
        });
        translated += 1;
      }
    }

    const latest = await base44.asServiceRole.entities.ProcessExercise.list('exercise_id', 500);
    const remaining = latest.filter(eligible).filter((x: any) => !alreadyLocalized(x)).length;
    return Response.json({ ok: true, translated, remaining, complete: remaining === 0 });
  } catch (error) {
    console.error('[localizeProcessExerciseLibrary] fatal:', error?.message, String(error));
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
});