import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { normalizeLang, t } from "@/lib/i18n";
import { buildConsentRecord } from "@/lib/consent";
import { isOldEnough } from "@/lib/ageGate";
import { track, EVENTS } from "@/lib/telemetry";
import { JOURNEY_EVENTS, logJourneyEvent } from "@/lib/journeyEvents";
import OnboardingShell from "./OnboardingShell";
import ModeSelectStep from "./ModeSelectStep";
import ConsentStep from "./ConsentStep";

export default function Onboarding({ appUser, currentUser, onComplete }) {
  const navigate = useNavigate();
  const lang = normalizeLang(appUser?.language);

  const [step, setStep] = useState(() => Math.max(0, Math.min(4, Number(appUser?.onboarding_step || 0))));
  const [selectedMode, setSelectedMode] = useState(null);
  const startedLoggedRef = useRef(false);
  const lastSavedStepRef = useRef(null);
  const [check1, setCheck1] = useState(false);
  const [check2, setCheck2] = useState(false);
  const [check3, setCheck3] = useState(false);
  const [birthYear, setBirthYear] = useState(null);
  const [finishing, setFinishing] = useState(false);

  const { data: modes = [], isLoading: modesLoading } = useQuery({
    queryKey: ["modes-active"],
    queryFn: () => base44.entities.Mode.filter({ is_active: true }, "sort_order"),
  });

  useEffect(() => {
    if (!selectedMode && appUser?.current_mode && modes.length) {
      setSelectedMode(modes.find((mode) => mode.mode_id === appUser.current_mode) || null);
    }
  }, [modes, appUser?.current_mode, selectedMode]);

  useEffect(() => {
    if (!appUser?.id || appUser.onboarding_completed) return;
    if (!startedLoggedRef.current) {
      startedLoggedRef.current = true;
      logJourneyEvent(JOURNEY_EVENTS.ONBOARDING_STARTED, { step_number: step, language: lang });
    }
    if (lastSavedStepRef.current === step) return;
    lastSavedStepRef.current = step;
    base44.entities.AppUser.update(appUser.id, {
      onboarding_step: step,
      onboarding_updated_at: new Date().toISOString(),
    }).catch((error) => console.warn("[Onboarding] step save failed:", error?.message));
    logJourneyEvent(JOURNEY_EVENTS.ONBOARDING_STEP_VIEWED, { step_number: step, language: lang });
  }, [appUser?.id, appUser?.onboarding_completed, step, lang]);

  const next = () => setStep((s) => Math.min(s + 1, 4));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  // Persist the choice immediately, so a resumed onboarding can restore it.
  const handleSelectMode = async (mode) => {
    setSelectedMode(mode);
    if (appUser?.id) {
      await base44.entities.AppUser.update(appUser.id, {
        current_mode: mode.mode_id,
        onboarding_step: step,
        onboarding_updated_at: new Date().toISOString(),
      }).catch((error) => console.warn("[Onboarding] mode save failed:", error?.message));
    }
  };

  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      if (appUser?.id) {
        await base44.entities.AppUser.update(appUser.id, {
          onboarding_completed: true,
          onboarding_step: 4,
          onboarding_updated_at: new Date().toISOString(),
          ...buildConsentRecord(lang, birthYear),
          current_mode: selectedMode?.mode_id || "",
        });
      }

      const modeId = selectedMode?.mode_id;
      track(EVENTS.ONBOARDING_COMPLETED, { mode: modeId || "", language: lang });
      await logJourneyEvent(JOURNEY_EVENTS.ONBOARDING_COMPLETED, {
        mode_id: modeId || "",
        step_number: 4,
        language: lang,
      });

      // Onboarding no longer starts a session — that would consume the user's
      // free-trial session in this mode before they knowingly begin a chat.
      // The user lands on the dashboard and starts their first session there.
      onComplete?.();
      navigate("/dashboard");
    } catch (e) {
      console.error("[Onboarding] finish failed:", e?.message);
      setFinishing(false);
    }
  };

  // ── Step config ──────────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <OnboardingShell step={0} onNext={next} nextLabel={t("onb_step1_button", lang)} backLabel={t("onb_back", lang)}>
        <h1 className="font-serif text-3xl font-semibold mb-4">{t("onb_step1_title", lang)}</h1>
        <p className="text-muted-foreground text-lg leading-relaxed">{t("onb_step1_text", lang)}</p>
      </OnboardingShell>
    );
  }

  if (step === 1) {
    return (
      <OnboardingShell step={1} onBack={back} onNext={next} nextLabel={t("onb_step2_button", lang)} backLabel={t("onb_back", lang)}>
        <h2 className="font-serif text-2xl font-semibold mb-4">{t("onb_step2_title", lang)}</h2>
        <p className="text-muted-foreground text-lg leading-relaxed">{t("onb_step2_text", lang)}</p>
      </OnboardingShell>
    );
  }

  if (step === 2) {
    return (
      <OnboardingShell
        step={2}
        onBack={back}
        onNext={next}
        nextLabel={t("onb_step3_button", lang)}
        nextDisabled={!selectedMode}
        backLabel={t("onb_back", lang)}
      >
        <h2 className="font-serif text-2xl font-semibold mb-6">{t("onb_step3_title", lang)}</h2>
        <ModeSelectStep
          modes={modes}
          loading={modesLoading}
          selectedId={selectedMode?.id}
          onSelect={handleSelectMode}
          lang={lang}
        />
      </OnboardingShell>
    );
  }

  if (step === 3) {
    return (
      <OnboardingShell
        step={3}
        onBack={back}
        onNext={next}
        nextLabel={t("onb_step4_button", lang)}
        nextDisabled={!(isOldEnough(birthYear) && check1 && check2 && check3)}
        backLabel={t("onb_back", lang)}
      >
        <ConsentStep
          lang={lang}
          check1={check1}
          check2={check2}
          check3={check3}
          onToggle1={() => setCheck1((v) => !v)}
          onToggle2={() => setCheck2((v) => !v)}
          onToggle3={() => setCheck3((v) => !v)}
          birthYear={birthYear}
          onBirthYearChange={setBirthYear}
        />
      </OnboardingShell>
    );
  }

  // step === 4 — final (no back)
  return (
    <OnboardingShell step={4} onNext={finish} nextLabel={t("onb_step5_button", lang)} nextDisabled={finishing} backLabel={t("onb_back", lang)}>
      <h1 className="font-serif text-3xl font-semibold mb-4">{t("onb_step5_title", lang)}</h1>
      <p className="text-muted-foreground text-lg leading-relaxed">{t("onb_step5_text", lang)}</p>
    </OnboardingShell>
  );
}