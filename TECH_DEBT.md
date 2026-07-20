# Technical Debt Register

A triaged, honest backlog of known issues and deferred refactors. Kept current
so anyone (a new engineer, a technical investor doing due diligence) can see what
we know and how we've prioritized it. Priorities: **P1** = do before scaling /
before it bites users; **P2** = important, schedule deliberately; **P3** = nice
to have.

Guiding principle: the app is **live with beta testers**. Changes to the working
core are made in small, checkpointed steps with runtime testing — never rushed.

---

## P1 — before scale / payments go live

### 1. Standardize record ownership fields
Ownership is expressed inconsistently across entities: `created_by` (email),
`created_by_id`, and `user_id`. Backend functions currently bridge this by hand
(e.g. `createSessionMessage` checks `created_by` by email; `persistSessionMemory`
uses `created_by_id`).
- **Risk if untouched:** access/RLS bugs as data volume and user count grow.
- **Why deferred:** this is a **live-data migration** — mishandling it causes
  access bugs or data loss. Must be done with a backup, a staging dry-run, and a
  backfill plan, not inline on production.
- **Target:** pick one canonical owner reference (recommend `created_by_id`),
  add it everywhere, backfill, then update RLS + functions, then retire the rest.

### 2. Move admin identity to role-based only
A personal admin email (`schwets.marina@gmail.com`) is hardcoded in client code
in 4 files (`App.jsx`, `AppLayout.jsx`, `Dashboard.jsx`, `SessionSummary.jsx`).
- **Risk:** brittle (breaks if the email changes), can't add admins cleanly, and
  ships an identity in the client bundle.
- **Target:** gate all admin UI on `user.role === "admin"` only; remove the
  hardcoded email. Verify no lockout before removing.

## P2 — maintainability / due-diligence readiness

### 3. Decompose the facilitator engine (monoliths)
Large, densely interdependent files:
`src/lib/sessionAI.js` (~1540 lines), `src/lib/systemPrompt.js` (~784),
`src/pages/SessionChat.jsx` (~853), `src/lib/sessionValidation.js` (~672).
- **Risk if untouched:** hard to maintain, onboard, and evolve; higher chance of
  regressions when editing the core.
- **Why deferred:** `getAIResponse` and its stage/layer detection helpers are
  tightly coupled; a split must preserve exact behavior and be validated with
  **real session runs**, ideally on staging. Build + lint alone don't prove
  behavioral equivalence for the facilitation logic.
- **Suggested split:** `session/crisis.js` (crisis + distress detection),
  `session/steps.js` (`fetchStep`, term lookup), `session/stageDetection.js`
  (all `detect*` helpers + layer signals), `session/promptBuilder.js` (prompt
  instruction blocks), `session/facilitator.js` (`getAIResponse` orchestration),
  `session/summary.js`. Keep `sessionAI.js` as a thin re-export barrel so
  existing imports keep working.

### 4. Add automated tests + error tracking + product analytics
No test runner; no error monitoring (e.g. Sentry); no product analytics.
- **Target:** smoke tests on critical paths (session turn loop, crisis
  detection, step-back, and — once built — payment webhook); error tracking in
  production; privacy-respecting product analytics (funnels, retention) — the
  metrics investors ask for.

### 5. Verify scheduled/maintenance functions
`abandonStaleSessions` (invoked on auth — OK), `dedupeActiveSessions` (no code
references — confirm it is a Base44 scheduled automation, else remove),
`patchProcessMappingSteps` (admin-triggered one-off via `AdminDataStatus` — keep
until confirmed applied, then remove with its admin button).

## P3 — polish

### 6. Replace ad-hoc logging with a leveled logger
~57 `console.log` calls in `src/`. Fine for beta; for production route through a
small logger with levels so prod stays quiet and errors are captured.

### 7. Dev/diagnostic components
`StepErrorDebug`, `RlsDiagnostic`, `SessionNotFoundDiagnostic` are currently
**admin-gated** (safe), but exist for debugging. Long term, hide behind an
explicit dev flag or remove for production.

---

## Recently resolved
- Removed unused dev/one-off backend functions: `createTestData`,
  `backfillInsightUserId`, `backfillSessionUserId`, `migrateTermKeys`
  (20 → 16 functions). Removed the test-data factory from the deployed surface.
- Added real project docs: `README.md`, `ARCHITECTURE.md`, `SECURITY.md`,
  `.env.example`.
- Added in-chat "step back" (undo last exchange) via `revertLastExchange`.
