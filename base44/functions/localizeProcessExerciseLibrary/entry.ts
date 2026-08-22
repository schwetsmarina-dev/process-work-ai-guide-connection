import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const BATCH_SIZE = 18;

function clean(v: unknown) {
  return String(v || '').trim();
}

function hasNamedAuthor(value: unknown) {
  const s = clean(value);
  if (!s) return false;
  const genericOnly = /^(process work учебная практика|ispwr training materials|ispwr\s*\/\s*сертификационные материалы|ispwr\s*\/\s*talvira adaptation|talvira methodology synthesis|ispwr trauma\/resource materials\s*\/\s*talvira adaptation)$/i;
  return !genericOnly.test(s);
}

function eligible(row: any) {
  return row?.active !== false
    && hasNamedAuthor(row?.author)
    && row?.requires_live_facilitator !== true
    && row?.delivery_level !== 'live_specialist'
    && row?.intensity !== 'high';
}

function localizedArrayMatches(source: unknown, translated: unknown) {
  const src = Array.isArray(source) ? source : [];
  const out = Array.isArray(translated) ? translated : [];
  return src.length === 0 || (out.length === src.length && out.every((x: unknown) => clean(x)));
}

function alreadyLocalized(row: any) {
  return clean(row?.title_es)
    && clean(row?.purpose_es)
    && Array.isArray(row?.steps_es)
    && row.steps_es.length === (Array.isArray(row?.steps) ? row.steps.length : 0)
    && row.steps_es.every((x: unknown) => clean(x))
    && localizedArrayMatches(row?.search_tags, row?.search_tags_es)
    && localizedArrayMatches(row?.delivery_conditions, row?.delivery_conditions_es)
    && localizedArrayMatches(row?.exclude_if, row?.exclude_if_es)
    && localizedArrayMatches(row?.contraindications, row?.contraindications_es);
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
        search_tags_ru: Array.isArray(x.search_tags) ? x.search_tags : [],
        delivery_conditions_ru: Array.isArray(x.delivery_conditions) ? x.delivery_conditions : [],
        exclude_if_ru: Array.isArray(x.exclude_if) ? x.exclude_if : [],
        contraindications_ru: Array.isArray(x.contraindications) ? x.contraindications : [],
      }));

      const prompt = `Translate the following Process Work exercise library records from Russian into natural professional Spanish used in Spain. Talvira addresses the user with tú.\n\nSTRICT RULES:\n- Translate title_ru, purpose_ru, every item of steps_ru, search_tags_ru, delivery_conditions_ru, exclude_if_ru and contraindications_ru.\n- Preserve the exact psychological/process-work meaning, order, intensity and methodological framing. Do not simplify, reinterpret, add warnings, remove claims, soften concepts or insert your own clinical commentary.\n- Do not translate or modify exercise_id.\n- Keep terminology consistent across exercises. Prefer natural Spanish such as proceso primario/secundario, borde, figura interna, señal corporal, amplificación, canal, polaridad, esencia, mente procesual, democracia profunda when those concepts are present.\n- The number and order of steps_es MUST exactly match steps_ru. Each translated metadata array MUST exactly match the source array length and order.\n- search_tags_es must use natural Spanish search terms rather than transliteration when a real Spanish equivalent exists.\n- Return only JSON matching the schema.\n\nRECORDS:\n${JSON.stringify(payload)}`;

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
                required: ['exercise_id', 'title_es', 'purpose_es', 'steps_es', 'search_tags_es', 'delivery_conditions_es', 'exclude_if_es', 'contraindications_es'],
                properties: {
                  exercise_id: { type: 'string' },
                  title_es: { type: 'string' },
                  purpose_es: { type: 'string' },
                  steps_es: { type: 'array', items: { type: 'string' } },
                  search_tags_es: { type: 'array', items: { type: 'string' } },
                  delivery_conditions_es: { type: 'array', items: { type: 'string' } },
                  exclude_if_es: { type: 'array', items: { type: 'string' } },
                  contraindications_es: { type: 'array', items: { type: 'string' } },
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
        const tagsEs = Array.isArray(item?.search_tags_es) ? item.search_tags_es.map(clean).filter(Boolean) : [];
        const conditionsEs = Array.isArray(item?.delivery_conditions_es) ? item.delivery_conditions_es.map(clean).filter(Boolean) : [];
        const excludeEs = Array.isArray(item?.exclude_if_es) ? item.exclude_if_es.map(clean).filter(Boolean) : [];
        const contraindicationsEs = Array.isArray(item?.contraindications_es) ? item.contraindications_es.map(clean).filter(Boolean) : [];
        const sameLength = (a: unknown, b: unknown[]) => (Array.isArray(a) ? a.length : 0) === b.length;
        if (!clean(item?.title_es) || !clean(item?.purpose_es)
          || !sameLength(original.steps, stepsEs)
          || !sameLength(original.search_tags, tagsEs)
          || !sameLength(original.delivery_conditions, conditionsEs)
          || !sameLength(original.exclude_if, excludeEs)
          || !sameLength(original.contraindications, contraindicationsEs)) {
          console.warn('[localizeProcessExerciseLibrary] invalid translated item', original.exercise_id);
          continue;
        }
        await base44.asServiceRole.entities.ProcessExercise.update(original.id, {
          title_es: clean(item.title_es),
          purpose_es: clean(item.purpose_es),
          steps_es: stepsEs,
          search_tags_es: tagsEs,
          delivery_conditions_es: conditionsEs,
          exclude_if_es: excludeEs,
          contraindications_es: contraindicationsEs,
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