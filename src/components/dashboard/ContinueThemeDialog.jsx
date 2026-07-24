import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { t } from "@/lib/i18n";

// Shown when the user starts a mode for which they already have a *completed*
// previous session (as opposed to ExistingSessionDialog, which handles an
// *active*/unfinished session). This makes cross-session continuity visible
// and explicit — addressing the feedback that users didn't understand how to
// return to and deepen a theme from a prior session.
export default function ContinueThemeDialog({ open, summary, onContinueTheme, onStartNew, onOpenChange, lang = "ru" }) {
  const snippet = String(summary || "").trim().slice(0, 220);
  const text = t("continue_theme_text", lang).replace("{summary}", snippet);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("continue_theme_title", lang)}</AlertDialogTitle>
          <AlertDialogDescription>{text}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onStartNew}>{t("continue_theme_start_new", lang)}</AlertDialogCancel>
          <AlertDialogAction onClick={onContinueTheme}>{t("continue_theme_continue", lang)}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
