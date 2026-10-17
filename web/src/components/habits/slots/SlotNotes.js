'use client';

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { PenLine, Lock, Sparkles, Check } from 'lucide-react';

/**
 * SlotNotes — Universal reflection & private journal notes slot.
 *
 * Configured via `habit.features.notes`:
 * - `isPrivateDiary`: Displays private reflection badge
 * - `reflectionPrompts`: Array of quick guidance chips
 * - `placeholder`: Customizable textarea placeholder
 *
 * Guarantees zero data loss:
 * - 400ms debounced auto-save
 * - Immediate save on blur
 * - Immediate flush on unmount (navigation)
 * - Immediate flush on page hide / tab backgrounding
 */
function SlotNotes({
  habitId,
  feature = {},
  progress = {},
  onSave,
  disabled = false,
}) {
  const incoming = progress.notes || progress.diaryEntry || '';
  const [prevIncoming, setPrevIncoming] = useState(incoming);
  const [text, setText] = useState(incoming);
  const [isEditing, setIsEditing] = useState(false);
  const [lastSaved, setLastSaved] = useState(incoming);
  const [saveIndicator, setSaveIndicator] = useState(false);

  const textRef = useRef(text);
  const lastSavedRef = useRef(lastSaved);
  const timerRef = useRef(null);

  // Sync incoming external notes during render if not currently editing (React-recommended pattern)
  if (!isEditing && incoming !== prevIncoming) {
    setPrevIncoming(incoming);
    setText(incoming);
    setLastSaved(incoming);
  }

  // Keep refs synchronized outside render
  useEffect(() => {
    textRef.current = text;
    lastSavedRef.current = lastSaved;
  }, [text, lastSaved]);

  const flushSave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    setIsEditing(false);

    const currentText = textRef.current;
    if (currentText !== lastSavedRef.current) {
      lastSavedRef.current = currentText;
      setLastSaved(currentText);
      try {
        onSave?.(currentText);
        setSaveIndicator(true);
        setTimeout(() => setSaveIndicator(false), 2000);
      } catch (err) {
        console.error('Error auto-saving notes:', err);
      }
    }
  }, [onSave]);

  const handleChange = (e) => {
    const val = e.target.value;
    setText(val);
    textRef.current = val;
    setIsEditing(true);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      flushSave();
    }, 400);
  };

  const handleBlur = () => {
    flushSave();
  };

  const handlePromptClick = (prompt) => {
    const prefix = text ? `${text.trim()}\n\n• ${prompt}: ` : `• ${prompt}: `;
    setText(prefix);
    textRef.current = prefix;
    setIsEditing(true);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      flushSave();
    }, 400);
  };

  // Immediate flush on unmount (e.g. client page navigation)
  useEffect(() => {
    return () => {
      flushSave();
    };
  }, [flushSave]);

  // Immediate flush on page hide / tab change
  useEffect(() => {
    const handlePageHide = () => flushSave();
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flushSave();
      }
    });
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [flushSave]);

  const prompts = Array.isArray(feature.reflectionPrompts) && feature.reflectionPrompts.length > 0
    ? feature.reflectionPrompts
    : feature.isPrivateDiary
    ? ['Wins', 'Gratitude', 'Learnings']
    : [];

  return (
    <div className="rounded-xl p-3 sm:p-3.5 bg-surface-subtle/80 dark:bg-stone-900/60 border border-subtle space-y-2.5">
      {/* Header Row */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-main text-2xs uppercase tracking-tight">
          <PenLine className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          <span>Notes & Reflection</span>
          {feature.isPrivateDiary && (
            <span className="flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded bg-surface border border-subtle text-muted">
              <Lock className="w-2.5 h-2.5" />
              <span>Private</span>
            </span>
          )}
        </div>

        <div className="text-2xs text-muted flex items-center gap-1">
          {saveIndicator ? (
            <span className="text-teal-700 dark:text-teal-400 font-semibold flex items-center gap-0.5 animate-fade-in">
              <Check className="w-3 h-3" /> Saved
            </span>
          ) : isEditing ? (
            <span className="text-slate-400">Saving...</span>
          ) : text ? (
            <span className="text-slate-400">Autosaved</span>
          ) : null}
        </div>
      </div>

      {/* Guided Reflection Prompt Chips */}
      {prompts.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-2xs text-muted flex items-center gap-1 mr-0.5">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>Prompts:</span>
          </span>
          {prompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => handlePromptClick(prompt)}
              disabled={disabled}
              className="px-2 py-0.5 text-2xs rounded-md bg-surface border border-subtle text-sub hover:text-main hover:bg-surface-subtle transition-colors shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-600"
            >
              + {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Responsive Textarea */}
      <div className="relative">
        <textarea
          value={text}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={feature.placeholder || (feature.isPrivateDiary ? 'Write your thoughts, daily learnings, and reflections here...' : 'Add private notes or reflections...')}
          rows={3}
          className="w-full px-3 py-2 text-base sm:text-xs rounded-xl border border-subtle bg-surface text-main placeholder-muted focus:ring-2 focus:ring-teal-600 focus:border-transparent outline-none resize-y transition-colors leading-relaxed"
        />
      </div>
    </div>
  );
}

export default memo(SlotNotes);
