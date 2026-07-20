import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, AlertTriangle, RefreshCw, ShieldAlert, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  checkCrisis,
  checkLowRisk,
  CRISIS_MESSAGE,
  fetchStep,
  getAIResponse,
  generateSessionSummary,
} from "@/lib/sessionAI";
import { createMessage, listMessages, revertLastExchange } from "@/lib/messageApi";
import {
  loadUserMemories,
  formatMemoriesForPrompt,
} from "@/lib/userMemory";
import SessionHeader from "@/components/session/SessionHeader";
import ChatMessage from "@/components/session/ChatMessage";
import ChatInput from "@/components/session/ChatInput";
import StepErrorDebug from "@/components/session/StepErrorDebug";
import { normalizeLang, t } from "@/lib/i18n";

// Canonical, mode-specific opening question (do NOT use DB step.question for the first greeting)
function getInitialOpeningQuestion(modeId, language, step) {
  const mode = String(modeId || "").toLowerCase();
  const isEs = language === "es";

  if (mode.includes("dream")) {
    return isEs
      ? "Cuéntame tu sueño tal como lo recuerdas. ¿Qué momentos o sensaciones son los más importantes?"
      : "Расскажи мне свой сон так, как ты его помнишь. Какие моменты или чувства в нём самые заметные?";
  }
  if (mode.includes("body")) {
    return isEs
      ? "¿Qué señal del cuerpo quieres explorar ahora? Puede ser un síntoma, una tensión, una sensación, dolor, cansancio o cualquier señal corporal."
      : "Что в теле ты хочешь исследовать сейчас? Это может быть симптом, напряжение, ощущение, боль, усталость или любой телесный сигнал.";
  }
  if (mode.includes("conflict")) {
    return isEs
      ? "Describe, por favor, el conflicto que quieres explorar. ¿Qué partes, deseos o posiciones chocan en él?"
      : "Опиши, пожалуйста, конфликт, который ты хочешь исследовать. Какие стороны, желания или позиции в нём сталкиваются?";
  }
  if (mode.includes("journal")) {
    return isEs
      ? "¿Qué quieres explorar hoy? Puede ser una situación, una emoción, una pregunta, un pensamiento o un tema que ocupa tu atención."
      : "О чём ты хочешь поисследовать сегодня? Это может быть ситуация, чувство, вопрос, мысль или тема, которая сейчас занимает внимание.";
  }
  return step?.question || "";
}

// Last-resort canonical greeting — used when fetchStep returns null or a greeting
// create fails. Never leaves the user with an empty chat. Throws if create fails.
async function createFallbackGreeting({ sessionId, modeId, stepNum, language, reason }) {
  const fallbackOpening =
    getInitialOpeningQuestion(modeId, language, null) ||
    (language === "es" ? "¿Qué quieres explorar hoy?" : "О чём ты хочешь поисследовать сегодня?");

  await createMessage({
    session_id: sessionId,
    mode_id: modeId,
    step_number: stepNum || 1,
    role: "assistant",
    content: `${t("greeting_start", language)}\n\n${fallbackOpening}`,
  });

  console.warn("[SESSION_INIT_FALLBACK_GREETING_CREATED]", { sessionId, modeId, stepNum, reason });
}

// Parse [SHIFT_SUGGEST:mode] tag from AI response
function parseShiftSuggestion(text) {
  const match = text.match(/\[SHIFT_SUGGEST:([^\]]*)\]/);
  if (match) {
    return {
      cleanText: text.replace(match[0], "").trim(),
      suggestedMode: match[1] || null,
    };
  }
  return { cleanText: text, suggestedMode: null };
}

