import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type AuthContextValue = {
  token: string | null;
  setToken: (token: string | null) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue>({
  token: null,
  setToken: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem('token'));

  const setToken = useCallback((next: string | null) => {
    if (next) localStorage.setItem('token', next);
    else localStorage.removeItem('token');
    setTokenState(next);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setTokenState(null);
    window.location.href = '/login';
  }, []);

  const value = useMemo(() => ({ token, setToken, logout }), [token, setToken, logout]);
  return React.createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  return useContext(AuthContext);
}
