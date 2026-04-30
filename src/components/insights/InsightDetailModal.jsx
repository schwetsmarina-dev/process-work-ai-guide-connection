import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, ExternalLink, Save } from "lucide-react";
import { format } from "date-fns";

const IMPORTANCE_LABELS = { 1: "наблюдение", 2: "значимое", 3: "ключевой инсайт" };

export default function InsightDetailModal({ insight, onClose }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [note, setNote] = useState(insight?.personal_note || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!insight) return null;

  const saveNote = async () => {
    setSaving(true);
    await base44.entities.Insight.update(insight.id, {
      personal_note: note,
      updated_at: new Date().toISOString(),
    });
    queryClient.invalidateQueries({ queryKey: ["insights"] });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl leading-snug pr-6">{insight.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Meta */}
          <div className="flex flex-wrap gap-2">
            {insight.importance && (
              <Badge variant="secondary">{IMPORTANCE_LABELS[insight.importance] || "значимое"}</Badge>
            )}
            {insight.source_mode && <Badge variant="outline">{insight.source_mode}</Badge>}
            {insight.process_layer && <Badge variant="outline">{insight.process_layer}</Badge>}
            {insight.created_at && (
              <span className="text-xs text-muted-foreground self-center">
                {format(new Date(insight.created_at), "d MMM yyyy, HH:mm")}
              </span>
            )}
          </div>

          {/* Main text */}
          <div className="bg-primary/5 border border-primary/10 rounded-xl p-4">
            <p className="text-sm leading-relaxed">{insight.insight_text}</p>
          </div>

          {/* State keywords */}
          {insight.state_keywords && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Ключевые состояния</p>
              <p className="text-sm">{insight.state_keywords}</p>
            </div>
          )}

          {/* Tags */}
          {insight.tags && (
            <div className="flex flex-wrap gap-1.5">
              {insight.tags.split(",").map((tag, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{tag.trim()}</Badge>
              ))}
            </div>
          )}

          {/* Reflection prompt */}
          <div className="border-t border-border pt-4">
            <p className="text-sm font-medium mb-1">Рефлексия</p>
            <p className="text-sm text-muted-foreground italic">
              «Как этот инсайт проявляется в твоей жизни сейчас?»
            </p>
          </div>

          {/* Personal note */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Личная заметка</p>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Добавь свою мысль или наблюдение..."
              className="min-h-[80px] resize-none text-sm"
            />
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={saveNote}
              disabled={saving}
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {saved ? "Сохранено" : saving ? "Сохраняю..." : "Сохранить заметку"}
            </Button>
          </div>

          {/* Session link */}
          {insight.session_id && (
            <div className="border-t border-border pt-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => { navigate(`/session/${insight.session_id}/summary`); onClose(); }}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Открыть сессию
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}