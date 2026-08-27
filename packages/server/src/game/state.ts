// BOOT ORDER: loaded before tick loop
// READS: shared types, GAME_CONSTANTS, TIER_STATS
// WRITES: GameState — players, entities, nodes
// v0.1.13 — roster slots hard cap (50), per-tier slot costs, KO refund on death,
//            Coaching Institute + Icon/Monument training, KO hype spike (+15),
//            Media Studio (Bling→Hype toggle), Performance Lab +0.5 hype/tick,
//            T3 base upgrade (World Promo HQ 900B+300H, 45s),
//            Recovery Center + Championship Office framework (built, effects next pass),
//            upgradeBase() extended to handle T1→T2 and T2→T3
/* ===== LAST STABLE: v0.1.11 — two-player browser match, Bling economy, Trainer/T1/T2 training ===== */

/* ===== WORKFLOW STACK =====
   File:         packages/server/src/game/state.ts
   Brand:        Zengine™ / FyteCraft
   Author:       Vince Gonzalez
   Version:      v0.1.13
   Boot order:   loop.ts → state.ts
   Dependencies: @fist/shared (GameState, Entity, Player, MapNode, Vec2,
                   Discipline, CareerState, AIState, Building, BuildingType,
                   ConstructionJob, FighterTrainingJob, GAME_CONSTANTS,
                   TIER_STATS, getBuildBlockReason)
===== END STACK ===== */

/* ===== ASSET MANIFEST =====
   No assets — server only. See game.ts for client asset manifest.
===== END MANIFEST ===== */

import {
  GameState, Entity, Player, MapNode, Vec2, Discipline, CareerState, AIState,
  Building, BuildingType, ConstructionJob, FighterTrainingJob,
} from '@fist/shared';
import { GAME_CONSTANTS, TIER_STATS, getBuildBlockReason } from '@fist/shared';

// ── CONFIG BLOCK ──────────────────────────────────────────────
// DECISION: All economy numbers centralized here. If GDD changes, change here only.

// ROSTER SLOT COSTS — locked v5.0
// Scout=1, Hero=1, Legend=2, Icon=3, Monument=4, Paragon=5
var ROSTER_COST: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 };
var ROSTER_HARD_CAP = 50;

// BUILDING COSTS not yet in shared/game.ts — added here pending shared update
var COST_COACHING_INSTITUTE = 350;
var COST_MEDIA_STUDIO        = 300;
var COST_RECOVERY_CENTER     = 400;
var COST_RECOVERY_CENTER_HYPE = 100;
var COST_CHAMPIONSHIP_OFFICE  = 600;
var COST_CHAMPIONSHIP_OFFICE_HYPE = 250;
var COST_FIGHT_BOOKING_OFFICE = 800;
var COST_FIGHT_BOOKING_OFFICE_HYPE = 300;
var COST_UPGRADE_BASE_T3      = 900;
var COST_UPGRADE_BASE_T3_HYPE = 300;

// BUILD TIMES not yet in shared/game.ts
var TIME_COACHING_INSTITUTE_S   = 40;
var TIME_MEDIA_STUDIO_S         = 20;
var TIME_RECOVERY_CENTER_S      = 25;
var TIME_CHAMPIONSHIP_OFFICE_S  = 35;
var TIME_FIGHT_BOOKING_OFFICE_S = 60;
var TIME_UPGRADE_BASE_T3_S      = 45;

// HYPE PHYSICS — locked v5.0
// DECISION: These are additive per-tick bonuses applied in tickPassiveHype().
//   T2 base: +1/tick. T3 base: +3/tick. Performance Lab built: +0.5/tick.
//   Media Studio toggle: converts 10 Bling/tick → 3 Hype/tick (separate function).
//   KO spike: flat +15 to killing player (applied in KO handler in resolver — see DECISION below).
//   Center hold: existing Bling/sec + new +0.5 hype/sec (applied in loop.ts center tick).
var HYPE_PER_TICK_T2_BASE       = 1.0;
var HYPE_PER_TICK_T3_BASE       = 3.0;
var HYPE_PER_TICK_PERF_LAB      = 0.5;
var HYPE_KO_SPIKE               = 15;
var HYPE_CENTER_PER_SEC         = 0.5;
var MEDIA_STUDIO_BLING_COST_PER_TICK = 10;
var MEDIA_STUDIO_HYPE_PER_TICK  = 3;

// RECOVERY CENTER PROXIMITY — locked v5.0
// DECISION: Training time reduction checked at job creation — if RC is built
//   and base is within RECOVERY_RADIUS of the RC building position (fixed offset from base),
//   all training jobs started by that player get TIME_REDUCTION applied.
//   Unit cooldown reduction handled in resolver.ts (next pass once assets exist).
var RECOVERY_RADIUS             = 12; // world units
var RECOVERY_TIME_REDUCTION     = 0.80; // multiply training time by this (= -20%)

// CHAMPIONSHIP OFFICE — framework only, effects wired next pass
// When built: doubles HYPE_KO_SPIKE and HYPE_CENTER_PER_SEC for that player.
var CHAMP_OFFICE_KO_MULT        = 2.0;
var CHAMP_OFFICE_CENTER_MULT    = 2.0;
// ── END CONFIG ────────────────────────────────────────────────

