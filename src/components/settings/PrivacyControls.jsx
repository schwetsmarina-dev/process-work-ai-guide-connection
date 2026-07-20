import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Trash2, Loader2, ShieldCheck, CheckCircle2 } from "lucide-react";
import { listMessages } from "@/lib/messageApi";

const L = {
  ru: {
    title: "Твои данные",
    intro:
      "Твои сессии и записи принадлежат тебе. Ты можешь скачать всё в любой момент или удалить без следа.",
    export: "Скачать мои данные",
    export_hint:
      "Полный экспорт в файл JSON: профиль, сессии, сообщения, инсайты, память и отзывы.",
    danger_title: "Удалить все мои данные",
    danger_hint:
      "Безвозвратно удаляет все твои сессии, сообщения, инсайты и память. Это действие нельзя отменить.",
    delete_btn: "Удалить мои данные",
    confirm_label: "Чтобы подтвердить, впиши слово УДАЛИТЬ:",
    confirm_word: "УДАЛИТЬ",
    confirm_cta: "Удалить безвозвратно",
    cancel: "Отмена",
    done: "Данные удалены. Перенаправляю…",
    error: "Не удалось удалить данные. Попробуй ещё раз.",
  },
  es: {
    title: "Tus datos",
    intro:
      "Tus sesiones y notas te pertenecen. Puedes descargarlo todo en cualquier momento o borrarlo sin dejar rastro.",
    export: "Descargar mis datos",
    export_hint:
      "Exportación completa a un archivo JSON: perfil, sesiones, mensajes, insights, memoria y valoraciones.",
    danger_title: "Eliminar todos mis datos",
    danger_hint:
      "Elimina de forma permanente todas tus sesiones, mensajes, insights y memoria. Esta acción no se puede deshacer.",
    delete_btn: "Eliminar mis datos",
    confirm_label: "Para confirmar, escribe la palabra ELIMINAR:",
    confirm_word: "ELIMINAR",
    confirm_cta: "Eliminar de forma permanente",
    cancel: "Cancelar",
    done: "Datos eliminados. Redirigiendo…",
    error: "No se pudieron eliminar los datos. Inténtalo de nuevo.",
  },
};

export default function PrivacyControls({ user, appUser, lang = "ru" }) {
  const tx = L[lang] || L.ru;
  const email = user?.email;

  const [exporting, setExporting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [done, setDone] = useState(false);

  const handleExport = async () => {
    if (!email) return;
    setExporting(true);
    try {
      const [sessions, insights] = await Promise.all([
        base44.entities.Session.filter({ created_by: email }, "-created_date", 1000).catch(() => []),
        base44.entities.Insight.filter({ created_by: email }, "-created_date", 1000).catch(() => []),
      ]);
      const memory = appUser?.id
        ? await base44.entities.UserMemory.filter({ user_id: appUser.id }).catch(() => [])
        : [];
      const feedback = await base44.entities.SessionFeedback
        .filter({ user_email: email })
        .catch(() => []);

      const messages_by_session = {};
      for (const s of sessions.slice(0, 300)) {
        try {
          messages_by_session[s.id] = await listMessages(s.id);
        } catch {
          /* skip a session whose messages fail to load */
        }
      }

      const payload = {
        exported_at: new Date().toISOString(),
        profile: { email, name: user?.full_name || null, language: appUser?.language || null },
        counts: {
          sessions: sessions.length,
          insights: insights.length,
          memory: memory.length,
          feedback: feedback.length,
        },
        sessions,
        messages_by_session,
        insights,
        memory,
        feedback,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `process-work-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const canDelete = confirmText.trim().toUpperCase() === tx.confirm_word;

  const handleDelete = async () => {
    if (!canDelete || deleting) return;
    setDeleting(true);
    try {
      await base44.functions.invoke("deleteMyData", {});
      try {
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith("pw_recap_")) localStorage.removeItem(k);
        });
      } catch {
        /* ignore */
      }
      setDone(true);
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 2500);
    } catch (e) {
      console.error("[deleteMyData] failed:", e?.message);
      alert(tx.error);
      setDeleting(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">{tx.title}</h3>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed mb-5">{tx.intro}</p>

      {/* Export */}
      <div className="mb-6">
        <Button variant="outline" onClick={handleExport} disabled={exporting} className="gap-2">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {tx.export}
        </Button>
        <p className="text-xs text-muted-foreground mt-2">{tx.export_hint}</p>
      </div>

      {/* Danger zone */}
      <div className="pt-5 border-t border-destructive/15">
        {done ? (
          <div className="flex items-center gap-2 text-sm text-primary">
            <CheckCircle2 className="w-4 h-4" />
            {tx.done}
          </div>
        ) : !confirmOpen ? (
          <div>
            <p className="text-sm font-medium mb-1">{tx.danger_title}</p>
            <p className="text-xs text-muted-foreground mb-3">{tx.danger_hint}</p>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(true)}
              className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
            >
              <Trash2 className="w-4 h-4" />
              {tx.delete_btn}
            </Button>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium mb-1 text-destructive">{tx.danger_title}</p>
            <p className="text-xs text-muted-foreground mb-3">{tx.danger_hint}</p>
            <label className="text-xs text-muted-foreground block mb-1.5">{tx.confirm_label}</label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={tx.confirm_word}
              className="w-full max-w-xs h-10 px-3 rounded-lg border border-border bg-card text-sm mb-3"
            />
            <div className="flex items-center gap-2">
              <Button
                onClick={handleDelete}
                disabled={!canDelete || deleting}
                className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {tx.confirm_cta}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmText("");
                }}
                disabled={deleting}
              >
                {tx.cancel}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
