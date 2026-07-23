import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { normalizeLang, t } from "@/lib/i18n";
import { buildConsentRecord } from "@/lib/consent";
import { track, EVENTS } from "@/lib/telemetry";
import OnboardingShell from "./OnboardingShell";
import ModeSelectStep from "./ModeSelectStep";
import ConsentStep from "./ConsentStep";

export default function Onboarding({ appUser, currentUser, onComplete }) {
  const navigate = useNavigate();
  const lang = normalizeLang(appUser?.language || "ru");

  const [step, setStep] = useState(0);
  const [selectedMode, setSelectedMode] = useState(null);
  const [check1, setCheck1] = useState(false);
  const [check2, setCheck2] = useState(false);
  const [check3, setCheck3] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const { data: modes = [], isLoading: modesLoading } = useQuery({
    queryKey: ["modes-active"],
    queryFn: () => base44.entities.Mode.filter({ is_active: true }, "sort_order"),
  });

  const next = () => setStep((s) => Math.min(s + 1, 4));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  // Step 3: persist current_mode as soon as user picks one
  const handleSelectMode = async (mode) => {
    setSelectedMode(mode);
  };

  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      if (appUser?.id) {
        await base44.entities.AppUser.update(appUser.id, {
          onboarding_completed: true,
          ...buildConsentRecord(lang),
          current_mode: selectedMode?.mode_id || "",
        });
      }

      // Create first session in the selected mode
      const modeId = selectedMode?.mode_id;
      if (modeId) {
        track(EVENTS.ONBOARDING_COMPLETED, { mode: modeId, language: lang });
        const session = await base44.entities.Session.create({
          user_id: currentUser?.id,
          mode_id: modeId,
          mode: modeId,
          status: "active",
          current_step: 1,
          started_at: new Date().toISOString(),
        });
        if (appUser?.id) {
          await base44.entities.AppUser.update(appUser.id, { last_session_id: session.id }).catch(() => {});
        }
        track(EVENTS.SESSION_STARTED, { mode: modeId, language: lang, is_first: true });
        onComplete?.();
        navigate(`/session/${session.id}`);
        return;
      }

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
        nextDisabled={!(check1 && check2 && check3)}
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