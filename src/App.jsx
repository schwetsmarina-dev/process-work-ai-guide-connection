import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import SessionChat from './pages/SessionChat';
import SessionSummary from './pages/SessionSummary';
import History from './pages/History';
import Insights from './pages/Insights';
import Settings from './pages/Settings';
import AppLayout from './components/layout/AppLayout';
import AdminImport from './pages/AdminImport';
import AdminDataStatus from './pages/AdminDataStatus';
import RequireAuth from './components/layout/RequireAuth';

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

      {/* Authenticated routes */}
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/history" element={<History />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        {/* Session pages (full screen, no sidebar) */}
        <Route path="/session/:id" element={<SessionChat />} />
        <Route path="/session/:id/summary" element={<SessionSummary />} />

        {/* Admin */}
        <Route path="/admin/import" element={<AdminImport />} />
        <Route path="/admin/status" element={<AdminDataStatus />} />
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