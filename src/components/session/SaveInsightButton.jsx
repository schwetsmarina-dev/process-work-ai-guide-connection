import { t, getStoredLanguage } from "@/lib/i18n";
import React, { useState } from "react";
import { Bookmark, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveInsightFromMessage } from "@/lib/insightAI";

export default function SaveInsightButton({ messageContent, sessionId, sourceMode }) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (saved || saving) return;
    setSaving(true);
    await saveInsightFromMessage({ messageContent, sessionId, sourceMode });
    setSaving(false);
    setSaved(true);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`h-6 px-2 text-xs gap-1 transition-all ${saved ? "text-primary" : "text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"}`}
      onClick={handleSave}
      disabled={saving}
    >
      {saved ? <Check className="w-3 h-3" /> : <Bookmark className="w-3 h-3" />}
      {saved ? t("saved", getStoredLanguage()) : t("save_insight", getStoredLanguage())}
    </Button>
  );
}