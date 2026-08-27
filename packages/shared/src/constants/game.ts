// BOOT ORDER: First file loaded. All other packages import from here.
// READS: Nothing — this IS the source of truth
// DO NOT change values here without a GDD version bump
// v0.1.10 — added build cost/time constants for new structures

// ============================================================
// GAME CONSTANTS — from GDD v2.0.0 / Brief v3.0
// ============================================================

export var GAME_CONSTANTS = {

  // Server
  TICK_RATE: 60,           // ticks per second
  TICK_MS: 1000 / 60,     // ~16.67ms per tick

  // Match
  MATCH_DURATION_S: 600,   // 10 minutes Phase 1 (King of the Hill)
  CAGE_CONTROL_RADIUS: 6,  // units — enemy within this radius interrupts hold
  CENTER_BONUS_PER_SEC: 2, // Bling/sec while holding center

  // Map
  SAFE_NODES: 4,
  CONTESTED_NODES: 3,
  TOTAL_NODES: 7,

  // Economy
  BASE_YIELD: 25,          // Bling per harvest trip
  HARVEST_TIME_S: 10.0,
  DROP_OFF_TIME_S: 2.0,
  ROUND_TRIP_S: 12.0,      // HARVEST_TIME_S + DROP_OFF_TIME_S

  TRAINEE_START: 3,
  TRAINEE_MAX: 10,
  TRAINEE_COST: 50,
  TRAINEE_TRAIN_TIME_S: 8,

  // Unit costs (Bling)
  COST_PROSPECT_TRAINING: 120,
  COST_T1_FIGHTER: 200,
  COST_T3_FIGHTER: 520,    // +70 from balance pass
  COST_T5_FIGHTER: 1050,   // +150 from balance pass

  // ── BUILDING COSTS (Bling) ── v0.1.10
  COST_RECRUIT_TRAINEE:   70,
  COST_UPGRADE_BASE_T2:   400,
  COST_COOKOUT:           200,
  COST_TECH_REFINERY:     450,
  COST_TRAINER:           0,   // trainee-built, no Bling cost beyond prereq
  COST_COACH:             0,   // upgrade from Trainer, no direct Bling cost
  COST_PHONE_BOOTH:       0,   // prereq-gated, no direct Bling cost

  // ── UPGRADE COSTS (Bling + Hype) ── v0.1.10
  COST_UPGRADE_ECONOMY_BLING: 200,
  COST_UPGRADE_ECONOMY_HYPE:  100,
  COST_UPGRADE_GEAR_BLING:    400,
  COST_UPGRADE_GEAR_HYPE:     100,
  COST_UPGRADE_EQUIP_BLING:   600,
  COST_UPGRADE_EQUIP_HYPE:    150,

  // ── BUILD TIMES (seconds) ── v0.1.10
  TIME_RECRUIT_TRAINEE_S:  8,
  TIME_UPGRADE_BASE_T2_S:  45,
  TIME_COOKOUT_S:          20,
  TIME_TECH_REFINERY_S:    30,
  TIME_TRAINER_S:          25,
  TIME_COACH_S:            40,
  TIME_PHONE_BOOTH_S:      60,
  TIME_T1_FIGHTER_S:       12,
  TIME_T2_FIGHTER_S:       20,
  TIME_T3_FIGHTER_S:       30,
  TIME_T4_FIGHTER_S:       45,
  TIME_T5_FIGHTER_S:       60,
  TIME_UPGRADE_S:          30,  // economy / gear / equipment upgrades

  // Combat
  BASE_CRIT_CHANCE: 0.05,
  CHAMPION_CRIT_BONUS: 0.03,
  CRIT_SOFT_CAP: 0.20,     // diminishing returns above this
  CRIT_MULTIPLIER: 1.75,
  PERFECT_COUNTER_CRIT_MULT: 1.25, // Striker T3 — NOT 1.75

  MAX_ACTIVE_PROCS: 2,
  PROC_REPEAT_PENALTY: 0.70, // same proc next application = 70% of normal chance

  // Cooldowns (seconds)
  CD_PUNCH: 0.9,
  CD_KICK: 2.2,
  CD_GRAPPLE: 5.0,
  CD_T1_ABILITY: 6,
  CD_T3_ABILITY: 12,
  CD_T5_ABILITY: 20,

  // Hitstop (seconds)
  HITSTOP_LIGHT: 0.03,
  HITSTOP_MEDIUM: 0.06,
  HITSTOP_HEAVY: 0.10,
  HITSTOP_KO: 0.20,

  // Camera shake intensity
  SHAKE_NORMAL: 0.2,
  SHAKE_HEAVY: 0.6,
  SHAKE_KO: 1.2,
  SLOW_MO_DURATION_S: 0.3,

  // Confidence
  CONFIDENCE_WIN_GAIN: 0.08,
  CONFIDENCE_KO_LOSS: 0.25,
  CONFIDENCE_PASSIVE_DECAY: 0.02, // subtracted per 10 seconds
  CONFIDENCE_DECAY_INTERVAL_S: 10,

  // Career
  WIN_STREAK_TO_PROMOTE: 2,   // consecutive wins needed to gain a tier
  KO_DROPS_PER_EVENT: 1,      // one KO = one tier drop, always

  // Grapple
  STRUGGLE_METER_MAX: 100,
  CHECKMATE_ESCAPE_REDUCTION: 0.60, // Checkmate Hold reduces escape by 60%, not 100%

  // Brawler chain cap (Infinite Chain upgrade)
  BRAWLER_CHAIN_MAX: 6,
  BRAWLER_CHAIN_DMG_PER_HIT: 0.05, // +5% per chain hit

  // Technician prediction window
  TECH_PREDICTION_INTERVAL_S: 10,
  TECH_PREDICTION_WINDOW_S: 1.2,

  // AI
  AI_MAX_QUEUE: 3,
  AI_QUEUE_DELAY_S: 0.1,
  AI_ALLY_KO_CONFIDENCE_HIT: 0.15,
  AI_REVENGE_PRIORITY_BOOST: 0.3,

  // Commentary
  COMMENTARY_COOLDOWNS_S: {
    T1: 2,
    T2: 4,
    T3: 6,
    T4: 10,
    T5: 15,
  },

  // Limb damage
  LIMB_BREAK_HP_PENALTY: 0.25, // flat 25% HP penalty — no animation complexity in v1

} as const;

