import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, MessageSquareText, Star } from "lucide-react";

const COPY = {
  ru: {
    title: "Оставить отзыв",
    subtitle: "Расскажи, как это было именно для тебя. Такой отзыв помогает улучшать Talvira.",
    rating: "Насколько это было полезно?",
    helpful: "Что было самым полезным?",
    difficult: "Что было непонятным, неудобным или лишним?",
    insight: "Какой инсайт или важный опыт ты забираешь с собой?",
    comment: "Что ещё важно сказать?",
    continue: "Ты хотела бы продолжить?",
    yes: "Да",
    no: "Нет",
    submit: "Отправить отзыв",
    saved: "Спасибо. Отзыв сохранён.",
    already: "Отзыв уже сохранён.",
  },
  es: {
    title: "Dejar feedback",
    subtitle: "Cuéntanos cómo fue para ti. Este feedback nos ayuda a mejorar Talvira.",
    rating: "¿Hasta qué punto te resultó útil?",
    helpful: "¿Qué fue lo más útil para ti?",
    difficult: "¿Qué fue confuso, incómodo o no te encajó?",
    insight: "¿Qué insight o experiencia importante te llevas contigo?",
    comment: "¿Hay algo más que quieras contarnos?",
    continue: "¿Te gustaría continuar?",
    yes: "Sí",
    no: "No",
    submit: "Enviar feedback",
    saved: "Gracias. Tu feedback se ha guardado.",
    already: "Tu feedback ya estaba guardado.",
  },
};

export default function ExperienceFeedbackForm({ user, lang = "es", experienceType, referenceId, programId = "", programName = "", experienceLabel = "", dayNumber = null, weekNumber = null }) {
  const c = COPY[lang] || COPY.es;
  const [rating, setRating] = useState(0);
  const [helpful, setHelpful] = useState("");
  const [difficult, setDifficult] = useState("");
  const [insight, setInsight] = useState("");
  const [comment, setComment] = useState("");
  const [wouldContinue, setWouldContinue] = useState(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!user?.id || !referenceId) { setChecking(false); return; }
      const rows = await base44.entities.ExperienceFeedback.filter({ user_id: user.id, experience_type: experienceType, reference_id: referenceId }).catch(() => []);
      if (active) { setDone((rows || []).length > 0); setChecking(false); }
    })();
    return () => { active = false; };
  }, [user?.id, experienceType, referenceId]);

  if (!user?.id || !referenceId || checking) return null;

  if (done) return <Card className="p-4 mt-4 border-primary/20 bg-primary/5"><div className="flex items-center gap-2 text-sm"><CheckCircle2 className="w-4 h-4 text-primary" />{c.saved}</div></Card>;

  const submit = async () => {
    setSaving(true);
    try {
      const authUser = user?.email || user?.full_name || user?.name
        ? user
        : await base44.auth.me().catch(() => user);
      await base44.entities.ExperienceFeedback.create({
        user_id: user.id,
        user_name: user?.name || authUser?.full_name || authUser?.name || "",
        user_email: user?.email || authUser?.email || "",
        experience_type: experienceType,
        experience_label: experienceLabel || (experienceType === "practice" ? (lang === "ru" ? "Персональная практика" : "Práctica personal") : (lang === "ru" ? "28-дневная программа" : "Programa de 28 días")),
        reference_id: referenceId,
        program_id: programId || "",
        program_name: programName || (experienceType.startsWith("edge_program") ? (lang === "ru" ? "Возвращение к себе — 28 дней" : "Volver a mí — 28 días") : ""),
        day_number: dayNumber || undefined,
        week_number: weekNumber || undefined,
        language: lang === "ru" ? "ru" : "es",
        rating: rating || undefined,
        helpful,
        difficult,
        insight,
        comment,
        would_continue: wouldContinue === null ? undefined : wouldContinue,
        created_at: new Date().toISOString(),
      });
      setDone(true);
    } finally { setSaving(false); }
  };

  return <Card className="p-5 md:p-6 mt-4" data-feedback-form>
    <div className="flex gap-2 items-center mb-1"><MessageSquareText className="w-4 h-4 text-primary" /><h3 className="font-semibold">{c.title}</h3></div>
    <p className="text-sm text-muted-foreground mb-4">{c.subtitle}</p>
    <div className="space-y-4">
      <div><p className="text-sm font-medium mb-2">{c.rating}</p><div className="flex gap-1">{[1,2,3,4,5].map((n) => <button key={n} type="button" aria-label={`${n}/5`} onClick={() => setRating(n)}><Star className={`w-6 h-6 ${rating >= n ? "fill-current text-primary" : "text-muted-foreground/40"}`} /></button>)}</div></div>
      <Field label={c.helpful} value={helpful} onChange={setHelpful} />
      <Field label={c.difficult} value={difficult} onChange={setDifficult} />
      <Field label={c.insight} value={insight} onChange={setInsight} />
      <Field label={c.comment} value={comment} onChange={setComment} />
      <div><p className="text-sm font-medium mb-2">{c.continue}</p><div className="flex gap-2"><Button type="button" size="sm" variant={wouldContinue === true ? "default" : "outline"} onClick={() => setWouldContinue(true)}>{c.yes}</Button><Button type="button" size="sm" variant={wouldContinue === false ? "default" : "outline"} onClick={() => setWouldContinue(false)}>{c.no}</Button></div></div>
      <Button onClick={submit} disabled={saving || (!rating && !helpful.trim() && !difficult.trim() && !insight.trim() && !comment.trim())}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{c.submit}</Button>
    </div>
  </Card>;
}

function Field({ label, value, onChange }) {
  return <label className="block"><span className="text-sm font-medium block mb-1.5">{label}</span><textarea value={value} onChange={(e) => onChange(e.target.value)} className="w-full min-h-20 rounded-xl border border-border bg-background p-3 text-sm" /></label>;
}
