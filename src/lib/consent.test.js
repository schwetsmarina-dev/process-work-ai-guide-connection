import { describe, expect, it } from "vitest";
import { buildConsentRecord, CONSENT_VERSION, hasCurrentConsent } from "./consent";

describe("versioned consent", () => {
  it("records explicit special-category and AI acknowledgement", () => {
    const record = buildConsentRecord("es", 1990);
    expect(record).toMatchObject({
      birth_year: 1990,
      consent_given: true,
      special_category_consent_given: true,
      ai_disclosure_ack: true,
      consent_version: CONSENT_VERSION,
      consent_locale: "es",
    });
    expect(record.consent_given_at).toBeTruthy();
    expect(record.special_category_consent_given_at).toBeTruthy();
  });

  it("rejects old or incomplete consent records", () => {
    expect(hasCurrentConsent({ consent_given: true, ai_disclosure_ack: true, consent_version: CONSENT_VERSION })).toBe(false);
    expect(hasCurrentConsent({
      consent_given: true,
      special_category_consent_given: true,
      ai_disclosure_ack: true,
      consent_version: "2026-07-a",
    })).toBe(false);
  });

  it("accepts only the complete current record", () => {
    expect(hasCurrentConsent(buildConsentRecord("ru", 1985))).toBe(true);
  });
});
