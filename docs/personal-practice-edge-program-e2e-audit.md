# Talvira — end-to-end audit: Personal Process Practice + 28-day program

Audit focus: real client journey, not only unit tests.

## Client path now

1. User completes ordinary Talvira sessions.
2. After at least 3 completed sessions, `checkProcessPracticeReadiness` evaluates recurring material from completed sessions only.
3. When confidence reaches threshold, dashboard offers Personal Process Practice.
4. `generateProcessPractice` builds a 7-step Process Work practice, selecting 0–2 eligible ProcessExercise records via canonical term keys. High/live-only exercises are excluded.
5. Practice is persisted with source session IDs and used exercise IDs; dashboard shows text, methodological attribution when available, and ElevenLabs audio controls.
6. After at least 5 completed sessions + a real Personal Process Practice, the 28-day offer appears.
7. Screening may return proceed / caution / stop.
8. Proceed opens `/edge-program`. Caution creates/keeps a paused program, allows resource/rest only, and can be re-screened later instead of becoming a dead end.
9. Each standard day starts with distress check-in, is generated from approved day methodology + confirmed prior program memory + eligible exercise library.
10. User performs the day, writes reflection, reports after-intensity / overwhelm / dissociation.
11. `completeEdgeProgramDay` analyze phase returns hypotheses and resource candidates only. Nothing enters confirmed memory yet.
12. Client explicitly confirms, corrects or rejects every observation/resource candidate.
13. Finalize updates day + program, resource library and progression decision. Safety overrides advancement.
14. User can continue, repeat previous day, choose resource day, pause or stop. Pause is also available before/during a day via `updateEdgeProgramState`; normal pause can be resumed, caution pause requires re-screening.
15. Pending generated or awaiting-review days are restored after reload via persisted `generated_content`; a refresh no longer destroys the client’s place/review state.
16. Day 28 completes the program.

## Critical issues found and fixed in this audit

- The monthly backend existed but there was no client page/route consuming it. Added `/edge-program` and full day UI.
- Screening success previously ended in a dialog with no route into the program. Added open/continue program CTAs.
- Existing active/paused program disappeared from dashboard. Dashboard now exposes continue/rescreen state.
- A caution screening could become a permanent dead end. Caution program can now be re-screened and updated in place.
- Deep program generation was possible while paused for caution. Now only resource/rest is allowed until re-screening.
- Pause was described methodologically but not actionable in the client UI. Added immediate pause/resume backend + UI.
- Pending day/review state was lost on reload. Added persisted `generated_content` and hydration of incomplete EdgeProgramDay.
- `distress_before` existed in progression logic but was not persisted by day generation. It is now saved.
- ProcessExercise retrieval was capped at 100 despite a growing library. Personal Practice and Edge Program now query up to 500 active exercises.
- `exercise_ids` were written by generators but missing from ProcessPractice / EdgeProgramDay schemas. Added fields to both schemas, making attribution and auditability real.
- Methodological source/author can now be shown for exercises actually used.
- LifeProcessMap used incomplete sessions when calculating Personal Practice readiness. Readiness/generation now request completed sessions only.
- Personal Practice and program day 4 were aligned with the project’s Process Work rule: a prohibiting/edge figure is approached as meaningful and potentially carrying useful quality/force/need/message, with movement toward the secondary/resource quality rather than negative dramatization.

## Safety/progression chain verified

- unresolved high/critical risk => blocks/stop
- reported dissociation => pause
- overwhelm => resource mode
- distress after >= 8 => resource mode
- distress increase >= 2 while after >= 7 => resource mode
- only after safety checks does user progression choice apply
- observations/resources remain candidates until explicit review
- rejected AI observations are retained in rejection history to avoid reasserting them casually
- program/day finalization uses guarded two-stage update plus compensating rollback

## Remaining product gaps (not blockers for the basic chain)

1. **Ready-made exercise library for clients**: ProcessExercise is currently used internally by generators. There is not yet a dedicated user-facing catalog where a client can choose an author practice “as is”.
2. **Audio inside the 28-day program / ready-made library**: ElevenLabs audio exists for ProcessPractice only. EdgeProgramDay and direct ProcessExercise playback do not yet have their own TTS pipeline.
3. **Resource/rest usage history**: resource/rest modes work and do not advance the program, but `rest_days_taken` / `resource_days_taken` are not yet incremented and support-only uses are not logged as separate records.
4. **Spanish-ready direct exercise texts**: internal generator localizes exercises through the LLM, but a future direct “as-is” exercise library needs localized stored scripts or an approved translation layer.
5. **True browser E2E with a disposable client account**: static code path, schemas, build and logic were audited; a scripted real-account run through 3 sessions → practice → 5 sessions → screening → days 1/2 → pause/reload would be the final pre-release QA layer.

## Verification

After the fixes: 14 test files, 103/103 tests passed; production Vite build passed.