var _idCounter = 0;
export function makeId(prefix: string): string {
  _idCounter++;
  return `${prefix}_${_idCounter}_${Date.now()}`;
}

export function createEntity(
  playerId: string, discipline: Discipline, tier: 1|2|3|4|5,
  position: Vec2, isTrainee: boolean = false
): Entity {
  var tierKey = `T${tier}` as keyof typeof TIER_STATS;
  var stats   = TIER_STATS[tierKey];
  return {
    id: makeId('ent'), playerId, discipline, tier,
    careerState:  isTrainee ? CareerState.TRAINEE : CareerState.FIGHTER,
    position:     { ...position },
    velocity:     { x: 0, y: 0 },
    confidence:   isTrainee ? 0.3 : 0.6,
    hp: stats.hp, maxHp: stats.hp,
    baseDamage:   stats.baseDamage,
    defense:      stats.defense,
    speed:        5.0,
    cooldowns:    {},
    activeProcs:  [],
    aiState:      AIState.AGGRESSIVE,
    memory:       { lastHitById: null, lastKOById: null, recentMoves: [], failedAbilities: [] },
    isTrainee,
    traineeRole:  isTrainee ? 'idle' : null,
    careerLadder: !isTrainee,
    isHarvesting: isTrainee,
    harvestTarget: null,
    winStreak: 0, koCount: 0, struggleMeter: 0, chainCount: 0,
    isAlive: true, hasThrownInTowel: false, hasPlayerCommand: false,
  };
}

// DISCIPLINE HOME NAMES — locked per GDD
// DECISION: These are asset sprite keys, not display names.
//   Display names (Fight Camp HQ etc.) live in UI only.
var DISCIPLINE_HOME: Record<string, string> = {
  Striker:    'localGym',
  Grappler:   'theMats',
  Brawler:    'biggerYard',
  Technician: 'theAcademy',
  Specialist: 'theLaboratory',
};

export function getBaseSpriteKey(discipline: string, level: number): string {
  if (level >= 2) return DISCIPLINE_HOME[discipline] ?? 'scrapYard';
  return 'scrapYard';
}

export function createPlayer(id: string, discipline: Discipline, basePosition: Vec2): Player {
  return {
    id, discipline,
    bling: 150, hype: 0,
    // DECISION: food field kept as-is for wire compatibility with client HUD.
    //   Semantically it is now "Roster Slots used". foodCap = Roster Slots available.
    food: 0, foodCap: 5,
    respect: 0, totalCenterTimeS: 0,
    entities: [], basePosition,
    baseTreasury: 150, baseHp: 500, baseMaxHp: 500,
    constructionQueue: [],
    trainingQueue: [],
    isConnected: true,
    baseLevel: 1,
    buildings: [],
    // DECISION: mediaStudioActive tracks whether player has toggled Media Studio on.
    //   Stored on player object so it survives snapshots and can be toggled mid-game.
    //   Defaults false — player must opt in.
    mediaStudioActive: false,
  } as any; // mediaStudioActive is an extension — cast until shared types updated
}

// ============================================================
// CREATE NODE
// ============================================================
export function createNode(
  id: string, position: Vec2, isContested: boolean, isCenter: boolean,
  blingYield: number = 25, nodeOwner: string | null = null
): MapNode {
  return {
    id, position, isContested, isCenter, blingYield,
    currentHolderId: null, accumulatedHoldTime: {},
    nodeOwner,
  };
}

