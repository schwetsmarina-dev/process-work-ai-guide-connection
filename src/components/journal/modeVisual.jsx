import { Heart, Moon, GitBranch, PenLine } from "lucide-react";
import { MODE_LABELS, MODE_ICONS } from "@/lib/modeSteps";

const iconMap = { Heart, Moon, GitBranch, PenLine };

// Normalize a mode id that may come from session.mode / session.mode_id / insight.source_mode
function normalizeMode(mode) {
  const m = String(mode || "").toLowerCase();
  if (m.includes("body")) return "body";
  if (m.includes("dream")) return "dream";
  if (m.includes("conflict")) return "conflict";
  if (m.includes("journal")) return "journaling";
  return m;
}

export function getModeIcon(mode) {
  const key = normalizeMode(mode);
  return iconMap[MODE_ICONS[key]] || Heart;
}

export function getModeLabel(mode, lang = "ru") {
  const key = normalizeMode(mode);
  return MODE_LABELS[key]?.[lang] || MODE_LABELS[key]?.ru || mode || "—";
}

export { normalizeMode };