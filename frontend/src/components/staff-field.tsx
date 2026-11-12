"use client";

import { useId, type ReactNode } from "react";
import styles from "./staff-patterns.module.css";

type ControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

export function Field({ id, label, hint, error, children }: {
  id?: string;
  label: ReactNode;
  hint?: string;
  error?: string;
  children: (props: ControlProps) => ReactNode;
}) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;

  return <div className={styles.field}>
    <label htmlFor={controlId}>{label}</label>
    {children({
      id: controlId,
      "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined,
      "aria-invalid": error ? true : undefined,
    })}
    {hint && <p id={hintId} className={styles.hint}>{hint}</p>}
    {error && <p id={errorId} className={styles.fieldError} role="alert">{error}</p>}
  </div>;
}
