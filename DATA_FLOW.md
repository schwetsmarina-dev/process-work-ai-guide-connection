# Talvira — Data Flow and Processor Register

**Version:** 0.1 · **Date:** 13 August 2026  
This file is the source-of-truth checklist for privacy, security and due-diligence reviews. Complete contractual fields from signed provider agreements; do not infer them from marketing pages.

## 1. High-level flow

1. User opens Talvira and selects language.
2. Authentication creates or retrieves an account through Base44.
3. Age gate stores birth year and confirmation timestamp; users below 18 are blocked.
4. Consent records the accepted language/version before a session can start.
5. User session content is stored in Base44 and sent through the configured AI gateway/model provider to generate a reply.
6. Talvira screens messages for safety signals and may create a RiskEvent.
7. Session completion may create summaries, memories, insights, reports and a personalised practice.
8. Paddle Checkout handles payment; signed Paddle webhooks update a server-side Entitlement.
9. Optional monitoring receives technical errors subject to configured redaction.
10. Users can export or delete data from Settings → Privacy.

## 2. System inventory

| System | Role | Data | Purpose | Storage/transfer details to verify |
|---|---|---|---|---|
| Base44 | Hosting, database, authentication, backend functions and AI gateway | Account, consent, sessions, derived content, safety events, entitlements | Core service | Legal entity, hosting region, DPA, subprocessors, SCCs, backups, deletion |
| Configured language-model provider via Base44 | Subprocessor for AI generation | Session prompt/context and relevant memory | Generate guided replies and summaries | Provider identity/model, retention, training exclusion, region, DPA/SCC |
| Paddle | Merchant of Record and subscription billing | Email/customer reference, subscription/product/price/status; payment data handled by Paddle | Checkout, tax, receipts, subscription management | DPA, region/transfers, retention, subprocessors |
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
| ProcessPractice | Personalised practice | Owner-scoped |
| RiskEvent | Safety classification and references | Restricted review; retention must be justified |
| PhysiologicalData | Optional body data | Special-category; explicit consent/minimisation |
| Entitlement | Paddle references and access status | Server-authoritative; no card data |
| SessionFeedback | Rating and free text | Owner/support access as defined |

## 4. Retention schedule to verify

| Data | Target rule | Verification |
|---|---|---|
| Active account/session data | While account is active and needed for service | Confirm production behavior |
| Deleted account data | Delete active records promptly; public policy states within 30 days where not immediate | Test all entities/functions |
| Technical logs | Public policy currently states 90 days | Confirm Base44/Sentry/provider settings |
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
