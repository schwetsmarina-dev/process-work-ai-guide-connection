# Personal practices and adaptive 28-day programme

**Status:** beta · **Audience:** product, engineering, safety, privacy and support  
**Public languages:** Russian and Spanish; English is partially supported.

## 1. Product positioning

These features extend Talvira's AI-guided self-exploration beyond a single chat.
They are not psychotherapy, diagnosis, treatment, a medical device or an
emergency service.

A personal practice is not selected from a generic catalogue. It is generated
from recurring material in the user's completed sessions and adapted to their
current process.

The 28-day programme is not a productivity challenge and does not reward
calendar compliance. It is a progressive, adaptive self-exploration path whose
next day depends on prior user-confirmed material and the current safety state.

## 2. Personal practices

### User promise

- Based on themes, patterns, resources, limits and emerging movements already
  explored in completed sessions.
- Generated only when there is enough recurring material.
- Guided step by step; no psychology knowledge or technique selection is needed.
- May feed later sessions and the optional 28-day programme.

### Eligibility and generation

1. `checkProcessPracticeReadiness` evaluates recurring material and readiness.
2. `generateProcessPractice` combines completed-session context, the life
   process map and safety-filtered `ProcessExercise` candidates.
3. The result is stored as an owner-scoped `ProcessPractice` with source
   session ids, theme, dominant channel, confidence and seven structured steps:
   grounding, contact, amplification, exploration, transition, secondary
   process and integration.
4. `generatePracticeAudio` may create an optional audio version. If audio
   generation fails, the text practice remains available.
5. A suggestion to seek a live facilitator is non-blocking and appears only
   when repeated edge material warrants it.

Only `ProcessExercise` records classified as AI-self-guided or conditional may
feed self-guided generation. Live-specialist material is excluded.

## 3. Adaptive 28-day programme

### Eligibility

`checkEdgeProgramReadiness` requires:

- a paid/full-access entitlement;
- at least five completed sessions;
- a qualifying personal practice informed by at least two source sessions;
- no active programme in screening, active or paused state;
- no unresolved high or critical `RiskEvent`.

Eligibility is an invitation to screening, not a clinical-safety decision.

### Pre-start screening

`submitEdgeProgramScreening` records whether the user reports current crisis,
recent significant dissociation/disconnection, worsening with deep self-guided
practice, access to human support, and understanding of the right to stop.
The result is `proceed`, `caution` or `stop`.

### Daily lifecycle

1. `generateEdgeProgramDay` creates the current day's adapted practice and
   journal questions from methodology, prior days, confirmed observations,
   resources and safety state.
2. The user records a reflection and optional distress-before/after values, plus
   overwhelm or dissociation signals.
3. `completeEdgeProgramDay` proposes observations and resource updates.
4. The user must confirm, correct or reject each proposal. AI hypotheses are
   never stored as user facts without this review.
5. Completion atomically updates the day and programme and selects one
   progression decision: `advance`, `repeat`, `resource`, `pause` or
   `stop`.
6. Days 7, 14, 21 and 28 may create `EdgeProgramMilestone` summaries.

### User control and pacing

- The user may step back at any time.
- A pause preserves the current day and context.
- Resuming begins with a new check-in; elapsed calendar days never auto-advance.
- A rest day contains no required introspection, journaling or catch-up task.
- A resource-only day does not reopen difficult material.
- A softer version or repeat may replace progression.
- The personal resource library records what helped, what did not help and what
  should not be offered again.
- Progress is defined by increased awareness and choice, not by completing 28
  consecutive calendar days.

## 4. Data model

| Entity | Purpose |
|---|---|
| `ProcessExercise` | Safety-classified source exercise library |
| `ProcessPractice` | Generated personal practice and optional audio reference |
| `EdgeProgram` | Programme status, source context, day/week, pause/resume and resource library |
| `EdgeProgramDay` | Daily practice, reflection, safety checks, reviewed observations/resources and progression |
| `EdgeProgramScreening` | Non-clinical pre-start screening |
| `EdgeProgramMilestone` | Weekly synthesis and next-week adjustment |
| `ReturnToSelfMethodology` / `ReturnToSelfMethodVersion` | Versioned programme method |

All user records are owner-scoped through RLS. Backend-created records use
service-role access only after caller authentication and ownership checks.

## 5. Safety invariants

- Existing crisis screening and `RiskEvent` handling remain authoritative.
- High/critical unresolved risk blocks programme entry.
- Reported dissociation pauses progression; marked overwhelm routes to a
  resource decision; a materially increased distress score prevents automatic
  advancement.
- The programme must not force breath focus, infer causality from early memories
  or present AI interpretations as facts.
- Support and resource access remain available throughout the programme.
- Public copy must preserve Talvira's non-clinical positioning and the user's
  right to pause or stop.

## 6. Subscription and trial

The three-day free trial includes one chat in each of the four modes and does
not include cross-session memory, personal practices or the 28-day programme.
These features require the full Talvira entitlement.

## 7. Documentation change checklist

Update this file, README, ARCHITECTURE, DATA_FLOW, DPIA, SECURITY, pricing copy,
FAQ and RU/ES marketing pages when any of the following changes:

- minimum completed-session threshold;
- practice structure or eligible exercise classifications;
- programme length, screening questions or progression decisions;
- stored programme fields or retention/deletion behaviour;
- crisis/safety routing;
- entitlement or trial access;
- supported language or public naming.
