import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import GoogleIcon from "@/components/GoogleIcon";
import { getStoredLanguage, t } from "@/lib/i18n";

export default function SocialButtons() {
  const language = getStoredLanguage();
  const es = language === "es";
  const [open, setOpen] = useState(false);

  const handleGoogle = () => {
    // Always give Base44 an absolute return URL on the current origin, so the
    // callback lands back inside Talvira and not on the auth host.
    base44.auth.loginWithProvider("google", `${window.location.origin}/dashboard`);
  };

  if (!open) {
    return (
      <div className="text-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {es ? "Otras formas de entrar" : "Другие способы входа"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        className="w-full h-12 text-sm font-medium"
        onClick={handleGoogle}
      >
        <GoogleIcon className="w-5 h-5 mr-2" />
        {t("auth_continue_google", language)}
      </Button>
      <p className="text-xs leading-relaxed text-muted-foreground text-center">
        {es
          ? "Google abre una página de inicio de sesión de Base44 (nuestra plataforma) y después vuelve a Talvira. Es normal."
          : "Google открывает страницу входа Base44 (это наша платформа), затем возвращает в Talvira. Так и должно быть."}
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground text-center">
        {es
          ? "Si Google no carga, usa el correo y la contraseña: funciona en cualquier país."
          : "Если Google не открывается (например, в России) — входите по email и паролю: этот способ работает без VPN."}
      </p>
    </div>
  );
}