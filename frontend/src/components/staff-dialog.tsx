"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import styles from "./staff-patterns.module.css";

// Mount only while open. The browser keeps focus inside the modal and restores it on close.
export function StaffDialog({ labelledBy, onDismiss, children }: {
  labelledBy: string;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return <dialog ref={ref} className={styles.dialog} aria-labelledby={labelledBy}
    onCancel={event => { event.preventDefault(); onDismiss(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect();
      if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) onDismiss();
    }}>
    {children}
  </dialog>;
}
