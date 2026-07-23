import React from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Archive, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { t, getStoredLanguage } from "@/lib/i18n";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";

const IMPORTANCE_KEYS = { 1: "importance_1", 2: "importance_2", 3: "importance_3" };
const IMPORTANCE_COLORS = {
  1: "bg-secondary text-secondary-foreground",
  2: "bg-primary/10 text-primary",
  3: "bg-amber-100 text-amber-800",
};

export default function InsightCard({ insight, onClick }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const toggleFavorite = async (e) => {
    e.stopPropagation();
    await base44.entities.Insight.update(insight.id, { is_favorite: !insight.is_favorite });
    queryClient.invalidateQueries({ queryKey: ["insights"] });
  };

  const toggleArchive = async (e) => {
    e.stopPropagation();
    await base44.entities.Insight.update(insight.id, { is_archived: !insight.is_archived });
    queryClient.invalidateQueries({ queryKey: ["insights"] });
  };

  return (
    <Card
      className="p-5 cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/30 group"
      onClick={() => onClick(insight)}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-semibold text-sm leading-snug flex-1">{insight.title}</h3>
        <div className="flex gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className={`h-7 w-7 ${insight.is_favorite ? "text-amber-500" : "text-muted-foreground opacity-0 group-hover:opacity-100"}`}
            onClick={toggleFavorite}
          >
            <Star className={`w-4 h-4 ${insight.is_favorite ? "fill-amber-500" : ""}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100"
            onClick={toggleArchive}
          >
            <Archive className="w-4 h-4" />
          </Button>
          {insight.session_id && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100"
              onClick={(e) => { e.stopPropagation(); navigate(`/session/${insight.session_id}/summary`); }}
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed mb-3 line-clamp-3">
        {insight.insight_text}
      </p>

      <div className="flex flex-wrap gap-2 items-center">
        {insight.importance && (
          <Badge className={`text-xs ${IMPORTANCE_COLORS[insight.importance] || IMPORTANCE_COLORS[2]}`}>
            {t(IMPORTANCE_KEYS[insight.importance] || "importance_2", getStoredLanguage())}
          </Badge>
        )}
        {insight.source_mode && (
          <Badge variant="outline" className="text-xs">{insight.source_mode}</Badge>
        )}
        {insight.tags && insight.tags.split(",").slice(0, 3).map((tag, i) => (
          <Badge key={i} variant="secondary" className="text-xs">{tag.trim()}</Badge>
        ))}
        <span className="text-xs text-muted-foreground ml-auto">
          {insight.created_at && format(new Date(insight.created_at), "d MMM yyyy")}
        </span>
      </div>
    </Card>
  );
}