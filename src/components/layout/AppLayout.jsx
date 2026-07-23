import React, { useState, useEffect } from "react";
import { isAdmin as hasAdminRole } from "@/lib/roles";
import { Outlet, Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  LayoutDashboard,
  History,
  BarChart3,
  Settings,
  Menu,
  LogOut,
  Sparkles,
  Upload,
  ShieldAlert,
  BookOpen,
  MessageSquare,
  NotebookPen,
  Network,
  Stethoscope,
  GitCommitVertical,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { queryClientInstance } from "@/lib/query-client";
import { normalizeLang, t, getStoredLanguage } from "@/lib/i18n";
import Onboarding from "@/components/onboarding/Onboarding";

const regularNavItems = [
  { path: "/dashboard", labelKey: "nav_home", icon: LayoutDashboard },
  { path: "/progress", labelKey: "nav_progress", icon: TrendingUp },
  { path: "/journal", labelKey: "nav_journal", icon: NotebookPen },
  { path: "/history", labelKey: "nav_history", icon: History },
  { path: "/insights-library", labelKey: "nav_insights_library", icon: BookOpen },
  { path: "/life-process-map", labelKey: "nav_process_map", icon: Network },
  { path: "/timeline", labelKey: "nav_timeline", icon: GitCommitVertical },
  { path: "/insights", labelKey: "nav_analytics", icon: BarChart3 },
  { path: "/settings", labelKey: "nav_settings", icon: Settings },
];

const therapistNavItem = { path: "/therapist", labelKey: "nav_therapist", icon: Stethoscope };

const adminNavItems = [
  { path: "/admin/import", labelKey: "nav_admin_import", icon: Upload },
  { path: "/admin/status", labelKey: "nav_admin_status", icon: ShieldAlert },
  { path: "/admin/feedback", labelKey: "nav_admin_feedback", icon: MessageSquare },
];

function NavContent({ currentPath, onNavigate, isAdmin, isTherapist, lang }) {
  let items = [...regularNavItems];
  if (isTherapist || isAdmin) items = [...items, therapistNavItem];
  if (isAdmin) items = [...items, ...adminNavItems];
  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-border">
        <Link to="/dashboard" onClick={onNavigate} className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-serif text-lg font-semibold">Process Work</span>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {items.map((item) => {
          const isActive = currentPath === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <item.icon className="w-5 h-5" />
              {t(item.labelKey, lang)}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <button
          onClick={() => { queryClientInstance.clear(); base44.auth.logout(); }}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all w-full"
        >
          <LogOut className="w-5 h-5" />
          {t("nav_logout", lang)}
        </button>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTherapist, setIsTherapist] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [appUser, setAppUser] = useState(null);
  const [userChecked, setUserChecked] = useState(false);

  // Nav language follows the user's saved preference; falls back to the
  // browser/stored language before AppUser has loaded.
  const lang = normalizeLang(appUser?.language || getStoredLanguage());

  useEffect(() => {
    base44.auth.me().then(async (user) => {
      const admin = hasAdminRole(user);
      console.log("[ADMIN_ACCESS]", { email: user?.email, role: user?.role, isAdmin: admin });
      setIsAdmin(admin);
      setIsTherapist(user?.role === "therapist");
      setCurrentUser(user);
      try {
        const rows = await base44.entities.AppUser.filter({ email: user?.email });
        setAppUser(rows[0] || null);
      } catch (e) {
        console.warn("[AppLayout] AppUser load failed:", e?.message);
      } finally {
        setUserChecked(true);
      }
    }).catch(() => setUserChecked(true));
  }, []);

  // Show onboarding full-screen for first-time users
  if (userChecked && appUser && !appUser.onboarding_completed && !isAdmin) {
    return (
      <Onboarding
        appUser={appUser}
        currentUser={currentUser}
        onComplete={() => setAppUser((prev) => ({ ...prev, onboarding_completed: true }))}
      />
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 border-r border-border bg-card flex-col fixed h-full">
        <NavContent currentPath={location.pathname} onNavigate={() => {}} isAdmin={isAdmin} isTherapist={isTherapist} lang={lang} />
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-serif text-base font-semibold">Process Work</span>
          </Link>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <NavContent currentPath={location.pathname} onNavigate={() => setOpen(false)} isAdmin={isAdmin} isTherapist={isTherapist} lang={lang} />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 md:ml-64 pt-14 md:pt-0">
        <Outlet />
      </main>
    </div>
  );
}