// ============================================================
// CREATE GAME STATE
// SPAWN LAYOUT — locked
// P1: {12,12} → node_s1   P2: {88,88} → node_s3
// P3: {88,12} → node_s2   P4: {12,88} → node_s4
// Each team spawns with: 3 Scouts + 1 Hero
// Starting Bling: 150
// ============================================================
export function createGameState(playerDisciplines: Record<string, Discipline>): GameState {
  var players:  Record<string, Player> = {};
  var entities: Record<string, Entity> = {};

  var basePositions: Vec2[] = [
    { x: 12, y: 12 },
    { x: 88, y: 88 },
    { x: 88, y: 12 },
    { x: 12, y: 88 },
    { x: 50, y: 50 },
  ];

  var cornerNodeIds = ['node_s1', 'node_s3', 'node_s2', 'node_s4', 'node_c1'];
  var playerIds = Object.keys(playerDisciplines);

  playerIds.forEach(function(pid, idx) {
    var basePos = basePositions[idx] ?? { x: 50, y: 50 };
    players[pid] = createPlayer(pid, playerDisciplines[pid], basePos);
  });

  playerIds.forEach(function(pid, idx) {
    var basePos = basePositions[idx] ?? { x: 50, y: 50 };
    var nodeId  = cornerNodeIds[idx] ?? 'node_s1';
    var player  = players[pid];

    // Spawn 3 Scouts
    for (var t = 0; t < GAME_CONSTANTS.TRAINEE_START; t++) {
      var offset  = t - Math.floor(GAME_CONSTANTS.TRAINEE_START / 2);
      var scout   = createEntity(pid, playerDisciplines[pid], 1,
        { x: basePos.x + offset * 3, y: basePos.y + 2 }, true);
      scout.harvestTarget        = nodeId;
      entities[scout.id]         = scout;
      player.entities.push(scout.id);
      // DECISION: Starting Scouts count against roster slots.
      player.food += ROSTER_COST[1];
    }

    // Spawn 1 Hero (T1 fighter)
    var hero = createEntity(pid, playerDisciplines[pid], 1,
      { x: basePos.x, y: basePos.y - 4 }, false);
    entities[hero.id] = hero;
    player.entities.push(hero.id);
    player.food += ROSTER_COST[1];
  });

  // Build node map
  var nodes: Record<string, MapNode> = {};
  var nodeConfigs = [
    { id: 'node_center', pos: { x: 50, y: 50 }, contested: true,  center: true,  yield: 45, ownerIdx: -1 },
    { id: 'node_c1',     pos: { x: 40, y: 42 }, contested: true,  center: false, yield: 45, ownerIdx: -1 },
    { id: 'node_c2',     pos: { x: 60, y: 42 }, contested: true,  center: false, yield: 45, ownerIdx: -1 },
    { id: 'node_s1',     pos: { x: 20, y: 20 }, contested: false, center: false, yield: 25, ownerIdx: 0 },
    { id: 'node_s2',     pos: { x: 80, y: 20 }, contested: false, center: false, yield: 25, ownerIdx: 2 },
    { id: 'node_s3',     pos: { x: 80, y: 80 }, contested: false, center: false, yield: 25, ownerIdx: 1 },
    { id: 'node_s4',     pos: { x: 20, y: 80 }, contested: false, center: false, yield: 25, ownerIdx: 3 },
  ];
  nodeConfigs.forEach(function(cfg) {
    var owner = cfg.ownerIdx >= 0 ? (playerIds[cfg.ownerIdx] ?? null) : null;
    nodes[cfg.id] = createNode(cfg.id, cfg.pos, cfg.contested, cfg.center, cfg.yield, owner);
  });

  return {
    tick: 0, matchElapsedS: 0, matchDurationS: GAME_CONSTANTS.MATCH_DURATION_S,
    players, entities, nodes, events: [], phase: 'WAR', winnerId: null,
  };
}

export function checkMatchEnd(state: GameState): void {
  if (state.matchElapsedS < state.matchDurationS) return;
  if (state.phase === 'ENDED') return;
  state.phase = 'ENDED';
  var winner = Object.values(state.players).reduce(function(best, player) {
    return player.totalCenterTimeS > best.totalCenterTimeS ? player : best;
  });
  state.winnerId = winner.id;
  state.events.push({ type: 'match_end', tick: state.tick, sourceId: winner.id, value: winner.totalCenterTimeS });
}

// ============================================================
// ROSTER SLOT HELPERS — v0.1.13
// READS: player.food (slots used), player.foodCap (slots available)
// WRITES: player.food
// DECISION: "food" field = roster slots used. "foodCap" = max roster slots.
//   Hard cap is ROSTER_HARD_CAP (50). foodCap can grow via Nutrition Center
//   but never exceeds ROSTER_HARD_CAP. Both checks required on recruit/train.
// ============================================================
function getRosterSlotsUsed(player: Player, state: GameState): number {
  // Recount from live entities — avoids drift from dropped connections or edge cases
  return player.entities.reduce(function(sum, eid) {
    var e = state.entities[eid];
    if (!e || !e.isAlive) return sum;
    return sum + (ROSTER_COST[e.tier] ?? 1);
  }, 0);
}

function canAffordRosterSlots(player: Player, state: GameState, slotsNeeded: number): boolean {
  var used = getRosterSlotsUsed(player, state);
  var cap  = Math.min(player.foodCap, ROSTER_HARD_CAP);
  return used + slotsNeeded <= cap;
}

// DECISION: Called on unit KO. Refunds the tier's roster slot cost to the player
//   who owned the unit. Called from resolver.ts after isAlive is set false.
export function refundRosterSlots(state: GameState, playerId: string, tier: number): void {
  var player = state.players[playerId];
  if (!player) return;
  var refund = ROSTER_COST[tier] ?? 1;
  // DECISION: Sync food to live count rather than subtracting, avoids drift.
  player.food = Math.max(0, getRosterSlotsUsed(player, state) - refund);
}

// ============================================================
// RECRUIT SCOUT (was recruitTrainee)
// READS: player.bling, player.food, player.foodCap, ROSTER_HARD_CAP
// WRITES: player.bling, player.food, state.entities, player.entities
// ============================================================
export function recruitTrainee(state: GameState, playerId: string): boolean {
  var player = state.players[playerId];
  if (!player) return false;

  // DECISION: Hard cap check — both foodCap (player's current cap) AND
  //   ROSTER_HARD_CAP (absolute max 50) must not be exceeded.
  if (!canAffordRosterSlots(player, state, ROSTER_COST[1])) return false;
  if (player.bling < GAME_CONSTANTS.COST_RECRUIT_TRAINEE) return false;

  player.bling        -= GAME_CONSTANTS.COST_RECRUIT_TRAINEE;
  player.baseTreasury -= GAME_CONSTANTS.COST_RECRUIT_TRAINEE;

  var ownedNode = Object.values(state.nodes).find(function(n) {
    return n.nodeOwner === playerId;
  });
  var nodeId = ownedNode ? ownedNode.id : 'node_s1';

  var scout = createEntity(playerId, player.discipline, 1, { ...player.basePosition }, true);
  scout.harvestTarget        = nodeId;
  state.entities[scout.id]   = scout;
  player.entities.push(scout.id);

  // Update live roster count
  player.food = getRosterSlotsUsed(player, state);

  state.events.push({ type: 'trainee_deployed', tick: state.tick, sourceId: playerId, value: GAME_CONSTANTS.COST_RECRUIT_TRAINEE });
  return true;
}

