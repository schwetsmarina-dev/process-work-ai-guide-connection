import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const TEST_EMAIL = "test@processwork.app";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = base44.asServiceRole.entities;

    // Idempotency: skip if test user already exists
    const existing = await db.AppUser.filter({ email: TEST_EMAIL });
    if (existing.length > 0) {
      return Response.json({ status: 'skipped', message: 'Test user already exists', user_id: existing[0].id });
    }

    const now = new Date().toISOString();

    // 1. Test user
    const appUser = await db.AppUser.create({
      email: TEST_EMAIL,
      name: "Тестовый пользователь",
      language: "ru",
      onboarding_completed: true,
      consent_given: true,
      current_mode: "body",
      plan: "free",
      created_at: now,
      last_seen_at: now,
    });
    const userId = appUser.id;

    // 2. Three completed sessions
    const sessionsConfig = [
      {
        mode: "body",
        summary: "Пользователь исследовал напряжение в плечах. Обнаружил связь с подавленным желанием двигаться в новом направлении. Вторичный процесс проявился как образ птицы.",
        themes: ["телесный сигнал", "вторичный процесс", "движение"],
        signals: ["напряжение в плечах", "желание расправить крылья"],
        next_step_suggestion: "Исследовать образ птицы через движение",
        messages: [
          { role: "assistant", content: "Здравствуйте. Где в теле вы сейчас замечаете наибольшее напряжение?" },
          { role: "user", content: "В плечах, как будто на них что-то давит." },
          { role: "assistant", content: "Побудьте с этим давлением. Если бы плечи могли двигаться так, как им хочется — что бы они сделали?" },
          { role: "user", content: "Расправились бы. Как крылья." },
          { role: "assistant", content: "Образ птицы. Что эта птица хочет?" },
          { role: "user", content: "Лететь в новом направлении." },
        ],
      },
      {
        mode: "conflict",
        summary: "Работа с внутренним конфликтом между потребностью в безопасности и желанием перемен. Край проявился как страх потерять стабильность.",
        themes: ["внутренний конфликт", "край", "безопасность"],
        signals: ["сжатие в груди", "прерывистое дыхание"],
        next_step_suggestion: "Исследовать фигуру, которая хочет перемен",
        messages: [
          { role: "assistant", content: "Расскажите о конфликте, который вы сейчас переживаете." },
          { role: "user", content: "Часть меня хочет перемен, а другая боится всё потерять." },
          { role: "assistant", content: "Что происходит в теле, когда вы говорите о страхе потерять стабильность?" },
          { role: "user", content: "Сжимается в груди, дыхание становится прерывистым." },
          { role: "assistant", content: "Это похоже на край. Что та часть, которая хочет перемен, пытается вам сказать?" },
          { role: "user", content: "Что так больше нельзя, нужно двигаться дальше." },
        ],
      },
      {
        mode: "dream",
        summary: "Анализ сна про лабиринт. Фигура проводника оказалась частью самого пользователя — внутренним знанием пути.",
        themes: ["сновидение", "проводник", "внутренняя мудрость"],
        signals: ["ощущение потерянности", "внезапное спокойствие"],
        next_step_suggestion: "Диалог с фигурой проводника в следующей сессии",
        messages: [
          { role: "assistant", content: "Расскажите сон, который вы хотите исследовать." },
          { role: "user", content: "Я блуждал по лабиринту и не мог найти выход." },
          { role: "assistant", content: "Что вы чувствовали в этом лабиринте?" },
          { role: "user", content: "Потерянность. Но потом появился проводник, и стало спокойно." },
          { role: "assistant", content: "Если бы этот проводник был частью вас — какой частью?" },
          { role: "user", content: "Тем, кто на самом деле знает путь." },
        ],
      },
    ];

    const createdSessions = [];
    for (const cfg of sessionsConfig) {
      const session = await db.Session.create({
        user_id: userId,
        mode_id: cfg.mode,
        mode: cfg.mode,
        status: "completed",
        current_step: 1,
        started_at: now,
        ended_at: now,
        summary: cfg.summary,
        themes: cfg.themes,
        signals: cfg.signals,
        next_step_suggestion: cfg.next_step_suggestion,
      });
      createdSessions.push(session.id);

      // 4. Messages per session
      let stepNum = 1;
      for (const m of cfg.messages) {
        await db.Message.create({
          session_id: session.id,
          user_id: userId,
          mode_id: cfg.mode,
          step_number: stepNum,
          role: m.role,
          content: m.content,
          created_at: now,
        });
        if (m.role === "user") stepNum++;
      }
    }

    // 3. User memory
    const memories = [
      { memory_key: "primary_theme", memory_value: "трансформация и движение", importance: "high" },
      { memory_key: "recurring_signal", memory_value: "напряжение в плечах и груди", importance: "high" },
      { memory_key: "edge_pattern", memory_value: "страх потерять стабильность при желании перемен", importance: "high" },
      { memory_key: "dream_figure", memory_value: "внутренний проводник", importance: "medium" },
      { memory_key: "progress", memory_value: "учится слышать вторичный процесс через тело", importance: "medium" },
    ];
    for (const mem of memories) {
      await db.UserMemory.create({
        user_id: userId,
        memory_type: "insight",
        memory_key: mem.memory_key,
        memory_value: mem.memory_value,
        importance: mem.importance,
        is_active: true,
        created_at: now,
        updated_at: now,
      });
    }

    return Response.json({
      status: 'created',
      user_id: userId,
      sessions: createdSessions,
      memories: memories.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});