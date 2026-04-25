import React from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Moon, GitBranch, PenLine, X } from "lucide-react";
import { MODE_LABELS, MODE_ICONS, MODE_STEPS } from "@/lib/modeSteps";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const iconMap = { Heart, Moon, GitBranch, PenLine };

export default function SessionHeader({ session, onEndSession }) {
  const navigate = useNavigate();
  const Icon = iconMap[MODE_ICONS[session.mode]] || Heart;
  const label = MODE_LABELS[session.mode]?.ru || session.mode;
  const steps = MODE_STEPS[session.mode] || [];
  const progress = steps.length > 0 ? ((session.current_step || 0) / steps.length) * 100 : 0;

  return (
    <div className="bg-card/80 backdrop-blur-lg border-b border-border px-4 py-3">
      <div className="flex items-center justify-between max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">{label}</p>
            <div className="flex items-center gap-2 mt-1">
              <Progress value={progress} className="w-20 h-1.5" />
              <span className="text-xs text-muted-foreground">
                {Math.min(session.current_step || 0, steps.length)}/{steps.length}
              </span>
            </div>
          </div>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <X className="w-4 h-4 mr-1" />
              Завершить
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Завершить сессию?</AlertDialogTitle>
              <AlertDialogDescription>
                Будет сгенерировано резюме вашей сессии.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction onClick={onEndSession}>
                Завершить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}