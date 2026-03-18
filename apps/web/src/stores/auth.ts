import { useSyncExternalStore, useCallback } from "react";
import type { Role } from "@judge/shared";

interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: Role;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
}

let state: AuthState = {
  token: localStorage.getItem("token"),
  user: (() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  })(),
};

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

export function setAuth(token: string, user: AuthUser) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
  state = { token, user };
  emitChange();
}

export function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  state = { token: null, user: null };
  emitChange();
}

export function updateUser(partial: Partial<AuthUser>) {
  if (!state.user) return;
  const updated = { ...state.user, ...partial };
  localStorage.setItem("user", JSON.stringify(updated));
  state = { ...state, user: updated };
  emitChange();
}

export function useAuth() {
  const authState = useSyncExternalStore(subscribe, getSnapshot);

  const login = useCallback((token: string, user: AuthUser) => {
    setAuth(token, user);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
  }, []);

  return {
    token: authState.token,
    user: authState.user,
    isAuthenticated: !!authState.token,
    login,
    logout,
  };
}
