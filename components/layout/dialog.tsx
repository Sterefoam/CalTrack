"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return <dialog ref={ref} className="ui-modal" aria-labelledby={titleId} onCancel={onClose} onClose={onClose}>
    <div className="ui-modal-box">
      <div className="flex items-start justify-between gap-4"><h2 id={titleId} className="text-xl font-semibold">{title}</h2><form method="dialog"><button className="ui-btn ui-btn-ghost" aria-label="Tutup dialog">Tutup</button></form></div>
      {children}
    </div>
    <form method="dialog" className="ui-modal-backdrop"><button aria-label="Tutup dialog">Tutup</button></form>
  </dialog>;
}