// ============================================================
// TIER STATS — locked per GDD
// ============================================================

export var TIER_STATS = {
  T1: { hp: 88,  baseDamage: 9,    defense: 10 },
  T2: { hp: 121, baseDamage: 13.5, defense: 20 },
  T3: { hp: 154, baseDamage: 19.8, defense: 35 },
  T4: { hp: 198, baseDamage: 28.8, defense: 50 },
  T5: { hp: 264, baseDamage: 45,   defense: 70 },
} as const;

// ============================================================
// FYTECRAFT ROSTER — 25 fighters, 5 per discipline
// Discipline sprites: /assets/[discipline].png (lowercase)
// Tier sprites: /assets/[discipline][tier].png for tier >= 2
// ============================================================
export var FYTE_ROSTER: Record<string, string[]> = {
  Striker:    ['Jabriel Floatson', 'Lefty Lowkix', 'Sleeperman', 'Clinchni', 'Hook Rex'],
  Grappler:   ['Slambo', 'Kingpin', 'Mountfather', 'Chainstructor', 'Hodler'],
  Technician: ['Kickslip', 'Bombsniffer', 'Patches', 'Napdancer', 'Counterbrick'],
  Specialist: ['Sprawlton', 'Flipjitsu', 'Groundhammer', 'Sandstorm', 'Heartburn'],
  Brawler:    ['Taxman', 'Knoxwell', "L'Beau", 'Limbyoke', 'Headbutt'],
};

// Food joint name — locked
export var FOOD_JOINT_NAME = 'The Cookout';

// Economy resource keys
export var RESOURCE_KEYS = ['bling', 'hype', 'food'] as const;

// ============================================================
// BUILD PREREQ HELPER
// DECISION: Centralised here so server state.ts and client UI both
//   use the same prereq check without duplicating logic.
//   Returns null if buildable, or a string reason if blocked.
// ============================================================

export function getBuildBlockReason(
  buildingType: string,
  baseLevel: number,
  bling: number,
  hype: number,
  buildings: Array<{ type: string }>,
): string | null {
  var has = function(t: string) { return buildings.some(function(b) { return b.type === t; }); };

  switch (buildingType) {
    case 'cookout':
      if (baseLevel < 2)    return 'Requires T2 Base';
      if (bling < GAME_CONSTANTS.COST_COOKOUT) return 'Need ' + GAME_CONSTANTS.COST_COOKOUT + '¤';
      return null;

    case 'tech_refinery':
      if (baseLevel < 2)    return 'Requires T2 Base';
      if (bling < GAME_CONSTANTS.COST_TECH_REFINERY) return 'Need ' + GAME_CONSTANTS.COST_TECH_REFINERY + '¤';
      if (has('tech_refinery')) return 'Already built';
      return null;

    case 'trainer':
      if (bling < GAME_CONSTANTS.COST_TRAINER) return 'Need ' + GAME_CONSTANTS.COST_TRAINER + '¤';
      if (has('trainer')) return 'Already built';
      return null;

    case 'coach':
      if (baseLevel < 2)  return 'Requires T2 Base';
      if (!has('trainer')) return 'Requires Trainer';
      if (has('coach'))    return 'Already built';
      return null;

    case 'phone_booth':
      if (baseLevel < 3)       return 'Requires T3 Base';
      if (!has('trainer'))     return 'Requires Trainer';
      if (!has('coach'))       return 'Requires Coach';
      if (!has('tech_refinery')) return 'Requires Tech Refinery';
      if (has('phone_booth'))  return 'Already built';
      return null;

    default:
      return 'Unknown building';
  }
}
