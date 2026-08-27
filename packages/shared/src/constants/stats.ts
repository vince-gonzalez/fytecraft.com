// READS: nothing
// WRITES: nothing — pure data
// Post-balance pass: HP x1.1, DMG x0.9 applied
// v0.1.10 — TIER_STATS moved to game.ts to consolidate all GDD numbers.
//            CAREER_MULTIPLIERS and TTK_TARGETS remain here.

export var CAREER_MULTIPLIERS = {
  TRAINEE:  { dmg: 0.6, speed: 0.70, procMin: 0.02, procMax: 0.04 },
  PROSPECT: { dmg: 0.8, speed: 0.85, procMin: 0.05, procMax: 0.07 },
  FIGHTER:  { dmg: 1.0, speed: 1.00, procMin: 0.08, procMax: 0.10 },
  CHAMPION: { dmg: 1.4, speed: 1.20, procMin: 0.10, procMax: 0.15 },
} as const;

// TTK targets (seconds) — used for balance validation in test scenarios
export var TTK_TARGETS = {
  T1_VS_T1: { min: 10, max: 14 },
  T3_VS_T3: { min: 8,  max: 12 },
  T5_VS_T5: { min: 6,  max: 9  },
} as const;
