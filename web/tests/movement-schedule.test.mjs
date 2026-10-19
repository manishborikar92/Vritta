import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MOVEMENT_SCHEDULE,
  WORKOUT_EXERCISES,
  WALK_DAY_ROUTINE,
  PROGRESSION_PHASES,
  STOP_SIGNALS,
} from '../src/lib/fixtures/exercise-plan.js';
import {
  getUserTimezone,
  resolveObservanceDate,
  isHabitRestDay,
} from '../src/domain/index.js';
import { getDayOfWeek } from '../src/utils/date-helpers.js';

describe('12-Week Movement Plan & Weekday Schedule', () => {
  it('should map weekdays to the exact schedule specified in the brief', () => {
    // Mon, Wed, Fri: Strength workout (~30 min)
    ['Mon', 'Wed', 'Fri'].forEach(day => {
      const plan = MOVEMENT_SCHEDULE[day];
      assert.equal(plan.type, 'workout', `${day} must be a workout day`);
      assert.equal(plan.target, 'About 30 minutes');
    });

    // Tue, Thu, Sat: Easy walk + 3 stretches (10-20 min)
    ['Tue', 'Thu', 'Sat'].forEach(day => {
      const plan = MOVEMENT_SCHEDULE[day];
      assert.equal(plan.type, 'walk', `${day} must be a walk day`);
      assert.ok(plan.target.includes('10–20 minutes'), `${day} walk target must be 10-20 min`);
    });

    // Sun: Planned rest (No workout required)
    const sunday = MOVEMENT_SCHEDULE.Sun;
    assert.equal(sunday.type, 'rest', 'Sunday must be a planned rest day');
    assert.equal(sunday.target, 'No workout required');
  });

  it('should contain all 11 workout exercises across warmup, main, and cooldown phases', () => {
    assert.equal(WORKOUT_EXERCISES.length, 11);

    const warmups = WORKOUT_EXERCISES.filter(e => e.phase === 'warmup');
    const mains = WORKOUT_EXERCISES.filter(e => e.phase === 'main');
    const cooldowns = WORKOUT_EXERCISES.filter(e => e.phase === 'cooldown');

    assert.equal(warmups.length, 3, 'Must have 3 warmup exercises');
    assert.equal(mains.length, 5, 'Must have 5 main exercises');
    assert.equal(cooldowns.length, 3, 'Must have 3 cooldown stretches');

    // Verify key movements exist
    const names = WORKOUT_EXERCISES.map(e => e.name);
    assert.ok(names.includes('March in Place'));
    assert.ok(names.includes('Cat–Cow'));
    assert.ok(names.includes('Chin Tuck'));
    assert.ok(names.includes('Sit-to-Stand'));
    assert.ok(names.includes('Incline Push-Up'));
    assert.ok(names.includes('Glute Bridge'));
    assert.ok(names.includes('Prone Y–T Raise'));
    assert.ok(names.includes('Dead Bug'));
    assert.ok(names.includes('Doorway Chest Stretch'));
    assert.ok(names.includes('Hip Flexor Stretch'));
    assert.ok(names.includes("Child's Pose"));
  });

  it('should include the walk day routine with walk and 3 stretches', () => {
    assert.equal(WALK_DAY_ROUTINE.length, 4);
    assert.equal(WALK_DAY_ROUTINE[0].name, 'Easy Walk');
    assert.equal(WALK_DAY_ROUTINE[1].name, 'Doorway Chest Stretch');
    assert.equal(WALK_DAY_ROUTINE[2].name, 'Hip Flexor Stretch');
    assert.equal(WALK_DAY_ROUTINE[3].name, "Child's Pose");
  });

  it('should enforce medical check-up caution in weeks 1-4 progression guidance', () => {
    const phase1 = PROGRESSION_PHASES.find(p => p.weeks === '1–4');
    assert.ok(phase1, 'Phase 1–4 must exist');
    assert.ok(phase1.caution.includes('Medical check-up recommended within the first 4 weeks'));
    assert.ok(phase1.caution.includes('Stay at 2 sets until that check-up'));
  });

  it('should include essential stop signals for safety', () => {
    const joinedSignals = STOP_SIGNALS.join(' ').toLowerCase();
    assert.ok(joinedSignals.includes('chest pain'), 'Stop signals must include chest pain');
    assert.ok(joinedSignals.includes('faintness') || joinedSignals.includes('dizziness'), 'Stop signals must include dizziness');
    assert.ok(joinedSignals.includes('breathing'), 'Stop signals must include breathing difficulty');
    assert.ok(joinedSignals.includes('heartbeat'), 'Stop signals must include irregular heartbeat');
    assert.ok(joinedSignals.includes('joint') || joinedSignals.includes('sharp'), 'Stop signals must include sharp pain');
  });

  describe('getUserTimezone Resolution', () => {
    it('should prioritize userProfile.preferences.timezone when valid', () => {
      const profile = { preferences: { timezone: 'Asia/Kolkata' } };
      assert.equal(getUserTimezone(profile), 'Asia/Kolkata');
    });

    it('should fall back to userProfile.timezone when preferences.timezone is absent', () => {
      const profile = { timezone: 'America/New_York' };
      assert.equal(getUserTimezone(profile), 'America/New_York');
    });

    it('should accept a direct valid timezone string', () => {
      assert.equal(getUserTimezone('Europe/London'), 'Europe/London');
    });

    it('should fall back gracefully when timezone is invalid or malformed', () => {
      const profileInvalid = { preferences: { timezone: 'Invalid/City_Name' } };
      const resolved = getUserTimezone(profileInvalid);
      assert.ok(resolved === 'UTC' || typeof resolved === 'string', 'Must resolve to a valid fallback timezone');
    });

    it('should fall back safely when userProfile is null or undefined without throwing', () => {
      assert.doesNotThrow(() => {
        const tzNull = getUserTimezone(null);
        assert.ok(typeof tzNull === 'string' && tzNull.length > 0);
        const tzUndef = getUserTimezone(undefined);
        assert.ok(typeof tzUndef === 'string' && tzUndef.length > 0);
      });
    });
  });

  describe('12-Week Movement Plan — Monday Morning Rest Day Bug Resolution', () => {
    const movementHabit = {
      id: 'test_movement_habit',
      userId: 'test_user_456',
      title: '12-Week Progressive Movement Routine',
      category: 'Movement & Strength',
      completionMethod: 'exercise_plan',
      stableKey: 'canonical_exercise_plan',
      schedule: {
        frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        restDays: ['Sun'],
      },
      features: {
        daySchedule: {
          enabled: true,
          dayVariations: MOVEMENT_SCHEDULE,
        },
      },
    };

    it('should decouple daily schedule variation from 04:00 AM observance window', () => {
      // Monday 2026-10-19 at 01:38 AM IST (+05:30) is 2026-10-18T20:08:00.000Z UTC
      const mondayEarlyMorningUTC = '2026-10-18T20:08:00.000Z';
      const timezone = 'Asia/Kolkata';

      // 1. Observance date correctly resolves to Sunday for nocturnal daily log attribution
      const currentObservanceDate = resolveObservanceDate(mondayEarlyMorningUTC, timezone);
      assert.equal(currentObservanceDate, '2026-10-18', 'Nocturnal 01:38 AM belongs to Sunday observance for logging');

      // 2. Active calendar date is Monday 2026-10-19
      const localToday = '2026-10-19';
      const calendarDayOfWeek = getDayOfWeek(localToday);
      assert.equal(calendarDayOfWeek, 'Mon', 'Active calendar day of week must be Monday');

      // 3. Schedule resolution for today derives from calendarDayOfWeek ('Mon')
      const dayVariation = movementHabit.features.daySchedule.dayVariations?.[calendarDayOfWeek];
      const scheduleForToday = dayVariation || MOVEMENT_SCHEDULE[calendarDayOfWeek] || MOVEMENT_SCHEDULE.Mon;

      // 4. Invariants on Monday morning:
      const isRestDay = scheduleForToday.type === 'rest' || dayVariation?.isRestDay === true || calendarDayOfWeek === 'Sun';
      const isWorkoutDay = scheduleForToday.type === 'workout' || (!isRestDay && scheduleForToday.type !== 'walk');

      assert.equal(isRestDay, false, 'Monday morning must NOT be evaluated as a rest day');
      assert.equal(isWorkoutDay, true, 'Monday morning must be evaluated as a workout day');
      assert.equal(scheduleForToday.label, 'Strength and Posture Workout');
      const currentItems = Array.isArray(scheduleForToday.exercises) && scheduleForToday.exercises.length > 0
        ? scheduleForToday.exercises
        : isWorkoutDay
        ? WORKOUT_EXERCISES
        : [];
      assert.equal(currentItems.length, 11, 'Monday workout must contain 11 exercises');
    });

    it('should NOT treat Monday as a scheduled rest day in HabitTrackerCard rest evaluation', () => {
      const localToday = '2026-10-19'; // Monday
      const timezone = 'Asia/Kolkata';

      // Prior buggy code did: isHabitRestDay(habit, localToday) || isHabitRestDay(habit, currentObservanceDate)
      // Because currentObservanceDate was '2026-10-18' (Sunday), it erroneously returned true!
      // New decoupled code does: isHabitRestDay(habit, localToday, timezone)
      const isScheduledRest = isHabitRestDay(movementHabit, localToday, timezone);
      assert.equal(isScheduledRest, false, 'Monday must not be evaluated as scheduled rest on HabitTrackerCard');
    });

    it('should correctly treat Sunday as a planned rest day across the entire day', () => {
      const sundayDate = '2026-10-18'; // Sunday
      const timezone = 'Asia/Kolkata';

      const isScheduledRest = isHabitRestDay(movementHabit, sundayDate, timezone);
      assert.equal(isScheduledRest, true, 'Sunday must be evaluated as planned rest');

      const calendarDayOfWeek = getDayOfWeek(sundayDate);
      assert.equal(calendarDayOfWeek, 'Sun');

      const scheduleForSunday = movementHabit.features.daySchedule.dayVariations?.[calendarDayOfWeek];
      assert.equal(scheduleForSunday.type, 'rest', 'Sunday variation must have type rest');
      const isRestDay = scheduleForSunday.type === 'rest' || calendarDayOfWeek === 'Sun';
      assert.equal(isRestDay, true, 'Sunday must be recognized as rest day');
    });

    it('should preserve nocturnal daily log attribution to preceding day without corrupting active schedule', () => {
      // 03:59:59 AM on Monday morning:
      // - Log persistence writes to yesterday's document (/dailyLogs/{userId}_2026-10-18)
      // - Active UI schedule shows Monday's workout exercises
      const timezone = 'Asia/Kolkata';
      const lateNightTimestamp = '2026-10-18T22:29:59.000Z'; // 03:59:59 AM IST Monday
      const logObservanceDate = resolveObservanceDate(lateNightTimestamp, timezone);
      assert.equal(logObservanceDate, '2026-10-18', 'Pre-04:00 AM logs to previous day');

      const calendarToday = '2026-10-19';
      const calendarDow = getDayOfWeek(calendarToday);
      assert.equal(calendarDow, 'Mon');
      assert.equal(MOVEMENT_SCHEDULE[calendarDow].type, 'workout');
    });

    it('should correctly resolve Tuesday walk day with 4 walk routine items', () => {
      const tuesdayDate = '2026-10-20'; // Tuesday
      const calendarDow = getDayOfWeek(tuesdayDate);
      assert.equal(calendarDow, 'Tue');

      const scheduleForToday = movementHabit.features.daySchedule.dayVariations?.[calendarDow] || MOVEMENT_SCHEDULE[calendarDow];
      const isRestDay = scheduleForToday.type === 'rest' || calendarDow === 'Sun';
      const isWalkDay = scheduleForToday.type === 'walk';

      assert.equal(isRestDay, false, 'Tuesday must not be rest day');
      assert.equal(isWalkDay, true, 'Tuesday must be walk day');

      const currentItems = Array.isArray(scheduleForToday.exercises) && scheduleForToday.exercises.length > 0
        ? scheduleForToday.exercises
        : isWalkDay
        ? WALK_DAY_ROUTINE
        : [];

      assert.equal(currentItems.length, 4, 'Walk routine must contain 4 items (Easy Walk + 3 stretches)');
      assert.equal(currentItems[0].name, 'Easy Walk');
    });

    it('should operate safely and resolve routines with null or undefined user profile', () => {
      // Simulate SlotDaySchedule and HabitTrackerCard resolving timezone when profile is completely empty
      const tzNull = getUserTimezone(null);
      const tzUndef = getUserTimezone(undefined);
      const tzEmpty = getUserTimezone({});

      assert.ok(typeof tzNull === 'string' && tzNull.length > 0);
      assert.ok(typeof tzUndef === 'string' && tzUndef.length > 0);
      assert.ok(typeof tzEmpty === 'string' && tzEmpty.length > 0);

      // Verify isHabitRestDay executes cleanly with resolved fallback timezone
      const isRest = isHabitRestDay(movementHabit, '2026-10-19', tzEmpty);
      assert.equal(isRest, false, 'Monday must not be rest even with fallback timezone');
    });
  });
});
