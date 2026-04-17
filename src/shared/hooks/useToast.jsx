import { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from "react";

const ToastContext = createContext(null);

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(clearTimeout);
      timersRef.current = {};
    };
  }, []);

  const dismiss = useCallback((id) => {
    clearTimeout(timersRef.current[id]);
    delete timersRef.current[id];
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (msg, type = "success", duration = 3500, action) => {
      const id = ++idCounter;
      const a =
        action && typeof action === "object" && typeof action.onClick === "function"
          ? { label: String(action.label || "Дія"), onClick: action.onClick }
          : null;
      setToasts((prev) => [...prev.slice(-4), { id, msg, type, action: a }]);
      timersRef.current[id] = setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss],
  );

  const success = useCallback((msg, duration, action) => show(msg, "success", duration, action), [show]);
  const error = useCallback((msg, duration, action) => show(msg, "error", duration ?? 5000, action), [show]);
  const info = useCallback((msg, duration, action) => show(msg, "info", duration, action), [show]);
  const warning = useCallback((msg, duration, action) => show(msg, "warning", duration ?? 5000, action), [show]);

  const api = useMemo(
    () => ({ show, success, error, info, warning, dismiss }),
    [show, success, error, info, warning, dismiss],
  );

  const value = useMemo(() => ({ ...api, toasts }), [api, toasts]);

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
