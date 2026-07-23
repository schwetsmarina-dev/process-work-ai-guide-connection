import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Shield, User } from "lucide-react";
import { normalizeLang, t } from "@/lib/i18n";
import LanguageSelector from "@/components/settings/LanguageSelector";
import PrivacyControls from "@/components/settings/PrivacyControls";
import SubscriptionCard from "@/components/settings/SubscriptionCard";

export default function Settings() {
  const [user, setUser] = useState(null);
  const [appUser, setAppUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState("ru");

  useEffect(() => {
    (async () => {
      const u = await base44.auth.me();
      setUser(u);
      const rows = await base44.entities.AppUser.filter({ email: u?.email });
      const au = rows[0] || null;
      setAppUser(au);
      setLang(normalizeLang(au?.language || "ru"));
      setLoading(false);
    })();
  }, []);

  const handleLangChange = (value) => {
    setLang(value);
    setAppUser((prev) => (prev ? { ...prev, language: value } : prev));
  };

  if (loading) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <h1 className="font-serif text-3xl font-semibold mb-2">{t("settings_title", lang)}</h1>
      <p className="text-muted-foreground mb-8">{t("settings_subtitle", lang)}</p>

      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">{t("profile", lang)}</h3>
          </div>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">{t("name", lang)}</Label>
              <p className="text-sm font-medium mt-1">{user?.full_name || "—"}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{t("email", lang)}</Label>
              <p className="text-sm font-medium mt-1">{user?.email || "—"}</p>
            </div>
          </div>
        </Card>

        <LanguageSelector authUser={user} appUser={appUser} lang={lang} onChange={handleLangChange} />

        <SubscriptionCard lang={lang} />

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">{t("privacy", lang)}</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("privacy_text", lang)}
          </p>
        </Card>

        <PrivacyControls user={user} appUser={appUser} lang={lang} />

        <Card className="p-6 border-destructive/20">
          <h3 className="font-semibold text-sm mb-2">{t("logout", lang)}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t("logout_text", lang)}
          </p>
          <Button
            variant="outline"
            onClick={() => base44.auth.logout("/")}
            className="text-destructive border-destructive/30 hover:bg-destructive/5"
          >
            {t("logout_button", lang)}
          </Button>
        </Card>
      </div>
    </div>
  );
}