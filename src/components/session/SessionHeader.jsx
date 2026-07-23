import React from "react";
import { useNavigate } from "react-router-dom";
import { Heart, X, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { t } from "@/lib/i18n";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

export default function SessionHeader({ session, totalSteps, onEndSession, lang = "ru" }) {
  const navigate = useNavigate();
  const modeId = session.mode_id || session.mode || "";
  const label = session.mode_name_ru || modeId;
  const currentStep = session.current_step || 1;
  const progress = totalSteps > 0 ? ((currentStep - 1) / totalSteps) * 100 : 0;

  return (
    <div className="bg-card/80 backdrop-blur-lg border-b border-border px-4 py-3">
      <div className="flex items-center justify-between max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Heart className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{label}</p>
              {/* EU AI Act Art. 50(1): disclosure must be present at the point of
                  interaction, not only once during onboarding. */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("ai_disclosure_title", lang)}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <Bot className="w-3 h-3" />
                    {t("ai_badge", lang)}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-80 text-sm">
                  <p className="font-semibold mb-1.5">{t("ai_disclosure_title", lang)}</p>
                  <p className="text-muted-foreground leading-relaxed">
                    {t("ai_disclosure_text", lang)}
                  </p>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Progress value={progress} className="w-20 h-1.5" />
              {totalSteps > 0 && (
                <span className="text-xs text-muted-foreground">
                  {currentStep}/{totalSteps}
                </span>
              )}
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