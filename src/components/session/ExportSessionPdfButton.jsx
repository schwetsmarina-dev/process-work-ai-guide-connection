import React from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { MODE_LABELS } from "@/lib/modeSteps";
import { t } from "@/lib/i18n";

export default function ExportSessionPdfButton({ session, messages = [], language = "ru" }) {
  const downloadPDF = () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 18;
    const maxW = pageW - margin * 2;
    let y = 20;

    const addText = (text, opts = {}) => {
      const { size = 10, bold = false, color = [60, 60, 60], indent = 0 } = opts;
      doc.setFontSize(size);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(String(text || ""), maxW - indent);
      if (y + lines.length * (size * 0.4 + 1) > 275) { doc.addPage(); y = 20; }
      doc.text(lines, margin + indent, y);
      y += lines.length * (size * 0.4 + 1) + 1;
    };

    const addSection = (title, color = [70, 130, 100]) => {
      y += 5;
      if (y > 265) { doc.addPage(); y = 20; }
      doc.setFillColor(...color);
      doc.rect(margin, y - 4, maxW, 8, "F");
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(title, margin + 3, y + 1);
      y += 9;
      doc.setTextColor(60, 60, 60);
    };

    const addLine = () => {
      y += 2;
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, y, pageW - margin, y);
      y += 4;
    };

    const resolvedMode = session.mode_id || session.mode || "journaling";
    const modeName = MODE_LABELS[resolvedMode]?.[language] || MODE_LABELS[resolvedMode]?.ru || resolvedMode;
    const dateStr = session.created_date ? format(new Date(session.created_date), "d MMM yyyy, HH:mm") : "";

    // Title
    addText("Inner Process Path", { size: 18, bold: true, color: [70, 130, 100] });
    addText(t("export_pdf_report_title", language), { size: 13, color: [100, 100, 100] });
    y += 2;
    addText(`${modeName}   |   ${dateStr}`, { size: 9, color: [130, 130, 130] });
    addLine();

    const fallback = "Сессия завершена. Резюме недоступно.";

    if (session.summary && session.summary !== fallback) {
      addSection(t("export_pdf_section_summary", language));
      addText(session.summary, { size: 10 });
    }

    if (session.themes?.length > 0 && session.summary !== fallback) {
      addSection(t("export_pdf_section_themes", language), [110, 80, 160]);
      addText(session.themes.join(", "), { size: 10, indent: 3 });
    }

    if (session.signals?.length > 0 && session.summary !== fallback) {
      addSection(t("export_pdf_section_signals", language), [200, 150, 50]);
      session.signals.forEach((s) => addText(`• ${s}`, { size: 10, indent: 3 }));
    }

    if (session.next_step_suggestion) {
      addSection(t("export_pdf_section_next", language), [50, 110, 160]);
      addText(session.next_step_suggestion, { size: 10 });
    }

    const dialog = messages.filter((m) => m.role !== "system");
    if (dialog.length > 0) {
      addSection(t("export_pdf_section_dialog", language), [100, 100, 100]);
      dialog.forEach((m) => {
        const who = m.role === "user"
          ? t("export_pdf_role_user", language)
          : t("export_pdf_role_assistant", language);
        addText(`${who}:`, { size: 9, bold: true, color: [90, 90, 90], indent: 0 });
        addText(m.content, { size: 10, indent: 4 });
        y += 1;
      });
    }

    // Footer on last page
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    doc.text(t("export_pdf_footer", language), margin, pageH - 12);

    const filename = `session-${session.id?.slice(0, 8) || "export"}.pdf`;
    doc.save(filename);
  };

  return (
    <Button
      variant="outline"
      className="w-full rounded-xl border-primary/30 text-primary hover:bg-primary/5"
      onClick={downloadPDF}
    >
      <Download className="w-4 h-4 mr-2" />
      {t("export_pdf", language)}
    </Button>
  );
}