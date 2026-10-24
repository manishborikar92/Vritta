'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import { X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            <div className="fixed bottom-20 left-0 right-0 z-[110] flex flex-col items-center gap-2 pointer-events-none px-4">
                {toasts.map(toast => {
                    let bgColor = 'bg-gray-800';
                    if (toast.type === 'success') bgColor = 'bg-green-600';
                    else if (toast.type === 'error') bgColor = 'bg-red-600';

                    return (
                        <div
                            key={toast.id}
                            className={`${bgColor} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 text-sm font-medium w-full max-w-sm pointer-events-auto transform transition-all duration-300 animate-in slide-in-from-bottom-2 fade-in`}
                            role="alert"
                        >
                            <span className="flex-1">{toast.message}</span>
                            <button
                                onClick={() => removeToast(toast.id)}
                                className="text-white/80 hover:text-white transition-colors"
                                aria-label="Close notification"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within a ToastProvider');
    return context;
};
