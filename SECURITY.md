# Security & Data Handling Policy

Process Work AI Guide handles **sensitive personal reflections** related to
emotional and psychological wellbeing. We treat this data with corresponding
care. This document describes how the system protects it and how to report a
problem.

> Scope note: this is a wellbeing / self-exploration tool, **not** a medical
> device. It does not provide diagnosis or treatment.

## Data we process

- **Account data:** email, name, language, plan, consent flag.
- **Session content:** user messages, AI facilitator replies, session summaries,
  durable memory notes, saved insights, feedback.
- **Safety signals (`RiskEvent`):** flagged messages indicating possible crisis,
  retained for human review.
- **Optional:** imported physiological data, when the user provides it.

## Access control

- **Authentication** is handled by the Base44 platform.
- **Row-level security (RLS)** restricts each user to their own sessions,
  messages, memory, and insights. Backend functions verify session ownership
  (`created_by` / owner id) before returning or mutating data.
- **Roles:** `user` (own data only) and `admin` (review dashboards, RiskEvents).
  Admin views of user sessions are read-only.
- Consent (`AppUser.consent_given`) is required before any session is created.

## Secrets

- No API keys, tokens, or passwords are stored in the client bundle (`src/`) or
  in git. `.env` / `.env.*` are git-ignored.
- Server-side secrets (payment keys, notification address, etc.) live in
  **Base44 app settings** and are read in backend functions via
  `Deno.env.get(...)` only.
- Payment card data is **never** handled by our servers — it is processed by the
  payment provider (Stripe/PayPal). We store only non-sensitive references
  (customer/subscription ids, plan status).

## Safety module

Every user message is screened for crisis and distress signals. On a crisis
signal the session pauses, the user is shown support resources, and a
`RiskEvent` is logged for review. Safety signals are **not** deleted by the
in-chat "step back" feature.

## Your data rights (GDPR)

Users may request access to, correction of, or deletion of their personal data.
Data-subject request handling (export and full deletion flows) is on the
roadmap; until automated, requests are handled manually via the contact below.

## Data retention

Session and account data are retained while the account is active. On verified
deletion request, associated sessions, messages, memory, insights, and feedback
are removed.

## Reporting a vulnerability

If you discover a security or privacy issue, please report it privately rather
than opening a public issue:

- **Contact:** security@pwguide.uwu.ai *(update to a monitored address)*
- Please include steps to reproduce and any relevant details.
- We aim to acknowledge reports within **5 business days** and to keep you
  updated on remediation.

We ask that you avoid accessing or modifying other users' data, and give us
reasonable time to remediate before any public disclosure. Good-faith research
is welcome.
