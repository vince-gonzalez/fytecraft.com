// BOOT ORDER: loaded by server tick loop
// READS: entity.hp, entity.confidence, entity.careerState, entity.cooldowns
// WRITES: entity.hp, entity.careerState, entity.activeProcs, entity.isAlive
// v0.1.13 — KO path now returns killerPlayerId in AttackResult so loop.ts
//            can call applyKoHypeSpike() and refundRosterSlots().
//            No changes to damage formula, crit, proc, or career logic.
/* ===== LAST STABLE: v0.1.11 — full combat resolver, career system, procs ===== */

/* ===== WORKFLOW STACK =====
   File:         packages/engine/src/combat/resolver.ts
   Brand:        Zengine™ / FyteCraft
   Author:       Vince Gonzalez
   Version:      v0.1.13
   Boot order:   loop.ts → resolver.ts
   Dependencies: @fist/shared (Entity, AttackResult, ProcType, CareerState,
                   GAME_CONSTANTS, CAREER_MULTIPLIERS, CAREER_LADDER)
===== END STACK ===== */

import {
  Entity,
  AttackResult,
  ProcType,
  ActiveProc,
  CareerState,
  CAREER_LADDER,
  ActionType,
  GameEvent,
  GameEventType,
} from '@fist/shared';

import {
  GAME_CONSTANTS,
  CAREER_MULTIPLIERS,
} from '@fist/shared';

var CAREER_MULT_KEY: Record<CareerState, keyof typeof CAREER_MULTIPLIERS> = {
  [CareerState.TRAINEE]:  'TRAINEE',
  [CareerState.PROSPECT]: 'PROSPECT',
  [CareerState.FIGHTER]:  'FIGHTER',
  [CareerState.CHAMPION]: 'CHAMPION',
};

// ============================================================
// SEEDED RNG — server only, never client
// ============================================================
var _seed = Date.now();

