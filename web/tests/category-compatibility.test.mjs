import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as categoriesModule from '../src/lib/constants/categories.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const firestoreRulesPath = path.join(__dirname, '..', 'firestore.rules');
const firestoreRulesContent = fs.readFileSync(firestoreRulesPath, 'utf8');

const {
  CATEGORIES,
  CANONICAL_CATEGORIES,
  CATEGORY_CONFIG,
  getCategoryConfig,
  isValidCategory,
} = categoriesModule;

describe('Authoritative Canonical Category Taxonomy & Rule Conformance', () => {
  it('should define exactly 9 canonical categories without duplicate or redundant entries', () => {
    assert.deepEqual(
      CATEGORIES,
      CANONICAL_CATEGORIES,
      'CATEGORIES must directly match CANONICAL_CATEGORIES'
    );
    assert.equal(CATEGORIES.length, 9, 'Must have exactly 9 canonical supported categories');
    
    const expected = [
      'Health & Fitness',
      'Learning & Growth',
      'Mindfulness & Spirit',
      'Reflection & Journaling',
      'Work & Career',
      'Creativity & Hobbies',
      'Relationships & Family',
      'Rest & Recovery',
      'Other',
    ];
    assert.deepEqual(CATEGORIES, expected);
  });

  it('should NOT export CATEGORY_ALIASES or normalizeCategory (strict canonical model, zero aliases)', () => {
    assert.equal(
      categoriesModule.CATEGORY_ALIASES,
      undefined,
      'CATEGORY_ALIASES must be completely removed from exports'
    );
    assert.equal(
      categoriesModule.normalizeCategory,
      undefined,
      'normalizeCategory must be completely removed from exports'
    );
  });

  it('should strictly validate canonical categories and reject non-canonical legacy values', () => {
    // All 9 canonical categories must return true
    for (const cat of CATEGORIES) {
      assert.equal(isValidCategory(cat), true, `isValidCategory must return true for ${cat}`);
    }

    // Legacy names and aliases must strictly return false
    const invalidCategories = [
      'Movement',
      'Fitness',
      'Health',
      'Wellness',
      'Mindfulness',
      'Random',
      '',
      null,
      undefined,
      123,
      {},
    ];

    for (const invalid of invalidCategories) {
      assert.equal(
        isValidCategory(invalid),
        false,
        `isValidCategory must reject non-canonical category: '${invalid}'`
      );
    }
  });

  it('should satisfy the Firestore rules whitelist in isValidCategory() with strictly 9 canonical categories', () => {
    // Every canonical category must be allowed in firestore.rules
    for (const cat of CANONICAL_CATEGORIES) {
      assert.ok(
        firestoreRulesContent.includes(`'${cat}'`),
        `firestore.rules must include canonical category '${cat}'`
      );
    }

    // Legacy 'Movement' duplicate must NOT be permitted in firestore.rules
    // We check for exact 'Movement' entry in array
    assert.ok(
      !firestoreRulesContent.includes("'Movement',"),
      "firestore.rules must NOT contain legacy standalone 'Movement'"
    );
  });

  it('should provide complete, valid styling tokens for every canonical category', () => {
    for (const cat of CATEGORIES) {
      const config = getCategoryConfig(cat);
      assert.ok(config, `Config for ${cat} must exist`);
      assert.ok(config.label, `Config for ${cat} must have a label`);
      assert.ok(!config.label.includes('(Legacy)'), `Label for ${cat} must not contain '(Legacy)'`);
      assert.ok(config.borderColor, `Config for ${cat} must have a borderColor`);
      assert.ok(config.bgColor, `Config for ${cat} must have a bgColor`);
      assert.ok(config.badgeClasses, `Config for ${cat} must have badgeClasses`);
      assert.ok(config.textColor, `Config for ${cat} must have a textColor`);
      assert.ok(config.dotColor, `Config for ${cat} must have a dotColor`);
      assert.ok(config.iconName, `Config for ${cat} must have an iconName`);
      assert.ok(config.description, `Config for ${cat} must have a description`);
    }
  });

  it('should fallback safely for unknown or empty categories without crashing', () => {
    const nullConfig = getCategoryConfig(null);
    assert.equal(nullConfig.label, 'General');

    const emptyConfig = getCategoryConfig('');
    assert.equal(emptyConfig.label, 'General');

    const customConfig = getCategoryConfig('Custom Habit');
    assert.equal(customConfig.label, 'Custom Habit');
    assert.equal(customConfig.iconName, 'CheckCircle2');
  });
});
