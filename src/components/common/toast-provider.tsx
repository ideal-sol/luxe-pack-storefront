"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

interface ToastMessage {
  readonly id: number;
  readonly message: string;
  readonly title: string;
}

interface ToastContextValue {
  readonly dismissToast: (id: number) => void;
  readonly showToast: (title: string, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { readonly children: React.ReactNode }) {
  const nextId = useRef(1);
  const [messages, setMessages] = useState<readonly ToastMessage[]>([]);
  const dismissToast = useCallback((id: number) => {
    setMessages((current) => current.filter((message) => message.id !== id));
  }, []);
  const showToast = useCallback((title: string, message: string) => {
    const id = nextId.current++;
    setMessages((current) => [...current, { id, message, title }]);
  }, []);
  const value = useMemo(() => ({ dismissToast, showToast }), [dismissToast, showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-label="通知" aria-live="polite" className="toast-viewport">
        {messages.map((message) => (
          <section className="toast-card" key={message.id}>
            <div>
              <strong>{message.title}</strong>
              <p>{message.message}</p>
            </div>
            <button aria-label="通知を閉じる" onClick={() => dismissToast(message.id)} type="button">
              ×
            </button>
          </section>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
