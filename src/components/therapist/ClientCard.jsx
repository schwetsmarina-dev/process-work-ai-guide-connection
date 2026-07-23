import { t, getStoredLanguage } from "@/lib/i18n";
import React from "react";
import { format } from "date-fns";
import { User, MessageSquare, AlertTriangle } from "lucide-react";

export default function ClientCard({ client, active, onClick }) {
  const lang = getStoredLanguage();
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-4 transition-colors ${
        active ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-accent/50"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{client.name}</p>
          {client.last_seen_at && (
            <p className="text-xs text-muted-foreground">
              {t("th_last_seen", lang)}: {format(new Date(client.last_seen_at), "d MMM yyyy")}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <MessageSquare className="w-3.5 h-3.5" />
          {client.session_count} {t("th_sessions_short", lang)}
        </span>
        {client.flagged_count > 0 && (
          <span className="flex items-center gap-1 text-destructive font-medium">
            <AlertTriangle className="w-3.5 h-3.5" />
            {client.flagged_count} {t("th_flagged_short", lang)}
          </span>
        )}
      </div>
    </button>
  );
}