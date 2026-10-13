import React, { useEffect, useState } from 'react';
import type { User } from '../types';
import {
  api,
  clearStoredAuth,
  getStoredToken,
  getStoredUser,
  setStoredUser,
} from '../services/api';
import { AuthContext } from './AuthContextState';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [user, setUser] = useState<User | null>(getStoredUser());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    if (!getStoredToken()) {
      setUser(null);
      return;
    }
    try {
      const liveUser = await api.getMe();
      setUser(liveUser);
      setStoredUser(liveUser);
    } catch {
      clearStoredAuth();
      setToken(null);
      setUser(null);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const existingToken = getStoredToken();
      if (existingToken) {
        await refreshUser();
      }
      setIsLoading(false);
    };

    initAuth();

    const handleExpired = () => {
      setToken(null);
      setUser(null);
    };

    window.addEventListener('vorldx_auth_expired', handleExpired);
    return () => window.removeEventListener('vorldx_auth_expired', handleExpired);
  }, []);

  const login = async (loginId: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      const res = await api.login(loginId, password);
      setToken(res.access_token);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = (): void => {
    api.logout();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
