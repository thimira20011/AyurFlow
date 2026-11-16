"use client";

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";

export function WorkspaceDialog({ labelledBy, className, style, onDismiss, children }: {
  labelledBy: string;
  className?: string;
  style?: CSSProperties;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      className={className}
      style={style}
      onCancel={event => {
        event.preventDefault();
        onDismiss();
      }}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const { left, top, right, bottom } = event.currentTarget.getBoundingClientRect();
        if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) onDismiss();
      }}
    >
      {children}
    </dialog>
  );
}
