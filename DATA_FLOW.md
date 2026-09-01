# Talvira — Data Flow and Processor Register

**Version:** 0.2 · **Date:** 15 August 2026  
This file is the source-of-truth checklist for privacy, security and due-diligence reviews. Complete contractual fields from signed provider agreements; do not infer them from marketing pages.

## 1. High-level flow

1. User opens Talvira and selects language.
2. Authentication creates or retrieves an account through Base44.
3. Age gate stores birth year and confirmation timestamp; users below 18 are blocked.
4. Consent records the accepted language/version, AI disclosure acknowledgement and explicit special-category consent before a session can start.
5. User session content is stored in Base44 and sent through the configured AI gateway/model provider to generate a reply.
6. Talvira screens messages for safety signals and may create a RiskEvent.
7. Session completion may create summaries, memories, insights, reports and a personalised practice derived from recurring material across completed sessions.
8. After eligibility and a non-clinical safety screening, a user may start the 28-day programme. Each generated day and completed reflection may store distress checks, user-reviewed observations, personal resources and an explicit progression decision (advance, repeat, resource, pause or stop).
9. Paddle Checkout handles payment; signed Paddle webhooks update a server-side Entitlement.
10. Optional monitoring receives technical errors subject to configured redaction.
11. Users can export or delete data from Settings → Privacy.

## 2. System inventory

| System | Role | Data | Purpose | Storage/transfer details to verify |
|---|---|---|---|---|
| Base44 | Hosting, database, authentication, backend functions and AI gateway | Account, consent, sessions, derived content, safety events, entitlements | Core service | Public DPA: https://base44.com/dpa · subprocessors: https://base44.com/dpa/exhibitc · verify selected workspace region, backups and deletion behavior in the account |
| Configured language-model provider via Base44 | Subprocessor for AI generation | Session prompt/context and relevant memory | Generate guided replies and summaries | Current Base44 list names OpenAI and Anthropic; record the actual routed provider/model, retention/training settings and transfer basis |
| Paddle | Merchant of Record and subscription billing | Email/customer reference, subscription/product/price/status; payment data handled by Paddle | Checkout, tax, receipts, subscription management | Public DPA: https://www.paddle.com/legal/data-processing-addendum · verify account-specific role, notices, retention and subprocessors |
| Sentry (if enabled in production) | Error monitoring | Technical error context; may contain identifiers unless scrubbed | Reliability and incident response | Production status, DSN, region, sampling, PII scrubbing, retention, DPA |
| Email/notification provider (if enabled) | Operational/safety notifications | Destination and minimum necessary event metadata | Support or risk review | Provider, region, content minimisation, DPA, retention |
| WordPress/Hostinger (talvira.es) | Marketing website and contact forms | Web logs, contact submissions, cookies where enabled | Marketing and support | Hosting region, form storage, email routing, cookie inventory, retention |
| Product analytics (if enabled) | Usage measurement | Events and device/account identifiers depending on configuration | Conversion and retention metrics | Exact vendor, consent requirement, IP handling, retention, DPA |

## 3. Internal entities

| Entity | Main content | Access/retention notes |
|---|---|---|
| AppUser | Account, language, plan, consent, birth year | User/admin; birth year only |
| Session / Message | Guided-session state and transcript | Owner-scoped; sensitive |
| UserMemory / Insight | Persistent derived reflection | Owner-scoped; user controls required |
| ProcessExercise | Safety-classified practice library | Admin-authored; only AI-usable material may feed self-guided generation |
| ProcessPractice | Personalised seven-step practice and optional audio reference | Owner-scoped; derived from completed sessions |
| EdgeProgram | 28-day programme state, source context, pause/resume state and personal resource library | Owner-scoped; backend-created after eligibility and screening |
| EdgeProgramDay | Daily generated practice, reflection, distress checks, reviewed observations/resources and progression decision | Owner-scoped; sensitive derived data |
| EdgeProgramScreening | Pre-start non-clinical safety answers and result | Owner-scoped; sensitive |
| EdgeProgramMilestone | Weekly synthesis, recurring signals, resources and next-week adjustment | Owner-scoped; backend-generated |
| RiskEvent | Safety classification and references | Restricted review; retention must be justified |
| PhysiologicalData | Optional body data | Special-category; explicit consent/minimisation |
| Entitlement | Paddle references and access status | Server-authoritative; no card data |
| SessionFeedback | Rating and free text | Owner/support access as defined |

## 4. Retention and deletion schedule

| Data | Target rule | Verification |
|---|---|---|
| Active account/session data | While account is active and needed for service | Implemented; periodic necessity review remains required |
| In-product data deletion | Immediate deletion of Talvira content/profile entities | Implemented by `deleteMyData`; authentication identity, billing records, provider logs and backups require provider/account handling |
| Cross-session memory | User may disable future use or delete saved memory separately | Implemented in Settings → Privacy and enforced before prompt loading/persistence |
| Technical logs | Never include transcript text, memory values, email or raw user/session identifiers; infrastructure retention per configured provider | Application logging sanitised; confirm Base44/DataDog/Sentry retention settings |
| Billing/tax records | Paddle/controller statutory obligations | Document exact controller copies |
| Backups | Shortest feasible rolling period | Obtain provider schedule |
| RiskEvent | Defined, justified review period | Approve with safety/privacy reviewer |
| Research datasets | Per separate consent/protocol | No indefinite default |

## 5. Change-control checklist

Update this register before:
- enabling a new AI model/provider;
- enabling analytics or session replay;
- adding therapist/centre access;
- expanding to minors or changing the 18+ rule;
- launching a new country/language with different emergency resources;
- changing billing provider;
- reusing session data for research, model training or marketing.

Each change requires: purpose, data fields, lawful basis, processor/DPA, transfer mechanism, retention, access control, deletion test and DPIA risk review.
