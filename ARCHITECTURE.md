# Architecture — Talvira

> AI-guided self-reflection assistant based on Arnold Mindell's Process-Oriented
> Psychology. Runs structured sessions across four modes, keeps memory between
> sessions, generates personalised practices, supports an adaptive 28-day
> programme, and includes a real-time safety module.
>
> **This is a wellbeing / self-exploration tool, not a medical device and not a
> replacement for professional care.** See `SECURITY.md` for data-handling rules.

Platform: **Base44** (BaaS — managed database, auth, backend functions, AI gateway)
Domain: **talvira.app** · Marketing site: **talvira.es** · Languages: **ru / es** (en partial)

---

## 1. Tech stack

| Layer      | Technology                                                        |
|------------|-------------------------------------------------------------------|
| Frontend   | React 18, Vite 6, React Router 6, TanStack Query 5, Tailwind 3    |
| UI kit     | shadcn/ui (Radix primitives), lucide-react, framer-motion         |
| Forms/valid| react-hook-form, zod                                              |
| Backend    | Base44 functions (Deno runtime, `entry.ts` per function)          |
| Data       | Base44 entities (15 app schemas plus the platform User schema, see §3) |
| AI         | Base44 AI gateway via the `invokeAI` function                     |
| Payments   | Paddle Billing: overlay checkout, webhooks, entitlements and customer portal |

## 2. Repository layout

```
base44/
  entities/      # 16 schemas (.jsonc; one extends platform User) — auto-synced on write
  functions/     # 29 backend-function directories (Deno), including maintenance/migrations
  agents/        # AI agent configs (insight_guide)
src/
  pages/         # 25 route-level screens (Dashboard, SessionChat, Journal, …)
  components/    # ~100 UI + feature components (session/, dashboard/, ui/, …)
  lib/           # domain logic: sessionAI, systemPrompt, stage detection, i18n, …
  hooks/  api/  utils/
```

## 3. Data model (entities)

Core: **AppUser** (profile, `language`, `plan`, consent), **Session** (one
exploration; `mode`, `current_step`, `status`, AI `summary`), **Message**
(`role` user/assistant/system, `content`, `step_number`), **Mode** + **ModeStep**
(the facilitation protocol: each step has a `goal`, `question`,
`facilitator_hint`, `next_step_on_answer`, optional `possible_mode_shift`).

Memory & output: **UserMemory** (durable cross-session notes, written at session
close), **Insight** (user-saved takeaways), **SessionFeedback** (rating + free
text), **Term** (Process Work glossary), **ProcessExercise** (safety-classified
exercise library) and **ProcessPractice** (a seven-step personalised practice
built from recurring material across completed sessions).

Longitudinal programme: **EdgeProgram** (owner, source practice/sessions, status,
current day/week, pause/resume state and personal resource library),
**EdgeProgramDay** (generated practice, reflection, distress checks, reviewed AI
observations/resources and progression decision), **EdgeProgramScreening**
(pre-start suitability gate) and **EdgeProgramMilestone** (weekly synthesis).

Safety & data: **RiskEvent** (logged safety signal — type/severity/status),
**PhysiologicalData** (optional imported body signals).

> ⚠️ **Known inconsistency (tracked for cleanup):** ownership is expressed with a
> mix of `created_by` (email), `created_by_id`, and `user_id` across entities.
> Standardize before scaling. Backend functions currently bridge this manually.

## 4. Session lifecycle

1. User confirms 18+, accepts versioned consent, explicitly consents to relevant special-category processing and acknowledges the AI interaction.
2. User selects a mode → a **Session** is created (`status=active`).
3. Opening greeting is posted (canonical per-mode question).
4. **Turn loop** (see `src/pages/SessionChat.jsx` + `src/lib/sessionAI.js`):
   - user message saved via `createSessionMessage`
   - `fetchStep(mode, current_step)` loads the active **ModeStep**
   - `getAIResponse` builds the prompt from **full message history + optional UserMemory +
     ModeStep + stage detection**, calls the Base44 AI gateway, validates, retries once
   - assistant reply saved; `Session.current_step` advances via `next_step_on_answer`
   - **Step back:** `revertLastExchange` removes the last user→assistant pair and
     rolls `current_step` back (used by the in-chat "undo" control)