// ============================================================
// UPGRADE BASE — extended v0.1.13 to handle T1→T2 and T2→T3
// READS: player.baseLevel, player.bling, player.hype
// WRITES: player.baseLevel, player.bling, player.hype, constructionQueue
// DECISION: T1→T2 remains instant (existing behavior preserved).
//   T2→T3 goes into constructionQueue with 45s build time — big upgrade
//   should feel like a commitment, not an instant button press.
// ============================================================
export function upgradeBase(state: GameState, playerId: string): boolean {
  var player = state.players[playerId];
  if (!player) return false;

  if (player.baseLevel === 1) {
    // T1 → T2: instant, 400 Bling
    if (player.bling < GAME_CONSTANTS.COST_UPGRADE_BASE_T2) return false;
    player.bling        -= GAME_CONSTANTS.COST_UPGRADE_BASE_T2;
    player.baseTreasury -= GAME_CONSTANTS.COST_UPGRADE_BASE_T2;
    player.baseLevel     = 2;
    player.hype         += 5;
    state.events.push({ type: 'base_expanded', tick: state.tick, sourceId: playerId });
    return true;
  }

  if (player.baseLevel === 2) {
    // T2 → T3: queued, 900 Bling + 300 Hype, 45s
    if (player.bling < COST_UPGRADE_BASE_T3)      return false;
    if (player.hype  < COST_UPGRADE_BASE_T3_HYPE) return false;
    var alreadyQueued = player.constructionQueue.some(function(j) {
      return j.buildingType === 'base_t3_upgrade';
    });
    if (alreadyQueued) return false;

    player.bling        -= COST_UPGRADE_BASE_T3;
    player.hype         -= COST_UPGRADE_BASE_T3_HYPE;
    player.baseTreasury -= COST_UPGRADE_BASE_T3;

    var job: ConstructionJob = {
      type:              'World Promo HQ',
      buildingType:      'base_t3_upgrade' as BuildingType,
      costBling:         COST_UPGRADE_BASE_T3,
      timeTotal:         TIME_UPGRADE_BASE_T3_S,
      timeRemaining:     TIME_UPGRADE_BASE_T3_S,
      assignedTraineeId: null,
    };
    player.constructionQueue.push(job);
    state.events.push({ type: 'base_upgrade_queued', tick: state.tick, sourceId: playerId, data: { targetLevel: 3 } });
    return true;
  }

  return false; // T3 is max
}

// ============================================================
// BUILD NUTRITION CENTER (was buildCookout)
// READS: player.baseLevel, player.bling
// WRITES: player.bling, player.foodCap, player.buildings
// DECISION: Nutrition Center grants +5 Roster Slots on completion.
//   foodCap is capped at ROSTER_HARD_CAP — can't buy past 50.
//   Multiple Nutrition Centers allowed (up to cap).
// ============================================================
export function buildCookout(state: GameState, playerId: string): boolean {
  var player = state.players[playerId];
  if (!player) return false;
  var reason = getBuildBlockReason('cookout', player.baseLevel, player.bling, player.hype, player.buildings);
  if (reason) return false;

  player.bling        -= GAME_CONSTANTS.COST_COOKOUT;
  player.baseTreasury -= GAME_CONSTANTS.COST_COOKOUT;

  // DECISION: foodCap update happens immediately on purchase for UX clarity.
  //   Player sees slots open right away rather than waiting for build timer.
  //   Cap at ROSTER_HARD_CAP.
  player.foodCap = Math.min(ROSTER_HARD_CAP, player.foodCap + 5);
  player.buildings.push({ type: 'cookout', builtAt: state.tick });

  state.events.push({ type: 'upgrade_purchased', tick: state.tick, sourceId: playerId, data: { building: 'cookout' } });
  return true;
}

// ============================================================
// BUILD PERFORMANCE LAB (was buildTechRefinery)
// READS: player.baseLevel, player.bling
// WRITES: player.bling, constructionQueue
// ============================================================
export function buildTechRefinery(state: GameState, playerId: string): boolean {
  var player = state.players[playerId];
  if (!player) return false;
  var reason = getBuildBlockReason('tech_refinery', player.baseLevel, player.bling, player.hype, player.buildings);
  if (reason) return false;

  var alreadyQueued = player.constructionQueue.some(function(j) { return j.buildingType === 'tech_refinery'; });
  if (alreadyQueued) return false;

  player.bling        -= GAME_CONSTANTS.COST_TECH_REFINERY;
  player.baseTreasury -= GAME_CONSTANTS.COST_TECH_REFINERY;

  var job: ConstructionJob = {
    type:              'Performance Lab',
    buildingType:      'tech_refinery',
    costBling:         GAME_CONSTANTS.COST_TECH_REFINERY,
    timeTotal:         GAME_CONSTANTS.TIME_TECH_REFINERY_S,
    timeRemaining:     GAME_CONSTANTS.TIME_TECH_REFINERY_S,
    assignedTraineeId: null,
  };
  player.constructionQueue.push(job);

  state.events.push({ type: 'tech_refinery_built', tick: state.tick, sourceId: playerId });
  return true;
}

