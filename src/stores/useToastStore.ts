import { create } from "zustand";

export type ToastVariant = "info" | "success" | "error" | "warning";

export type Toast = {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
};

type ToastState = {
  toasts: Toast[];
  add: (toast: Omit<Toast, "id"> & { id?: string }) => string;
  dismiss: (id: string) => void;
};

const MAX_TOASTS = 5;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: (toast) => {
    const id = toast.id ?? crypto.randomUUID();
    set((s) => {
      const next = [...s.toasts.filter((t) => t.id !== id), { ...toast, id }];
      return { toasts: next.slice(-MAX_TOASTS) };
    });
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Module-level helpers so services/components can fire toasts without hooks. */
export const toast = {
  info: (title: string, description?: string) =>
    useToastStore.getState().add({ variant: "info", title, description }),
  success: (title: string, description?: string) =>
    useToastStore.getState().add({ variant: "success", title, description }),
  error: (title: string, description?: string) =>
    useToastStore.getState().add({ variant: "error", title, description }),
  warning: (title: string, description?: string) =>
    useToastStore.getState().add({ variant: "warning", title, description }),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
};
