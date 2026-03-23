'use client';
import * as React from 'react';
import type { ToastActionElement, ToastProps } from '@/components/ui/toast';

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 4000;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

let count = 0;
function genId() { return `toast-${++count}`; }

type State = { toasts: ToasterToast[] };

const listeners: Array<(state: State) => void> = [];
let memoryState: State = { toasts: [] };

function dispatch(toasts: ToasterToast[]) {
  memoryState = { toasts };
  listeners.forEach(l => l(memoryState));
}

function toast({ ...props }: Omit<ToasterToast, 'id'>) {
  const id = genId();
  const update = (p: ToasterToast) => dispatch(memoryState.toasts.map(t => (t.id === id ? { ...t, ...p } : t)));
  const dismiss = () => dispatch(memoryState.toasts.filter(t => t.id !== id));
  dispatch([{ ...props, id, open: true, onOpenChange: (open) => { if (!open) dismiss(); } }, ...memoryState.toasts].slice(0, TOAST_LIMIT));
  setTimeout(dismiss, TOAST_REMOVE_DELAY);
  return { id, dismiss, update };
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);
  React.useEffect(() => {
    listeners.push(setState);
    return () => { const i = listeners.indexOf(setState); if (i > -1) listeners.splice(i, 1); };
  }, []);
  return { ...state, toast, dismiss: (id: string) => dispatch(memoryState.toasts.filter(t => t.id !== id)) };
}

export { useToast, toast };
