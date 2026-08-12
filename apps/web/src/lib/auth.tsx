'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, getFacilityId, getToken, setFacilityId, setToken } from './api';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  roleCode: string;
  roleName: string;
  facilityId?: string | null;
  permissions: string[];
};

type AuthState = {
  user: AuthUser | null;
  facilityId: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  selectFacility: (id: string) => void;
  refreshMe: () => Promise<void>;
  hasPermission: (p: string) => boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [facilityId, setFacility] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api<AuthUser>('/v1/auth/me');
      setUser(me);
      const stored = getFacilityId() || me.facilityId || null;
      if (stored) {
        setFacility(stored);
        setFacilityId(stored);
      }
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<{ accessToken: string; user: AuthUser }>('/v1/auth/login', {
      method: 'POST',
      json: { email, password },
    });
    setToken(res.accessToken);
    setUser(res.user);
    if (res.user.facilityId) {
      setFacility(res.user.facilityId);
      setFacilityId(res.user.facilityId);
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const selectFacility = useCallback((id: string) => {
    setFacility(id);
    setFacilityId(id);
  }, []);

  const hasPermission = useCallback(
    (p: string) => !!user?.permissions?.includes(p),
    [user],
  );

  const value = useMemo(
    () => ({
      user,
      facilityId,
      loading,
      login,
      logout,
      selectFacility,
      refreshMe,
      hasPermission,
    }),
    [user, facilityId, loading, login, logout, selectFacility, refreshMe, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora de AuthProvider');
  return ctx;
}
