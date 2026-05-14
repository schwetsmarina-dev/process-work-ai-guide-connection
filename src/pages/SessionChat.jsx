import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, AlertTriangle, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  checkCrisis,
  CRISIS_MESSAGE,
  fetchStep,
  getAIResponse,
  generateSessionSummary,
} from "@/lib/sessionAI";
import SessionHeader from "@/components/session/SessionHeader";
import ChatMessage from "@/components/session/ChatMessage";
import ChatInput from "@/components/session/ChatInput";

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
  const [stepError, setStepError] = useState(false);
  const [stepDebugInfo, setStepDebugInfo] = useState(null);
  const [sendError, setSendError] = useState(false);
  const [sendErrorMessage, setSendErrorMessage] = useState(null);
  const [shiftSuggestion, setShiftSuggestion] = useState(null);
  const [totalSteps, setTotalSteps] = useState(0);
  const [currentUser, setCurrentUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [isAdminView, setIsAdminView] = useState(false);
  // Optimistic messages shown while backend confirms
  const [optimisticMessages, setOptimisticMessages] = useState([]);
  const messagesEndRef = useRef(null);
  const initDone = useRef(false);

  // ── Reset all init state when sessionId changes ───────────────────────────
  useEffect(() => {
    initDone.current = false;
    setStepError(false);
    setStepDebugInfo(null);
    setOptimisticMessages([]);
  }, [sessionId]);

  // ── Load current user first ───────────────────────────────────────────────
  useEffect(() => {
    base44.auth.me().then((u) => {
      console.log("[SessionChat] currentUser loaded:", u?.email, "role:", u?.role);
      setCurrentUser(u);
      setUserLoading(false);
    }).catch((err) => {
      console.error("[SessionChat] auth.me() failed:", err);
      setUserLoading(false);
    });
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
      const msgs = await base44.entities.Message.filter({ session_id: sessionId }, "created_date");
      console.log("[SessionFlow] messages loaded:", msgs.length, "for session:", sessionId);
      return msgs;
    },
    // Only load messages AFTER session ownership has been confirmed (session !== null + not denied)
    enabled: !!sessionId && !!currentUser?.email && !accessDenied && !!session,
  });

  // Merge DB messages with optimistic ones (de-dup by content+role for pending)
  const messages = useMemo(() => {
    if (optimisticMessages.length === 0) return dbMessages;
    return dbMessages;
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
    const stepNum = 1;

    if (!modeId) {
      console.error("[SESSION_INIT] Cannot init — missing modeId", { mode_id: session.mode_id, mode: session.mode });
      setStepError(true);
      return;
    }

    // Mark init started — prevent double-fire
    initDone.current = true;

    // Always clear stale error state before attempting lookup
    setStepError(false);
    setStepDebugInfo(null);

    const stepKey = `${modeId}_${stepNum}`;
    console.log("[SESSION_INIT] session loaded — mode:", modeId, "step_key:", stepKey, "session:", sessionId);
    console.log("[SESSION_INIT] fetching step...");

    let cancelled = false;

    fetchStep(modeId, stepNum).then(async (step) => {
      if (cancelled) return;

      if (!step) {
        console.error("[SESSION_INIT] step render failed — fetchStep returned null for", stepKey);
        // Gather diagnostics without doing duplicate ModeStep queries (fetchStep already logged them)
        const allSteps = await base44.entities.ModeStep.list("step_number", 20).catch(() => []);
        const forMode = allSteps.filter((s) => String(s.mode_id || "").trim() === modeId);
        const availableKeys = forMode.map((s) => s.step_key || `[no key, step_number=${s.step_number}]`);
        const allModeIds = [...new Set(allSteps.map((s) => s.mode_id).filter(Boolean))];
        const sampleRows = allSteps.map((s) => `${s.mode_id}/${s.step_key || s.step_number}`);
        setStepDebugInfo({ stepKey, modeId, stepNum, availableKeys, totalStepsInDb: allSteps.length, allModeIds, sampleRows });
        setStepError(true);
        return;
      }

      console.log("[SESSION_INIT] step found:", step.step_key || step._stepKey);
      const greeting = `Давай начнём.\n\n${step.question}`;
      await base44.entities.Message.create({
        session_id: sessionId,
        mode_id: modeId,
        step_number: stepNum,
        role: "assistant",
        content: greeting,
        created_at: new Date().toISOString(),
      });
      console.log("[SESSION_INIT] step render success — greeting saved");
      queryClient.invalidateQueries({ queryKey: ["messages", sessionId, currentUser?.email] });
    }).catch((err) => {
      if (cancelled) return;
      console.error("[SESSION_INIT] step render failed — exception:", err?.message || err);
      setStepError(true);
    });

    return () => { cancelled = true; };
  }, [session?.id, msgsLoading, dbMessages.length, isAdminView]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, optimisticMessages]);

  // ── Send user message ─────────────────────────────────────────────────────
  const handleSend = async (text) => {
    if (!session || isAdminView) return;
    setSendError(false);
    setSendErrorMessage(null);

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
      await base44.entities.Message.create({
        session_id: sessionId,
        mode_id: modeId,
        step_number: currentStep,
        role: "user",
        content: text,
        created_at: new Date().toISOString(),
      });
      console.log("[CHAT_FLOW] 2. user message saved");

      // Clear optimistic after save
      setOptimisticMessages([]);
      queryClient.invalidateQueries({ queryKey: ["messages", sessionId, currentUser?.email] });

      // Crisis check
      if (checkCrisis(text)) {
        await base44.entities.Message.create({
          session_id: sessionId,
          role: "system",
          content: CRISIS_MESSAGE,
          created_at: new Date().toISOString(),
        });
        await base44.entities.RiskEvent.create({
          session_id: sessionId,
          risk_type: "suicide_mention",
          severity: "high",
          trigger_text: text.substring(0, 500),
          detected_at: new Date().toISOString(),
          status: "open",
        });
        await base44.entities.Session.update(sessionId, { risk_flag: true });
        queryClient.invalidateQueries({ queryKey: ["messages", sessionId, currentUser?.email] });
        return;
      }

      // Fetch current step from DB
      const stepKey = `${modeId}_${currentStep}`;
      console.log("[CHAT_FLOW] looking up step_key:", stepKey);
      const step = await fetchStep(modeId, currentStep);
      if (!step) {
        const [forMode, allSteps] = await Promise.all([
          base44.entities.ModeStep.filter({ mode_id: modeId }),
          base44.entities.ModeStep.list("step_number", 10),
        ]);
        const availableKeys = forMode.map((s) => s.step_key || `[no key, step_number=${s.step_number}]`);
        const allModeIds = [...new Set(allSteps.map((s) => s.mode_id).filter(Boolean))];
        setStepDebugInfo({ stepKey, modeId, stepNum: currentStep, availableKeys, totalStepsInDb: allSteps.length, allModeIds, sampleRows: allSteps.map((s) => `${s.mode_id}/${s.step_key || s.step_number}`) });
        setStepError(true);
        return;
      }

      setIsAiLoading(true);
      setShiftSuggestion(null);

      // Refresh messages for AI context
      console.log("[CHAT_FLOW] 3. AI generation started");
      const updatedMessages = await base44.entities.Message.filter(
        { session_id: sessionId },
        "created_date"
      );

      // Get AI response
      let rawResponse;
      try {
        rawResponse = await getAIResponse(session, step, updatedMessages, text);
        console.log("[CHAT_FLOW] 4. AI response generated, length:", rawResponse?.length);
      } catch (aiErr) {
        console.error("[CHAT_FLOW] AI generation failed:", aiErr);
        rawResponse = "Сейчас произошла ошибка генерации ответа. Попробуй ещё раз.";
        setSendErrorMessage(`Ошибка AI: ${aiErr?.message || String(aiErr)}`);
      }

      const { cleanText, suggestedMode } = parseShiftSuggestion(rawResponse);

      // Save assistant message (always, even if AI failed — show fallback)
      console.log("[CHAT_FLOW] 5. assistant message save started");
      try {
        await base44.entities.Message.create({
          session_id: sessionId,
          mode_id: modeId,
          step_number: currentStep,
          role: "assistant",
          content: cleanText,
          created_at: new Date().toISOString(),
        });
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
        // No next step — complete session
        await handleEndSessionSilent(updatedMessages);
        return;
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
      queryClient.invalidateQueries({ queryKey: ["messages", sessionId, currentUser?.email] });
    }
  };

  // ── End session (manual) ──────────────────────────────────────────────────
  const handleEndSession = async () => {
    setIsEnding(true);
    const allMessages = await base44.entities.Message.filter(
      { session_id: sessionId },
      "created_date"
    );
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
      const sessionMessages = await base44.entities.Message.filter(
        { session_id: sessionId },
        "created_date"
      );

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
        const summaryData = await generateSessionSummary(session, sessionMessages);
        await base44.entities.Session.update(sessionId, {
          status: "completed",
          ended_at: new Date().toISOString(),
          summary: summaryData.summary || "Сессия завершена.",
          themes: summaryData.themes || [],
          signals: summaryData.signals || [],
          next_step_suggestion: summaryData.next_step_suggestion || "",
        });
        if (summaryData.memories?.length > 0) {
          await base44.entities.UserMemory.bulkCreate(
            summaryData.memories.map((m) => ({
              memory_key: m.key,
              memory_value: m.value,
              memory_type: m.category,
              importance: m.importance,
              source_session_id: sessionId,
              source_mode_id: session.mode_id,
              is_active: true,
              created_at: new Date().toISOString(),
            }))
          );
        }
      }
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
    setSendError(false);
    queryClient.invalidateQueries({ queryKey: ["messages", sessionId, currentUser?.email] });
    refetchMessages();
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

  // Combine DB messages with any pending optimistic ones
  const displayMessages = optimisticMessages.length > 0
    ? [...dbMessages, ...optimisticMessages]
    : dbMessages;

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
              {displayMessages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  sessionId={sessionId}
                  sourceMode={session?.mode_id || session?.mode}
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

              {/* Step not found error — full debug block */}
              {stepError && (
                <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
                    <p className="text-sm font-semibold text-destructive">Шаг не найден (MODE_STEPS)</p>
                  </div>
                  <pre className="text-xs bg-black/5 rounded-lg p-3 font-mono whitespace-pre-wrap text-foreground/80 overflow-x-auto leading-relaxed">
{stepDebugInfo
  ? `mode_id        = "${stepDebugInfo.modeId}"
current_step   = ${stepDebugInfo.stepNum}
step_key       = "${stepDebugInfo.stepKey}"

Steps for this mode (${stepDebugInfo.availableKeys.length}):
${stepDebugInfo.availableKeys.length > 0
  ? stepDebugInfo.availableKeys.join("\n")
  : "  (none — режим не найден в MODE_STEPS)"}

Total MODE_STEPS in DB: ${stepDebugInfo.totalStepsInDb ?? "?"}
Mode IDs in DB: ${stepDebugInfo.allModeIds?.join(", ") || "(empty)"}

DB sample (first 10):
${stepDebugInfo.sampleRows?.join("\n") || "  (empty)"}`
  : `mode_id = "${session?.mode_id}"  step = ${session?.current_step}  (загружаем диагностику...)`
}</pre>
                  <p className="text-xs text-muted-foreground">
                    Откройте /admin/import и загрузите mode_steps.csv. Убедитесь, что mode_id в CSV совпадает с mode_id в MODES.
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => navigate("/dashboard")}>На главную</Button>
                    <Button size="sm" variant="outline" onClick={() => navigate("/admin/status")}>Статус данных</Button>
                  </div>
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
              <ChatInput
                onSend={handleSend}
                isLoading={isAiLoading}
                disabled={!!stepError || !!shiftSuggestion || isAdminView}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}