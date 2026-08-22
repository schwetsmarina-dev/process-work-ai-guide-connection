import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import AgeVerificationGate from "@/components/onboarding/AgeVerificationGate";
import { normalizeLang, getStoredLanguage, setStoredLanguage } from "@/lib/i18n";

async function ensureAppUser(user) {
  // If user context is missing (403 path), try fetching directly
  let resolvedUser = user;
  if (!resolvedUser?.email) {
    try {
      resolvedUser = await base44.auth.me();
    } catch (e) {
      console.warn("ensureAppUser: could not resolve user", e);
      return;
    }
  }
  if (!resolvedUser?.email) return;

  const existing = await base44.entities.AppUser.filter({ email: resolvedUser.email });
  if (existing.length === 0) {
    const initialLanguage = normalizeLang(getStoredLanguage());
    await base44.entities.AppUser.create({
      email: resolvedUser.email,
      name: resolvedUser.full_name || resolvedUser.email,
      language: initialLanguage,
      plan: "free",
      onboarding_completed: false,
      consent_given: false,
      created_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    });
    setStoredLanguage(initialLanguage);
  } else {
    const profileLanguage = normalizeLang(existing[0].language || getStoredLanguage());
    // Once a profile exists, its language is authoritative. Keep browser
    // storage synchronized so logout/login and direct auth URLs stay in the
    // same language instead of resurrecting a stale previous locale.
    setStoredLanguage(profileLanguage);
    await base44.entities.AppUser.update(existing[0].id, {
      language: profileLanguage,
      last_seen_at: new Date().toISOString(),
    });
  }

  // Fire-and-forget: clean up stale "active" sessions older than 24h
  base44.functions
    .invoke("abandonStaleSessions", {})
    .catch((e) => console.warn("abandonStaleSessions failed (silent):", e?.message));
}

export default function RequireAuth() {
  const { isAuthenticated, isLoadingAuth, authChecked, user } = useAuth();
  const [appUserReady, setAppUserReady] = useState(false);

  // Accounts created before the age gate existed have no birth_year, so their
  // age is unknown. Unknown is not an acceptable answer for a service that
  // must not be used under 16 — ask once, then never again.
  const { data: appUser, refetch: refetchAppUser } = useQuery({
    queryKey: ["appUser", user?.email],
    enabled: Boolean(isAuthenticated && user?.email && appUserReady),
    queryFn: async () => {
      const rows = await base44.entities.AppUser.filter({ email: user.email });
      return rows?.[0] || null;
    },
  });

  useEffect(() => {
    if (isAuthenticated && user) {
      ensureAppUser(user).finally(() => setAppUserReady(true));
    }
  }, [isAuthenticated, user]);

  if (!authChecked || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Auth gating is handled upstream by ProtectedRoute (redirects to /login).
  // RequireAuth now only ensures the AppUser record exists for the authenticated user.
  if (!isAuthenticated) {
    return null;
  }

  if (!appUserReady) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Legacy accounts that already completed onboarding before the age gate was
  // introduced still need a one-time age check. Brand-new accounts must NOT be
  // intercepted here: onboarding already contains the age + consent step, and
  // showing this gate first would make them enter their birth year twice.
  if (appUser && appUser.onboarding_completed === true && !appUser.birth_year) {
    return (
      <AgeVerificationGate
        appUser={appUser}
        lang={normalizeLang(appUser.language || getStoredLanguage())}
        onVerified={refetchAppUser}
      />
    );
  }

  return <Outlet />;
}