// ============================================================
// BUILD FIGHT GYM (was buildTrainer)
// READS: player.buildings, player.bling
// WRITES: constructionQueue
// ============================================================
export function buildTrainer(state: GameState, playerId: string): boolean {
  var player = state.players[playerId];
  if (!player) return false;
  var reason = getBuildBlockReason('trainer', player.baseLevel, player.bling, player.hype, player.buildings);
  if (reason) return false;

  var alreadyQueued = player.constructionQueue.some(function(j) { return j.buildingType === 'trainer'; });
  if (alreadyQueued) return false;

  var job: ConstructionJob = {
    type:              'Fight Gym',
    buildingType:      'trainer',
    costBling:         0,
    timeTotal:         GAME_CONSTANTS.TIME_TRAINER_S,
    timeRemaining:     GAME_CONSTANTS.TIME_TRAINER_S,
    assignedTraineeId: null,
  };
  player.constructionQueue.push(job);

  state.events.push({ type: 'trainer_built', tick: state.tick, sourceId: playerId });
  return true;
}

// ============================================================
// BUILD COACHING INSTITUTE — v0.1.13
// READS: player.baseLevel, player.bling, player.buildings
// WRITES: player.bling, constructionQueue
// DECISION: Prereq = T2 base + Fight Gym (trainer). Separate building from
//   Fight Gym — not an upgrade. Cost: 350 Bling, 40s.
//   getBuildBlockReason handles 'coach' prereq check via shared/game.ts.
// ============================================================
export function buildCoach(state: GameState, playerId: string): boolean {
  var player = state.players[playerId];
  if (!player) return false;
  var reason = getBuildBlockReason('coach', player.baseLevel, player.bling, player.hype, player.buildings);
  if (reason) return false;

  var alreadyQueued = player.constructionQueue.some(function(j) { return j.buildingType === 'coach'; });
  if (alreadyQueued) return false;

  player.bling        -= COST_COACHING_INSTITUTE;
  player.baseTreasury -= COST_COACHING_INSTITUTE;

  var job: ConstructionJob = {
    type:              'Coaching Institute',
    buildingType:      'coach',
    costBling:         COST_COACHING_INSTITUTE,
    timeTotal:         TIME_COACHING_INSTITUTE_S,
    timeRemaining:     TIME_COACHING_INSTITUTE_S,
    assignedTraineeId: null,
  };
  player.constructionQueue.push(job);

  state.events.push({ type: 'coach_built', tick: state.tick, sourceId: playerId });
  return true;
}

// ============================================================
// BUILD MEDIA STUDIO — v0.1.13
// READS: player.baseLevel, player.bling
// WRITES: player.bling, constructionQueue
// DECISION: T2 base required. 300 Bling, 20s. One per player.
//   Once built, player can toggle mediaStudioActive on/off.
//   Conversion runs in tickPassiveHype() when active.
// ============================================================
export function buildMediaStudio(state: GameState, playerId: string): boolean {
  var player = state.players[playerId] as any;
  if (!player) return false;
  if (player.baseLevel < 2)            return false;
  if (player.bling < COST_MEDIA_STUDIO) return false;

  var has = function(t: string) { return player.buildings.some(function(b: any) { return b.type === t; }); };
  if (has('media_studio'))             return false;

  var alreadyQueued = player.constructionQueue.some(function(j: any) { return j.buildingType === 'media_studio'; });
  if (alreadyQueued)                   return false;

  player.bling        -= COST_MEDIA_STUDIO;
  player.baseTreasury -= COST_MEDIA_STUDIO;

  var job: ConstructionJob = {
    type:              'Media Studio',
    buildingType:      'media_studio' as BuildingType,
    costBling:         COST_MEDIA_STUDIO,
    timeTotal:         TIME_MEDIA_STUDIO_S,
    timeRemaining:     TIME_MEDIA_STUDIO_S,
    assignedTraineeId: null,
  };
  player.constructionQueue.push(job);

  state.events.push({ type: 'media_studio_built', tick: state.tick, sourceId: playerId });
  return true;
}

// ============================================================
// TOGGLE MEDIA STUDIO — v0.1.13
// DECISION: Player explicitly toggles Bling→Hype conversion on/off.
//   Returns current active state. No cost — just a mode switch.
//   Client sends TOGGLE_MEDIA_STUDIO command; server flips the flag.
// ============================================================
export function toggleMediaStudio(state: GameState, playerId: string): boolean {
  var player = state.players[playerId] as any;
  if (!player) return false;
  var has = function(t: string) { return player.buildings.some(function(b: any) { return b.type === t; }); };
  if (!has('media_studio')) return false;

  player.mediaStudioActive = !player.mediaStudioActive;
  state.events.push({
    type:     'media_studio_toggled',
    tick:     state.tick,
    sourceId: playerId,
    data:     { active: player.mediaStudioActive },
  });
  return player.mediaStudioActive;
}

