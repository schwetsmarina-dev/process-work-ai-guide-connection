import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Share2, Loader2, Check } from "lucide-react";

const COPY = {
  ru: {
    title: "Поделиться с терапевтом",
    therapist: "Терапевт",
    share: "Делиться моими данными",
    what: "Что передавать",
    scopes: { summaries: "Только резюме сессий", insights: "Только инсайты", both: "Резюме и инсайты" },
  },
  es: {
    title: "Compartir con mi terapeuta",
    therapist: "Terapeuta",
    share: "Compartir mis datos",
    what: "Qué compartir",
    scopes: { summaries: "Solo resúmenes de sesión", insights: "Solo insights", both: "Resúmenes e insights" },
  },
};

// Client-side control that sets consent_to_share + share_scope on the
// ClientLink(s) their therapist created. The client is the only one who can
// turn sharing on — RLS lets the linked client update their own links.
export default function ShareWithTherapist({ clientEmail, lang = "es" }) {
  const c = COPY[lang] || COPY.es;
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);

  const load = async () => {
    const rows = await base44.entities.ClientLink.filter({ client_email: clientEmail });
    setLinks(rows);
    setLoading(false);
  };

  useEffect(() => {
    if (clientEmail) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientEmail]);

  const update = async (link, changes) => {
    setSavingId(link.id);
    setSavedId(null);
    try {
      await base44.entities.ClientLink.update(link.id, changes);
      setLinks((prev) => prev.map((l) => (l.id === link.id ? { ...l, ...changes } : l)));
      setSavedId(link.id);
      setTimeout(() => setSavedId(null), 1500);
    } finally {
      setSavingId(null);
    }
  };

  if (loading || links.length === 0) return null;

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Share2 className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">{c.title}</h3>
      </div>
      <div className="space-y-5">
        {links.map((link) => (
          <div key={link.id} className="space-y-3 border-b border-border last:border-0 pb-4 last:pb-0">
            <p className="text-xs text-muted-foreground">
              {c.therapist}: <span className="font-medium text-foreground">{link.therapist_email}</span>
            </p>
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm">{c.share}</Label>
              <div className="flex items-center gap-2">
                {savingId === link.id && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                {savedId === link.id && <Check className="w-4 h-4 text-green-600" />}
                <Switch
                  checked={link.consent_to_share === true}
                  onCheckedChange={(v) =>
                    update(link, { consent_to_share: v, status: v ? "active" : link.status })
                  }
                />
              </div>
            </div>
            {link.consent_to_share && (
              <div>
                <Label className="text-xs text-muted-foreground">{c.what}</Label>
                <Select value={link.share_scope || "summaries"} onValueChange={(v) => update(link, { share_scope: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(c.scopes).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}