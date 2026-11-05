"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

/* Shared client UI: toast messages, confirm dialogs, modals and copy buttons. */

type UI = { toast: (msg: string) => void; confirm: (msg: string) => Promise<boolean> };
const UIContext = createContext<UI | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState("");
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [ask, setAsk] = useState<{ msg: string; resolve: (ok: boolean) => void } | null>(null);

  const toast = useCallback((m: string) => {
    setMsg(m);
    setShow(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(false), 2800);
  }, []);
  const confirm = useCallback((m: string) => new Promise<boolean>((resolve) => setAsk({ msg: m, resolve })), []);
  const answer = (ok: boolean) => { ask?.resolve(ok); setAsk(null); };

  return (
    <UIContext value={{ toast, confirm }}>
      {children}
      {ask && (
        <Modal onClose={() => answer(false)}>
          <h3>Are you sure?</h3>
          <p style={{ fontSize: 14, marginBottom: 16 }}>{ask.msg}</p>
          <div className="actions">
            <button className="btn btn-outline btn-sm" onClick={() => answer(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={() => answer(true)} autoFocus>Yes</button>
          </div>
        </Modal>
      )}
      <div className={`toast ${show ? "show" : ""}`} role="status" aria-live="polite">{msg}</div>
    </UIContext>
  );
}

export function useUI() {
  const ui = useContext(UIContext);
  if (!ui) throw new Error("useUI must be used inside UIProvider");
  return ui;
}

export function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true">{children}</div>
    </div>
  );
}

export function CopyButton({ text, label = "Copy", className = "btn btn-outline btn-sm" }: { text: string; label?: string; className?: string }) {
  const { toast } = useUI();
  const copy = () => {
    const fail = () => toast(`Copy isn't allowed here. The code is ${text}`);
    try { navigator.clipboard.writeText(text).then(() => toast(`Copied ${text}`), fail); } catch { fail(); }
  };
  return <button type="button" className={className} onClick={copy}>{label}</button>;
}
