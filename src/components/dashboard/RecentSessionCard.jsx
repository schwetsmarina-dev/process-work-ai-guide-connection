import React from "react";
import { Link } from "react-router-dom";
import { Heart, Moon, GitBranch, PenLine, ArrowRight } from "lucide-react";
import { MODE_LABELS, MODE_ICONS } from "@/lib/modeSteps";
import { format } from "date-fns";

const iconMap = { Heart, Moon, GitBranch, PenLine };

export default function RecentSessionCard({ session }) {
  const Icon = iconMap[MODE_ICONS[session.mode]] || Heart;
  const label = MODE_LABELS[session.mode]?.ru || session.mode;
  const isActive = session.status === "active";

  return (
    <Link
      to={isActive ? `/session/${session.id}` : `/session/${session.id}/summary`}
      className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/20 hover:shadow-sm transition-all group"
    >
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{label}</span>
          {isActive && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              Активна
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {format(new Date(session.created_date), "d MMM yyyy, HH:mm")}
        </p>
      </div>
      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
    </Link>
  );
}