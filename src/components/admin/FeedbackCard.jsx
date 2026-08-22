import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, ExternalLink } from "lucide-react";
import { format } from "date-fns";

const MODE_LABELS = {
  dream: "Dream",
  body: "Body",
  conflict: "Conflict",
  journaling: "Journaling",
};

const EXPERIENCE_LABELS = {
  practice: "Personal practice",
  edge_program_day: "28-day program · day",
  edge_program_week: "28-day program · week",
  edge_program_complete: "28-day program · final",
};

export default function FeedbackCard({ item, onOpenSession }) {
  const dateStr = item.created_at || item.created_date;
  const formatted = dateStr ? format(new Date(dateStr), "d MMM yyyy, HH:mm") : "—";
  const isSession = item._feedback_kind === "session" || Boolean(item.session_id);
  const positive = isSession ? item.useful : item.helpful;
  const negative = isSession ? item.confusing : item.difficult;
  const continueValue = isSession ? item.would_use_again : item.would_continue;

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-medium">{item.user_name || item.user_email || "—"}</div>
          {item.user_name && item.user_email && <div className="text-xs text-muted-foreground">{item.user_email}</div>}
          <div className="text-xs text-muted-foreground">{formatted}</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary">
            {isSession ? (MODE_LABELS[item.mode_id] || item.mode_id || "Session") : (item.experience_label || EXPERIENCE_LABELS[item.experience_type] || item.experience_type || "Experience")}
          </Badge>
          {item.day_number && <Badge variant="outline">Day {item.day_number}</Badge>}
          {item.week_number && <Badge variant="outline">Week {item.week_number}</Badge>}
          {item.language && <Badge variant="outline">{item.language.toUpperCase()}</Badge>}
          {typeof item.rating === "number" && (
            <span className="flex items-center gap-1 text-sm font-medium">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              {item.rating}
            </span>
          )}
          {continueValue === true && <Badge className="bg-green-600">Continue: yes</Badge>}
          {continueValue === false && <Badge variant="destructive">Continue: no</Badge>}
        </div>
      </div>

      {item.program_name && <div className="text-xs text-muted-foreground">{item.program_name}</div>}

      {positive && (
        <div>
          <div className="text-xs text-muted-foreground mb-0.5">What was good / useful</div>
          <p className="text-sm">{positive}</p>
        </div>
      )}
      {negative && (
        <div>
          <div className="text-xs text-muted-foreground mb-0.5">What was difficult / unclear</div>
          <p className="text-sm">{negative}</p>
        </div>
      )}
      {item.insight && (
        <div>
          <div className="text-xs text-muted-foreground mb-0.5">Insight / important experience</div>
          <p className="text-sm font-medium">{item.insight}</p>
        </div>
      )}
      {item.comment && (
        <div>
          <div className="text-xs text-muted-foreground mb-0.5">Comment</div>
          <p className="text-sm italic">{item.comment}</p>
        </div>
      )}

      {isSession && item.session_id && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground font-mono">{item.session_id.slice(0, 8)}</span>
          <Button variant="outline" size="sm" onClick={() => onOpenSession(item.session_id)}>
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            Open session
          </Button>
        </div>
      )}
    </Card>
  );
}
