import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Share2, Loader2, Check } from "lucide-react";

const COPY = {
  ru: {
    title: "Что видит мой терапевт",
    intro: "Доступ задаёшь только ты. Можно отключить его целиком или отдельно разрешить разные части данных.",
    therapist: "Терапевт",
    master: "Разрешить доступ",
    summaries: "Резюме сессий",
    summariesHint: "Краткие итоги завершённых сессий, без полного текста переписки.",
    insights: "Сохранённые инсайты",
    insightsHint: "Только инсайты, которые сохранены в твоей библиотеке.",
    memory: "Моя процессуальная карта",
    memoryHint: "Подтверждённые и актуальные семантические гипотезы и изменения во времени. Отдельные сырые эпизоды не передаются.",
    map: "Карта связей процессов",
    mapHint: "Темы, сигналы, края, первичные и вторичные процессы и связи между ними.",
    risks: "Подробности событий безопасности",
    risksHint: "Если Talvira зафиксирует событие, связанное с безопасностью, терапевт получит уведомление о самом факте события. Без этого разрешения ему не передаются тип риска, уровень, содержание сессии или другие подробности. Включи этот доступ только если хочешь разрешить просмотр подробностей.",
  },
  es: {
    title: "Qué puede ver mi terapeuta",
    intro: "Tú decides el acceso. Puedes desactivarlo por completo o permitir por separado cada tipo de información.",
    therapist: "Terapeuta",
    master: "Permitir acceso",
    summaries: "Resúmenes de sesiones",
    summariesHint: "Resumen breve de sesiones finalizadas, sin compartir la conversación completa.",
    insights: "Insights guardados",
    insightsHint: "Solo los insights guardados en tu biblioteca.",
    memory: "Mi mapa de proceso",
    memoryHint: "Hipótesis semánticas vigentes y cambios a lo largo del tiempo. No se comparten episodios brutos individuales.",
    map: "Mapa de relaciones del proceso",
    mapHint: "Temas, señales, bordes, procesos primarios/secundarios y sus relaciones.",
    risks: "Detalles de eventos de seguridad",
    risksHint: "Si Talvira registra un evento relacionado con tu seguridad, tu terapeuta recibirá una notificación de que el evento se ha producido. Sin este permiso no verá el tipo de riesgo, el nivel, el contenido de la sesión ni otros detalles. Activa este acceso solo si quieres permitir que vea los detalles.",
  },
};

function ToggleRow({ label, hint, checked, disabled, onChange }) {
  return <div className="flex items-start justify-between gap-4 py-3 border-t border-border first:border-0">
    <div><Label className="text-sm">{label}</Label><p className="text-xs text-muted-foreground mt-0.5 max-w-lg leading-relaxed">{hint}</p></div>
    <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
  </div>;
}

export default function ShareWithTherapist({ clientEmail, lang = "es" }) {
  const c = COPY[lang] || COPY.es;
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);

  const load = async () => {
    try {
      const rows = await base44.entities.ClientLink.filter({ client_email: clientEmail });
      setLinks(rows || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (clientEmail) load(); }, [clientEmail]);

  const normalized = (link) => {
    const legacy = link.share_scope || "summaries";
    return {
      summaries: link.share_session_summaries ?? (legacy === "summaries" || legacy === "both"),
      insights: link.share_insights ?? (legacy === "insights" || legacy === "both"),
      memory: link.share_memory_profile === true,
      map: link.share_process_map === true,
      risks: link.share_risk_flags === true,
    };
  };

  const update = async (link, changes) => {
    setSavingId(link.id); setSavedId(null);
    try {
      const payload = { ...changes, consent_updated_at: new Date().toISOString() };
      await base44.entities.ClientLink.update(link.id, payload);
      setLinks((prev) => prev.map((l) => l.id === link.id ? { ...l, ...payload } : l));
      setSavedId(link.id); setTimeout(() => setSavedId(null), 1200);
    } finally { setSavingId(null); }
  };

  if (loading || links.length === 0) return null;

  return <Card className="p-6">
    <div className="flex items-center gap-2 mb-1"><Share2 className="w-4 h-4 text-primary" /><h3 className="font-semibold text-sm">{c.title}</h3></div>
    <p className="text-xs text-muted-foreground mb-4">{c.intro}</p>
    <div className="space-y-5">{links.map((link) => {
      const s = normalized(link);
      const disabled = savingId === link.id || !link.consent_to_share;
      return <div key={link.id} className="rounded-xl border p-4">
        <div className="flex items-center justify-between gap-4 mb-2">
          <p className="text-xs text-muted-foreground">{c.therapist}: <span className="font-medium text-foreground">{link.therapist_email}</span></p>
          <div className="flex gap-2 items-center">{savingId === link.id && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}{savedId === link.id && <Check className="w-4 h-4 text-green-600" />}<Switch checked={link.consent_to_share === true} onCheckedChange={(v) => update(link, { consent_to_share: v, status: v ? "active" : "paused" })} /></div>
        </div>
        <ToggleRow label={c.summaries} hint={c.summariesHint} checked={s.summaries} disabled={disabled} onChange={(v) => update(link, { share_session_summaries: v })} />
        <ToggleRow label={c.insights} hint={c.insightsHint} checked={s.insights} disabled={disabled} onChange={(v) => update(link, { share_insights: v })} />
        <ToggleRow label={c.memory} hint={c.memoryHint} checked={s.memory} disabled={disabled} onChange={(v) => update(link, { share_memory_profile: v })} />
        <ToggleRow label={c.map} hint={c.mapHint} checked={s.map} disabled={disabled} onChange={(v) => update(link, { share_process_map: v })} />
        <ToggleRow label={c.risks} hint={c.risksHint} checked={s.risks} disabled={disabled} onChange={(v) => update(link, { share_risk_flags: v })} />
      </div>;
    })}</div>
  </Card>;
}
