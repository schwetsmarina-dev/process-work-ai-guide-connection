import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Trash2, Loader2, ShieldCheck, CheckCircle2, Brain } from "lucide-react";
import { listMessages } from "@/lib/messageApi";

const L = {
  ru: {
    title: "Твои данные",
    intro:
      "Твои сессии и записи принадлежат тебе. Ты можешь скачать полный экспорт или удалить пользовательские данные Talvira.",
    export: "Скачать мои данные",
    export_hint:
      "Полный экспорт в файл JSON: профиль, сессии, сообщения, инсайты, память, практики, физиологические данные, связи с терапевтом и отзывы.",
    memory_title: "Память между сессиями",
    memory_hint: "Если память включена, Talvira может использовать ключевые темы прошлых сессий для более связного сопровождения. Её можно отключить или удалить отдельно.",
    memory_on: "Память включена",
    memory_off: "Память выключена",
    memory_view: "Посмотреть сохранённую память",
    memory_hide: "Скрыть память",
    memory_empty: "Сохранённой памяти пока нет.",
    memory_delete: "Удалить сохранённую память",
    memory_deleted: "Сохранённая память удалена.",
    memory_error: "Не удалось изменить настройки памяти.",
    danger_title: "Удалить все мои данные",
    danger_hint:
      "Безвозвратно удаляет сессии, сообщения, инсайты, память, практики и другие пользовательские данные Talvira. Техническая учётная запись и платёжные записи могут храниться, когда этого требует закон.",
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
      "Tus sesiones y notas te pertenecen. Puedes descargar una copia completa o eliminar tus datos de usuario de Talvira.",
    export: "Descargar mis datos",
    export_hint:
      "Exportación completa en JSON: perfil, sesiones, mensajes, insights, memoria, prácticas, datos fisiológicos, vínculos con terapeutas y valoraciones.",
    memory_title: "Memoria entre sesiones",
    memory_hint: "Si la memoria está activada, Talvira puede usar temas clave de sesiones anteriores para ofrecer un acompañamiento más coherente. Puedes desactivarla o eliminarla por separado.",
    memory_on: "Memoria activada",
    memory_off: "Memoria desactivada",
    memory_view: "Ver la memoria guardada",
    memory_hide: "Ocultar la memoria",
    memory_empty: "Todavía no hay memoria guardada.",
    memory_delete: "Eliminar la memoria guardada",
    memory_deleted: "La memoria guardada se ha eliminado.",
    memory_error: "No se pudo cambiar la configuración de memoria.",
    danger_title: "Eliminar todos mis datos",
    danger_hint:
      "Elimina de forma permanente tus sesiones, mensajes, insights, memoria, prácticas y demás datos de usuario de Talvira. La cuenta técnica y los registros de facturación podrán conservarse cuando lo exija la ley.",
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
  const [memoryEnabled, setMemoryEnabled] = useState(appUser?.memory_enabled !== false);
  const [memorySaving, setMemorySaving] = useState(false);
  const [memoryDeleting, setMemoryDeleting] = useState(false);
  const [memoryDeleted, setMemoryDeleted] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [memoryItems, setMemoryItems] = useState([]);
  const [memoryLoading, setMemoryLoading] = useState(false);

  useEffect(() => {
    setMemoryEnabled(appUser?.memory_enabled !== false);
  }, [appUser?.memory_enabled]);

  const handleExport = async () => {
    if (!email) return;
    setExporting(true);
    try {
      // Session ownership uses `user_id` (platform User.id), not created_by —
      // created_by is stamped with the SERVICE ROLE's identity since sessions
      // are created server-side (startSession). Insight is still created
      // client-side, so its created_by correctly reflects the real user.
      // UserMemory.user_id is ALSO the platform User.id (set by
      // persistSessionMemory as session.user_id) — not AppUser.id, which is a
      // different record entirely.
      const [sessions, insights, practices, physiological, riskEvents] = await Promise.all([
        base44.entities.Session.filter({ user_id: user?.id }, "-created_date", 1000).catch(() => []),
        base44.entities.Insight.filter({ created_by: email }, "-created_date", 1000).catch(() => []),
        base44.entities.ProcessPractice.filter({ user_id: user?.id }, "-created_date", 1000).catch(() => []),
        base44.entities.PhysiologicalData.filter({ user_id: user?.id }, "-recorded_at", 1000).catch(() => []),
        base44.entities.RiskEvent.filter({ user_id: user?.id }, "-detected_at", 1000).catch(() => []),
      ]);
      const memory = user?.id
        ? await base44.entities.UserMemory.filter({ user_id: user.id }).catch(() => [])
        : [];
      const feedback = await base44.entities.SessionFeedback
        .filter({ user_email: email })
        .catch(() => []);
      const [clientLinksAsClient, clientLinksAsTherapist, assignmentsAsClient, assignmentsAsTherapist] =
        await Promise.all([
          base44.entities.ClientLink.filter({ client_email: email }).catch(() => []),
          base44.entities.ClientLink.filter({ therapist_email: email }).catch(() => []),
          base44.entities.Assignment.filter({ client_email: email }).catch(() => []),
          base44.entities.Assignment.filter({ therapist_email: email }).catch(() => []),
        ]);
      const dedupe = (rows) => [...new Map(rows.map((row) => [row.id, row])).values()];
      const client_links = dedupe([...clientLinksAsClient, ...clientLinksAsTherapist]);
      const assignments = dedupe([...assignmentsAsClient, ...assignmentsAsTherapist]);

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
          practices: practices.length,
          physiological: physiological.length,
          risk_events: riskEvents.length,
          client_links: client_links.length,
          assignments: assignments.length,
        },
        sessions,
        messages_by_session,
        insights,
        memory,
        practices,
        physiological,
        risk_events: riskEvents,
        client_links,
        assignments,
        feedback,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `talvira-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const handleMemoryToggle = async () => {
    if (!appUser?.id || memorySaving) return;
    const next = !memoryEnabled;
    setMemorySaving(true);
    try {
      await base44.entities.AppUser.update(appUser.id, { memory_enabled: next });
      setMemoryEnabled(next);
    } catch {
      alert(tx.memory_error);
    } finally {
      setMemorySaving(false);
    }
  };

  const handleViewMemory = async () => {
    if (memoryOpen) {
      setMemoryOpen(false);
      return;
    }
    if (!user?.id || memoryLoading) return;
    setMemoryLoading(true);
    try {
      const rows = await base44.entities.UserMemory.filter({ user_id: user.id, is_active: true }, "-updated_at", 50);
      setMemoryItems(rows || []);
      setMemoryOpen(true);
    } catch {
      alert(tx.memory_error);
    } finally {
      setMemoryLoading(false);
    }
  };

  const handleDeleteMemory = async () => {
    if (!user?.id || memoryDeleting) return;
    setMemoryDeleting(true);
    try {
      const rows = await base44.entities.UserMemory.filter({ user_id: user.id }, "-updated_at", 1000);
      for (const row of rows) await base44.entities.UserMemory.delete(row.id);
      setMemoryItems([]);
      setMemoryDeleted(true);
    } catch {
      alert(tx.memory_error);
    } finally {
      setMemoryDeleting(false);
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
        base44.auth.logout("/");
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

      {/* Cross-session memory controls */}
      <div className="py-5 border-t border-border">
        <div className="flex items-center gap-2 mb-1">
          <Brain className="w-4 h-4 text-primary" />
          <p className="text-sm font-medium">{tx.memory_title}</p>
        </div>
        <p className="text-xs text-muted-foreground mb-3">{tx.memory_hint}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleMemoryToggle} disabled={!appUser?.id || memorySaving}>
            {memorySaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {memoryEnabled ? tx.memory_on : tx.memory_off}
          </Button>
          <Button variant="ghost" onClick={handleViewMemory} disabled={!user?.id || memoryLoading}>
            {memoryLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {memoryOpen ? tx.memory_hide : tx.memory_view}
          </Button>
          <Button variant="ghost" onClick={handleDeleteMemory} disabled={!user?.id || memoryDeleting} className="text-destructive">
            {memoryDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
            {tx.memory_delete}
          </Button>
        </div>
        {memoryOpen && (
          <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            {memoryItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">{tx.memory_empty}</p>
            ) : memoryItems.map((item) => (
              <div key={item.id} className="text-xs leading-relaxed">
                <span className="font-medium text-foreground">{item.memory_type || item.memory_key}: </span>
                <span className="text-muted-foreground">{item.memory_value}</span>
              </div>
            ))}
          </div>
        )}
        {memoryDeleted && <p className="text-xs text-primary mt-2">{tx.memory_deleted}</p>
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
