# Talvira — RLS audit evidence

**Date:** 15 August 2026  
**Scope:** all Base44 application entity schemas.

## Result

All 15 application-owned entity schemas define row-level security rules. The `User` schema only extends Base44's platform authentication entity with the Talvira role enum; authentication-record access is managed by the platform rather than custom entity RLS.

| Entity | Access model |
|---|---|
| AppUser | matching email or admin |
| Session, Message | owning authenticated user or admin |
| UserMemory, Insight, ProcessPractice, PhysiologicalData | owner or admin |
| RiskEvent | owner for limited user access; privileged review where configured |
| SessionFeedback | submitting user or admin/support |
| ClientLink, Assignment | linked client/therapist or admin |
| Entitlement | owner read; server/admin authoritative writes |
| Mode, ModeStep, Term | reference-data read; privileged writes |

## Verification rule

Any new entity containing account, session, safety, billing, therapist-link or derived personal data must ship with explicit create/read/update/delete rules and an owner-isolation test before release. The built-in `User` entity must not be treated as an unrestricted application table.

This audit records schema coverage, not a substitute for periodic two-account production isolation tests.