'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import styles from './ToastProvider.module.css';

const ToastContext = createContext(null);
const dismissMsByType = {
  success: 3500,
  info: 3500,
  warning: 6000,
  error: 6000
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismissToast = useCallback((id) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((toast) => {
    const id = nextId.current;
    nextId.current += 1;
    const type = toast.type || 'info';
    const duration = toast.duration ?? dismissMsByType[type] ?? dismissMsByType.info;

    setToasts((currentToasts) => [
      ...currentToasts,
      {
        id,
        type,
        title: toast.title || defaultTitle(type),
        message: toast.message || ''
      }
    ]);

    if (duration > 0) {
      window.setTimeout(() => dismissToast(id), duration);
    }

    return id;
  }, [dismissToast]);

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.viewport} aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div key={toast.id} className={`${styles.toast} ${styles[toast.type] || styles.info}`} role={toast.type === 'error' ? 'alert' : 'status'}>
            <div>
              <strong>{toast.title}</strong>
              {toast.message && <p>{toast.message}</p>}
            </div>
            <button type="button" className={styles.closeButton} onClick={() => dismissToast(toast.id)} aria-label="Dismiss notification">
              x
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

function defaultTitle(type) {
  if (type === 'success') return 'Success';
  if (type === 'error') return 'Error';
  if (type === 'warning') return 'Warning';
  return 'Info';
}
