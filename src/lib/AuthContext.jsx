import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      
      // First, check app public settings (with token if available)
      // This will tell us if auth is required, user not registered, etc.
      const appClient = createAxiosClient({
        baseURL: `/api/apps/public`,
        headers: {
          'X-App-Id': appParams.appId
        },
        token: appParams.token, // Include token if available
        interceptResponses: true
      });
      
      try {
        const publicSettings = await appClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
        setAppPublicSettings(publicSettings);
        
        // Always ask the auth service for the current user. OAuth sessions may now
        // be stored in an HTTP-only cookie and therefore have no access_token
        // in the URL/localStorage. Checking only appParams.token causes a valid
        // Google login to be treated as logged out after the callback.
        await checkUserAuth();
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('App state check failed:', appError);
        
        // Handle app-level errors
        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          if (reason === 'auth_required') {
            // A cookie-backed OAuth session can exist even when the public
            // settings request has no token header. Verify it before deciding
            // that the visitor is logged out.
            setIsLoadingPublicSettings(false);
            await checkUserAuth();
          } else if (reason === 'user_not_registered') {
            // Logged in but no AppUser record yet — proceed as authenticated
            // RequireAuth will auto-create the AppUser
            setIsLoadingPublicSettings(false);
            if (appParams.token) {
              await checkUserAuth();
            } else {
              setIsLoadingAuth(false);
              setAuthChecked(true);
            }
          } else {
            setAuthError({ type: reason, message: appError.message });
            setIsLoadingPublicSettings(false);
            setIsLoadingAuth(false);
          }
        } else {
          setAuthError({
            type: 'unknown',
            message: appError.message || 'Failed to load app'
          });
          setIsLoadingPublicSettings(false);
          setIsLoadingAuth(false);
        }
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      console.error('User auth check failed:', error);
      const reason = error.data?.extra_data?.reason || error.data?.reason;

      // Only this specific 403 means the identity is valid but the app profile
      // has not been created yet. A generic 403/auth_required must never be
      // treated as an authenticated user.
      if (error.status === 403 && reason === 'user_not_registered') {
        const userData = error.data?.user || null;
        setUser(userData);
        setIsAuthenticated(true);
        setAuthError(null);
      } else {
        setUser(null);
        setIsAuthenticated(false);
        if (error.status === 401 || error.status === 403 || reason === 'auth_required') {
          setAuthError({ type: 'auth_required', message: 'Authentication required' });
        } else {
          setAuthError({
            type: 'unknown',
            message: error.message || 'Failed to verify authentication'
          });
        }
      }

      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    
    if (shouldRedirect) {
      // Use the SDK's logout method which handles token cleanup and redirect
      base44.auth.logout(window.location.href);
    } else {
      // Just remove the token without redirect
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    // Use the SDK's redirectToLogin method
    base44.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};