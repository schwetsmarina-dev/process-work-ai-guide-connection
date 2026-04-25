import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { MODE_STEPS, CRISIS_MESSAGE } from "@/lib/modeSteps";
import { getAIResponse, generateSessionSummary, checkCrisis } from "@/lib/sessionAI";
import SessionHeader from "@/components/session/SessionHeader";
import ChatMessage from "@/components/session/ChatMessage";
import ChatInput from "@/components/session/ChatInput";

export default function SessionChat() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const pathParts = window.location.pathname.split("/");
  const sessionId = pathParts[pathParts.length - 1];

  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const messagesEndRef = useRef(null);

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: async () => {
      const sessions = await base44.entities.Session.filter({ id: sessionId });
      return sessions[0];
    },
    enabled: !!sessionId,
  });

  const { data: messages = [], isLoading: msgsLoading } = useQuery({
    queryKey: ["messages", sessionId],
    queryFn: () => base44.entities.Message.filter({ session_id: sessionId }, "created_date"),
    enabled: !!sessionId,
  });

  // Send initial greeting
  useEffect(() => {
    if (!session || msgsLoading || messages.length > 0) return;

    const steps = MODE_STEPS[session.mode] || [];
    const firstStep = steps[0];
    if (firstStep) {
      const greeting = `Давайте начнём.\n\n${firstStep.question}`;
      base44.entities.Message.create({
        session_id: sessionId,
        role: "assistant",
        content: greeting,
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["messages", sessionId] });
      });
    }
  }, [session, msgsLoading, messages.length, sessionId, queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text) => {
    // Save user message
    await base44.entities.Message.create({
      session_id: sessionId,
      role: "user",
      content: text,
    });
    queryClient.invalidateQueries({ queryKey: ["messages", sessionId] });

    // Check for crisis
    if (checkCrisis(text)) {
      await base44.entities.Message.create({
        session_id: sessionId,
        role: "system",
        content: CRISIS_MESSAGE,
      });
      await base44.entities.RiskEvent.create({
        session_id: sessionId,
        type: "suicide_mention",
        severity: "high",
        trigger_text: text.substring(0, 200),
      });
      await base44.entities.Session.update(sessionId, { risk_flag: true });
      queryClient.invalidateQueries({ queryKey: ["messages", sessionId] });
      return;
    }

    // Get AI response
    setIsAiLoading(true);
    const updatedMessages = await base44.entities.Message.filter(
      { session_id: sessionId },
      "created_date"
    );

    const aiResponse = await getAIResponse(session, updatedMessages, text);

    await base44.entities.Message.create({
      session_id: sessionId,
      role: "assistant",
      content: aiResponse,
    });

    // Advance step
    const steps = MODE_STEPS[session.mode] || [];
    const nextStep = (session.current_step || 0) + 1;
    if (nextStep <= steps.length) {
      await base44.entities.Session.update(sessionId, { current_step: nextStep });
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
    }

    queryClient.invalidateQueries({ queryKey: ["messages", sessionId] });
    setIsAiLoading(false);
  };

  const handleEndSession = async () => {
    setIsEnding(true);
    const allMessages = await base44.entities.Message.filter(
      { session_id: sessionId },
      "created_date"
    );

    const summaryData = await generateSessionSummary(session, allMessages);

    await base44.entities.Session.update(sessionId, {
      status: "completed",
      ended_at: new Date().toISOString(),
      summary: summaryData.summary,
      themes: summaryData.themes,
      signals: summaryData.signals,
      next_step_suggestion: summaryData.next_step_suggestion,
    });

    // Save memories
    if (summaryData.memories?.length > 0) {
      await base44.entities.UserMemory.bulkCreate(
        summaryData.memories.map((m) => ({
          key: m.key,
          value: m.value,
          category: m.category,
          importance: m.importance,
        }))
      );
    }

    queryClient.invalidateQueries({ queryKey: ["sessions"] });
    navigate(`/session/${sessionId}/summary`);
  };

  if (sessionLoading || msgsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Сессия не найдена</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <SessionHeader session={session} onEndSession={handleEndSession} />

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
                <ChatMessage key={msg.id} message={msg} />
              ))}
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
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="border-t border-border bg-card/80 backdrop-blur-lg px-4 py-3">
            <div className="max-w-3xl mx-auto">
              <ChatInput onSend={handleSend} isLoading={isAiLoading} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}