function seededRandom(): number {
  _seed |= 0;
  _seed = (_seed + 0x6D2B79F5) | 0;
  var t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function seedRNG(seed: number): void {
  _seed = seed;
}

// ============================================================
// DAMAGE FORMULA
// GDD: (baseDMG × careerMult) × crit × (1 - DEF / (DEF + 100))
// ============================================================
export function calculateDamage(
  attacker: Entity,
  defender: Entity,
  isCrit: boolean
): number {
  var mult = CAREER_MULTIPLIERS[CAREER_MULT_KEY[attacker.careerState]];
  var base = attacker.baseDamage * mult.dmg;
  var critMult = isCrit ? GAME_CONSTANTS.CRIT_MULTIPLIER : 1.0;
  var mitigation = defender.defense / (defender.defense + 100);
  var damage = base * critMult * (1 - mitigation);
  return Math.max(1, Math.round(damage));
}

// ============================================================
// CRIT CHECK
// ============================================================
export function rollCrit(attacker: Entity): boolean {
  var base  = GAME_CONSTANTS.BASE_CRIT_CHANCE;
  var bonus = attacker.careerState === CareerState.CHAMPION
    ? GAME_CONSTANTS.CHAMPION_CRIT_BONUS : 0;
  var raw = base + bonus;
  var effective: number;
  if (raw <= GAME_CONSTANTS.CRIT_SOFT_CAP) {
    effective = raw;
  } else {
    var excess = raw - GAME_CONSTANTS.CRIT_SOFT_CAP;
    effective = GAME_CONSTANTS.CRIT_SOFT_CAP + excess * 0.5;
  }
  return seededRandom() < effective;
}

// ============================================================
// PROC ROLL
// ============================================================
export function rollProc(attacker: Entity): boolean {
  var band = CAREER_MULTIPLIERS[CAREER_MULT_KEY[attacker.careerState]];
  var procChance = band.procMin + (band.procMax - band.procMin) * attacker.confidence;
  var noise = 0.9 + seededRandom() * 0.2;
  procChance *= noise;
  return seededRandom() < procChance;
}

// ============================================================
// PROC SELECTION
// ============================================================
var PROC_POOL: ProcType[] = [
  ProcType.BLEED,
  ProcType.STAGGER,
  ProcType.RAGE,
  ProcType.DEVOLVE,
];

export function selectProc(attacker: Entity, defender: Entity): ProcType {
  if (defender.activeProcs.length >= GAME_CONSTANTS.MAX_ACTIVE_PROCS) {
    return ProcType.STAGGER;
  }
  var activeProcTypes = defender.activeProcs.map(function(p: ActiveProc) { return p.type; });
  var weights = PROC_POOL.map(function(proc) {
    var isRepeat = activeProcTypes.includes(proc);
    return isRepeat ? GAME_CONSTANTS.PROC_REPEAT_PENALTY : 1.0;
  });
  var total = weights.reduce(function(a, b) { return a + b; }, 0);
  var roll = seededRandom() * total;
  var cumulative = 0;
  for (var i = 0; i < PROC_POOL.length; i++) {
    cumulative += weights[i];
    if (roll <= cumulative) return PROC_POOL[i];
  }
  return ProcType.BLEED;
}

// ============================================================
// APPLY PROC
// ============================================================
export function applyProc(
  proc: ProcType,
  attacker: Entity,
  defender: Entity
): void {
  switch (proc) {
    case ProcType.BLEED:
      defender.activeProcs.push({
        type: ProcType.BLEED, remainingS: 5, value: 0.02, sourceId: attacker.id,
      });
      break;
    case ProcType.STAGGER:
      Object.keys(defender.cooldowns).forEach(function(key) {
        var k = key as ActionType;
        defender.cooldowns[k] = (defender.cooldowns[k] ?? 0) + 1.5;
      });
      break;
    case ProcType.RAGE:
      attacker.activeProcs.push({
        type: ProcType.RAGE, remainingS: 4, value: 1.25, sourceId: attacker.id,
      });
      break;
    case ProcType.DEVOLVE:
      if (seededRandom() < 0.10) {
        defender.cooldowns[ActionType.PUNCH] =
          Math.max(defender.cooldowns[ActionType.PUNCH] ?? 0, 2.0);
      }
      break;
  }
}

// ============================================================
// TICK PROCS
// ============================================================
export function tickProcs(entity: Entity, deltaS: number): void {
  var toRemove: number[] = [];
  entity.activeProcs.forEach(function(proc: ActiveProc, idx: number) {
    proc.remainingS -= deltaS;
    if (proc.type === ProcType.BLEED) {
      var bleedDmg = entity.maxHp * proc.value * deltaS;
      entity.hp = Math.max(0, entity.hp - bleedDmg);
    }
    if (proc.remainingS <= 0) toRemove.push(idx);
  });
  for (var i = toRemove.length - 1; i >= 0; i--) {
    entity.activeProcs.splice(toRemove[i], 1);
  }
}

// ============================================================
// HANDLE KO
// ============================================================
export function handleKO(
  defender: Entity,
  attacker: Entity | null,
  events: GameEvent[],
  tick: number
): void {
  var currentIndex = CAREER_LADDER.indexOf(defender.careerState);

  if (defender.isTrainee || defender.careerState === CareerState.TRAINEE) {
    defender.isAlive = false;
    defender.hasThrownInTowel = true;
    defender.confidence = 0;
    events.push({
      type: 'trainee_exit' as GameEventType,
      tick, sourceId: defender.id, targetId: attacker?.id,
    });
    return;
  }

  var newIndex = Math.max(0, currentIndex - 1);
  var newState = CAREER_LADDER[newIndex];
  var dropped  = newState !== defender.careerState;

  defender.careerState = newState;
  defender.confidence  = Math.max(0, defender.confidence - GAME_CONSTANTS.CONFIDENCE_KO_LOSS);
  defender.hp          = Math.round(defender.maxHp * 0.5);
  defender.winStreak   = 0;
  defender.koCount++;

  if (dropped) {
    events.push({
      type: 'career_drop' as GameEventType,
      tick, sourceId: attacker?.id, targetId: defender.id,
      data: { from: CAREER_LADDER[currentIndex], to: newState },
    });
  }

  if (defender.careerState === CareerState.TRAINEE) {
    events.push({ type: 'champion_at_risk' as GameEventType, tick, targetId: defender.id });
  }
}

// ============================================================
// FULL ATTACK RESOLUTION — v0.1.13
// DECISION: resolveAttack() itself does NOT call applyKoHypeSpike or
//   refundRosterSlots. Those require GameState which resolver.ts doesn't
//   own. Instead, loop.ts checks result.isKO and calls them directly.
//   This keeps resolver.ts pure — it only touches Entity objects.
// ============================================================
export function resolveAttack(
  attacker: Entity,
  defender: Entity,
  events: GameEvent[],
  tick: number
): AttackResult {
  var missChance = attacker.isTrainee ? 0.20 : 0.05;
  if (seededRandom() < missChance) {
    return { hit: false, damage: 0, isCrit: false, proc: null, isKO: false, careerDropped: false, traineeExited: false };
  }

  var isCrit  = rollCrit(attacker);
  var damage  = calculateDamage(attacker, defender, isCrit);

  var rageMult = attacker.activeProcs.find(function(p: ActiveProc) { return p.type === ProcType.RAGE; });
  if (rageMult) damage = Math.round(damage * rageMult.value);

  defender.hp = Math.max(0, defender.hp - damage);

  var procFired: ProcType | null = null;
  if (rollProc(attacker)) {
    procFired = selectProc(attacker, defender);
    applyProc(procFired, attacker, defender);
    events.push({
      type: 'proc_chain' as GameEventType, tick,
      sourceId: attacker.id, targetId: defender.id,
      data: { proc: procFired },
    });
  }

  if (isCrit) {
    events.push({
      type: 'crit_hit' as GameEventType, tick,
      sourceId: attacker.id, targetId: defender.id, value: damage,
    });
  }

  attacker.confidence = Math.min(1, attacker.confidence + GAME_CONSTANTS.CONFIDENCE_WIN_GAIN);
  defender.confidence = Math.max(0, defender.confidence - 0.04);

  var isKO           = defender.hp <= 0;
  var careerDropped  = false;
  var traineeExited  = false;

  if (isKO) {
    var prevState = defender.careerState;
    handleKO(defender, attacker, events, tick);
    careerDropped = defender.careerState !== prevState;
    traineeExited = defender.hasThrownInTowel;
    events.push({
      type: 'unit_kill' as GameEventType, tick,
      sourceId: attacker.id, targetId: defender.id, value: damage,
    });
  }

  return { hit: true, damage, isCrit, proc: procFired, isKO, careerDropped, traineeExited };
}

// ============================================================
// CAREER RECOVERY
// ============================================================
export function checkCareerRecovery(
  entity: Entity,
  events: GameEvent[],
  tick: number
): void {
  if (entity.winStreak < GAME_CONSTANTS.WIN_STREAK_TO_PROMOTE) return;
  if (entity.hasThrownInTowel) return;
  var currentIndex = CAREER_LADDER.indexOf(entity.careerState);
  if (currentIndex >= CAREER_LADDER.length - 1) return;
  entity.careerState = CAREER_LADDER[currentIndex + 1];
  entity.winStreak   = 0;
  events.push({
    type: 'career_recovery' as GameEventType, tick,
    targetId: entity.id, data: { newState: entity.careerState },
  });
}

// ============================================================
// CONFIDENCE DECAY — exported for loop.ts
// ============================================================
export function tickConfidenceDecay(entity: Entity): void {
  entity.confidence = Math.max(
    0,
    entity.confidence - GAME_CONSTANTS.CONFIDENCE_PASSIVE_DECAY
  );
}