// ============================================================
// BUILD RECOVERY CENTER — v0.1.13 (framework)
// READS: player.baseLevel, player.bling, player.hype
// WRITES: player.bling, player.hype, constructionQueue
// DECISION: T2 base required. 400 Bling + 100 Hype, 25s. One per player.
//   Proximity effects (training time -20%, unit cooldown -15%) wired
//   in next pass once asset exists. Building registers in state now
//   so prereq tree is complete.
// ============================================================
export function buildRecoveryCenter(state: GameState, playerId: string): boolean {
  var player = state.players[playerId] as any;
  if (!player) return false;
  if (player.baseLevel < 2)                    return false;
  if (player.bling < COST_RECOVERY_CENTER)     return false;
  if (player.hype  < COST_RECOVERY_CENTER_HYPE) return false;

  var has = function(t: string) { return player.buildings.some(function(b: any) { return b.type === t; }); };
  if (has('recovery_center')) return false;

  var alreadyQueued = player.constructionQueue.some(function(j: any) { return j.buildingType === 'recovery_center'; });
  if (alreadyQueued) return false;

  player.bling        -= COST_RECOVERY_CENTER;
  player.hype         -= COST_RECOVERY_CENTER_HYPE;
  player.baseTreasury -= COST_RECOVERY_CENTER;

  var job: ConstructionJob = {
    type:              'Recovery Center',
    buildingType:      'recovery_center' as BuildingType,
    costBling:         COST_RECOVERY_CENTER,
    timeTotal:         TIME_RECOVERY_CENTER_S,
    timeRemaining:     TIME_RECOVERY_CENTER_S,
    assignedTraineeId: null,
  };
  player.constructionQueue.push(job);

  state.events.push({ type: 'recovery_center_built', tick: state.tick, sourceId: playerId });
  return true;
}

// ============================================================
// BUILD CHAMPIONSHIP OFFICE — v0.1.13 (framework)
// READS: player.baseLevel, player.bling, player.hype
// WRITES: player.bling, player.hype, constructionQueue
// DECISION: T3 base required. 600 Bling + 250 Hype, 35s. One per player.
//   Active effects (KO hype doubling, center hold doubling) applied in
//   tickPassiveHype() and resolver.ts once T3 path is fully tested.
//   Building registers now so the unlock tree is structurally complete.
// ============================================================
export function buildChampionshipOffice(state: GameState, playerId: string): boolean {
  var player = state.players[playerId] as any;
  if (!player) return false;
  if (player.baseLevel < 3)                        return false;
  if (player.bling < COST_CHAMPIONSHIP_OFFICE)     return false;
  if (player.hype  < COST_CHAMPIONSHIP_OFFICE_HYPE) return false;

  var has = function(t: string) { return player.buildings.some(function(b: any) { return b.type === t; }); };
  if (has('championship_office')) return false;

  var alreadyQueued = player.constructionQueue.some(function(j: any) { return j.buildingType === 'championship_office'; });
  if (alreadyQueued) return false;

  player.bling        -= COST_CHAMPIONSHIP_OFFICE;
  player.hype         -= COST_CHAMPIONSHIP_OFFICE_HYPE;
  player.baseTreasury -= COST_CHAMPIONSHIP_OFFICE;

  var job: ConstructionJob = {
    type:              'Championship Office',
    buildingType:      'championship_office' as BuildingType,
    costBling:         COST_CHAMPIONSHIP_OFFICE,
    timeTotal:         TIME_CHAMPIONSHIP_OFFICE_S,
    timeRemaining:     TIME_CHAMPIONSHIP_OFFICE_S,
    assignedTraineeId: null,
  };
  player.constructionQueue.push(job);

  state.events.push({ type: 'championship_office_built', tick: state.tick, sourceId: playerId });
  return true;
}

// ============================================================
// BUILD FIGHT BOOKING OFFICE (was Phone Booth) — v0.1.13 (framework)
// READS: player.baseLevel, player.bling, player.hype, player.buildings
// WRITES: player.bling, player.hype, constructionQueue
// DECISION: Prereqs = T3 base + Performance Lab + Fight Gym + Coaching Institute.
//   getBuildBlockReason handles 'phone_booth' prereq check via shared/game.ts.
//   800 Bling + 300 Hype, 60s.
// ============================================================
export function buildPhoneBooth(state: GameState, playerId: string): boolean {
  var player = state.players[playerId] as any;
  if (!player) return false;
  var reason = getBuildBlockReason('phone_booth', player.baseLevel, player.bling, player.hype, player.buildings);
  if (reason) return false;

  var alreadyQueued = player.constructionQueue.some(function(j: any) { return j.buildingType === 'phone_booth'; });
  if (alreadyQueued) return false;

  player.bling        -= COST_FIGHT_BOOKING_OFFICE;
  player.hype         -= COST_FIGHT_BOOKING_OFFICE_HYPE;
  player.baseTreasury -= COST_FIGHT_BOOKING_OFFICE;

  var job: ConstructionJob = {
    type:              'Fight Booking Office',
    buildingType:      'phone_booth',
    costBling:         COST_FIGHT_BOOKING_OFFICE,
    timeTotal:         TIME_FIGHT_BOOKING_OFFICE_S,
    timeRemaining:     TIME_FIGHT_BOOKING_OFFICE_S,
    assignedTraineeId: null,
  };
  player.constructionQueue.push(job);

  state.events.push({ type: 'phone_booth_built', tick: state.tick, sourceId: playerId });
  return true;
}

