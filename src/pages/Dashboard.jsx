import React, { useEffect, useState } from "react";
import { isAdmin as hasAdminRole } from "@/lib/roles";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import RecentSessionCard from "@/components/dashboard/RecentSessionCard";
import ModeCardDB from "@/components/dashboard/ModeCardDB";
import AdminPanel from "@/components/dashboard/AdminPanel";
import ExistingSessionDialog from "@/components/dashboard/ExistingSessionDialog";
import ContinueThemeDialog from "@/components/dashboard/ContinueThemeDialog";
import ConsistencyCalendar from "@/components/dashboard/ConsistencyCalendar";
import { normalizeLang, t } from "@/lib/i18n";
import { startSession } from "@/lib/sessionApi";
import UpgradePrompt from "@/components/billing/UpgradePrompt";
import SuggestedPractices from "@/components/client/SuggestedPractices";

export default function Dashboard() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [appUser, setAppUser] = useState(null);
  const [pendingMode, setPendingMode] = useState(null);
  const [existingActive, setExistingActive] = useState(null);
  const [lastCompletedForMode, setLastCompletedForMode] = useState(null);
  const lang = normalizeLang(appUser?.language || "ru");
  const [quotaBlockedMode, setQuotaBlockedMode] = useState(null);

  useEffect(() => {
    (async () => {
      const u = await base44.auth.me();
      setCurrentUser(u);
      const rows = await base44.entities.AppUser.filter({ email: u?.email });
      setAppUser(rows[0] || null);
    })();
  }, []);

  // Load active modes from DB
  const { data: modes = [], isLoading: modesLoading } = useQuery({
    queryKey: ["modes-active"],
    queryFn: () => base44.entities.Mode.filter({ is_active: true }, "sort_order"),
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["sessions", currentUser?.email],
    // Ownership uses `user_id`, not created_by — created_by is stamped with
    // the SERVICE ROLE's identity since sessions are created server-side.
    queryFn: () => base44.entities.Session.filter({ user_id: currentUser.id }, "-created_date", 10),
    enabled: !!currentUser?.id,
  });

  // Full completed-session history for the consistency calendar
  const { data: completedSessions = [] } = useQuery({
    queryKey: ["sessions-completed", currentUser?.email],
    queryFn: () =>
      base44.entities.Session.filter(
        { user_id: currentUser.id, status: "completed" },
        "-created_date",
        500
      ),
    enabled: !!currentUser?.email,
  });

  const isAdmin = hasAdminRole(currentUser);
  const activeSession = sessions.find((s) => s.status === "active");
  const recentSessions = sessions.filter((s) => s.status !== "active").slice(0, 5);

  const hasContinuationMaterial = (session) => {
    if (!session) return false;
    return Boolean(
      String(session.summary || "").trim() ||
      String(session.next_step_suggestion || "").trim() ||
      (Array.isArray(session.edge_signals) && session.edge_signals.some(Boolean)) ||
      (Array.isArray(session.primary_process) && session.primary_process.some(Boolean)) ||
      (Array.isArray(session.secondary_process) && session.secondary_process.some(Boolean))
    );
  };

  // Find the latest *meaningful* completed session in this mode. We deliberately
  // do not use limit=1: a short/broken test session can otherwise hide an older
  // session that actually contains the process map and continuation point.
  const findContinuationSession = async (modeId) => {
    try {
      const completedInMode = await base44.entities.Session.filter(
        { user_id: currentUser.id, status: "completed", mode_id: modeId },
        "-created_date",
        50
      );
      return (completedInMode || []).find(hasContinuationMaterial) || null;
    } catch (e) {
      console.error("[SessionFlow] lookup of continuation session failed:", e?.message);
      return null;
    }
  };

  const offerContinuationOrCreate = async (mode) => {
    const previous = await findContinuationSession(mode.mode_id);
    if (previous) {
      setPendingMode(mode);
      setLastCompletedForMode(previous);
      return;
    }
    await createSession(mode);
  };

  const handleModeSelect = async (mode) => {
    const modeId = mode.mode_id;

    // Guard: if an active session already exists for this user+mode, ask before creating
    const existing = sessions.find((s) => s.status === "active" && (s.mode_id || s.mode) === modeId);
    if (existing) {
      console.log("[SessionFlow] existing active session found for mode:", modeId, "→", existing.id);
      setPendingMode(mode);
      setExistingActive(existing);
      return;
    }

    await offerContinuationOrCreate(mode);
  };

  const handleContinueTheme = async () => {
    const mode = pendingMode;
    const prev = lastCompletedForMode;
    setLastCompletedForMode(null);
    setPendingMode(null);
    if (!mode || !prev) return;

    // Legacy fallback only. startSession/sessionApi now reconstruct the full
    // continuation from the previous Session record, including map + edge data.
    const carrySource = prev.next_step_suggestion || prev.summary || "";
    const carryOverContext = carrySource
      ? `Пользователь возвращается к теме прошлой сессии в этом же направлении. Тогда пришли к следующему: «${carrySource}». Начни с мягкой отсылки к этому и продолжай со следующего незавершённого слоя — не начинай с нуля и не повторяй пройденное.`
      : "";

    await createSession(mode, { continuedFromSessionId: prev.id, carryOverContext });
  };

  const handleStartNewTheme = async () => {
    const mode = pendingMode;
    setLastCompletedForMode(null);
    setPendingMode(null);
    if (mode) await createSession(mode);
  };

  const handleContinueExisting = () => {
    if (existingActive) navigate(`/session/${existingActive.id}`);
    setExistingActive(null);
    setPendingMode(null);
  };

  const handleStartNew = async () => {
    const mode = pendingMode;
    if (existingActive) {
      await base44.entities.Session.update(existingActive.id, {
        status: "abandoned",
        ended_at: new Date().toISOString(),
      }).catch(() => {});
    }
    setExistingActive(null);

    // IMPORTANT: "start new" here only means "do not resume this unfinished
    // session". It must NOT skip the separate choice to deepen a previously
    // completed meaningful theme. That bypass caused the continuation dialog to
    // disappear during testing.
    if (mode) {
      await offerContinuationOrCreate(mode);
    } else {
      setPendingMode(null);
    }
  };

  /**
   * @param {any} mode
   * @param {{ continuedFromSessionId?: any, carryOverContext?: any }} [opts]
   */
  const createSession = async (mode, { continuedFromSessionId, carryOverContext } = {}) => {
    const modeId = mode.mode_id;
    const stepKey = `${modeId}_1`;

    console.log("[SessionFlow] mode selected:", modeId, "looking up step_key:", stepKey);

    // Load all steps for mode — bulletproof check before creating session
    let allModeSteps = [];
    try {
      allModeSteps = await base44.entities.ModeStep.filter({ mode_id: modeId });
    } catch (e) {
      // Permissions issue — try listing all
      try {
        const all = await base44.entities.ModeStep.list("step_number", 500);
        allModeSteps = all.filter((s) => String(s.mode_id || "").trim() === modeId);
      } catch (e2) {
        console.error("[SessionFlow] Cannot read ModeStep:", e2.message);
      }
    }

    const firstStep =
      allModeSteps.find((s) => String(s.step_key || "").trim() === stepKey) ||
      allModeSteps.find((s) => Number(s.step_number) === 1) ||
      allModeSteps.find((s) => Number(s.step) === 1) ||
      allModeSteps.find((s) => String(s.step_key || "").endsWith("_1"));

    if (!firstStep) {
      const allSample = await base44.entities.ModeStep.list("step_number", 10).catch(() => []);
      const allModeIds = [...new Set(allSample.map((s) => s.mode_id).filter(Boolean))];
      const allKeys = allModeSteps.map((s) => s.step_key || `[no key, step_number=${s.step_number}]`).join(", ") || "(none)";
      console.error(
        `[SessionFlow] First step not found!\n  mode_id = ${modeId}\n  step_key = ${stepKey}\n  steps for mode = ${allKeys}\n  DB mode_ids = ${allModeIds.join(", ")}\n  ModeStep rows readable = ${allSample.length}`
      );
      alert(
        `First step not found for mode "${modeId}".\n\n` +
        `step_key: ${stepKey}\n` +
        `Steps for this mode: ${allKeys}\n` +
        `All mode_id values in DB: ${allModeIds.join(", ") || "(empty)"}\n` +
        `ModeStep records visible to this user: ${allSample.length}\n\n` +
        `→ Open /admin/status → "Test step lookup" to diagnose.\n` +
        `→ Or open /admin/import and upload mode_steps.csv.`
      );
      return;
    }

    if (!currentUser?.id) {
      console.error("[SessionFlow] Cannot create session — current user not loaded");
      alert(t("profile_not_loaded", lang));
      return;
    }

    const result = await startSession(modeId, { continuedFromSessionId, carryOverContext });
    if (result.blocked) {
      // Free trial for this mode is used up. The server decided this, not us.
      setQuotaBlockedMode(modeId);
      return;
    }
    const session = result.session;

    console.log(
      "[SessionFlow] session created:",
      session.id,
      "mode_id:", session.mode_id,
      "step:", session.current_step,
      "user:", currentUser?.email
    );

    if (appUser?.id) {
      await base44.entities.AppUser.update(appUser.id, { last_session_id: session.id }).catch(() => {});
    }

    navigate(`/session/${session.id}`);
  };

  const continuationPreview = lastCompletedForMode
    ? (
        lastCompletedForMode.next_step_suggestion ||
        lastCompletedForMode.summary ||
        (Array.isArray(lastCompletedForMode.edge_signals) ? lastCompletedForMode.edge_signals.filter(Boolean).join("; ") : "") ||
        (Array.isArray(lastCompletedForMode.secondary_process) ? lastCompletedForMode.secondary_process.filter(Boolean).join("; ") : "") ||
        (Array.isArray(lastCompletedForMode.primary_process) ? lastCompletedForMode.primary_process.filter(Boolean).join("; ") : "")
      )
    : "";

  const isLoading = modesLoading || sessionsLoading;

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <div className="mb-10">
        <h1 className="font-serif text-3xl md:text-4xl font-semibold mb-2">
          {t("welcome", lang)}
        </h1>
        <p className="text-muted-foreground">
          {t("choose_direction", lang)}
        </p>
      </div>

      {/* Admin quick-access panel */}
      {isAdmin && <AdminPanel />}

      {quotaBlockedMode && (
        <div className="mb-6">
          <UpgradePrompt lang={lang} variant="quota" onDismiss={() => setQuotaBlockedMode(null)} />
        </div>
      )}

      <ExistingSessionDialog
        open={!!existingActive}
        onContinue={handleContinueExisting}
        onStartNew={handleStartNew}
        onOpenChange={(o) => { if (!o) { setExistingActive(null); setPendingMode(null); } }}
        lang={lang}
      />

      <ContinueThemeDialog
        open={!!lastCompletedForMode}
        summary={continuationPreview}
        onContinueTheme={handleContinueTheme}
        onStartNew={handleStartNewTheme}
        onOpenChange={(o) => { if (!o) { setLastCompletedForMode(null); setPendingMode(null); } }}
        lang={lang}
      />

      {/* Active session banner */}
      {activeSession && (
        <div className="mb-8 p-5 rounded-2xl border-2 border-primary/20 bg-primary/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-primary mb-1">{t("unfinished_session", lang)}</p>
              <p className="text-sm text-muted-foreground">
                {activeSession.mode_id || activeSession.mode}
              </p>
            </div>
            <Button onClick={() => navigate(`/session/${activeSession.id}`)}>
              {t("continue", lang)}
            </Button>
          </div>
        </div>
      )}

      {/* Mode selection */}
      {modesLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : modes.length === 0 ? (
        <div className="flex items-start gap-3 p-5 rounded-2xl border border-amber-200 bg-amber-50 mb-8">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800 text-sm">{t("modes_not_configured", lang)}</p>
            <p className="text-amber-700 text-xs mt-1">
              {t("modes_not_configured_text", lang)}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
          {modes.map((mode) => (
            <ModeCardDB key={mode.id} mode={mode} onClick={handleModeSelect} />
          ))}
        </div>
      )}

      {/* Talvira Pro — practices assigned by the client's therapist */}
      {currentUser?.email && (
        <div className="mb-12">
          <SuggestedPractices clientEmail={currentUser.email} />
        </div>
      )}

      {/* Consistency calendar */}
      {completedSessions.length > 0 && (
        <ConsistencyCalendar sessions={completedSessions} lang={lang} />
      )}

      {/* Recent sessions */}
      {sessionsLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : recentSessions.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl font-semibold">{t("recent_sessions", lang)}</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/history")}>
              {t("all_sessions", lang)}
            </Button>
          </div>
          <div className="space-y-2">
            {recentSessions.map((session) => (
              <RecentSessionCard key={session.id} session={session} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
