'use client';

import {
  CounterSlotEditor,
  TimerSlotEditor,
  ChecklistSlotEditor,
  NotesSlotEditor,
  CatalogSlotEditor,
  DayScheduleSlotEditor,
} from './slots';

/**
 * HabitFeaturesTab — Tab 3: Composable Feature Slots configuration.
 */
export function HabitFeaturesTab({
  formData,
  setFormData,
  errors,
  toggleFeatureSlot,
  // Checklist props
  updateChecklistItemLabel,
  moveChecklistItem,
  removeChecklistItem,
  newChecklistItem,
  setNewChecklistItem,
  addChecklistItem,
  // Notes props
  newPromptChip,
  setNewPromptChip,
  addPromptChip,
  removePromptChip,
  // Catalog props
  loadOshoPreset,
  moveCatalogItem,
  removeCatalogItem,
  newCatalogItemTitle,
  setNewCatalogItemTitle,
  newCatalogItemUrl,
  setNewCatalogItemUrl,
  newCatalogItemDesc,
  setNewCatalogItemDesc,
  addCatalogItem,
  // DaySchedule props
  days,
  selectedDayScheduleWeekday,
  handleSelectDayScheduleWeekday,
  handleChangeDayVariationType,
  handleUpdateDayVariationMeta,
  handleUpdateDayScheduleExercise,
  handleToggleDayScheduleExerciseRequired,
  handleRemoveDayScheduleExercise,
  handleMoveDayScheduleExercise,
  handleLoad12WeekMovementDefaults,
  newDayExerciseName,
  setNewDayExerciseName,
  newDayExerciseTarget,
  setNewDayExerciseTarget,
  newDayExerciseRequired,
  setNewDayExerciseRequired,
  handleAddDayScheduleExercise,
}) {
  return (
    <div className="space-y-3.5">
      {/* 1. Counter Slot */}
      <CounterSlotEditor
        feature={formData.features.counter}
        onToggle={() => toggleFeatureSlot('counter')}
        setFormData={setFormData}
      />

      {/* 2. Timer Slot */}
      <TimerSlotEditor
        feature={formData.features.timer}
        onToggle={() => toggleFeatureSlot('timer')}
        setFormData={setFormData}
      />

      {/* 3. Checklist Slot */}
      <ChecklistSlotEditor
        feature={formData.features.checklist}
        checklistItems={formData.checklistItems}
        onToggle={() => toggleFeatureSlot('checklist')}
        updateChecklistItemLabel={updateChecklistItemLabel}
        moveChecklistItem={moveChecklistItem}
        removeChecklistItem={removeChecklistItem}
        newChecklistItem={newChecklistItem}
        setNewChecklistItem={setNewChecklistItem}
        addChecklistItem={addChecklistItem}
      />

      {/* 4. Notes & Reflection Slot */}
      <NotesSlotEditor
        feature={formData.features.notes}
        onToggle={() => toggleFeatureSlot('notes')}
        setFormData={setFormData}
        newPromptChip={newPromptChip}
        setNewPromptChip={setNewPromptChip}
        addPromptChip={addPromptChip}
        removePromptChip={removePromptChip}
      />

      {/* 5. Catalog Slot */}
      <CatalogSlotEditor
        feature={formData.features.catalog}
        onToggle={() => toggleFeatureSlot('catalog')}
        setFormData={setFormData}
        errors={errors}
        loadOshoPreset={loadOshoPreset}
        moveCatalogItem={moveCatalogItem}
        removeCatalogItem={removeCatalogItem}
        newCatalogItemTitle={newCatalogItemTitle}
        setNewCatalogItemTitle={setNewCatalogItemTitle}
        newCatalogItemUrl={newCatalogItemUrl}
        setNewCatalogItemUrl={setNewCatalogItemUrl}
        newCatalogItemDesc={newCatalogItemDesc}
        setNewCatalogItemDesc={setNewCatalogItemDesc}
        addCatalogItem={addCatalogItem}
      />

      {/* 6. Day Schedule Slot */}
      <DayScheduleSlotEditor
        feature={formData.features.daySchedule}
        onToggle={() => toggleFeatureSlot('daySchedule')}
        setFormData={setFormData}
        errors={errors}
        days={days}
        selectedDayScheduleWeekday={selectedDayScheduleWeekday}
        handleSelectDayScheduleWeekday={handleSelectDayScheduleWeekday}
        handleChangeDayVariationType={handleChangeDayVariationType}
        handleUpdateDayVariationMeta={handleUpdateDayVariationMeta}
        handleUpdateDayScheduleExercise={handleUpdateDayScheduleExercise}
        handleToggleDayScheduleExerciseRequired={handleToggleDayScheduleExerciseRequired}
        handleRemoveDayScheduleExercise={handleRemoveDayScheduleExercise}
        handleMoveDayScheduleExercise={handleMoveDayScheduleExercise}
        handleLoad12WeekMovementDefaults={handleLoad12WeekMovementDefaults}
        newDayExerciseName={newDayExerciseName}
        setNewDayExerciseName={setNewDayExerciseName}
        newDayExerciseTarget={newDayExerciseTarget}
        setNewDayExerciseTarget={setNewDayExerciseTarget}
        newDayExerciseRequired={newDayExerciseRequired}
        setNewDayExerciseRequired={setNewDayExerciseRequired}
        handleAddDayScheduleExercise={handleAddDayScheduleExercise}
      />
    </div>
  );
}
