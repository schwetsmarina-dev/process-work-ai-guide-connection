# Talvira — Data Protection Impact Assessment (working draft)

**Version:** 0.1  
**Date:** 13 August 2026  
**Owner:** Marina Shvets  
**Contact:** help@talvira.app  
**Status:** Working governance document; requires periodic review and legal/DPO validation before material scale-up.

## 1. Scope and purpose

Talvira is an AI-guided self-reflection service available at https://talvira.app. It supports structured exploration of dreams, conflicts, journaling and body signals and can generate summaries, memories, insights and personalised practices.

Talvira is not psychotherapy, a medical device, a diagnostic service or an emergency service. The product is restricted to adults aged 18 or over.

This DPIA covers account creation, age confirmation, guided sessions, AI processing, memory, safety screening, billing entitlements, user-controlled export/deletion and operational monitoring.

## 2. Why a DPIA is appropriate

Session content can reveal information about mental or physical wellbeing and may therefore contain special-category personal data. The service combines systematic AI-assisted analysis, persistent memory and potentially vulnerable users. A DPIA is maintained as a precautionary privacy-by-design measure.

## 3. Data subjects and data

**Data subjects:** registered adult users; invited therapist accounts where applicable.

**Data categories:**
- account: name, email, language, plan and consent records;
- age gate: birth year and confirmation timestamp (no full birth date);
- session: user messages, AI replies, mode, progress and summaries;
- derived: memories, themes, insights, reports, process maps and practices;
- safety: risk classification and the message/event that triggered review;
- billing: Paddle customer/subscription/product/price references and entitlement status;
- technical: security, error and service logs;
- optional: physiological data deliberately supplied by the user.

## 4. Purposes and legal bases

| Purpose | Provisional legal basis |
|---|---|
| Provide account and requested service | GDPR 6(1)(b), contract |
| Process sensitive reflection/session content | GDPR 9(2)(a), explicit consent |
| Safety screening and service security | GDPR 6(1)(f), legitimate interests; reviewed case by case |
| Billing and accounting | GDPR 6(1)(b) and 6(1)(c) |
| Optional research | Separate, specific and withdrawable consent |
| Anonymous product analytics | Legitimate interest only where data is genuinely non-identifying; otherwise consent |

Consent must be informed, specific, recorded, easy to withdraw and separate from optional research.

## 5. Necessity and proportionality

- Talvira collects only birth year for the 18+ decision.
- Sessions cannot start before consent and age confirmation.
- Users choose what to disclose and can stop a session.
- Access is restricted by ownership/RLS checks.
- Payment card data is handled by Paddle, not Talvira.
- Data export and deletion controls are available in Settings → Privacy.
- The AI nature and product limits are disclosed before and during interaction.
- Persistent memory and optional data should remain user-controlled and off by default where feasible.

## 6. Main risks and controls

| Risk | Initial risk | Controls | Residual risk |
|---|---:|---|---:|
| Disclosure of sensitive session content | High | TLS, RLS, ownership checks, least privilege, secrets server-side | Medium |
| User mistakes AI for a clinician | High | persistent AI disclosure, non-clinical positioning, no diagnosis/advice | Medium |
| Harmful response during crisis | High | crisis screening, emergency routes, response constraints, RiskEvent logging, red-team tests | Medium |
| Minor accesses the service | High | 18+ policy, birth-year gate, account blocking | Medium |
| Excessive or opaque AI profiling | High | limited purposes, user access/export/deletion, no legal-effect automated decisions | Medium |
| International transfer without safeguards | High | processor register, SCC/DPA verification and region review | Medium pending contracts |
| Billing data mismatch or entitlement fraud | Medium | signed Paddle webhooks, server-side entitlement checks, event ordering protection | Low |
| Retention exceeds necessity | Medium | defined schedule, deletion workflow and periodic review | Low/Medium |
| Re-identification of research data | High | separate consent, minimisation, aggregation and release review | Medium |

## 7. Required actions before scale-up

1. Complete the processor register with legal entity, region, DPA, subprocessors and transfer mechanism.
2. Confirm retention periods against actual infrastructure and backups.
3. Verify deletion across production database, AI/provider logs, monitoring and backups.
4. Record lawful-basis and consent wording approval.
5. Expand safety red-team coverage and retain test evidence.
6. Define incident response owners and breach-notification workflow.
7. Reassess after new languages, therapist/centre features, new AI providers or material profiling.

## 8. Consultation and sign-off

If residual high risk cannot be reduced, obtain specialist advice and consider prior consultation with the AEPD under GDPR Article 36.

| Role | Name | Decision | Date |
|---|---|---|---|
| Product owner/controller | Marina Shvets | Pending | |
| Privacy/legal reviewer | | Pending | |
| Technical reviewer | | Pending | |

## 9. Review cadence

Review at least annually and whenever Talvira changes AI provider, processing purpose, data category, retention, user group, geography, therapist access or billing architecture.
