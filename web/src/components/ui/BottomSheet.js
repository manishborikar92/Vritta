'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/utils/cn';

/**
 * Modal bottom sheet built on the native <dialog>:
 * focus trap, Escape, inert background, focus restore, and top-layer rendering
 * (so no portal and no z-index / backdrop-filter containing-block problems).
 */
export default function BottomSheet({ open, onClose, label, children, className }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      // Clicks on the backdrop are dispatched to the <dialog> itself
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        'fixed inset-x-0 top-auto bottom-0 m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto overscroll-contain',
        'rounded-t-3xl border-t border-subtle bg-surface p-0 text-main shadow-lg pb-safe',
        'open:animate-sheet-up backdrop:bg-black/50 backdrop:animate-fade-in',
        'motion-reduce:animate-none motion-reduce:backdrop:animate-none',
        className
      )}
    >
      {open && children}
    </dialog>
  );
}
