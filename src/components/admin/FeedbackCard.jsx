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

export default function FeedbackCard({ item, onOpenSession }) {
  const dateStr = item.created_at || item.created_date;
  const formatted = dateStr ? format(new Date(dateStr), "d MMM yyyy, HH:mm") : "—";

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-medium">{item.user_email || "—"}</div>
          <div className="text-xs text-muted-foreground">{formatted}</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary">{MODE_LABELS[item.mode_id] || item.mode_id || "—"}</Badge>
          {item.language && <Badge variant="outline">{item.language.toUpperCase()}</Badge>}
          {typeof item.rating === "number" && (
            <span className="flex items-center gap-1 text-sm font-medium">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              {item.rating}
            </span>
          )}
          {item.would_use_again === true && <Badge className="bg-green-600">Yes</Badge>}
          {item.would_use_again === false && <Badge variant="destructive">No</Badge>}
        </div>
      </div>

      {item.useful && (
        <div>
          <div className="text-xs text-muted-foreground mb-0.5">What was useful</div>
          <p className="text-sm">{item.useful}</p>
        </div>
      )}
      {item.confusing && (
        <div>
          <div className="text-xs text-muted-foreground mb-0.5">What was confusing</div>
          <p className="text-sm">{item.confusing}</p>
        </div>
      )}
      {item.comment && (
        <div>
          <div className="text-xs text-muted-foreground mb-0.5">Comment</div>
          <p className="text-sm italic">{item.comment}</p>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-muted-foreground font-mono">{item.session_id?.slice(0, 8) || "—"}</span>
        {item.session_id && (
          <Button variant="outline" size="sm" onClick={() => onOpenSession(item.session_id)}>
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            Open session
          </Button>
        )}
      </div>
    </Card>
  );
}