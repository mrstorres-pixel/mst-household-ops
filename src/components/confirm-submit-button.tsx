"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";

type ConfirmSubmitButtonProps = {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  title: string;
  message: string;
  confirmLabel?: string;
};

export function ConfirmSubmitButton({
  children,
  pendingText = "Working...",
  className = "btn btn-danger",
  title,
  message,
  confirmLabel = "Confirm"
}: ConfirmSubmitButtonProps) {
  const { pending } = useFormStatus();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button ref={buttonRef} className={className} type="button" disabled={pending} aria-busy={pending} onClick={() => setIsOpen(true)}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {pending ? pendingText : children}
      </button>
      {isOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4 backdrop-blur-sm" role="presentation" onMouseDown={() => setIsOpen(false)}>
          <div
            className="w-full max-w-md rounded-lg border border-[color:var(--danger-border)] bg-[color:var(--card)] shadow-2xl"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-action-title"
            aria-describedby="confirm-action-message"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex gap-3 border-b border-[color:var(--border)] p-5">
              <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-[color:var(--danger)]" aria-hidden="true" />
              <div>
                <h3 id="confirm-action-title" className="text-xl font-bold">{title}</h3>
                <p id="confirm-action-message" className="mt-2 text-sm text-[color:var(--muted-foreground)]">{message}</p>
              </div>
            </div>
            <div className="grid gap-3 p-5 sm:flex sm:justify-end">
              <button className="btn btn-secondary" type="button" onClick={() => setIsOpen(false)}>Cancel</button>
              <button
                className="btn btn-danger"
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  buttonRef.current?.form?.requestSubmit();
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
