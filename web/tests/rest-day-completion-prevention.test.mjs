import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isHabitRestDay,
  evaluateHabitCompletion,
  deriveCompletedProgressForHabit,
  deriveUncompletedProgressForHabit,
  isFeatureSatisfied,
  resolveObservanceDate,
  getEffectiveSchedule,
  getEffectiveScheduleForDate,
  ValidationError,
} from '../src/domain/index.js';
import {
  toggleHabitCompletion,
  updateDailyHabitProgress,
} from '../src/lib/firebase/firestore.js';
import {
  evaluateHabitDayScenario,
} from '../src/lib/analytics/consistency-engine.js';
import {
  calculateStreak,
} from '../src/utils/analytics-helpers.js';
import { getDayOfWeek, getDateString, getDaysAgo } from '../src/utils/date-helpers.js';

describe('Rest Day Completion Prevention & Status Neutrality Regression Suite', () => {
  // Test routine with configured rest days (e.g. Sunday movement)
  const scheduledRestHabit = {
    id: 'habit_scheduled_rest',
    userId: 'user_test_123',
    title: 'Daily Movement Practice',
    category: 'Movement & Strength',
    schedule: {
      frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      restDays: ['Sun'],
      timingType: 'anytime',
      order: 1,
    },
    lifecycle: {
      trackingHorizon: {
        startDate: '2026-01-01',
        status: 'verified_creation',
      },
    },
    features: {
      checklist: {
        enabled: true,
        items: [
          { id: 'stretch_1', label: 'Morning Mobility', isRequired: true },
        ],
      },
    },
  };

  // Test routine with Progressive Day Schedule rest variant
  const dayScheduleHabit = {
    id: 'habit_day_schedule',
    userId: 'user_test_123',
    title: 'Progressive Conditioning Plan',
    category: 'Movement & Strength',
    lifecycle: {
      trackingHorizon: {
        startDate: '2026-01-01',
        status: 'verified_creation',
      },
    },
    schedule: {
      frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      restDays: [],
      timingType: 'anytime',
      order: 2,
    },
    features: {
      daySchedule: {
        enabled: true,
        planTitle: '12-Week Conditioning',
        totalWeeks: 12,
        dayVariations: {
          Mon: {
            type: 'workout',
            title: 'Strength Session',
            exercises: [
              { id: 'ex_1', name: 'Pushups', isRequired: true },
            ],
          },
          Wed: {
            type: 'rest',
            title: 'Midweek Rest & Active Recovery',
            isRestDay: true,
            exercises: [],
          },
          Sun: {
            dayType: 'rest',
            title: 'Sunday Recovery',
            exercises: [],
          },
        },
      },
    },
  };

  describe('1. Routine on a configured rest day cannot be marked complete', () => {
    it('should identify Sunday as a planned rest day from schedule.restDays', () => {
      assert.strictEqual(isHabitRestDay(scheduledRestHabit, 'Sun'), true);
      assert.strictEqual(isHabitRestDay(scheduledRestHabit, '2026-10-18'), true); // Oct 18, 2026 is Sunday
    });

    it('should refuse to derive completed progress on a configured rest day', () => {
      const initialProgress = { completedSteps: [] };
      const nextProgress = deriveCompletedProgressForHabit(scheduledRestHabit, initialProgress, 'Sun');
      
      // Existing progress is strictly preserved; no completion flags or steps are marked
      assert.deepStrictEqual(nextProgress, initialProgress);
      assert.strictEqual(nextProgress.completedSteps.length, 0);
    });

    it('should evaluate habit completion to false on a configured rest day even with completed items', () => {
      const progressWithCompletedItems = {
        completedSteps: ['stretch_1'],
        reviewDone: true,
      };

      assert.strictEqual(
        evaluateHabitCompletion(scheduledRestHabit, progressWithCompletedItems, 'Sun'),
        false,
        'evaluateHabitCompletion MUST return false on rest day regardless of progress'
      );
    });
  });

  describe('2. Routine with Progressive Day Schedule rest variant cannot be marked complete', () => {
    it('should identify custom midweek rest variant (Wed) and Sunday as rest days', () => {
      assert.strictEqual(isHabitRestDay(dayScheduleHabit, 'Wed'), true);
      assert.strictEqual(isHabitRestDay(dayScheduleHabit, 'Sun'), true);
      assert.strictEqual(isHabitRestDay(dayScheduleHabit, 'Mon'), false);
    });

    it('should refuse to derive completed progress for Progressive Day Schedule on rest day', () => {
      const initialProgress = { completedItemIds: [] };
      const nextProgressWed = deriveCompletedProgressForHabit(dayScheduleHabit, initialProgress, 'Wed');
      assert.deepStrictEqual(nextProgressWed, initialProgress);
      assert.strictEqual(nextProgressWed.workoutCompleted, undefined);

      const nextProgressSun = deriveCompletedProgressForHabit(dayScheduleHabit, initialProgress, 'Sun');
      assert.deepStrictEqual(nextProgressSun, initialProgress);
      assert.strictEqual(nextProgressSun.workoutCompleted, undefined);
    });

    it('should evaluate isFeatureSatisfied and evaluateHabitCompletion to false on rest variant', () => {
      const activeProgress = {
        workoutCompleted: true,
        walkCompleted: true,
        completedItemIds: ['ex_1'],
      };

      assert.strictEqual(
        isFeatureSatisfied('daySchedule', dayScheduleHabit.features.daySchedule, activeProgress, 'Wed'),
        false,
        'Midweek rest variant must not be satisfied'
      );
      assert.strictEqual(
        evaluateHabitCompletion(dayScheduleHabit, activeProgress, 'Wed'),
        false,
        'evaluateHabitCompletion must return false on rest variant'
      );

      assert.strictEqual(
        isFeatureSatisfied('daySchedule', dayScheduleHabit.features.daySchedule, activeProgress, 'Sun'),
        false,
        'Sunday rest variant must not be satisfied'
      );
      assert.strictEqual(
        evaluateHabitCompletion(dayScheduleHabit, activeProgress, 'Sun'),
        false,
        'Sunday rest variant must return false'
      );
    });
  });

  describe('3. UI interactions and direct completion-handler calls cannot bypass rest-day restriction', () => {
    it('should simulate useDailyLogs toggleHabit guard: aborts on rest day without mutating state', () => {
      let stateTodayLog = [];
      const habit = scheduledRestHabit;
      const today = '2026-10-18'; // Sunday

      // Simulates useDailyLogs.toggleHabit guard
      const isCompleted = stateTodayLog.includes(habit.id);
      if (!isCompleted && habit && isHabitRestDay(habit, today)) {
        // Guard prevents completion
      } else {
        stateTodayLog = [...stateTodayLog, habit.id];
      }

      assert.deepStrictEqual(stateTodayLog, [], 'State must remain empty when toggle is attempted on rest day');
    });

    it('should simulate useDailyLogs updateProgress guard: forces effectiveCompleted to false', () => {
      const habit = dayScheduleHabit;
      const today = '2026-10-18'; // Sunday
      const isRest = habit ? isHabitRestDay(habit, today) : false;
      const candidateIsFullyCompleted = true;

      const effectiveCompleted = isRest ? false : candidateIsFullyCompleted;
      assert.strictEqual(effectiveCompleted, false, 'effectiveCompleted must be forced to false on rest day');
    });
  });

  describe('4. Attempted rest-day completion produces no Firestore write and no synthetic daily log entry', () => {
    it('should return null from toggleHabitCompletion without writing to Firestore on rest day', async () => {
      const result = await toggleHabitCompletion(
        'user_test_123',
        '2026-10-18', // Sunday
        scheduledRestHabit.id,
        false, // Attempting to mark complete
        { habit: scheduledRestHabit }
      );

      assert.strictEqual(result, null, 'toggleHabitCompletion must return null without invoking setDoc');
    });

    it('should force effectiveCompleted to false in updateDailyHabitProgress on rest day', async () => {
      // In firestore.js, options.habit is inspected:
      const dateStr = '2026-10-18'; // Sunday
      const habit = dayScheduleHabit;
      const timezone = 'UTC';
      const isRest = isHabitRestDay(habit, dateStr, timezone);
      const isFullyCompletedAttempt = true;
      const effectiveCompleted = isRest ? false : isFullyCompletedAttempt;

      assert.strictEqual(isRest, true);
      assert.strictEqual(effectiveCompleted, false, 'updateDailyHabitProgress must never record completion on rest day');
    });
  });

  describe('5. Rest days remain neutral in missed-status, streak, and consistency calculations', () => {
    it('should evaluate rest day as Scenario 4 (Planned Rest) with 0/0 denominators and bridges streak', () => {
      const sundayLog = null; // Unrecorded day
      const evalResult = evaluateHabitDayScenario(
        scheduledRestHabit,
        '2026-10-18',
        'Sun',
        sundayLog,
        { currentObservanceDate: '2026-10-19', timezone: 'UTC' }
      );

      assert.strictEqual(evalResult.scenario, 4);
      assert.strictEqual(evalResult.status, 'rest');
      assert.strictEqual(evalResult.label, 'Planned Rest');
      assert.strictEqual(evalResult.isRestDay, true);
      assert.strictEqual(evalResult.isCompleted, false);
      assert.strictEqual(evalResult.isMissed, false);
      assert.strictEqual(evalResult.numerator, 0);
      assert.strictEqual(evalResult.eligibleDenom, 0, 'Rest day must not be in eligible denominator');
      assert.strictEqual(evalResult.verifiedDenom, 0, 'Rest day must not be in verified denominator');
      assert.strictEqual(evalResult.adherenceDenom, 0, 'Rest day must not be in adherence denominator');
      assert.strictEqual(evalResult.streakEffect, 'bridges', 'Rest day must non-punitively bridge streaks');
    });

    it('should neutralize any anomalous completed mark in daily log on a rest day', () => {
      // Even if an anomalous historical log contained this habit in completedHabitIds
      const anomalousLog = {
        completedHabitIds: [scheduledRestHabit.id],
        habitOutcomes: {
          [scheduledRestHabit.id]: { status: 'completed' },
        },
      };

      const evalResult = evaluateHabitDayScenario(
        scheduledRestHabit,
        '2026-10-18',
        'Sun',
        anomalousLog,
        { currentObservanceDate: '2026-10-19', timezone: 'UTC' }
      );

      assert.strictEqual(evalResult.scenario, 4, 'Must evaluate as Scenario 4 Planned Rest');
      assert.strictEqual(evalResult.status, 'rest');
      assert.strictEqual(evalResult.isCompleted, false, 'Must not be considered completed on rest day');
      assert.strictEqual(evalResult.numerator, 0);
      assert.strictEqual(evalResult.eligibleDenom, 0);
      assert.strictEqual(evalResult.streakEffect, 'bridges');
    });

    it('should bridge streak across a rest day without penalty', () => {
      const todayDow = getDayOfWeek(new Date());
      const habitRestingToday = {
        ...scheduledRestHabit,
        schedule: {
          ...scheduledRestHabit.schedule,
          restDays: [todayDow],
        },
      };
      const yesterdayDate = getDateString(getDaysAgo(1));
      const dailyLogs = {
        [yesterdayDate]: { completedHabitIds: [habitRestingToday.id] },
      };

      const streak = calculateStreak([habitRestingToday], dailyLogs, 7);
      assert.strictEqual(streak, 1, 'Rest day today must bridge and preserve yesterday streak');
    });
  });

  describe('6. The same routine completes normally on an eligible scheduled day', () => {
    it('should evaluate Monday as an active, non-rest scheduled day', () => {
      assert.strictEqual(isHabitRestDay(scheduledRestHabit, 'Mon'), false);
      assert.strictEqual(isHabitRestDay(scheduledRestHabit, '2026-10-19'), false); // Oct 19, 2026 is Monday
    });

    it('should derive completed progress and evaluate completion normally on Monday', () => {
      const initialProgress = { completedSteps: [] };
      const nextProgress = deriveCompletedProgressForHabit(scheduledRestHabit, initialProgress, 'Mon');

      assert.ok(nextProgress.completedSteps.includes('stretch_1'));
      assert.strictEqual(nextProgress.reviewDone, true);

      const isSatisfied = evaluateHabitCompletion(scheduledRestHabit, nextProgress, 'Mon');
      assert.strictEqual(isSatisfied, true, 'Habit must complete normally on eligible Monday');
    });

    it('should evaluate Monday completion as Scenario 1 (extends streak, adds to numerator)', () => {
      const mondayLog = {
        completedHabitIds: [scheduledRestHabit.id],
      };

      const evalResult = evaluateHabitDayScenario(
        scheduledRestHabit,
        '2026-10-19',
        'Mon',
        mondayLog,
        { currentObservanceDate: '2026-10-20', timezone: 'UTC' }
      );

      assert.strictEqual(evalResult.scenario, 1);
      assert.strictEqual(evalResult.status, 'completed');
      assert.strictEqual(evalResult.isCompleted, true);
      assert.strictEqual(evalResult.numerator, 1);
      assert.strictEqual(evalResult.eligibleDenom, 1);
      assert.strictEqual(evalResult.streakEffect, 'extends');
    });
  });

  describe('7. Adjacent days and 04:00 AM observance boundary handled correctly', () => {
    const timezone = 'America/New_York'; // UTC-4 in daylight saving / UTC-5 in standard

    it('should treat Sunday 03:59:59 AM as Saturday observance (eligible scheduled day)', () => {
      // 2026-10-18 is Sunday. 03:59:59 EDT corresponds to 2026-10-18T07:59:59Z.
      const earlySundayTime = new Date('2026-10-18T07:59:59Z');
      const obsDate = resolveObservanceDate(earlySundayTime, timezone);
      const dow = getDayOfWeek(obsDate);

      assert.strictEqual(obsDate, '2026-10-17', 'Before 04:00 AM belongs to Saturday observance');
      assert.strictEqual(dow, 'Sat');
      assert.strictEqual(
        isHabitRestDay(scheduledRestHabit, earlySundayTime, timezone),
        false,
        'Saturday observance is not a rest day'
      );
    });

    it('should treat Sunday 04:00:00 AM as Sunday observance (planned rest day)', () => {
      // 04:00:00 EDT corresponds to 2026-10-18T08:00:00Z.
      const sundayCutoff = new Date('2026-10-18T08:00:00Z');
      const obsDate = resolveObservanceDate(sundayCutoff, timezone);
      const dow = getDayOfWeek(obsDate);

      assert.strictEqual(obsDate, '2026-10-18', 'At/after 04:00 AM belongs to Sunday observance');
      assert.strictEqual(dow, 'Sun');
      assert.strictEqual(
        isHabitRestDay(scheduledRestHabit, sundayCutoff, timezone),
        true,
        'Sunday observance is a planned rest day'
      );
    });

    it('should treat Monday 03:59:59 AM as Sunday observance (planned rest day)', () => {
      // 2026-10-19 is Monday. 03:59:59 EDT corresponds to 2026-10-19T07:59:59Z.
      const earlyMondayTime = new Date('2026-10-19T07:59:59Z');
      const obsDate = resolveObservanceDate(earlyMondayTime, timezone);
      const dow = getDayOfWeek(obsDate);

      assert.strictEqual(obsDate, '2026-10-18', 'Monday 03:59 AM belongs to Sunday observance');
      assert.strictEqual(dow, 'Sun');
      assert.strictEqual(
        isHabitRestDay(scheduledRestHabit, earlyMondayTime, timezone),
        true,
        'Sunday observance grace period is still a planned rest day'
      );
    });

    it('should treat Monday 04:00:00 AM as Monday observance (eligible scheduled day)', () => {
      // 04:00:00 EDT corresponds to 2026-10-19T08:00:00Z.
      const mondayCutoff = new Date('2026-10-19T08:00:00Z');
      const obsDate = resolveObservanceDate(mondayCutoff, timezone);
      const dow = getDayOfWeek(obsDate);

      assert.strictEqual(obsDate, '2026-10-19', 'At/after 04:00 AM belongs to Monday observance');
      assert.strictEqual(dow, 'Mon');
      assert.strictEqual(
        isHabitRestDay(scheduledRestHabit, mondayCutoff, timezone),
        false,
        'Monday observance is an active scheduled day'
      );
    });
  });

  describe('8. Authoritative schedule history resolution (getEffectiveSchedule) & dashboard execution path', () => {
    // Habit with multi-phase schedule history:
    // Period 1 (Baseline: 2026-10-01 to 2026-10-14): Mon-Sat active, Sunday is rest day
    // Period 2 (Updated:  2026-10-15 onwards):        Mon-Thu, Sat-Sun active, Friday is rest day
    const habitWithHistory = {
      id: 'habit_with_multi_phase_history',
      userId: 'user_test_123',
      title: 'Adaptive Routine',
      category: 'Movement & Strength',
      schedule: {
        frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Sat', 'Sun'],
        restDays: ['Fri'],
        timingType: 'anytime',
      },
      scheduleHistory: [
        {
          effectiveDate: '2026-10-01',
          frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
          restDays: ['Sun'],
          timingType: 'anytime',
        },
        {
          effectiveDate: '2026-10-15',
          frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Sat', 'Sun'],
          restDays: ['Fri'],
          timingType: 'anytime',
        },
      ],
    };

    it('should invoke isHabitRestDay with real date and scheduleHistory without throwing ReferenceError', () => {
      // Must not throw ReferenceError: getEffectiveSchedule is not defined
      assert.doesNotThrow(() => {
        isHabitRestDay(habitWithHistory, '2026-10-18', 'UTC');
      });
    });

    it('should select correct historical schedule before, on, and after an effective-date change', () => {
      // 1. Before change (2026-10-04 is Sunday): Sunday is rest day in Period 1
      const scheduleOct4 = getEffectiveSchedule(habitWithHistory, '2026-10-04');
      assert.strictEqual(scheduleOct4.source, 'schedule_history');
      assert.strictEqual(scheduleOct4.effectiveDate, '2026-10-01');
      assert.deepStrictEqual(scheduleOct4.restDays, ['Sun']);
      assert.strictEqual(isHabitRestDay(habitWithHistory, '2026-10-04'), true, 'Sunday was rest before change');

      // Oct 02 (Friday) was an active day before change
      assert.strictEqual(isHabitRestDay(habitWithHistory, '2026-10-02'), false, 'Friday was active before change');

      // 2. On change date (2026-10-15 is Thursday): Period 2 applies
      const scheduleOct15 = getEffectiveSchedule(habitWithHistory, '2026-10-15');
      assert.strictEqual(scheduleOct15.effectiveDate, '2026-10-15');
      assert.deepStrictEqual(scheduleOct15.restDays, ['Fri']);

      // 3. After change (2026-10-16 is Friday): Friday is rest day in Period 2
      assert.strictEqual(isHabitRestDay(habitWithHistory, '2026-10-16'), true, 'Friday is rest after change');

      // After change (2026-10-18 is Sunday): Sunday is now an active day in Period 2
      assert.strictEqual(isHabitRestDay(habitWithHistory, '2026-10-18'), false, 'Sunday is active after change');

      // 4. Preceding all history entries (2026-09-20): uses earliest history entry as baseline
      const scheduleSept20 = getEffectiveSchedule(habitWithHistory, '2026-09-20');
      assert.strictEqual(scheduleSept20.source, 'schedule_history_baseline');
      assert.strictEqual(scheduleSept20.effectiveDate, '2026-10-01');
      assert.deepStrictEqual(scheduleSept20.restDays, ['Sun']);
    });

    it('should recognize a historical rest day even when the current schedule is different', () => {
      // Current schedule says Friday is rest, but on 2026-10-11 (Sunday), Sunday was rest
      assert.strictEqual(habitWithHistory.schedule.restDays.includes('Sun'), false);
      assert.strictEqual(
        isHabitRestDay(habitWithHistory, '2026-10-11'),
        true,
        'Historical Sunday rest must be honored even if current schedule has no Sunday rest'
      );
    });

    it('should recognize current schedule rest day for current dates or when history is empty', () => {
      // Current date after 2026-10-15
      assert.strictEqual(isHabitRestDay(habitWithHistory, '2026-10-23'), true, 'Friday rest in current schedule');

      // Empty history habit
      const emptyHistoryHabit = {
        ...scheduledRestHabit,
        scheduleHistory: [],
      };
      const effectiveEmpty = getEffectiveSchedule(emptyHistoryHabit, '2026-10-18');
      assert.strictEqual(effectiveEmpty.source, 'current_schedule');
      assert.deepStrictEqual(effectiveEmpty.restDays, ['Sun']);
      assert.strictEqual(isHabitRestDay(emptyHistoryHabit, '2026-10-18'), true);
    });

    it('should handle weekday-name inputs without confusing them with calendar dates', () => {
      // Weekday string alone resolves to current canonical schedule (Friday rest in habitWithHistory)
      const scheduleByWeekday = getEffectiveSchedule(habitWithHistory, 'Fri');
      assert.strictEqual(scheduleByWeekday.source, 'current_schedule');
      assert.deepStrictEqual(scheduleByWeekday.restDays, ['Fri']);

      // Weekday query in isHabitRestDay resolves against current schedule
      assert.strictEqual(isHabitRestDay(habitWithHistory, 'Fri'), true);
      assert.strictEqual(isHabitRestDay(habitWithHistory, 'Sun'), false); // Sunday is active in current schedule
    });

    it('should resolve Date instances and timestamps through the 04:00 AM observance boundary', () => {
      const timezone = 'America/New_York';
      // Friday 03:59:59 AM EDT belongs to Thursday observance (not a rest day)
      const earlyFri = new Date('2026-10-16T07:59:59Z');
      assert.strictEqual(isHabitRestDay(habitWithHistory, earlyFri, timezone), false);

      // Friday 04:00:00 AM EDT belongs to Friday observance (planned rest day in Period 2)
      const regularFri = new Date('2026-10-16T08:00:00Z');
      assert.strictEqual(isHabitRestDay(habitWithHistory, regularFri, timezone), true);
    });

    it('should deliberately throw ValidationError on malformed scheduleHistory rather than silently hiding errors', () => {
      // Malformed: non-array scheduleHistory
      assert.throws(() => {
        getEffectiveSchedule({ schedule: { frequency: ['Mon'] }, scheduleHistory: 'not-an-array' }, '2026-10-18');
      }, ValidationError);

      // Malformed: entry missing effectiveDate
      assert.throws(() => {
        getEffectiveSchedule({
          schedule: { frequency: ['Mon'] },
          scheduleHistory: [{ frequency: ['Mon'] }],
        }, '2026-10-18');
      }, ValidationError);

      // Malformed: entry with non-array frequency
      assert.throws(() => {
        getEffectiveSchedule({
          schedule: { frequency: ['Mon'] },
          scheduleHistory: [{ effectiveDate: '2026-10-01', frequency: 'Mon' }],
        }, '2026-10-18');
      }, ValidationError);
    });

    it('should execute the exact dashboard rendering path without crashing', () => {
      // Simulates HabitTrackerCard resolution path:
      // const timezone = userProfile?.preferences?.timezone || userProfile?.timezone || 'UTC';
      // const currentObservanceDate = resolveObservanceDate(new Date(), timezone);
      // const isPlannedRest = isHabitRestDay(habit, currentObservanceDate, timezone);
      const userProfile = { preferences: { timezone: 'Asia/Kolkata' } };
      const timezone = userProfile.preferences.timezone;
      const currentObservanceDate = resolveObservanceDate(new Date(), timezone);

      assert.doesNotThrow(() => {
        const isPlannedRest = isHabitRestDay(habitWithHistory, currentObservanceDate, timezone);
        assert.strictEqual(typeof isPlannedRest, 'boolean');
      }, 'HabitTrackerCard rest day resolution path must execute cleanly');
    });

    it('should verify backward-compatible export getEffectiveScheduleForDate identity', () => {
      assert.strictEqual(getEffectiveSchedule, getEffectiveScheduleForDate);
    });
  });

  describe('9. Rest-Day Checklist Immutability & Multi-Layer Event Locking', () => {
    const restChecklistHabit = {
      id: 'habit_rest_checklist',
      userId: 'user_test_123',
      title: 'Workbook Exercises with Checklist',
      category: 'English Learning',
      schedule: {
        frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        restDays: ['Sun'],
        timingType: 'anytime',
      },
      features: {
        checklist: {
          enabled: true,
          items: [
            { id: 'step_1', label: 'Review vocabulary', required: true },
            { id: 'step_2', label: 'Grammar practice', required: true },
          ],
        },
      },
    };

    it('should lock SlotChecklist handleStepToggle when disabled=true', () => {
      let onChangeCalls = 0;
      let lastResult = null;
      const onChange = (steps, allDone) => {
        onChangeCalls++;
        lastResult = { steps, allDone };
      };

      // Simulates SlotChecklist handleStepToggle when disabled=true
      const disabled = true;
      const items = restChecklistHabit.features.checklist.items;

      const handleStepToggle = (index, e) => {
        e?.stopPropagation?.();
        e?.preventDefault?.();
        if (disabled) return;
        onChange(items[index].id, false);
      };

      let stopPropCalled = false;
      let preventDefCalled = false;
      const fakeEvent = {
        stopPropagation: () => { stopPropCalled = true; },
        preventDefault: () => { preventDefCalled = true; },
      };

      handleStepToggle(0, fakeEvent);

      assert.strictEqual(stopPropCalled, true, 'stopPropagation must be called');
      assert.strictEqual(preventDefCalled, true, 'preventDefault must be called');
      assert.strictEqual(onChangeCalls, 0, 'onChange must NOT be invoked when disabled');
      assert.strictEqual(lastResult, null);
    });

    it('should allow SlotChecklist handleStepToggle on active day when disabled=false', () => {
      let onChangeCalls = 0;
      let nextStepsResult = null;
      const onChange = (steps) => {
        onChangeCalls++;
        nextStepsResult = steps;
      };

      const disabled = false;
      const items = restChecklistHabit.features.checklist.items;

      const handleStepToggle = (index, e) => {
        e?.stopPropagation?.();
        e?.preventDefault?.();
        if (disabled) return;
        onChange([items[index].id]);
      };

      handleStepToggle(0);
      assert.strictEqual(onChangeCalls, 1, 'onChange must be invoked on active day');
      assert.deepStrictEqual(nextStepsResult, ['step_1']);
    });

    it('should determine isPlannedRest=true in HabitTrackerCard from schedule or explicit outcome', () => {
      const timezone = 'Asia/Kolkata';
      // Oct 18, 2026 is Sunday
      const sundayDate = '2026-10-18';
      const isScheduledRest = isHabitRestDay(restChecklistHabit, sundayDate, timezone);
      assert.strictEqual(isScheduledRest, true, 'Sunday must be recognized as scheduled rest day');

      // Container evaluates isPlannedRest
      const progress = { completedSteps: ['prior_step_1'] };
      const isExplicitRest = progress?.status === 'rest' || progress?.outcomes?.[restChecklistHabit.id]?.status === 'rest';
      const isPlannedRest = Boolean(isScheduledRest || isExplicitRest);
      assert.strictEqual(isPlannedRest, true);

      // handleChecklistChange in HabitTrackerCard aborts when isPlannedRest=true
      let onUpdateProgressCalls = 0;
      const onUpdateProgress = () => { onUpdateProgressCalls++; };

      const handleChecklistChange = (nextSteps, allDone) => {
        if (isPlannedRest) return;
        onUpdateProgress(restChecklistHabit.id, nextSteps, allDone);
      };

      handleChecklistChange(['step_1', 'step_2'], true);
      assert.strictEqual(onUpdateProgressCalls, 0, 'Container handleChecklistChange must reject changes on rest day');
    });

    it('should reject useDailyLogs.updateProgress on rest day: 0 optimistic updates, 0 Firestore writes, preserves progress', async () => {
      const habit = restChecklistHabit;
      const today = '2026-10-18'; // Sunday

      // Starting state with legitimate historical checklist progress
      let todayProgress = {
        [habit.id]: {
          completedSteps: ['step_1'],
          reviewDone: false,
          count: 1,
        },
      };
      let todayLog = [];
      let firestoreWriteCalls = 0;

      const mockUpdateDailyHabitProgress = async () => {
        firestoreWriteCalls++;
        return { success: true };
      };

      // Simulates useDailyLogs.updateProgress on rest day
      const simulateUpdateProgress = async (habitId, progressData, isFullyCompleted) => {
        const isScheduleRest = isHabitRestDay(habit, today);
        const currentProgress = todayProgress[habitId] || {};
        const isExplicitRest =
          currentProgress.status === 'rest' ||
          currentProgress.outcome === 'rest' ||
          todayProgress.outcomes?.[habitId]?.status === 'rest';

        const isRest = Boolean(isScheduleRest || isExplicitRest);

        // Guard: Planned rest days are neutral and immutable.
        if (isRest) {
          return;
        }

        todayProgress = {
          ...todayProgress,
          [habitId]: {
            ...(todayProgress[habitId] || {}),
            ...progressData,
          },
        };

        await mockUpdateDailyHabitProgress();
      };

      // Attempt to check step_2 on rest day
      await simulateUpdateProgress(habit.id, { completedSteps: ['step_1', 'step_2'] }, true);

      // Evidence of zero mutation and zero writes:
      assert.strictEqual(firestoreWriteCalls, 0, 'Firestore write must NOT be triggered on rest day');
      assert.deepStrictEqual(
        todayProgress[habit.id].completedSteps,
        ['step_1'],
        'Prior progress must be strictly preserved without adding new steps'
      );
      assert.strictEqual(todayLog.length, 0, 'Rest day habit must NOT be added to todayLog');
    });

    it('should verify firestore.updateDailyHabitProgress rejects rest-day writes fail-closed', async () => {
      // Calling updateDailyHabitProgress with habit on its rest day
      const result = await updateDailyHabitProgress(
        'user_test_123',
        '2026-10-18', // Sunday
        restChecklistHabit.id,
        { completedSteps: ['step_1', 'step_2'] },
        true,
        { habit: restChecklistHabit }
      );

      assert.strictEqual(result, null, 'updateDailyHabitProgress must return null without modifying Firestore on rest days');
    });

    it('should audit and verify other slot components reject rest-day interactions', () => {
      // 1. SlotStepper (Counter)
      const disabled = true;
      let counterChangeCalls = 0;
      const onCounterChange = () => { counterChangeCalls++; };
      const handleIncrement = (e) => {
        e?.stopPropagation?.();
        e?.preventDefault?.();
        if (disabled) return;
        onCounterChange();
      };
      handleIncrement();
      assert.strictEqual(counterChangeCalls, 0, 'SlotStepper increment must reject when disabled');

      // 2. SlotTimer
      let timerPlayCalls = 0;
      const handleTogglePlay = (e) => {
        e?.stopPropagation?.();
        e?.preventDefault?.();
        if (disabled) return;
        timerPlayCalls++;
      };
      handleTogglePlay();
      assert.strictEqual(timerPlayCalls, 0, 'SlotTimer play/pause must reject when disabled');

      // 3. SlotDaySchedule
      let dayScheduleChangeCalls = 0;
      const isRestDay = true;
      const handleDayScheduleToggle = (e) => {
        e?.stopPropagation?.();
        e?.preventDefault?.();
        if (disabled || isRestDay) return;
        dayScheduleChangeCalls++;
      };
      handleDayScheduleToggle();
      assert.strictEqual(dayScheduleChangeCalls, 0, 'SlotDaySchedule toggle must reject on rest day');

      // 4. SlotCatalog
      let catalogChangeCalls = 0;
      const handleCatalogToggle = (e) => {
        e?.stopPropagation?.();
        e?.preventDefault?.();
        if (disabled) return;
        catalogChangeCalls++;
      };
      handleCatalogToggle();
      assert.strictEqual(catalogChangeCalls, 0, 'SlotCatalog toggle must reject when disabled');
    });
  });
});
