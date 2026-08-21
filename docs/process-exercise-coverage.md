# ProcessExercise coverage map

Generated from the current `Term.latin_key` glossary and active `ProcessExercise.term_keys` library.

Two coverage measures matter:

- **usable by AI** = `ai_self_guided` + `conditional`; `live_specialist` is excluded.
- **total** = all active exercises, including professional-only material.

Current library: **74 active exercises**. Current glossary: **98 terms**, of which **75 have `latin_key`** and **23 still lack one**.

## AI-usable coverage buckets (75 keyed terms)

- **0 usable exercises — 31 terms**
- **1 usable exercise — 6 terms**
- **2 usable exercises — 12 terms**
- **3–4 usable exercises — 8 terms**
- **5+ usable exercises — 18 terms**

### 0 usable — priority gaps

`burning_wood`, `secondary_process_types`, `double_bind`, `dream_decoding`, `framing`, `coma`, `rainbow_medicine`, `consensus_reality`, `self_actualization_business`, `deep_democracy`, `social_rhythms`, `edge_figure_methods`, `empty_access`, `business_architecture`, `spiritual_warrior`, `inner_work`, `collective_dreambody`, `facilitation`, `symmetric_reactions`, `mythic_body`, `dream_maker`, `secondary_via_conversation`, `dreambody`, `process`, `process_work`, `world_dreambody`, `mainstream`, `marginalization`, `metaskills`, `worldwork`, `safety`.

Notes:
- `burning_wood` is intentionally **0 AI-usable** because its current exercises are live-specialist only.
- `coma` should remain outside the self-guided library.
- Several zero-coverage keys (`process_work`, `facilitation`, `consensus_reality`, `framing`, `metaskills`) are conceptual/therapist-facing and may not need a user exercise at all.
- The highest-value gaps for future Talvira exercises are therefore not all zero terms; prioritization should consider product relevance and safety.

### 1 usable exercise

`unmanifest`, `mythic_level`, `energy_u_x`, `vector_work`, `symptom_maker`, `process_mind`.

### 2 usable exercises

`unoccupied_channel`, `ghost_role`, `signal`, `spiritual_rank`, `social_rank`, `rank`, `geopsychology`, `primary_process`, `contextual_rank`, `dreaming_up`, `channel`, `double_signal`.

### 3–4 usable exercises

- `eldership` — 4
- `proprioceptive_channel` — 4
- `second_attention` — 4
- `leadership` — 3
- `life_myth` — 3
- `waking_dream` — 3
- `symptom` — 3
- `psychological_rank` — 4

### 5+ usable exercises

- `integration` — 59
- `body_signal` — 33
- `secondary_process` — 31
- `inner_figure` — 21
- `polarity` — 20
- `amplification` — 18
- `awareness` — 18
- `edge` — 15
- `personal_myth` — 13
- `metacommunicator` — 12
- `world_channel` — 11
- `essence_level` — 10
- `dreaming` — 9
- `visual_channel` — 9
- `field` — 7
- `auditory_channel` — 6
- `flirts` — 6
- `high_low_dream` — 6

## Terms currently missing `latin_key`

These cannot participate reliably in canonical exercise retrieval until the glossary is normalized:

1. Предсмертные состояния
2. Фактор двойного края
3. Трансформационный коучинг
4. Дверь в сновидение (Dream Door)
5. Горячие точки
6. Групповой процесс
7. Флирты
8. Территориальные сигналы
9. Трикстер
10. Сущностный уровень (Sentience)
11. Интегративный подход
12. Канал отношений
13. Политика третьей стороны
14. Целостный опыт
15. Принцип нелокальности
16. Измененные состояния сознания
17. Клоунада
18. Индивидуальность отношений
19. Субъектно-деятельностный подход
20. Экстремальные состояния
21. Текучесть
22. Планетарная психология
23. Дао отношений

## Recommended content priorities

### Priority A — product-relevant gaps
Create/adapt safe exercises for: `double_bind`, `dream_decoding`, `deep_democracy`, `empty_access`, `inner_work`, `dream_maker`, `secondary_via_conversation`, `dreambody`, `safety`.

### Priority B — thin coverage (1–2)
Strengthen: `unmanifest`, `mythic_level`, `energy_u_x`, `symptom_maker`, `process_mind`, `unoccupied_channel`, `ghost_role`, `signal`, `primary_process`, `dreaming_up`, `channel`, `double_signal`.

### Priority C — intentionally professional / conceptual
Do not chase exercise-count parity for `coma`, `burning_wood`, `worldwork`, `facilitation`, `framing`, business-only concepts, or other terms whose safe use is primarily professional/systemic.

The backend endpoint `getExerciseCoverageMap` recomputes this map dynamically and reports total vs AI-usable coverage so future library changes do not require manual recounting.
