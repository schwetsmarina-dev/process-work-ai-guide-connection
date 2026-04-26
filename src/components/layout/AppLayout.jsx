import React, { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  LayoutDashboard,
  History,
  BarChart3,
  Settings,
  Menu,
  X,
  LogOut,
  Sparkles,
  Upload,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navItems = [
  { path: "/dashboard", label: "Главная", icon: LayoutDashboard },
  { path: "/history", label: "История", icon: History },
  { path: "/insights", label: "Инсайты", icon: BarChart3 },
  { path: "/settings", label: "Настройки", icon: Settings },
  { path: "/admin/import", label: "Импорт данных", icon: Upload },
  { path: "/admin/status", label: "Статус данных", icon: ShieldAlert },
];

function NavContent({ currentPath, onNavigate }) {
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
        {navItems.map((item) => {
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
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <button
          onClick={() => base44.auth.logout()}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all w-full"
        >
          <LogOut className="w-5 h-5" />
          Выйти
        </button>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 border-r border-border bg-card flex-col fixed h-full">
        <NavContent currentPath={location.pathname} onNavigate={() => {}} />
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
              <NavContent currentPath={location.pathname} onNavigate={() => setOpen(false)} />
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