import React from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Heart, Moon, GitBranch, PenLine, ArrowLeft, Sparkles, Tag, Zap, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MODE_LABELS, MODE_ICONS } from "@/lib/modeSteps";
import { format } from "date-fns";
import { motion } from "framer-motion";

const iconMap = { Heart, Moon, GitBranch, PenLine };

export default function SessionSummary() {
  const navigate = useNavigate();
  const pathParts = window.location.pathname.split("/");
  const sessionId = pathParts[2];

  const { data: session, isLoading } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: async () => {
      const sessions = await base44.entities.Session.filter({ id: sessionId });
      return sessions[0];
    },
    enabled: !!sessionId,
  });

  if (isLoading) {
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

  const Icon = iconMap[MODE_ICONS[session.mode]] || Heart;
  const label = MODE_LABELS[session.mode]?.ru || session.mode;

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <Button
        variant="ghost"
        onClick={() => navigate("/dashboard")}
        className="mb-6 text-muted-foreground"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Назад
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
              <h3 className="font-semibold text-sm">Резюме</h3>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {session.summary || "Резюме не создано"}
            </p>
          </Card>
        </motion.div>

        {/* Themes */}
        {session.themes?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <Tag className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm">Темы</h3>
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

        {/* Signals */}
        {session.signals?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm">Замеченные сигналы</h3>
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
                <h3 className="font-semibold text-sm">Следующий шаг</h3>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {session.next_step_suggestion}
              </p>
            </Card>
          </motion.div>
        )}
      </div>

      <div className="mt-10 flex justify-center">
        <Button onClick={() => navigate("/dashboard")} size="lg" className="rounded-xl">
          Новая сессия
        </Button>
      </div>
    </div>
  );
}