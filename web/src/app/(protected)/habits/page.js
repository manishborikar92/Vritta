'use client';

import { useState, useRef } from 'react';
import { Plus, Compass, BookOpen } from 'lucide-react';
import { useData, useToast, useSound } from '@/contexts';
import { ConfirmDialog, HabitsSkeleton } from '@/components/ui';
import { HabitModal, HabitManagerCard, TemplateBrowserModal } from '@/components/habits';
import { getSafeSaveErrorMessage, logDiagnosticError } from '@/lib/utils/error-helpers';

export default function HabitsPage() {
  const { habits, loading, addHabit, updateHabit, deleteHabit, seedHabits } = useData();
  const { addToast } = useToast();
  const { playActionSuccessCue, playActionDeleteCue } = useSound();
  const [showModal, setShowModal] = useState(false);
  const [showTemplateBrowser, setShowTemplateBrowser] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const isSeedingRef = useRef(false);

  const handleSave = async (formData) => {
    try {
      if (editingHabit && editingHabit.id) {
        await updateHabit(editingHabit.id, formData);
      } else {
        await addHabit(formData);
      }
      setShowModal(false);
      setEditingHabit(null);
      addToast(`Routine ${editingHabit?.id ? 'updated' : 'created'} successfully`, 'success');
      playActionSuccessCue?.();
    } catch (err) {
      logDiagnosticError('[RoutinePersistenceError] Failed to save routine:', err);
      const displayMessage = getSafeSaveErrorMessage(err);
      addToast(displayMessage, 'error');
    }
  };

  const handleDelete = async (habitId) => {
    setIsDeleting(true);
    try {
      await deleteHabit(habitId);
      setShowModal(false);
      setEditingHabit(null);
      setDeleteConfirm(null);
      addToast('Routine removed. Past logs remain preserved.', 'success');
      playActionDeleteCue?.();
    } catch (err) {
      console.error('Error deleting routine:', err);
      addToast('Failed to delete routine. Please try again.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSeedHabits = async () => {
    // Only permit seeding when user has zero routines or habits
    if (habits.length > 0 || isSeedingRef.current || seeding) return;

    isSeedingRef.current = true;
    setSeeding(true);
    try {
      await seedHabits();
      addToast('Foundation routines loaded successfully!', 'success');
      playActionSuccessCue?.();
    } catch (err) {
      console.error('Error loading foundation routines:', err);
      addToast(err.message || 'Failed to load recommended routines. Please try again.', 'error');
    } finally {
      isSeedingRef.current = false;
      setSeeding(false);
    }
  };

  if (loading) {
    return <HabitsSkeleton />;
  }

  return (
    <>
      <main className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-5 space-y-4 pb-32 sm:pb-36">
        {habits.length === 0 ? (
          <div className="text-center py-12 px-4 bg-surface rounded-2xl border border-subtle dark:border-stone-800 shadow-2xs space-y-4">
            <div className="w-14 h-14 bg-teal-50 dark:bg-teal-950/60 rounded-2xl flex items-center justify-center mx-auto text-teal-700 dark:text-teal-400 shadow-2xs">
              <Compass className="w-7 h-7" />
            </div>
            <div className="max-w-sm mx-auto space-y-1.5">
              <h3 className="text-base font-bold text-main">No routines found</h3>
              <p className="text-xs text-sub leading-relaxed">
                Load recommended foundation routines or create your own custom habit.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5 justify-center items-center flex-wrap">
              <button
                type="button"
                onClick={handleSeedHabits}
                disabled={seeding}
                className="px-5 py-2.5 bg-teal-700 dark:bg-teal-600 text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-teal-800 dark:hover:bg-teal-500 transition-colors disabled:opacity-50 shadow-2xs min-h-[44px]"
              >
                {seeding ? 'Loading Routines...' : 'Load Recommended Routines'}
              </button>
              <button
                type="button"
                onClick={() => setShowTemplateBrowser(true)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-surface border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 rounded-xl text-xs sm:text-sm font-semibold hover:bg-teal-50 dark:hover:bg-teal-950/40 transition-colors shadow-2xs min-h-[44px]"
              >
                <BookOpen className="w-4 h-4" />
                <span>Schedule Blueprints</span>
              </button>
              <button
                type="button"
                onClick={() => { setEditingHabit(null); setShowModal(true); }}
                className="px-5 py-2.5 bg-surface border border-subtle dark:border-stone-700 text-main rounded-xl text-xs sm:text-sm font-semibold hover:bg-surface-subtle transition-colors shadow-2xs min-h-[44px]"
              >
                Create Custom Routine
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-3.5">
            {/* Page Header */}
            <div className="flex items-center justify-between gap-3 px-1">
              <div className="space-y-0.5 min-w-0">
                <h1 className="text-base sm:text-lg font-bold text-main leading-snug">
                  Routines &amp; Observance
                </h1>
                <p className="text-2xs sm:text-xs text-muted leading-tight">
                  Manage your daily rhythms and feature slots
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplateBrowser(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl border border-subtle bg-surface text-xs font-semibold text-main hover:bg-surface-subtle transition-colors shadow-2xs h-9 min-h-[36px] sm:h-10 sm:min-h-[40px] shrink-0"
                title="Browse schedule blueprints and templates"
              >
                <BookOpen className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                <span>Blueprints</span>
              </button>
            </div>

            <div className="space-y-3">
              {habits.map((habit) => (
                <HabitManagerCard
                  key={habit.id}
                  habit={habit}
                  onEdit={(h) => {
                    setEditingHabit(h);
                    setShowModal(true);
                  }}
                  onDelete={(id) => setDeleteConfirm(id)}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => handleDelete(deleteConfirm)}
        title="Delete Routine?"
        message="This routine will be removed from your upcoming schedule. Historical logs and past completions are safely preserved."
        confirmText="Delete"
        isDanger={true}
        isLoading={isDeleting}
      />

      {showModal && (
        <HabitModal
          habit={editingHabit}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingHabit(null); }}
          onDelete={editingHabit ? handleDelete : null}
        />
      )}

      <TemplateBrowserModal
        isOpen={showTemplateBrowser}
        onClose={() => setShowTemplateBrowser(false)}
        onSelectTemplate={(templateHabit) => {
          setEditingHabit(templateHabit);
          setShowModal(true);
        }}
      />

      {/* Floating Add Routine Button — elevated above BottomNav with zero card collision */}
      <div className="fixed bottom-22 sm:bottom-24 left-0 right-0 pointer-events-none z-40">
        <div className="max-w-2xl mx-auto px-4 flex justify-end">
          <button
            type="button"
            onClick={() => { setEditingHabit(null); setShowModal(true); }}
            className="w-13 h-13 min-w-[52px] min-h-[52px] bg-teal-700 dark:bg-teal-600 text-white rounded-full shadow-lg hover:bg-teal-800 dark:hover:bg-teal-500 transition-all hover:scale-105 active:scale-95 flex items-center justify-center pointer-events-auto shadow-teal-700/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            aria-label="Add Routine"
            title="Add Routine"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </div>
    </>
  );
}
