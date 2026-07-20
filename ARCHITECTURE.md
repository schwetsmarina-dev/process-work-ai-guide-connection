# Architecture — Process Work AI Guide

> AI-guided self-reflection assistant based on Arnold Mindell's Process-Oriented
> Psychology. Runs structured sessions across four modes, keeps memory between
> sessions, auto-generates summaries, and includes a real-time safety module.
>
> **This is a wellbeing / self-exploration tool, not a medical device and not a
> replacement for professional care.** See `SECURITY.md` for data-handling rules.

Platform: **Base44** (BaaS — managed database, auth, backend functions, AI gateway)
Domain: **pwguide.uwu.ai** · Languages: **ru / es** (en partial)

---

## 1. Tech stack

| Layer      | Technology                                                        |
|------------|-------------------------------------------------------------------|
| Frontend   | React 18, Vite 6, React Router 6, TanStack Query 5, Tailwind 3    |
| UI kit     | shadcn/ui (Radix primitives), lucide-react, framer-motion         |
| Forms/valid| react-hook-form, zod                                              |
| Backend    | Base44 functions (Deno runtime, `entry.ts` per function)          |
| Data       | Base44 entities (12 tables, see §3)                               |
| AI         | Base44 AI gateway via the `invokeAI` function                     |
| Payments   | Stripe SDK installed (`@stripe/stripe-js`) — integration pending  |

## 2. Repository layout

```
base44/
  entities/      # 12 data-model schemas (.jsonc) — auto-synced on write
  functions/     # 20 backend functions (Deno), one dir + entry.ts each
  agents/        # AI agent configs (insight_guide)
src/
  pages/         # 20 route-level screens (Dashboard, SessionChat, Journal, …)
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
text), **Term** (Process Work glossary).

Safety & data: **RiskEvent** (logged safety signal — type/severity/status),
**PhysiologicalData** (optional imported body signals).

> ⚠️ **Known inconsistency (tracked for cleanup):** ownership is expressed with a
> mix of `created_by` (email), `created_by_id`, and `user_id` across entities.
> Standardize before scaling. Backend functions currently bridge this manually.

## 4. Session lifecycle

1. User gives consent (`AppUser.consent_given`) and picks a language.
2. User selects a mode → a **Session** is created (`status=active`).
3. Opening greeting is posted (canonical per-mode question).
4. **Turn loop** (see `src/pages/SessionChat.jsx` + `src/lib/sessionAI.js`):
   - user message saved via `createSessionMessage`
   - `fetchStep(mode, current_step)` loads the active **ModeStep**
   - `getAIResponse` builds the prompt from **full message history + UserMemory +
     ModeStep + stage detection**, calls `invokeAI`, validates, retries once
   - assistant reply saved; `Session.current_step` advances via `next_step_on_answer`
   - **Step back:** `revertLastExchange` removes the last user→assistant pair and
     rolls `current_step` back (used by the in-chat "undo" control)
5. On close: `generateSessionSummary` fills summary/themes/signals;
   `persistSessionMemory` extracts durable **UserMemory** from the transcript
   (idempotent, runs once per session).

## 5. Safety module

Every user message is screened (`checkCrisis`, `checkLowRisk` in `sessionAI.js`).
On a crisis signal the session pauses, a support message is shown, and a
**RiskEvent** is created; `notifyRiskEvent` can email a review address
(`TEAM_NOTIFICATION_EMAIL`). RiskEvents are **never** deleted by the step-back
flow — safety signals stay logged for human review.

## 6. Backend functions (catalog)

**Runtime:** `invokeAI`, `createSessionMessage`, `listSessionMessages`,
`revertLastExchange`, `persistSessionMemory`, `regenerateSessionSummary`,
`detectUserPatterns`, `buildLifeProcessMap`, `notifyRiskEvent`, `listTermIds`,
`importPhysiologicalData`, `therapistDashboard`, `exportResearchData`.

**Scheduled / maintenance:** `abandonStaleSessions`, `dedupeActiveSessions`.

**One-off migrations (candidates for archival once confirmed run):**
`backfillInsightUserId`, `backfillSessionUserId`, `migrateTermKeys`,
`patchProcessMappingSteps`.

**Dev/test only (must not ship to production users):** `createTestData`.

## 7. Roadmap (see also README §Roadmap)

- **Payments:** add `Subscription`/entitlement entity, Stripe Checkout + Customer
  Portal, a Stripe **webhook** function, and **server-side** entitlement checks
  (never trust the client `plan` field to gate paid features).
- **Mobile:** PWA-first (installable, no store fees; Stripe/PayPal/Apple Pay/
  Google Pay all work in web). Optional Capacitor wrapper later for App/Play Store
  (triggers Apple/Google in-app-purchase rules).
- **Structure:** decompose monoliths (`sessionAI.js` ~1540 lines,
  `systemPrompt.js`, `SessionChat.jsx`); standardize ownership fields (§3);
  gate/remove dev & diagnostic artifacts; add error tracking + product analytics.
