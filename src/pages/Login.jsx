import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import SocialButtons from "@/components/auth/SocialButtons";
import { getStoredLanguage, t, translateAuthError } from "@/lib/i18n";

export default function Login() {
  const language = getStoredLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    base44.auth.me()
      .then((currentUser) => {
        if (!cancelled && currentUser?.email) {
          window.location.replace("/dashboard");
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await base44.auth.loginViaEmailPassword(email, password);
      if (result?.access_token) {
        base44.auth.setToken(result.access_token);
      }
      window.location.replace("/dashboard");
    } catch (err) {
      const rawMessage =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        err?.data?.message ||
        err?.message;
      setError(translateAuthError(rawMessage, language, "err_login_failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={LogIn}
      title={t("auth_welcome_back", language)}
      subtitle={t("auth_login_subtitle", language)}
      footer={
        <>
          {t("auth_no_account", language)}{" "}
          <Link to="/register" className="text-primary font-medium hover:underline">
            {t("auth_register_link", language)}
          </Link>
        </>
      }
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">{t("auth_email", language)}</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder={t("auth_email_placeholder", language)}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t("auth_password", language)}</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              {t("auth_forgot_password", language)}
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t("auth_logging_in", language)}
            </>
          ) : (
            t("auth_login", language)
          )}
        </Button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">{t("auth_or", language)}</span>
        </div>
      </div>

      <SocialButtons />
    </AuthLayout>
  );
}