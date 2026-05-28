import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";

async function ensureSubscription(email) {
  const subs = await base44.entities.Subscription.filter({ user_email: email });
  if (subs.length === 0) {
    const now = new Date();
    const end = new Date(now);
    end.setMonth(end.getMonth() + 1);
    await base44.entities.Subscription.create({
      user_email: email,
      plan_type: "FREE",
      status: "ACTIVE",
      sessions_limit: 5,
      messages_limit: 200,
      pdf_limit: 2,
      sessions_used: 0,
      messages_used: 0,
      pdf_used: 0,
      period_start: now.toISOString(),
      period_end: end.toISOString(),
      created_at: now.toISOString(),
    });
    console.log('[SUBSCRIPTION_CHECK]', { user: email, action: 'free_plan_created' });
  }
}

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
  // Ensure FREE subscription exists
  await ensureSubscription(resolvedUser.email).catch((e) =>
    console.warn('ensureSubscription failed:', e.message)
  );
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