import React from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import GoogleIcon from "@/components/GoogleIcon";
import { getStoredLanguage, t } from "@/lib/i18n";

// Visible providers for MVP/beta: Email+password (handled by forms) + Google.
const PROVIDERS = [
  { id: "google", labelKey: "auth_continue_google", Icon: GoogleIcon },
];

export default function SocialButtons() {
  const language = getStoredLanguage();

  const handleProvider = (provider) => {
    base44.auth.loginWithProvider(provider, "/dashboard");
  };

  return (
    <div className="space-y-3 mb-6">
      {PROVIDERS.map(({ id, labelKey, Icon }) => (
        <Button
          key={id}
          type="button"
          variant="outline"
          className="w-full h-12 text-sm font-medium"
          onClick={() => handleProvider(id)}
        >
          <Icon className="w-5 h-5 mr-2" />
          {t(labelKey, language)}
        </Button>
      ))}
    </div>
  );
}