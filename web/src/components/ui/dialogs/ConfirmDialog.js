'use client';

import { AlertTriangle, Info } from 'lucide-react';

/**
 * Reusable confirmation dialog component.
 * @param {boolean} isOpen - Whether the dialog is visible
 * @param {function} onClose - function to call to close the dialog
 * @param {function} onConfirm - function to call upon confirmation
 * @param {string} title - Dialog title
 * @param {string} message - Dialog description message
 * @param {string} confirmText - Text for the confirm button
 * @param {string} cancelText - Text for the cancel button
 * @param {boolean} isDanger - Whether the action is dangerous (uses red colors)
 * @param {boolean} isLoading - Whether the confirm action is in progress
 */
export default function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDanger = true,
    isLoading = false,
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={!isLoading ? onClose : undefined} />

            <div
                className="relative bg-surface border border-subtle rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200"
                role="dialog"
                aria-labelledby="dialog-title"
                aria-describedby="dialog-description"
                aria-modal="true"
            >
                <div className="text-center mb-6">
                    <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${isDanger ? 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400' : 'bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300'}`}>
                        {isDanger ? <AlertTriangle className="w-6 h-6" /> : <Info className="w-6 h-6" />}
                    </div>
                    <h3 id="dialog-title" className="text-lg font-bold text-main mb-2">
                        {title}
                    </h3>
                    <p id="dialog-description" className="text-sm text-sub">
                        {message}
                    </p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="flex-1 px-4 py-2.5 bg-surface-subtle text-sub rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-white ${isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-teal-600 hover:bg-teal-700'
                            }`}
                    >
                        {isLoading && (
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white" />
                        )}
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