// ============================================================
// TICK CONSTRUCTION QUEUE
// READS: player.constructionQueue, deltaS
// WRITES: constructionQueue, buildings, player.baseLevel (T3 upgrade)
// ============================================================
export function tickConstructionQueue(state: GameState, deltaS: number): void {
  Object.values(state.players).forEach(function(player) {
    if (player.constructionQueue.length === 0) return;

    var job = player.constructionQueue[0];
    job.timeRemaining = Math.max(0, job.timeRemaining - deltaS);
    if (job.timeRemaining > 0) return;

    player.constructionQueue.shift();
    var btype = job.buildingType as BuildingType;

    switch (btype) {
      case 'cookout':
        // foodCap already incremented at purchase time — no action needed here
        player.buildings.push({ type: btype, builtAt: state.tick });
        break;

      case 'base_t3_upgrade' as BuildingType:
        // DECISION: T3 upgrade completes — set baseLevel to 3.
        //   Does NOT push to player.buildings (it's a base upgrade, not a building).
        //   Hype boost on completion.
        player.baseLevel = 3;
        (player as any).hype += 20;
        break;

      case 'tech_refinery':
      case 'trainer':
      case 'coach':
      case 'phone_booth':
      case 'media_studio' as BuildingType:
      case 'recovery_center' as BuildingType:
      case 'championship_office' as BuildingType:
        player.buildings.push({ type: btype, builtAt: state.tick });
        break;

      default:
        player.buildings.push({ type: btype, builtAt: state.tick });
        break;
    }

    state.events.push({
      type:     'construction_complete',
      tick:     state.tick,
      sourceId: player.id,
      data:     { buildingType: btype, displayName: job.type },
    });
  });
}

// ============================================================
// TICK PASSIVE HYPE — v0.1.13
// READS: player.baseLevel, player.buildings, player.mediaStudioActive
// WRITES: player.hype, player.bling
// DECISION: Called every tick from loop.ts. Replaces any inline hype
//   increments that were scattered. Single source of truth for passive
//   hype generation.
//   T2 base:        +HYPE_PER_TICK_T2_BASE per tick
//   T3 base:        +HYPE_PER_TICK_T3_BASE per tick (replaces T2, not additive)
//   Performance Lab: +HYPE_PER_TICK_PERF_LAB bonus on top of base
//   Media Studio:   if active, costs MEDIA_STUDIO_BLING_COST_PER_TICK Bling
//                   and grants MEDIA_STUDIO_HYPE_PER_TICK Hype
//   Championship Office: multipliers applied to KO spike + center hold
//                   (those are event-driven, not tick-driven — see trainFighter/resolver)
// ============================================================
export function tickPassiveHype(state: GameState, deltaS: number): void {
  Object.values(state.players).forEach(function(player) {
    var p = player as any;

    var baseHypeTick = 0;
    if (player.baseLevel >= 3)      baseHypeTick = HYPE_PER_TICK_T3_BASE;
    else if (player.baseLevel >= 2) baseHypeTick = HYPE_PER_TICK_T2_BASE;

    var has = function(t: string) {
      return player.buildings.some(function(b: any) { return b.type === t; });
    };

    var perfLabBonus = has('tech_refinery') ? HYPE_PER_TICK_PERF_LAB : 0;

    player.hype += (baseHypeTick + perfLabBonus) * deltaS;

    // Media Studio conversion — player must have it built and toggled on
    if (p.mediaStudioActive && has('media_studio')) {
      var blingCost = MEDIA_STUDIO_BLING_COST_PER_TICK * deltaS;
      if (player.bling >= blingCost) {
        player.bling -= blingCost;
        player.hype  += MEDIA_STUDIO_HYPE_PER_TICK * deltaS;
      } else {
        // DECISION: Not enough Bling — auto-disable Media Studio rather than
        //   letting it run negative. Player must manually re-enable.
        p.mediaStudioActive = false;
        state.events.push({
          type:     'media_studio_auto_off',
          tick:     state.tick,
          sourceId: player.id,
        });
      }
    }
  });
}

// ============================================================
// APPLY KO HYPE SPIKE — v0.1.13
// READS: state.players, killerPlayerId, killedTier
// WRITES: killer player.hype
// DECISION: Called from resolver.ts when a unit is KO'd (isAlive set false).
//   Flat +15 Hype to the killing player.
//   Championship Office doubles this spike if built.
//   killedTier passed in for future scaling (e.g. bonus for KO'ing Paragon).
// ============================================================
export function applyKoHypeSpike(state: GameState, killerPlayerId: string, killedTier: number): void {
  var killer = state.players[killerPlayerId] as any;
  if (!killer) return;

  var spike = HYPE_KO_SPIKE;

  // Championship Office doubles KO hype
  var hasChampOffice = killer.buildings && killer.buildings.some(function(b: any) {
    return b.type === 'championship_office';
  });
  if (hasChampOffice) spike *= CHAMP_OFFICE_KO_MULT;

  killer.hype += spike;

  state.events.push({
    type:     'hype_spike',
    tick:     state.tick,
    sourceId: killerPlayerId,
    value:    spike,
    data:     { reason: 'ko', killedTier },
  });
}

