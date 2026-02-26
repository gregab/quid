import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import * as Haptics from "expo-haptics";
import { Toast } from "../components/ui/Toast";

export type ToastType = "success" | "error" | "info";

interface ToastData {
  message: string;
  type: ToastType;
  duration: number;
  key: number;
}

interface ToastContextValue {
  showToast: (opts: {
    message: string;
    type: ToastType;
    duration?: number;
  }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 3000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);

  const showToast = useCallback(
    ({
      message,
      type,
      duration = DEFAULT_DURATION,
    }: {
      message: string;
      type: ToastType;
      duration?: number;
    }) => {
      setToast({ message, type, duration, key: Date.now() });

      if (type === "success") {
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
      } else if (type === "error") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [],
  );

  const handleDismiss = useCallback(() => {
    setToast(null);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Toast
          key={toast.key}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onDismiss={handleDismiss}
        />
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
