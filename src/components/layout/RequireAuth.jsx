import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";

async function ensureAppUser(user) {
  if (!user?.email) return;
  const existing = await base44.entities.AppUser.filter({ email: user.email });
  if (existing.length === 0) {
    await base44.entities.AppUser.create({
      email: user.email,
      name: user.full_name || user.email,
      language: "ru",
      plan: "free",
      onboarding_completed: false,
      consent_given: false,
      created_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    });
  } else {
    // Update last_seen_at
    await base44.entities.AppUser.update(existing[0].id, {
      last_seen_at: new Date().toISOString(),
    });
  }
}

export default function RequireAuth() {
  const { isAuthenticated, isLoadingAuth, authChecked, user } = useAuth();
  const [appUserReady, setAppUserReady] = useState(false);

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

  if (!isAuthenticated) {
    base44.auth.redirectToLogin(window.location.pathname);
    return null;
  }

  if (!appUserReady) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return <Outlet />;
}