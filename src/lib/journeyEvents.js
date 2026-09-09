import { base44 } from "@/api/base44Client";

export const JOURNEY_EVENTS = Object.freeze({
  APP_OPENED: "app_opened",
  ONBOARDING_STARTED: "onboarding_started",
  ONBOARDING_STEP_VIEWED: "onboarding_step_viewed",
  ONBOARDING_COMPLETED: "onboarding_completed",
  MODE_OPENED: "mode_opened",
  SESSION_CREATED: "session_created",
  SESSION_FIRST_MESSAGE: "session_first_message",
  SESSION_STEP_ADVANCED: "session_step_advanced",
  SESSION_RESUMED: "session_resumed",
  SESSION_COMPLETED: "session_completed",
  SESSION_ABANDONED: "session_abandoned",
  ABANDONMENT_FEEDBACK_PROMPTED: "abandonment_feedback_prompted",
  ABANDONMENT_REASON_SUBMITTED: "abandonment_reason_submitted",
});

export function logJourneyEvent(event_type, details = {}) {
  const payload = { event_type };
  for (const key of ["session_id", "mode_id", "step_number", "reason_code", "language"]) {
    if (details[key] !== undefined && details[key] !== null && details[key] !== "") payload[key] = details[key];
  }
  return base44.functions.invoke("logJourneyEvent", payload).catch((error) => {
    console.warn("[journey] event was not saved:", event_type, error?.message);
    return null;
  });
}