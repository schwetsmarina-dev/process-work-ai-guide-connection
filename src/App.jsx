import { t, getStoredLanguage } from "@/lib/i18n";
import React from "react"
import { Toaster } from "@/components/ui/toaster"
import { base44 } from "@/api/base44Client"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Progress from './pages/Progress';
import SessionChat from './pages/SessionChat';
import SessionSummary from './pages/SessionSummary';
import History from './pages/History';
import Journal from './pages/Journal';
import Insights from './pages/Insights';
import Settings from './pages/Settings';
import AppLayout from './components/layout/AppLayout';
import AdminImport from './pages/AdminImport';
import AdminDataStatus from './pages/AdminDataStatus';
import AdminFeedback from './pages/AdminFeedback';
import InsightLibrary from './pages/InsightLibrary';
import InsightAgent from './pages/InsightAgent';
import LifeProcessMap from './pages/LifeProcessMap';
import Timeline from './pages/Timeline';
import TherapistDashboard from './pages/TherapistDashboard';
import RequireAuth from './components/layout/RequireAuth';
import { Navigate } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

function ProtectedAdminRoute({ children }) {
  const [status, setStatus] = React.useState("loading");

  React.useEffect(() => {
    base44.auth.me().then((user) => {
      const admin = user?.role === "admin" || user?.email === "schwets.marina@gmail.com";
      setStatus(admin ? "ok" : "denied");
    }).catch(() => setStatus("denied"));
  }, []);

  if (status === "loading") return null;
  if (status === "denied") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">{t("access_denied", getStoredLanguage())}</p>
      </div>
    );
  }
  return children;
}

function ProtectedTherapistRoute({ children }) {
  const [status, setStatus] = React.useState("loading");

  React.useEffect(() => {
    base44.auth.me().then((user) => {
      const ok = user?.role === "therapist" || user?.role === "admin";
      setStatus(ok ? "ok" : "denied");
    }).catch(() => setStatus("denied"));
  }, []);

  if (status === "loading") return null;
  if (status === "denied") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">{t("access_denied", getStoredLanguage())}</p>
      </div>
    );
  }
  return children;
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, isAuthenticated } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  // user_not_registered is handled gracefully by RequireAuth (auto-creates AppUser)
  // Only show hard errors for truly unrecoverable situations
  if (authError && authError.type !== 'user_not_registered' && authError.type !== 'auth_required') {
    return <UserNotRegisteredError />;
  }

  // Render the main app
  return (
    <Routes>
      {/* Public landing page */}
      <Route path="/" element={<Landing />} />

      {/* Public custom auth pages */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Authenticated routes — gated by ProtectedRoute, unauthenticated users go to /login */}
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/history" element={<History />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/insights-library" element={<InsightLibrary />} />
            <Route path="/life-process-map" element={<LifeProcessMap />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/therapist" element={<ProtectedTherapistRoute><TherapistDashboard /></ProtectedTherapistRoute>} />
            <Route path="/insight-agent" element={<InsightAgent />} />
            <Route path="/admin/import" element={<ProtectedAdminRoute><AdminImport /></ProtectedAdminRoute>} />
            <Route path="/admin/status" element={<ProtectedAdminRoute><AdminDataStatus /></ProtectedAdminRoute>} />
            <Route path="/admin/feedback" element={<ProtectedAdminRoute><AdminFeedback /></ProtectedAdminRoute>} />
          </Route>

          {/* Session pages (full screen, no sidebar) */}
          <Route path="/session/:id" element={<SessionChat />} />
          <Route path="/session/:id/summary" element={<SessionSummary />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App