export default function SessionChat() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathParts = window.location.pathname.split("/");
  const sessionId = pathParts[2]; // /session/:id

  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [stepError, setStepError] = useState(false);
  const [stepDebugInfo, setStepDebugInfo] = useState(null);
  const [sendError, setSendError] = useState(false);
  const [sendErrorMessage, setSendErrorMessage] = useState(null);
  const [shiftSuggestion, setShiftSuggestion] = useState(null);
  const [totalSteps, setTotalSteps] = useState(0);
  const [currentUser, setCurrentUser] = useState(null);
  const [appUser, setAppUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);
  const language = normalizeLang(appUser?.language || "ru");
  const [accessDenied, setAccessDenied] = useState(false);
  const [isAdminView, setIsAdminView] = useState(false);
  // Optimistic messages shown while backend confirms
  const [optimisticMessages, setOptimisticMessages] = useState([]);
  // "Step back" (undo last exchange) state
  const [isUndoing, setIsUndoing] = useState(false);
  const [seedText, setSeedText] = useState("");
  const [seedNonce, setSeedNonce] = useState(0);
  const messagesEndRef = useRef(null);
  const initDone = useRef(false);
  const lastFailedMessageRef = useRef(null);

  // ── Reset all init state when sessionId changes ───────────────────────────
  useEffect(() => {
    initDone.current = false;
    setStepError(false);
    setStepDebugInfo(null);
    setOptimisticMessages([]);
  }, [sessionId]);

  // ── Load current user first ───────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const u = await base44.auth.me();
        console.log("[SessionChat] currentUser loaded:", u?.email, "role:", u?.role);
        setCurrentUser(u);
        const rows = await base44.entities.AppUser.filter({ email: u?.email });
        setAppUser(rows[0] || null);
      } catch (err) {
        console.error("[SessionChat] auth.me() failed:", err);
      } finally {
        setUserLoading(false);
      }
    })();
  }, []);

  // ── Session ──────────────────────────────────────────────────────────────
  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ["session", sessionId, currentUser?.email],
    queryFn: async () => {
      console.log("[SessionChat] loading session:", sessionId, "for user:", currentUser?.email);
      const rows = await base44.entities.Session.filter({ id: sessionId });
      const found = rows[0];
      if (!found) {
        console.warn("[SessionChat] session not found");
        setAccessDenied(true);
        return null;
      }
      // Admin can view any session (read-only)
      if (found.created_by !== currentUser.email) {
        if (currentUser.role === "admin") {
          console.log("[SessionChat] admin viewing foreign session (read-only)");
          setIsAdminView(true);
          return found;
        }
        console.warn("[SessionChat] access denied — session owned by", found.created_by);
        setAccessDenied(true);
        return null;
      }
      return found;
    },
    enabled: !!sessionId && !!currentUser?.email,
  });

  // ── Messages — filter by session_id only (assistant msgs have no created_by) ──
  const { data: dbMessages = [], isLoading: msgsLoading, refetch: refetchMessages } = useQuery({
    queryKey: ["messages", sessionId, currentUser?.email],
    queryFn: async () => {
      console.log("[SessionFlow] loading messages — session:", sessionId, "user:", currentUser?.email);
      const msgs = await listMessages(sessionId);
      console.log("[SessionFlow] messages loaded:", msgs.length, "for session:", sessionId);
      return msgs;
    },
    // Only load messages AFTER session ownership has been confirmed (session !== null + not denied)
    enabled: !!sessionId && !!currentUser?.email && !accessDenied && !!session,
  });

  // Merge DB messages with optimistic ones
  const messages = useMemo(() => {
    return [...dbMessages, ...optimisticMessages];
  }, [dbMessages, optimisticMessages]);

  // ── Total steps for progress bar ─────────────────────────────────────────
  useEffect(() => {
    if (!session?.mode_id) return;
    base44.entities.ModeStep.filter({ mode_id: session.mode_id }).then((rows) => {
      setTotalSteps(rows.length);
    });
  }, [session?.mode_id]);

  // ── Send initial greeting from step 1 ────────────────────────────────────
  useEffect(() => {
    if (!session || msgsLoading || dbMessages.length > 0 || initDone.current) return;
    if (isAdminView) return;

    const modeId = String(session.mode_id || session.mode || "").trim();
    const stepNum = session.current_step || 1;

    if (!modeId) {
      console.error("[SESSION_INIT] Cannot init — missing modeId", { mode_id: session.mode_id, mode: session.mode });
      setStepError(true);
      return;
    }

    // Clear any stale error state — do NOT set stepError here, only after fetchStep fails
    setStepError(false);
    setStepDebugInfo(null);

    const stepKey = `${modeId}_${stepNum}`;
    console.log("[SESSION_INIT] session loaded — mode:", modeId, "step_key:", stepKey, "session:", sessionId);

    let cancelled = false;

    // Runs the shared fallback greeting + clears error state. Throws if create fails.
    const runFallback = async (reason) => {
      await createFallbackGreeting({ sessionId, modeId, stepNum, language, reason });
      if (cancelled) return;
      initDone.current = true;
      setStepError(false);
      setStepDebugInfo(null);
      queryClient.invalidateQueries({ queryKey: ["messages", sessionId, currentUser?.email] });
    };

    fetchStep(modeId, stepNum).then(async (step) => {
      if (cancelled) return;

      console.log("[STEP_LOOKUP]", {
        sessionId,
        modeId,
        currentStep: stepNum,
        lookupKey: stepKey,
        stepFound: !!step,
      });

      if (!step) {
        console.error("[SESSION_INIT] fetchStep returned null for", stepKey, "— using canonical fallback greeting");
        try {
          await runFallback("fetchStep returned null");
          return;
        } catch (fbErr) {
          if (cancelled) return;
          console.error("[SESSION_INIT] fallback greeting also failed:", fbErr?.message);
          // Only now surface the diagnostic block (admins see details, users a soft message).
          const allSteps = await base44.entities.ModeStep.list("step_number", 20).catch(() => []);
          const forMode = allSteps.filter((s) => String(s.mode_id || "").trim() === modeId);
          const availableKeys = forMode.map((s) => s.step_key || `[no key, step_number=${s.step_number}]`);
          const allModeIds = [...new Set(allSteps.map((s) => s.mode_id).filter(Boolean))];
          const sampleRows = allSteps.map((s) => `${s.mode_id}/${s.step_key || s.step_number}`);
          setStepDebugInfo({ stepKey, modeId, stepNum, availableKeys, totalStepsInDb: allSteps.length, allModeIds, sampleRows });
          setStepError(true);
          return;
        }
      }

      // Step found — create greeting, THEN mark init done
      console.log("[SESSION_INIT] step found:", step.step_key || step._stepKey, "session.id:", sessionId);
      // Use canonical, mode-specific opening question (never DB step.question for first greeting)
      const openingQuestion = getInitialOpeningQuestion(modeId, language, step);
      console.log("[CANONICAL_OPENING_USED]", { modeId, language, openingQuestion });
      const greeting = `${t("greeting_start", language)}\n\n${openingQuestion}`;
      try {
        await createMessage({ session_id: sessionId, mode_id: modeId, step_number: stepNum, role: "assistant", content: greeting });
      } catch (createErr) {
        if (cancelled) return;
        console.error("[SESSION_INIT] createMessage failed:", {
          status: createErr?.response?.status || createErr?.status,
          message: createErr?.message,
          session_id: sessionId,
        });
        // Retry once via canonical fallback before surfacing an error.
        try {
          await runFallback("greeting createMessage failed");
        } catch (fbErr) {
          if (cancelled) return;
          console.error("[SESSION_INIT] fallback greeting also failed:", fbErr?.message);
          setStepError(true);
        }
        return;
      }
      if (cancelled) return;
      initDone.current = true; // only mark done on success
      setStepError(false);
      setStepDebugInfo(null);
      console.log("[SESSION_INIT] greeting saved — init complete");
      queryClient.invalidateQueries({ queryKey: ["messages", sessionId, currentUser?.email] });
    }).catch((err) => {
      if (cancelled) return;
      console.error("[SESSION_INIT] unexpected error:", err?.message || err);
      setStepError(true);
    });

    return () => { cancelled = true; };
  }, [session?.id, msgsLoading, dbMessages.length, isAdminView]);

  // ── Auto-recover: if stepError is set but fetchStep actually works, create greeting silently ──
  useEffect(() => {
    if (!stepError || !session || isAdminView || dbMessages.length > 0) return;

    const modeId = String(session.mode_id || session.mode || "").trim();
    const stepNum = session.current_step || 1;
    if (!modeId) return;

    let cancelled = false;
    fetchStep(modeId, stepNum).then(async (step) => {
      if (cancelled || !step) return;
      console.log("[SESSION_AUTORECOVERY] fetchStep succeeded — creating greeting, session.id:", sessionId);
      const recoveryQuestion = getInitialOpeningQuestion(modeId, language, step);
      console.log("[CANONICAL_OPENING_USED]", { modeId, language, openingQuestion: recoveryQuestion });
      const greeting = `${t("greeting_start", language)}\n\n${recoveryQuestion}`;
      try {
        await createMessage({ session_id: sessionId, mode_id: modeId, step_number: stepNum, role: "assistant", content: greeting });
      } catch (createErr) {
        if (cancelled) return;
        console.error("[SESSION_AUTORECOVERY] greeting create failed — trying fallback:", createErr?.message);
        await createFallbackGreeting({ sessionId, modeId, stepNum, language, reason: "autorecovery greeting create failed" });
      }
      if (cancelled) return;
      initDone.current = true;
      setStepError(false);
      setStepDebugInfo(null);
      queryClient.invalidateQueries({ queryKey: ["messages", sessionId, currentUser?.email] });
    }).catch((e) => {
      console.error("[SESSION_AUTORECOVERY] failed:", e?.message);
      /* stay in error state so user sees StepErrorDebug */
    });

    return () => { cancelled = true; };
  }, [stepError]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, optimisticMessages]);

  // ── Send user message ─────────────────────────────────────────────────────
  const handleSend = async (text) => {
    if (!session || isAdminView) return;
    setSendError(false);
    setSendErrorMessage(null);
    lastFailedMessageRef.current = null;

    const modeId = String(session.mode_id || session.mode || "").trim();
    const currentStep = session.current_step || 1;

    console.log("[CHAT_FLOW] 1. user message received:", text.substring(0, 60), "step:", currentStep);

    // Optimistic: show user message immediately in UI
    const optimisticUserMsg = {
      id: `optimistic-${Date.now()}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
      session_id: sessionId,
    };
    setOptimisticMessages([optimisticUserMsg]);

    try {
      // Save user message to backend
      const savedUserMsg = await createMessage({ session_id: sessionId, mode_id: modeId, step_number: currentStep, role: "user", content: text });
      console.log("[CHAT_FLOW] 2. user message saved");

      // Clear optimistic after save
      setOptimisticMessages([]);
      queryClient.invalidateQueries({ queryKey: ["messages", sessionId, currentUser?.email] });

      // Crisis check (high severity)
      if (checkCrisis(text)) {
        await createMessage({ session_id: sessionId, role: "system", content: CRISIS_MESSAGE });
        const created = await base44.entities.RiskEvent.create({
          session_id: sessionId,
          message_id: savedUserMsg?.id,
          user_id: currentUser?.id,
          risk_type: "suicide_mention",
          severity: "high",
          trigger_text: text.substring(0, 500),
          detected_at: new Date().toISOString(),
          status: "open",
        });
        console.log("[RISK_EVENT_CREATED]", { id: created?.id, severity: "high", session_id: sessionId });
        await base44.entities.Session.update(sessionId, { risk_flag: true });
        queryClient.invalidateQueries({ queryKey: ["messages", sessionId, currentUser?.email] });
        return;
      }

      // Low-severity distress check — log a RiskEvent but keep the session flowing
      if (checkLowRisk(text)) {
        const createdLow = await base44.entities.RiskEvent.create({
          session_id: sessionId,
          message_id: savedUserMsg?.id,
          user_id: currentUser?.id,
          risk_type: "other",
          severity: "low",
          trigger_text: text.substring(0, 500),
          detected_at: new Date().toISOString(),
          status: "open",
        });
        console.log("[RISK_EVENT_CREATED]", { id: createdLow?.id, severity: "low", session_id: sessionId });
      }

      // Fetch current step from DB
      const stepKey = `${modeId}_${currentStep}`;
      console.log("[CHAT_FLOW] looking up step_key:", stepKey);
      const step = await fetchStep(modeId, currentStep);
      console.log("[STEP_LOOKUP]", {
        sessionId,
        modeId,
        currentStep,
        lookupKey: stepKey,
        stepFound: !!step,
      });
      if (!step) {
        // Soft fallback — never dead-end. Show an error message in chat but keep input enabled.
        console.error("[CHAT_FLOW] step not found — soft fallback, input stays enabled:", stepKey);
        setOptimisticMessages([]);
        setIsAiLoading(false);
        setSendErrorMessage("Произошла ошибка загрузки шага. Попробуйте обновить страницу.");
        setSendError(true);
        return;
      }

      setIsAiLoading(true);
      setShiftSuggestion(null);

      // Refresh messages for AI context
      console.log("[CHAT_FLOW] 3. AI generation started");
      const updatedMessages = await listMessages(sessionId);

      // Load user memory and format it for the prompt
      const memories = await loadUserMemories(currentUser?.id);
      const memoriesBlock = formatMemoriesForPrompt(memories);

      // Get AI response
      let rawResponse;
      try {
        rawResponse = await getAIResponse(session, step, updatedMessages, text, language, memoriesBlock);
        console.log("[CHAT_FLOW] 4. AI response generated, length:", rawResponse?.length);
      } catch (aiErr) {
        console.error("[CHAT_FLOW] AI generation failed:", aiErr);
        rawResponse = t("ai_error_fallback", language);
        setSendErrorMessage(`Ошибка AI: ${aiErr?.message || String(aiErr)}`);
      }

      const { cleanText, suggestedMode } = parseShiftSuggestion(rawResponse);

      // Save assistant message (always, even if AI failed — show fallback)
      console.log("[CHAT_FLOW] 5. assistant message save started");
      try {
        await createMessage({ session_id: sessionId, mode_id: modeId, step_number: currentStep, role: "assistant", content: cleanText });
        console.log("[CHAT_FLOW] 6. assistant message save success");
      } catch (saveErr) {
        console.error("[CHAT_FLOW] assistant message save failed:", saveErr);
        setSendErrorMessage(`Ошибка сохранения ответа: ${saveErr?.message || String(saveErr)}`);
        setIsAiLoading(false);
        queryClient.invalidateQueries({ queryKey: ["messages", sessionId, currentUser?.email] });
        return;
      }

      console.log("[CHAT_FLOW] 7. assistant message rendered");

      // Advance step using next_step_on_answer
      const nextStep = step.next_step_on_answer ? Number(step.next_step_on_answer) : null;

      if (nextStep) {
        await base44.entities.Session.update(sessionId, { current_step: nextStep });
      } else {
        // No next step — final closing message shown; reveal "Завершить сессию" button instead of auto-redirect
        setSessionComplete(true);
      }

      queryClient.invalidateQueries({ queryKey: ["session", sessionId, currentUser?.email] });
      queryClient.invalidateQueries({ queryKey: ["messages", sessionId, currentUser?.email] });
      setIsAiLoading(false);

      if (suggestedMode) {
        setShiftSuggestion({ suggestedMode });
      }
    } catch (err) {
      console.error("[CHAT_FLOW] send failed at unknown stage:", err);
      setOptimisticMessages([]);
      setIsAiLoading(false);
      setSendError(true);
      setSendErrorMessage(err?.message || String(err));
      lastFailedMessageRef.current = text;
      queryClient.invalidateQueries({ queryKey: ["messages", sessionId, currentUser?.email] });
    }
  };

  // ── Step back: undo last exchange (user answer + facilitator reply) ────────
  const handleUndo = async () => {
    if (!session || isAdminView || isAiLoading || isUndoing) return;
    setIsUndoing(true);
    setSendError(false);
    setSendErrorMessage(null);
    try {
      const res = await revertLastExchange(sessionId);
      if (res?.reverted) {
        setSessionComplete(false);
        setShiftSuggestion(null);
        if (res.removed_user_text) {
          setSeedText(res.removed_user_text);
          setSeedNonce((n) => n + 1);
        }
        queryClient.invalidateQueries({ queryKey: ["session", sessionId, currentUser?.email] });
        queryClient.invalidateQueries({ queryKey: ["messages", sessionId, currentUser?.email] });
      }
    } catch (err) {
      console.error("[UNDO] revert failed:", err?.message || err);
      setSendError(true);
      setSendErrorMessage(
        language === "es"
          ? "No se pudo volver un paso atrás. Inténtalo de nuevo."
          : "Не удалось вернуться на шаг назад. Попробуй ещё раз."
      );
    } finally {
      setIsUndoing(false);
    }
  };

  // ── End session (manual) ──────────────────────────────────────────────────
  const handleEndSession = async () => {
    setIsEnding(true);
    const allMessages = await listMessages(sessionId);
    await finalizeSession(allMessages);
  };

  const handleEndSessionSilent = async (msgs) => {
    setIsAiLoading(false);
    setIsEnding(true);
    await finalizeSession(msgs);
  };

  const finalizeSession = async (passedMessages) => {
    const redirectTimer = setTimeout(() => {
      navigate(`/session/${sessionId}/summary`);
    }, 15000);

    try {
      // Always re-fetch messages scoped strictly to THIS session to prevent data mixing
      const sessionMessages = await listMessages(sessionId);

      const userMessages = sessionMessages.filter((m) => m.role === "user");

      console.log(
        "[SessionFlow] finalizing session:", sessionId,
        "owner:", currentUser?.email,
        "total messages:", sessionMessages.length,
        "user messages:", userMessages.length,
        "first preview:", userMessages[0]?.content?.substring(0, 60) || "(none)"
      );

      // Guard: if no real user messages, skip LLM and save fallback only
      if (userMessages.length === 0) {
        console.warn("[SessionFlow] No user messages found — saving fallback summary only");
        await base44.entities.Session.update(sessionId, {
          status: "completed",
          ended_at: new Date().toISOString(),
          summary: "Сессия завершена. Резюме недоступно.",
          themes: [],
          signals: [],
          next_step_suggestion: "",
        });
      } else {
        const summaryData = await generateSessionSummary(session, sessionMessages, language);
        await base44.entities.Session.update(sessionId, {
          status: "completed",
          ended_at: new Date().toISOString(),
          summary: summaryData.summary || "Сессия завершена.",
          themes: summaryData.themes || [],
          signals: summaryData.signals || [],
          next_step_suggestion: summaryData.next_step_suggestion || "",
          confidence_note: summaryData.confidence_note || "",
        });
      }

      // Keep AppUser.last_session_id pointing at the most recent session
      if (appUser?.id) {
        await base44.entities.AppUser.update(appUser.id, { last_session_id: sessionId }).catch(() => {});
      }

      // ── Persist memory via backend (service role, silent, idempotent) ────
      // Fire-and-forget: do NOT await — must not delay the redirect or surface errors.
      base44.functions
        .invoke("persistSessionMemory", { session_id: sessionId })
        .then((res) => console.log("[SessionFlow] memory persist requested:", res?.data))
        .catch((memErr) => console.error("[SessionFlow] memory persist request failed (silent):", memErr?.message));
    } catch (e) {
      console.error("[SessionFlow] finalization error:", e.message);
      await base44.entities.Session.update(sessionId, {
        status: "completed",
        ended_at: new Date().toISOString(),
        summary: "Сессия завершена. Резюме недоступно.",
        themes: [],
        signals: [],
        next_step_suggestion: "",
      }).catch(() => {});
    } finally {
      clearTimeout(redirectTimer);
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      navigate(`/session/${sessionId}/summary`);
    }
  };

  // ── Mode shift ────────────────────────────────────────────────────────────
  const handleContinueMode = () => setShiftSuggestion(null);

  const handleSwitchMode = async () => {
    if (!shiftSuggestion?.suggestedMode) return;
    await base44.entities.Session.update(sessionId, {
      mode_id: shiftSuggestion.suggestedMode,
      current_step: 1,
    });
    setShiftSuggestion(null);
    initDone.current = false;
    queryClient.invalidateQueries({ queryKey: ["session", sessionId, currentUser?.email] });
    queryClient.invalidateQueries({ queryKey: ["messages", sessionId, currentUser?.email] });
  };

  // ── Manual reload ─────────────────────────────────────────────────────────
  const handleReload = () => {
    const retryText = lastFailedMessageRef.current;
    setSendError(false);
    setSendErrorMessage(null);
    lastFailedMessageRef.current = null;
    queryClient.invalidateQueries({ queryKey: ["messages", sessionId, currentUser?.email] });
    if (retryText) {
      setTimeout(() => handleSend(retryText), 300);
    } else {
      refetchMessages();
    }
  };

  // ── Guards ────────────────────────────────────────────────────────────────
  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Необходима авторизация</p>
      </div>
    );
  }

  if (sessionLoading || msgsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (accessDenied || (!sessionLoading && !session)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Сессия не найдена</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Admin debug banner */}
      {isAdminView && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>Режим разработчика: просмотр чужой сессии (только чтение)</span>
        </div>
      )}

      <SessionHeader
        session={session}
        totalSteps={totalSteps}
        onEndSession={handleEndSession}
      />

      {isEnding && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Создаём резюме сессии...</p>
          </div>
        </div>
      )}

      {!isEnding && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  sessionId={sessionId}
                  sourceMode={session?.mode_id || session?.mode}
                  language={language}
                />
              ))}

              {/* AI loading indicator */}
              {isAiLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  </div>
                  <div className="bg-accent rounded-2xl rounded-tl-md px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-pulse" />
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-pulse" style={{ animationDelay: "0.2s" }} />
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-pulse" style={{ animationDelay: "0.4s" }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Send error */}
              {sendError && (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/5">
                  <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-destructive">{sendErrorMessage || "Ошибка отправки. Попробуй ещё раз."}</p>
                    <Button size="sm" variant="outline" className="mt-2 gap-1.5" onClick={handleReload}>
                      <RefreshCw className="w-3.5 h-3.5" />
                      Перезагрузить чат
                    </Button>
                  </div>
                </div>
              )}

              {/* Step load error — admins get full diagnostics, regular users get a soft message.
                  Either way the input below stays enabled (never dead-end). */}
              {stepError && (currentUser?.role === "admin" ? (
                <StepErrorDebug
                  session={session}
                  stepDebugInfo={stepDebugInfo}
                  navigate={navigate}
                  onGreetingCreated={() => {
                    initDone.current = true;
                    setStepError(false);
                    setStepDebugInfo(null);
                    queryClient.invalidateQueries({ queryKey: ["messages", sessionId, currentUser?.email] });
                  }}
                />
              ) : (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/5">
                  <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-destructive">
                      Произошла ошибка загрузки шага. Попробуйте обновить страницу.
                    </p>
                    <Button size="sm" variant="outline" className="mt-2 gap-1.5" onClick={handleReload}>
                      <RefreshCw className="w-3.5 h-3.5" />
                      Перезагрузить чат
                    </Button>
                  </div>
                </div>
              ))}

              {/* Session complete — clear closing + explicit end button */}
              {sessionComplete && !isAiLoading && (
                <div className="flex flex-col items-center gap-3 p-5 rounded-2xl border border-primary/20 bg-primary/5 text-center">
                  <p className="text-sm text-muted-foreground">
                    {language === "es"
                      ? "Esta sesión ha llegado a su cierre natural."
                      : "Эта сессия подошла к естественному завершению."}
                  </p>
                  <Button size="lg" onClick={handleEndSession}>
                    {language === "es" ? "Finalizar sesión" : "Завершить сессию"}
                  </Button>
                </div>
              )}

              {/* Mode shift suggestion */}
              {shiftSuggestion && (
                <div className="flex flex-col gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5">
                  <p className="text-sm font-medium">
                    Похоже, разговор движется в другом направлении. Хотите переключиться?
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Предложенный режим: <span className="font-semibold">{shiftSuggestion.suggestedMode}</span>
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={handleContinueMode}>
                      Продолжить текущий режим
                    </Button>
                    <Button size="sm" onClick={handleSwitchMode}>
                      Переключиться
                    </Button>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="border-t border-border bg-card/80 backdrop-blur-lg px-4 py-3">
            <div className="max-w-3xl mx-auto">
              {!isAdminView && !sessionComplete && messages.some((m) => m.role === "user") && (
                <div className="mb-2 flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleUndo}
                    disabled={isUndoing || isAiLoading || !!shiftSuggestion}
                    className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground"
                    title={language === "es" ? "Corregir tu última respuesta" : "Исправить последний ответ"}
                  >
                    {isUndoing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5" />
                    )}
                    {language === "es" ? "Volver un paso atrás" : "Вернуться на шаг назад"}
                  </Button>
                </div>
              )}
              {(() => {
                // Input is disabled ONLY for states where typing makes no sense.
                // stepError NO LONGER disables input — user must always be able to type.
                const inputDisabled = !!shiftSuggestion || isAdminView || sessionComplete;
                console.log("[CHAT_INPUT_STATE]", {
                  disabled: inputDisabled,
                  loading: isAiLoading,
                  isGenerating: isAiLoading,
                  sessionLoaded: !!session,
                  currentStep: session?.current_step ?? null,
                  stepError,
                });
                return (
                  <ChatInput
                    onSend={handleSend}
                    isLoading={isAiLoading}
                    disabled={inputDisabled}
                    seedText={seedText}
                    seedNonce={seedNonce}
                  />
                );
              })()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}