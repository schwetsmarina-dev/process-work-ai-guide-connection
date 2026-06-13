import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listMessages } from "@/lib/messageApi";
import { Heart, Moon, GitBranch, PenLine, ArrowLeft, Sparkles, Tag, Zap, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MODE_LABELS, MODE_ICONS } from "@/lib/modeSteps";
import { format } from "date-fns";
import { motion } from "framer-motion";
import SessionInsightSuggestions from "@/components/session/SessionInsightSuggestions";
import { extractInsightsFromSession } from "@/lib/insightAI";
import FullSessionReport from "@/components/session/FullSessionReport";
import SessionFeedbackForm from "@/components/session/SessionFeedbackForm";
import SummaryActions from "@/components/session/SummaryActions";
import SessionNotFoundDiagnostic from "@/components/session/SessionNotFoundDiagnostic";
import SessionHighlights from "@/components/session/SessionHighlights";
import { normalizeLang, t } from "@/lib/i18n";

const iconMap = { Heart, Moon, GitBranch, PenLine };

export default function SessionSummary() {
  const navigate = useNavigate();
  const pathParts = window.location.pathname.split("/");
  const sessionId = pathParts[2];
  const [insightSuggestions, setInsightSuggestions] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [appUser, setAppUser] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const language = normalizeLang(appUser?.language || "ru");

  useEffect(() => {
    (async () => {
      const u = await base44.auth.me();
      console.log("CURRENT USER:", u?.id, u?.email);
      setCurrentUser(u);
      const rows = await base44.entities.AppUser.filter({ email: u?.email });
      setAppUser(rows[0] || null);
    })();
  }, []);

  const { data: session, isLoading } = useQuery({
    queryKey: ["session", sessionId, currentUser?.email],
    queryFn: async () => {
      const sessions = await base44.entities.Session.filter({ id: sessionId });
      const found = sessions[0];
      const isAdmin =
        currentUser?.role === "admin" ||
        currentUser?.email === "schwets.marina@gmail.com";

      if (!found) {
        const params = new URLSearchParams(window.location.search);
        console.log("[SESSION_NOT_FOUND_FROM_FEEDBACK]", {
          sessionId,
          feedbackUserEmail: params.get("fe"),
          feedbackCreatedAt: params.get("fc"),
        });
        setAccessDenied(true);
        return null;
      }

      if (found.created_by !== currentUser.email && !isAdmin) {
        setAccessDenied(true);
        return null;
      }

      if (isAdmin && found.created_by !== currentUser.email) {
        console.log("[ADMIN_SUMMARY_ACCESS_GRANTED]", {
          adminEmail: currentUser.email,
          sessionId,
          sessionOwner: found.created_by,
        });
      }

      return found;
    },
    enabled: !!sessionId && !!currentUser?.email,
  });

  const queryClient = useQueryClient();

  const { data: messages = [], isError: messagesError, refetch: refetchMessages } = useQuery({
    queryKey: ["messages", sessionId],
    queryFn: async () => {
      const msgs = await listMessages(sessionId);
      return Array.isArray(msgs) ? msgs : [];
    },
    enabled: !!sessionId && !accessDenied && !!session,
  });

  useEffect(() => {
    if (session && messages.length > 0 && insightSuggestions.length === 0) {
      extractInsightsFromSession(session, messages)
        .then(setInsightSuggestions)
        .catch(() => {});
    }
  }, [session, messages]);

  if (!currentUser || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (accessDenied || (!isLoading && currentUser && !session)) {
    const params = new URLSearchParams(window.location.search);
    const fromFeedback = params.get("from") === "feedback";
    const isAdmin = currentUser?.role === "admin" || currentUser?.email === "schwets.marina@gmail.com";
    if (fromFeedback && isAdmin) {
      return (
        <SessionNotFoundDiagnostic
          sessionId={sessionId}
          fromFeedback={{ userEmail: params.get("fe"), createdAt: params.get("fc") }}
        />
      );
    }
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Сессия не найдена</p>
      </div>
    );
  }

  const resolvedMode = session.mode_id || session.mode || "journaling";
  const Icon = iconMap[MODE_ICONS[resolvedMode]] || Heart;
  const label = MODE_LABELS[resolvedMode]?.ru || resolvedMode;
  const isAdmin = currentUser?.role === "admin" || currentUser?.email === "schwets.marina@gmail.com";
  const isAdminViewing = isAdmin && session.created_by !== currentUser.email;

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 md:py-12">
      {isAdminViewing && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm text-center">
          {language === "es"
            ? "Modo administrador: vista de la sesión de un usuario. No se realizan cambios."
            : "Режим администратора: просмотр сессии пользователя. Изменения не вносятся."}
        </div>
      )}

      <Button
        variant="ghost"
        onClick={() => navigate("/dashboard")}
        className="mb-6 text-muted-foreground"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        {t("back", language)}
      </Button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-semibold">{label}</h1>
            <p className="text-sm text-muted-foreground">
              {session.created_date && format(new Date(session.created_date), "d MMM yyyy, HH:mm")}
            </p>
          </div>
        </div>
      </motion.div>

      <div className="space-y-6 mt-8">
        {/* Summary */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">{t("summary", language)}</h3>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {session.summary || t("summary_missing", language)}
            </p>
            {session.confidence_note && session.summary && session.summary !== "Сессия завершена. Резюме недоступно." && (
              <p className="text-xs text-muted-foreground/70 italic mt-3 pt-3 border-t border-border">
                {session.confidence_note}
              </p>
            )}
          </Card>
        </motion.div>

        {/* Quick visual overview of themes + signals */}
        {session.summary !== "Сессия завершена. Резюме недоступно." && (
          <SessionHighlights
            themes={session.themes || []}
            signals={session.signals || []}
            language={language}
          />
        )}

        {/* Themes — only show if summary is not the fallback */}
        {session.themes?.length > 0 && session.summary !== "Сессия завершена. Резюме недоступно." && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <Tag className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm">{t("themes", language)}</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {session.themes.map((theme, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {theme}
                  </Badge>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Signals — only show if summary is not the fallback */}
        {session.signals?.length > 0 && session.summary !== "Сессия завершена. Резюме недоступно." && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm">{t("noticed_signals", language)}</h3>
              </div>
              <ul className="space-y-2">
                {session.signals.map((signal, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                    {signal}
                  </li>
                ))}
              </ul>
            </Card>
          </motion.div>
        )}

        {/* Next step */}
        {session.next_step_suggestion && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card className="p-6 border-primary/20 bg-primary/5">
              <div className="flex items-center gap-2 mb-3">
                <ArrowRight className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm">{t("next_step", language)}</h3>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {session.next_step_suggestion}
              </p>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Messages load error */}
      {messagesError && (
        <div className="mt-6 p-4 rounded-xl border border-destructive/30 bg-destructive/5 flex items-center justify-between">
          <p className="text-sm text-destructive">{t("messages_load_error", language)}</p>
          <Button size="sm" variant="outline" onClick={() => refetchMessages()}>{t("retry", language)}</Button>
        </div>
      )}

      {/* Full session report */}
      {messages.length > 0 && (
        <FullSessionReport session={session} messages={messages} />
      )}

      {/* Summary actions: regenerate (if fallback) or save to diary */}
      {!messagesError && messages.length > 0 && (
        <SummaryActions
          session={session}
          language={language}
          onUpdated={() => queryClient.invalidateQueries({ queryKey: ["session", sessionId, currentUser?.email] })}
        />
      )}

      {/* Feedback (beta) — only for completed sessions owned by the user */}
      {session.status === "completed" && currentUser && session.created_by === currentUser.email && (
        <SessionFeedbackForm session={session} user={currentUser} language={language} />
      )}

      {/* Insight suggestions */}
      {insightSuggestions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-6"
        >
          <SessionInsightSuggestions suggestions={insightSuggestions} session={session} />
        </motion.div>
      )}

      <div className="mt-10 flex flex-col sm:flex-row justify-center gap-3">
        <Button variant="outline" onClick={() => navigate("/insights-library")} className="rounded-xl">
          {t("insight_library", language)}
        </Button>
        <Button onClick={() => navigate("/dashboard")} size="lg" className="rounded-xl">
          {t("new_session", language)}
        </Button>
      </div>
    </div>
  );
}