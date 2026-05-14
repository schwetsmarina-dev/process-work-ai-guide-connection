import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// New process_mapping first steps for each mode
const NEW_FIRST_STEPS = {
  body: {
    mode_id: "body",
    step_number: 1,
    step_key: "body_1",
    goal: "process mapping / primary-secondary orientation",
    question: "Перед тем как идти глубже в телесное ощущение, давай чуть сориентируемся. Что для тебя уже понятно про этот симптом или напряжение, а что в нём кажется странным, новым или непривычным?",
    facilitator_hint: "Собери консенсусный контекст: привычное объяснение, медицинский/бытовой смысл, известный стрессор. Затем мягко найди вторичный сигнал: странное качество, необычное движение, непонятная энергия, притяжение или край.",
    next_step_on_answer: 2,
    response_type: "text",
    is_required: true,
    related_term_ids: "primary_process; secondary_process; edge; consensus_reality; body_signal",
  },
  dream: {
    mode_id: "dream",
    step_number: 1,
    step_key: "dream_1",
    goal: "process mapping / primary-secondary orientation",
    question: "Перед тем как разворачивать сон, давай сначала наметим карту. Что в этом сне тебе кажется более знакомым и понятным, а что — самым странным, новым или притягивающим?",
    facilitator_hint: "Помоги пользователю отделить более первичный материал — знакомое, понятное, близкое к идентичности — от вторичного: странного, заряженного, неожиданного, сновидческого. Не интерпретируй. Спроси, куда есть больше живости.",
    next_step_on_answer: 2,
    response_type: "text",
    is_required: true,
    related_term_ids: "primary_process; secondary_process; dream; edge; consensus_reality",
  },
  conflict: {
    mode_id: "conflict",
    step_number: 1,
    step_key: "conflict_1",
    goal: "process mapping / primary-secondary orientation",
    question: "Перед тем как разбирать конфликт, давай сначала увидим карту. Какая сторона в тебе более привычная и знакомая, а какая — новая, менее привычная или труднее принимается?",
    facilitator_hint: "Помоги обозначить две стороны. Не делай одну правильной, другую неправильной. Определи, какая часть ближе к первичному процессу, а какая несёт вторичный материал, край, новое поведение или непривычную энергию.",
    next_step_on_answer: 2,
    response_type: "text",
    is_required: true,
    related_term_ids: "polarity; primary_process; secondary_process; edge; conflict",
  },
  journaling: {
    mode_id: "journaling",
    step_number: 1,
    step_key: "journaling_1",
    goal: "process mapping / primary-secondary orientation",
    question: "Перед тем как идти глубже, давай чуть сориентируемся. Что в твоей ситуации сейчас уже понятно и привычно, а что ощущается новым, странным, живым или не до конца ясным?",
    facilitator_hint: "Собери первичный консенсусный контекст и отметь возможный вторичный сигнал. Пользователь может начать с мысли, чувства, образа, тела или конфликта. Цель — не анализ, а карта поля.",
    next_step_on_answer: 2,
    response_type: "text",
    is_required: true,
    related_term_ids: "primary_process; secondary_process; signal; edge; process",
  },
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  const modes = Object.keys(NEW_FIRST_STEPS);
  const report = {};

  for (const modeId of modes) {
    report[modeId] = { shifted: 0, inserted: false, skipped: false, duplicatesRemoved: 0, errors: [] };

    // 1. Fetch ALL existing steps for this mode
    const existing = await base44.asServiceRole.entities.ModeStep.filter({ mode_id: modeId });
    console.log(`[PATCH] ${modeId}: found ${existing.length} existing steps`);

    // 2. Detect and remove duplicate step_keys (keep the one with lowest step_number)
    const keyMap = {};
    for (const s of existing) {
      if (!s.step_key) continue;
      if (!keyMap[s.step_key]) {
        keyMap[s.step_key] = s;
      } else {
        // Duplicate: delete the newer one (higher step_number or later created)
        const prev = keyMap[s.step_key];
        const toDelete = (s.step_number || 0) >= (prev.step_number || 0) ? s : prev;
        if (toDelete === prev) keyMap[s.step_key] = s;
        try {
          await base44.asServiceRole.entities.ModeStep.delete(toDelete.id);
          report[modeId].duplicatesRemoved++;
          console.log(`[PATCH] ${modeId}: removed duplicate step_key="${toDelete.step_key}" id=${toDelete.id}`);
        } catch (e) {
          report[modeId].errors.push(`delete dup ${toDelete.id}: ${e.message}`);
        }
      }
    }

    // Re-fetch after dedup
    const fresh = await base44.asServiceRole.entities.ModeStep.filter({ mode_id: modeId });

    // 3. Check if process_mapping step already exists at step_number=1 with correct key
    const existingFirst = fresh.find(s => s.step_key === `${modeId}_1`);
    if (existingFirst && existingFirst.goal && existingFirst.goal.includes("process mapping")) {
      console.log(`[PATCH] ${modeId}: process_mapping step already exists, skipping`);
      report[modeId].skipped = true;
      continue;
    }

    // 4. Shift all existing steps: step_number += 1, update step_key
    // Sort descending to avoid key collisions while updating
    const sorted = [...fresh].sort((a, b) => (b.step_number || 0) - (a.step_number || 0));
    for (const step of sorted) {
      const oldNum = Number(step.step_number) || 1;
      const newNum = oldNum + 1;
      const newKey = `${modeId}_${newNum}`;
      const oldNextAnswer = step.next_step_on_answer ? Number(step.next_step_on_answer) + 1 : null;
      const oldNextSkip = step.next_step_on_skip ? Number(step.next_step_on_skip) + 1 : null;
      try {
        await base44.asServiceRole.entities.ModeStep.update(step.id, {
          step_number: newNum,
          step_key: newKey,
          ...(oldNextAnswer ? { next_step_on_answer: oldNextAnswer } : {}),
          ...(oldNextSkip ? { next_step_on_skip: oldNextSkip } : {}),
        });
        report[modeId].shifted++;
        console.log(`[PATCH] ${modeId}: shifted step ${oldNum} → ${newNum} (${step.step_key} → ${newKey})`);
      } catch (e) {
        report[modeId].errors.push(`shift step ${step.id}: ${e.message}`);
      }
    }

    // 5. Insert the new process_mapping first step
    try {
      await base44.asServiceRole.entities.ModeStep.create(NEW_FIRST_STEPS[modeId]);
      report[modeId].inserted = true;
      console.log(`[PATCH] ${modeId}: inserted new ${modeId}_1 process_mapping step`);
    } catch (e) {
      report[modeId].errors.push(`insert ${modeId}_1: ${e.message}`);
    }
  }

  return Response.json({ success: true, report });
});