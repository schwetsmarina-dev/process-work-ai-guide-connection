# Security & Data Handling Policy

Talvira handles **sensitive personal reflections** related to
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
- Versioned consent is required before any session is created. Talvira records separate acknowledgement of the AI interaction and explicit consent for session content that may contain physical or psychological information (`special_category_consent_given`).

## Secrets

- No API keys, tokens, or passwords are stored in the client bundle (`src/`) or
  in git. `.env` / `.env.*` are git-ignored.
- Server-side secrets (payment keys, notification address, etc.) live in
  **Base44 app settings** and are read in backend functions via
  `Deno.env.get(...)` only.
- Payment card data is **never** handled by our servers — it is processed by
  Paddle, Talvira's Merchant of Record. We store only non-sensitive references
  (customer/subscription ids, plan status).

## Safety module

Every user message is screened for crisis and distress signals. On a crisis
signal the session pauses, the user is shown support resources, and a
`RiskEvent` is logged for review. Safety signals are **not** deleted by the
in-chat "step back" feature.

## Your data rights (GDPR)

Users can export their data and delete Talvira user-generated data directly in Settings → Privacy. They can also disable cross-session memory or erase memory without deleting the account. Requests requiring correction, account-identity deletion, processor/back-up handling or billing-record review are handled through the contact below.

## Data retention

Session data is retained while the account is active and needed for the service. The in-product deletion flow removes sessions, messages, summaries, insights, memory, practices, physiological data, risk events, therapist links, assignments, feedback and the custom AppUser profile. Base44 authentication identity and Paddle/billing records may remain where platform or statutory obligations require them. Application logs are content-minimised and must never include transcript text, memory values, email addresses or raw user identifiers.

## Reporting a vulnerability

If you discover a security or privacy issue, please report it privately rather
than opening a public issue:

- **Contact:** help@talvira.app
- Please include steps to reproduce and any relevant details.
- We aim to acknowledge reports within **5 business days** and to keep you
  updated on remediation.

We ask that you avoid accessing or modifying other users' data, and give us
reasonable time to remediate before any public disclosure. Good-faith research
is welcome.
