// Consent record — single source of truth.
//
// Why versioned: GDPR Art. 7(1) requires the controller to be able to
// DEMONSTRATE that the user consented — which text, when, in which language.
// A bare `consent_given: true` boolean cannot prove that. Whenever the consent
// wording below changes materially, bump CONSENT_VERSION so existing users are
// re-asked instead of being silently carried over onto new terms.
//
// EU AI Act Art. 50(1) (applies from 2 August 2026) requires that a person is
// informed they are interacting with an AI system. `ai_disclosure_ack` records
// that this was shown and acknowledged.

export const CONSENT_VERSION = "2026-07-a";

/**
 * Fields to persist on AppUser when the user accepts the consent step.
 * @param {string} lang - locale the consent text was displayed in ("ru" | "es")
 */
export function buildConsentRecord(lang) {
  return {
    consent_given: true,
    ai_disclosure_ack: true,
    consent_version: CONSENT_VERSION,
    consent_given_at: new Date().toISOString(),
    consent_locale: lang || "ru",
  };
}

/** True when the user has accepted the current consent version. */
export function hasCurrentConsent(appUser) {
  return Boolean(
    appUser?.consent_given &&
      appUser?.ai_disclosure_ack &&
      appUser?.consent_version === CONSENT_VERSION,
  );
}