// ============================================================
// TRAIN FIGHTER — v0.1.13
// READS: player.buildings, player.bling, player.hype, player.food,
//        player.foodCap, player.baseLevel, ROSTER_HARD_CAP
// WRITES: player.trainingQueue, player.bling, player.hype
// DECISION: trainFighter() is the single entry point for all tiers.
//   Roster slot check enforced at queue time (ROSTER_HARD_CAP).
//   Recovery Center proximity reduces training time if built.
//   T3/T4 now fully wired via Coaching Institute.
//   T5 wired via Fight Booking Office.
// ============================================================
export function trainFighter(state: GameState, playerId: string, tier: 1|2|3|4|5): boolean {
  var player = state.players[playerId] as any;
  if (!player) return false;

  var has = function(t: string) {
    return player.buildings.some(function(b: any) { return b.type === t; });
  };

  // Roster slot check — hard cap enforced
  var slotsNeeded = ROSTER_COST[tier] ?? tier;
  if (!canAffordRosterSlots(player, state, slotsNeeded)) return false;

  // Cost definitions per tier
  var costBling = 0, costHype = 0;
  switch (tier) {
    case 1:
      if (!has('trainer'))                           return false;
      if (player.bling < GAME_CONSTANTS.COST_T1_FIGHTER) return false;
      costBling = GAME_CONSTANTS.COST_T1_FIGHTER;
      break;
    case 2:
      if (!has('trainer'))      return false;
      if (player.baseLevel < 2) return false;
      if (player.bling < 350)   return false;
      if (player.hype  < 50)    return false;
      costBling = 350; costHype = 50;
      break;
    case 3:
      if (!has('coach'))        return false;
      if (player.bling < 500)   return false;
      if (player.hype  < 100)   return false;
      costBling = 500; costHype = 100;
      break;
    case 4:
      if (!has('coach'))        return false;
      if (player.bling < 800)   return false;
      if (player.hype  < 200)   return false;
      costBling = 800; costHype = 200;
      break;
    case 5:
      if (!has('phone_booth'))  return false;
      if (player.bling < 1500)  return false;
      if (player.hype  < 500)   return false;
      costBling = 1500; costHype = 500;
      break;
    default:
      return false;
  }

  player.bling        -= costBling;
  player.hype         -= costHype;
  player.baseTreasury -= costBling;

  // Base training times
  var timeMap: Record<number, number> = {
    1: GAME_CONSTANTS.TIME_T1_FIGHTER_S,
    2: GAME_CONSTANTS.TIME_T2_FIGHTER_S,
    3: GAME_CONSTANTS.TIME_T3_FIGHTER_S,
    4: GAME_CONSTANTS.TIME_T4_FIGHTER_S,
    5: GAME_CONSTANTS.TIME_T5_FIGHTER_S,
  };
  var trainTime = timeMap[tier];

  // DECISION: Recovery Center reduces training time by 20% if built.
  //   Proximity check: RC is placed at fixed offset from base — for now
  //   we treat "RC built = in range" since placement is fixed-offset.
  //   When click-to-place is implemented, add actual distance check here.
  if (has('recovery_center')) {
    trainTime *= RECOVERY_TIME_REDUCTION;
  }

  var job: FighterTrainingJob = {
    tier,
    discipline:    player.discipline,
    costBling,
    costHype,
    timeTotal:     trainTime,
    timeRemaining: trainTime,
  };
  player.trainingQueue.push(job);

  state.events.push({
    type:     'fighter_trained',
    tick:     state.tick,
    sourceId: playerId,
    data:     { tier, discipline: player.discipline },
  });
  return true;
}

// ============================================================
// TICK FIGHTER TRAINING — v0.1.13
// READS: player.trainingQueue, deltaS
// WRITES: trainingQueue, state.entities, player.entities, player.food
// DECISION: On spawn, fighter's roster slots are added to player.food.
//   If food would exceed hard cap at spawn time (edge case — player sold
//   other units while training), fighter spawns anyway (they paid for it).
// ============================================================
export function tickFighterTraining(state: GameState, deltaS: number): void {
  Object.values(state.players).forEach(function(player) {
    if (player.trainingQueue.length === 0) return;

    var job = player.trainingQueue[0];
    job.timeRemaining = Math.max(0, job.timeRemaining - deltaS);
    if (job.timeRemaining > 0) return;

    player.trainingQueue.shift();

    var spawnPos: Vec2 = {
      x: player.basePosition.x + (Math.random() * 6 - 3),
      y: player.basePosition.y - 6,
    };

    var fighter = createEntity(
      player.id,
      player.discipline as Discipline,
      job.tier as 1|2|3|4|5,
      spawnPos,
      false
    );
    state.entities[fighter.id] = fighter;
    player.entities.push(fighter.id);

    // Sync roster slots
    player.food = getRosterSlotsUsed(player, state);

    state.events.push({
      type:     'fighter_ready',
      tick:     state.tick,
      sourceId: player.id,
      data:     { tier: job.tier, discipline: job.discipline, entityId: fighter.id },
    });
  });
}
