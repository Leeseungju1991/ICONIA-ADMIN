"use client";

const KEY = "soom_auth";

export function isAuthed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY) === "true";
}

export function login(id: string, pw: string): boolean {
  if (id === "soom" && pw === "soom") {
    window.localStorage.setItem(KEY, "true");
    return true;
  }
  return false;
}

export function logout(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
