import React from "react";
import { Heart, Moon, GitBranch, PenLine } from "lucide-react";
import { MODE_LABELS, MODE_DESCRIPTIONS, MODE_ICONS } from "@/lib/modeSteps";

const iconMap = { Heart, Moon, GitBranch, PenLine };

export default function ModeCard({ mode, onClick }) {
  const Icon = iconMap[MODE_ICONS[mode]];
  const label = MODE_LABELS[mode]?.ru || mode;
  const desc = MODE_DESCRIPTIONS[mode] || "";

  return (
    <button
      onClick={() => onClick(mode)}
      className="group text-left p-6 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-lg transition-all duration-300 w-full"
    >
      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <h3 className="font-serif text-lg font-semibold mb-1">{label}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
    </button>
  );
}