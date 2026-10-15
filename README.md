# Talvira

AI-guided self-reflection assistant based on Arnold Mindell's **Process-Oriented
Psychology**. Users move through structured sessions in four modes — **body
signal, dream, inner conflict, journaling** — with an AI facilitator that follows
their process, keeps memory between sessions, generates summaries and personal
practices, offers an adaptive 28-day self-exploration programme, and screens
every user entry with a real-time safety module.

> **Not a medical device and not a substitute for professional psychological
> help.** A wellbeing / self-exploration tool. See `SECURITY.md`.

- **Live:** https://talvira.app
- **Platform:** Base44 (managed backend, DB, auth, AI gateway)
- **Status:** MVP in beta testing
- **Architecture:** see [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- **Security & data handling:** see [`SECURITY.md`](./SECURITY.md)
- **Personal practices and 28-day programme:** see [`docs/PERSONAL_PRACTICES_AND_28_DAY_PROGRAM.md`](./docs/PERSONAL_PRACTICES_AND_28_DAY_PROGRAM.md)

## Product capabilities

- Four structured session modes: body signal, dream, inner conflict and journaling.
- Cross-session memory, summaries, insights, reports and process mapping.
- Personal practices generated from the user's own completed-session context and
  the safety-filtered ProcessExercise library; users do not choose a generic
  exercise from a list.
- A progressive 28-day programme that connects discoveries between days, supports
  pause/rest/resource days and resumes without treating the calendar as a
  compliance target.
- Real-time crisis screening and clear non-clinical boundaries throughout guided
  sessions and longer programmes.

## Tech stack

React 18 · Vite 6 · React Router 6 · TanStack Query 5 · Tailwind 3 · shadcn/ui ·
react-hook-form + zod · Base44 (Deno backend functions, entities, AI gateway) ·
Paddle.js + Paddle Billing (checkout, subscriptions, webhooks and customer portal).

## Local development

**Prerequisites:** Node.js 18+.

```bash
git clone <repo-url>
cd <project>
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev
```

Environment variables (`.env.local`, never committed):

```
VITE_BASE44_APP_ID=<your app id>
VITE_BASE44_APP_BASE_URL=<your backend url, e.g. https://<app>.base44.app>
```

Server-side secrets (Paddle API/webhook keys, `TEAM_NOTIFICATION_EMAIL`, etc.) are configured
in **Base44 app settings**, read in functions via `Deno.env.get(...)`, and must
**never** appear in `src/` (client bundle) or in git.

## Scripts

| Command             | Purpose                                  |
|---------------------|------------------------------------------|
| `npm run dev`       | Local dev server (Vite)                  |
| `npm run build`     | Production build → `./dist`              |
| `npm run preview`   | Preview the production build             |
| `npm run lint`      | ESLint (quiet)                           |
| `npm run lint:fix`  | ESLint autofix                           |
| `npm run typecheck` | TypeScript check (jsconfig)              |

## Backend & deploy

Backend functions live in `base44/functions/<name>/entry.ts` (Deno). On the
Base44 platform, **writing a resource file deploys it** (auto-sync); there is no
separate deploy step for entities/functions/agents. The frontend builds to
`./dist`. Any change pushed to the connected Git repo is also reflected in the
Base44 Builder.

## Repository layout

```
base44/entities   data-model schemas        src/pages       route screens
base44/functions  Deno backend functions    src/components   UI + features
base44/agents     AI agent configs          src/lib          domain logic
                                             src/hooks/api/utils
```

## Roadmap

1. **Hygiene & docs** — real README/ARCHITECTURE/SECURITY, remove dev/diagnostic
   artifacts, archive one-off migrations. *(in progress)*
2. **Structure** — decompose large modules; standardize ownership fields.
3. **Payments** — finish Paddle Live verification and production credentials;
   checkout, customer portal, webhook handling and server-side entitlement
   checks are implemented. Paddle acts as Merchant of Record.
4. **Mobile** — PWA-first; optional Capacitor native wrapper post-funding.
5. **Scale readiness** — error tracking, product analytics, smoke tests, GDPR
   data-export/deletion flows.

## License

Proprietary — all rights reserved. Not for redistribution.
