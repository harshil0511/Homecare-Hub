"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";

export type ToastType = "success" | "error" | "notification";
export type NotificationType = "INFO" | "WARNING" | "URGENT";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  notificationType?: NotificationType;
}

interface ToastContextValue {
  toasts: Toast[];
  success: (message: string) => void;
  error: (message: string) => void;
  notify: (title: string, message: string, notificationType?: NotificationType) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timerRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    clearTimeout(timerRefs.current[id]);
    delete timerRefs.current[id];
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<Toast, "id">, duration = 4000) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => {
      const next = [...prev, { ...toast, id }];
      return next.slice(-5); // max 5 stacked
    });
    timerRefs.current[id] = setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  const success = useCallback((message: string) => {
    addToast({ type: "success", message });
  }, [addToast]);

  const error = useCallback((message: string) => {
    addToast({ type: "error", message }, 6000);
  }, [addToast]);

  const notify = useCallback((title: string, message: string, notificationType: NotificationType = "INFO") => {
    addToast({ type: "notification", title, message, notificationType }, 5000);
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, success, error, notify, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