5. On close: `generateSessionSummary` fills summary/themes/signals;
   `persistSessionMemory` extracts durable **UserMemory** from the transcript
   (idempotent, runs once per session, and skips when the user has disabled memory).
   Completed sessions persist `system_prompt_version` and `ai_gateway_version`
   so incidents and evaluation results can be tied to a specific orchestration release.

## 5. Personal practices and the 28-day programme

A personal practice is offered only when `checkProcessPracticeReadiness` finds
enough recurring material. `generateProcessPractice` combines the user's
completed-session context, process map and safe `ProcessExercise` candidates
into a structured seven-step `ProcessPractice`; `generatePracticeAudio` may
create an optional audio version.

The 28-day programme is downstream of that practice. `checkEdgeProgramReadiness`
requires full access, at least five completed sessions and a qualifying personal
practice, and blocks invitations when a high/critical unresolved `RiskEvent`
exists. `submitEdgeProgramScreening` creates the programme only after a
non-clinical safety screening. `generateEdgeProgramDay` produces one adaptive
day at a time. `completeEdgeProgramDay` stores the user's reflection, requires
review of AI observations and proposed resource updates, and atomically applies
the progression guard: advance, repeat, resource day, pause or stop.

Calendar time never auto-advances the programme. A pause preserves the current
day. Rest days contain no required introspection; resource-only days do not
reopen difficult material. See
[`docs/PERSONAL_PRACTICES_AND_28_DAY_PROGRAM.md`](./docs/PERSONAL_PRACTICES_AND_28_DAY_PROGRAM.md).

## 6. Safety module

Every user message is screened (`checkCrisis`, `checkLowRisk` in `sessionAI.js`).
On a crisis signal the session pauses, a support message is shown, and a
**RiskEvent** is created; `notifyRiskEvent` can email a review address
(`TEAM_NOTIFICATION_EMAIL`). RiskEvents are **never** deleted by the step-back
flow — safety signals stay logged for human review.

## 7. Backend functions (catalog)

**Runtime:** `invokeAI`, `createSessionMessage`, `listSessionMessages`,
`revertLastExchange`, `persistSessionMemory`, `regenerateSessionSummary`,
`detectUserPatterns`, `buildLifeProcessMap`, `notifyRiskEvent`, `listTermIds`,
`importPhysiologicalData`, `therapistDashboard`, `exportResearchData`,
`checkProcessPracticeReadiness`, `generateProcessPractice`,
`generatePracticeAudio`, `getExerciseCoverageMap`,
`checkEdgeProgramReadiness`, `submitEdgeProgramScreening`,
`generateEdgeProgramDay`, `completeEdgeProgramDay`.

**Scheduled / maintenance:** `abandonStaleSessions`, `dedupeActiveSessions`.

**One-off migrations (candidates for archival once confirmed run):**
`backfillInsightUserId`, `backfillSessionUserId`, `migrateTermKeys`,
`patchProcessMappingSteps`.

**Dev/test only (must not ship to production users):** `createTestData`.

## 8. Roadmap (see also README §Roadmap)

- **Payments:** Paddle is the primary launch provider and Merchant of Record.
  Checkout, customer portal, signed webhook processing and server-side
  entitlement checks are implemented. Production rollout requires Paddle Live
  approval and separate production credentials.
- **Mobile:** PWA-first (installable and distributed on the web). Payment methods
  available to a buyer are presented by Paddle Checkout. Optional Capacitor wrapper later for App/Play Store
  (triggers Apple/Google in-app-purchase rules).
- **Monitoring:** production operational failures use content-free error codes; transcript text, memory values, email and raw user/session identifiers are never sent as telemetry.
- **Structure:** decompose monoliths (`sessionAI.js` ~1540 lines,
  `systemPrompt.js`, `SessionChat.jsx`); standardize ownership fields (§3);
  gate/remove dev & diagnostic artifacts; add error tracking + product analytics.
