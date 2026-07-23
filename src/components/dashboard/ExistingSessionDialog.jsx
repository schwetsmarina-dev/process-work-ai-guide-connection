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

export default function ExistingSessionDialog({ open, onContinue, onStartNew, onOpenChange, lang = "ru" }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("existing_session_title", lang)}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("existing_session_text", lang)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onStartNew}>{t("existing_session_new", lang)}</AlertDialogCancel>
          <AlertDialogAction onClick={onContinue}>{t("existing_session_continue", lang)}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}