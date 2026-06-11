import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft } from "lucide-react";

// Admin-friendly diagnostic shown when a session opened from the feedback admin
// cannot be found, instead of dead-ending on "Сессия не найдена".
export default function SessionNotFoundDiagnostic({ sessionId, fromFeedback }) {
  const navigate = useNavigate();

  useEffect(() => {
    console.log("[SESSION_NOT_FOUND_FROM_FEEDBACK]", {
      session_id: sessionId,
      user_email: fromFeedback?.userEmail || null,
      created_at: fromFeedback?.createdAt || null,
    });
  }, [sessionId, fromFeedback]);

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <Card className="p-6 border-amber-200 bg-amber-50/60 space-y-4">
        <div className="flex items-center gap-2 text-amber-800">
          <AlertTriangle className="w-5 h-5" />
          <h2 className="font-semibold">Сессия не найдена</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Сессия из этого отзыва недоступна (возможно, удалена или принадлежит другому пользователю).
        </p>
        <div className="text-xs font-mono bg-background/60 rounded-lg p-3 space-y-1 border border-amber-200">
          <div>session_id: {sessionId || "—"}</div>
          <div>user_email: {fromFeedback?.userEmail || "—"}</div>
          <div>created_at: {fromFeedback?.createdAt || "—"}</div>
        </div>
        <Button variant="outline" onClick={() => navigate("/admin/feedback")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад к отзывам
        </Button>
      </Card>
    </div>
  );
}