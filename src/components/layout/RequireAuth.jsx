import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import AgeVerificationGate from "@/components/onboarding/AgeVerificationGate";
import { normalizeLang, getStoredLanguage } from "@/lib/i18n";

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
    await base44.entities.AppUser.create({
      email: resolvedUser.email,
      name: resolvedUser.full_name || resolvedUser.email,
      language: "ru",
      plan: "free",
      onboarding_completed: false,
      consent_given: false,
      created_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    });
  } else {
    await base44.entities.AppUser.update(existing[0].id, {
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

  if (appUser && !appUser.birth_year) {
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