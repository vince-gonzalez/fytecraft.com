// BOOT ORDER: entry point for simulation
// READS: GameState, GAME_CONSTANTS, all engine packages
// WRITES: GameState each tick via tick()
// v0.1.13 — tickPassiveHype() replaces inline hype tick,
//            food sync replaced by roster slot live recount (in state.ts),
//            new command routes: BUILD_COACH, BUILD_MEDIA_STUDIO,
//            TOGGLE_MEDIA_STUDIO, BUILD_RECOVERY_CENTER,
//            BUILD_CHAMPIONSHIP_OFFICE, UPGRADE_BASE_T3,
//            TRAIN_T3_FIGHTER, TRAIN_T4_FIGHTER, TRAIN_T5_FIGHTER,
//            center hold grants +0.5 hype/sec to holding player
/* ===== LAST STABLE: v0.1.11 — TRAIN_T1/T2_FIGHTER, construction queue, node exclusivity ===== */

/* ===== WORKFLOW STACK =====
   File:         packages/server/src/game/loop.ts
   Brand:        Zengine™ / FyteCraft
   Author:       Vince Gonzalez
   Version:      v0.1.13
   Boot order:   index.ts → loop.ts → state.ts
   Dependencies: @fist/shared, @fist/engine, @fist/commentary, ./state
===== END STACK ===== */

import {
  GameState, Entity, Snapshot, Command, ActionType, CareerState,
} from '@fist/shared';
import { GAME_CONSTANTS } from '@fist/shared';
import {
  resolveAttack, checkCareerRecovery, tickProcs, tickConfidenceDecay,
} from '@fist/engine';
import { tickHarvest, tickCenterHold, HarvestState } from '@fist/engine';
import { CommentaryEngine } from '@fist/commentary';
import {
  checkMatchEnd,
  recruitTrainee,
  upgradeBase,
  buildCookout,
  buildTechRefinery,
  buildTrainer,
  buildCoach,
  buildMediaStudio,
  toggleMediaStudio,
  buildRecoveryCenter,
  buildChampionshipOffice,
  buildPhoneBooth,
  tickConstructionQueue,
  tickPassiveHype,
  trainFighter,
  tickFighterTraining,
  applyKoHypeSpike,
  refundRosterSlots,
} from './state';

// ── CONFIG ────────────────────────────────────────────────────
var AI_FIGHTER_SPD = 4.5;
var AI_TRAINEE_SPD = 3.0;
var AI_ENGAGE_DIST = 3.5;
var AI_NODE_REACH  = 2.5;
// DECISION: Center hold hype rate — +0.5 hype/sec to the player holding
//   the center node uncontested. Applied in tickCenterHoldHype() each tick.
//   Championship Office doubles this (checked per-player in that function).
var HYPE_CENTER_PER_SEC = 0.5;
// ── END CONFIG ────────────────────────────────────────────────

function aiFyteDist(a: {x:number,y:number}, b: {x:number,y:number}): number {
  var dx = b.x - a.x, dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function aiFyteMove(ent: any, target: {x:number,y:number}, spd: number, dt: number): void {
  var d = aiFyteDist(ent.position, target);
  if (d < 0.05) return;
  var nx = (target.x - ent.position.x) / d;
  var ny = (target.y - ent.position.y) / d;
  var step = Math.min(spd * dt, d);
  ent.position.x += nx * step;
  ent.position.y += ny * step;
  ent.velocity.x  = nx * spd;
  ent.velocity.y  = ny * spd;
}

function aiFyteNearestEnemy(ent: any, entities: Record<string,any>): any {
  var best: any = null, bestD = Infinity;
  Object.keys(entities).forEach(function(id) {
    var o = entities[id];
    if (!o.isAlive || o.playerId === ent.playerId || o.isTrainee) return;
    var d = aiFyteDist(ent.position, o.position);
    if (d < bestD) { bestD = d; best = o; }
  });
  return best;
}

export function tickAI(state: any, deltaS: number, harvestStates?: Map<string,any>): void {
  if (!state || !state.entities) return;
  var ents = state.entities, nodes = state.nodes || {};

  Object.keys(ents).forEach(function(id) {
    var ent = ents[id];
    if (!ent.isAlive || !ent.position) return;
    if (ent.hasPlayerCommand) { ent.hasPlayerCommand = false; return; }

    if (ent.isTrainee) {
      var hs = harvestStates ? harvestStates.get(ent.id) : null;
      if (hs && hs.phase === 'HARVESTING') { ent.velocity.x = 0; ent.velocity.y = 0; return; }
      if (hs && hs.phase === 'DROP_OFF')   { ent.velocity.x = 0; ent.velocity.y = 0; return; }
      if (hs && hs.phase === 'RETURNING') {
        var pl = state.players[ent.playerId];
        if (pl && pl.basePosition) {
          if (aiFyteDist(ent.position, pl.basePosition) > 2.0)
            aiFyteMove(ent, pl.basePosition, AI_TRAINEE_SPD, deltaS);
          else { ent.velocity.x = 0; ent.velocity.y = 0; }
        }
        return;
      }
      if (hs && hs.targetNodeId && nodes[hs.targetNodeId]) {
        var np = nodes[hs.targetNodeId].position;
        if (aiFyteDist(ent.position, np) > AI_NODE_REACH)
          aiFyteMove(ent, np, AI_TRAINEE_SPD, deltaS);
        else { ent.velocity.x = 0; ent.velocity.y = 0; }
        return;
      }
      // Fallback: walk to nearest non-center node
      var bn: any = null, bnd = Infinity;
      Object.keys(nodes).forEach(function(nid) {
        var n = nodes[nid];
        if (!n.position || n.isCenter) return;
        var d = aiFyteDist(ent.position, n.position);
        if (d < bnd) { bnd = d; bn = n; }
      });
      if (bn && bnd > AI_NODE_REACH) aiFyteMove(ent, bn.position, AI_TRAINEE_SPD, deltaS);
      else { ent.velocity.x = 0; ent.velocity.y = 0; }

    } else {
      // DECISION: Fighters only engage if enemy is within 2x engage distance.
      var enemy = aiFyteNearestEnemy(ent, ents);
      if (enemy && aiFyteDist(ent.position, enemy.position) <= AI_ENGAGE_DIST * 2) {
        if (aiFyteDist(ent.position, enemy.position) > AI_ENGAGE_DIST) {
          aiFyteMove(ent, enemy.position, AI_FIGHTER_SPD, deltaS);
        } else {
          ent.velocity.x = 0; ent.velocity.y = 0;
          var pcd = (ent.cooldowns && ent.cooldowns['PUNCH']) ? ent.cooldowns['PUNCH'] : 0;
          if (pcd <= 0) {
            // DECISION: resolveAttack result checked here for KO — if KO occurred,
            //   apply hype spike and refund roster slots to appropriate players.
            var result = resolveAttack(ent, enemy, state.events, state.tick);
            ent.cooldowns['PUNCH'] = GAME_CONSTANTS.CD_PUNCH;
            if (result.isKO) {
              applyKoHypeSpike(state, ent.playerId, enemy.tier ?? 1);
              refundRosterSlots(state, enemy.playerId, enemy.tier ?? 1);
            }
          }
        }
      } else {
        ent.velocity.x = 0; ent.velocity.y = 0;
      }
    }
  });
}

// ============================================================
// CENTER HOLD HYPE TICK — v0.1.13
// READS: state.nodes (center), state.players, state.entities
// WRITES: player.hype for the player holding center uncontested
// DECISION: Separate from tickPassiveHype() because this is event-driven
//   by who holds the center node, not a flat per-player passive.
//   Championship Office doubles the rate for that player.
// ============================================================
function tickCenterHoldHype(state: GameState, deltaS: number): void {
  var centerNode = Object.values(state.nodes).find(function(n) { return n.isCenter; });
  if (!centerNode || !centerNode.currentHolderId) return;

  var holder = state.players[centerNode.currentHolderId];
  if (!holder) return;

  var rate = HYPE_CENTER_PER_SEC;

  // Championship Office doubles center hold hype
  var hasChampOffice = (holder as any).buildings && (holder as any).buildings.some(function(b: any) {
    return b.type === 'championship_office';
  });
  if (hasChampOffice) rate *= 2.0;

  (holder as any).hype = Math.min(99999, ((holder as any).hype || 0) + rate * deltaS);
}

export class GameLoop {
  private state:                GameState;
  private commentary:           CommentaryEngine;
  private harvestStates:        Map<string, HarvestState>;
  private commandQueues:        Map<string, Command[]>;
  private confidenceDecayTimer: number = 0;
  private onSnapshot:           (snapshot: Snapshot) => void;
  private intervalHandle:       ReturnType<typeof setInterval> | null = null;

  constructor(state: GameState, onSnapshot: (snapshot: Snapshot) => void) {
    this.state       = state;
    this.commentary  = new CommentaryEngine();
    this.harvestStates = new Map();
    this.commandQueues = new Map();
    this.onSnapshot  = onSnapshot;

    Object.values(state.entities).forEach((entity) => {
      if (entity.isTrainee) {
        var targetId = entity.harvestTarget ?? 'node_s1';
        if (!state.nodes[targetId]) {
          var sn = Object.values(state.nodes).find(function(n) { return !n.isCenter && !n.isContested; });
          targetId = sn ? sn.id : 'node_s1';
        }
        this.harvestStates.set(entity.id, {
          phase: 'MOVING_TO_NODE', phaseElapsedS: 0, carryingBling: 0, targetNodeId: targetId,
        });
      }
    });
  }

  start(): void {
    this.intervalHandle = setInterval(this.tick.bind(this), GAME_CONSTANTS.TICK_MS);
  }

  stop(): void {
    if (this.intervalHandle) { clearInterval(this.intervalHandle); this.intervalHandle = null; }
  }

  // READS: command.metaType — routes to state functions immediately
  // WRITES: state via state functions, commandQueues for unit commands
  enqueueCommand(command: Command): void {
    var meta = (command as any).metaType;

    // ── Economy / base commands ──────────────────────────────
    if (meta === 'RECRUIT_TRAINEE')          { this.handleRecruitTrainee(command.unitId);              return; }
    if (meta === 'UPGRADE_BASE')             { upgradeBase(this.state, command.unitId);                return; }
    if (meta === 'UPGRADE_BASE_T3')          { upgradeBase(this.state, command.unitId);                return; }
    // DECISION: UPGRADE_BASE and UPGRADE_BASE_T3 both route to upgradeBase().
    //   upgradeBase() internally handles T1→T2 vs T2→T3 based on current baseLevel.
    //   Client sends UPGRADE_BASE always; UPGRADE_BASE_T3 is an alias for clarity.

    // ── Building commands ────────────────────────────────────
    if (meta === 'BUILD_COOKOUT')            { buildCookout(this.state, command.unitId);               return; }
    if (meta === 'BUILD_TECH_REFINERY')      { buildTechRefinery(this.state, command.unitId);          return; }
    if (meta === 'BUILD_TRAINER')            { buildTrainer(this.state, command.unitId);               return; }
    if (meta === 'BUILD_COACH')              { buildCoach(this.state, command.unitId);                 return; }
    if (meta === 'BUILD_MEDIA_STUDIO')       { buildMediaStudio(this.state, command.unitId);           return; }
    if (meta === 'TOGGLE_MEDIA_STUDIO')      { toggleMediaStudio(this.state, command.unitId);          return; }
    if (meta === 'BUILD_RECOVERY_CENTER')    { buildRecoveryCenter(this.state, command.unitId);        return; }
    if (meta === 'BUILD_CHAMPIONSHIP_OFFICE'){ buildChampionshipOffice(this.state, command.unitId);    return; }
    if (meta === 'BUILD_PHONE_BOOTH')        { buildPhoneBooth(this.state, command.unitId);            return; }

    // ── Fighter training commands ────────────────────────────
    if (meta === 'TRAIN_T1_FIGHTER')         { trainFighter(this.state, command.unitId, 1);            return; }
    if (meta === 'TRAIN_T2_FIGHTER')         { trainFighter(this.state, command.unitId, 2);            return; }
    if (meta === 'TRAIN_T3_FIGHTER')         { trainFighter(this.state, command.unitId, 3);            return; }
    if (meta === 'TRAIN_T4_FIGHTER')         { trainFighter(this.state, command.unitId, 4);            return; }
    if (meta === 'TRAIN_T5_FIGHTER')         { trainFighter(this.state, command.unitId, 5);            return; }

    // ── Unit commands (queued per-entity) ────────────────────
    var queue = this.commandQueues.get(command.unitId) ?? [];
    if (queue.length >= GAME_CONSTANTS.AI_MAX_QUEUE) queue.shift();
    queue.push(command);
    this.commandQueues.set(command.unitId, queue);
  }

  // READS: state, playerId
  // WRITES: state.entities (new scout), harvestStates
  // DECISION: After recruitTrainee() creates the entity we register it
  //   in harvestStates here — state.ts doesn't own harvestStates.
  private handleRecruitTrainee(playerId: string): void {
    var player = this.state.players[playerId];
    if (!player) return;
    var before  = new Set(player.entities);
    var success = recruitTrainee(this.state, playerId);
    if (!success) return;
    var newId = player.entities.find(function(eid) { return !before.has(eid); });
    if (!newId) return;
    var newEnt = this.state.entities[newId];
    if (!newEnt || !newEnt.isTrainee) return;
    var targetId = newEnt.harvestTarget ?? 'node_s1';
    if (!this.state.nodes[targetId]) {
      var sn = Object.values(this.state.nodes).find(function(n) { return !n.isCenter && !n.isContested; });
      targetId = sn ? sn.id : 'node_s1';
    }
    this.harvestStates.set(newId, {
      phase: 'MOVING_TO_NODE', phaseElapsedS: 0, carryingBling: 0, targetNodeId: targetId,
    });
  }

  private tick(): void {
    var deltaS = GAME_CONSTANTS.TICK_MS / 1000;
    var state  = this.state;
    if (state.phase === 'ENDED') return;

    state.tick++;
    state.matchElapsedS += deltaS;
    state.events = [];

    // DECISION: Roster slot sync is now handled inside state.ts via
    //   getRosterSlotsUsed() — live recount from entities.
    //   The old food = liveTrainees count is removed.
    //   player.food is synced in recruitTrainee() and tickFighterTraining().

    // ── Passive hype — single source of truth ────────────────
    // DECISION: tickPassiveHype() replaces the inline T2 hype increment.
    //   Covers T2/T3 base rates, Performance Lab bonus, Media Studio conversion.
    tickPassiveHype(state, deltaS);

    // ── Center hold hype ─────────────────────────────────────
    tickCenterHoldHype(state, deltaS);

    // ── Construction + training queues ───────────────────────
    tickConstructionQueue(state, deltaS);
    tickFighterTraining(state, deltaS);

    // ── Player commands + AI ─────────────────────────────────
    this.processCommands(deltaS);
    this.processHarvest(deltaS);
    tickAI(state, deltaS, this.harvestStates);

    // ── Center hold (Bling) ──────────────────────────────────
    var cn = Object.values(state.nodes).find(function(n) { return n.isCenter; });
    if (cn) tickCenterHold(cn, state.players, state.entities, deltaS);

    // ── Proc ticks + cooldowns + confidence decay ────────────
    Object.values(state.entities).forEach(function(e) { if (e.isAlive) tickProcs(e, deltaS); });
    this.tickCooldowns(deltaS);

    this.confidenceDecayTimer += deltaS;
    if (this.confidenceDecayTimer >= GAME_CONSTANTS.CONFIDENCE_DECAY_INTERVAL_S) {
      this.confidenceDecayTimer = 0;
      Object.values(state.entities).forEach(function(e) {
        if (e.isAlive) tickConfidenceDecay(e);
      });
    }

    Object.values(state.entities).forEach(function(e) {
      if (e.isAlive && !e.isTrainee) checkCareerRecovery(e, state.events, state.tick);
    });

    checkMatchEnd(state);
    this.onSnapshot(this.buildSnapshot(this.commentary.processEvents(state.events, deltaS)));
  }

  private processCommands(deltaS: number): void {
    var state = this.state;
    this.commandQueues.forEach(function(queue, unitId) {
      if (queue.length === 0) return;
      var entity = state.entities[unitId];
      if (!entity || !entity.isAlive) return;
      var command = queue[0];

      switch (command.type) {
        case ActionType.MOVE:
          if (command.targetPos) {
            var dx = command.targetPos.x - entity.position.x;
            var dy = command.targetPos.y - entity.position.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 0.5) {
              queue.shift();
            } else {
              var spd = entity.speed * deltaS;
              entity.position.x += (dx / dist) * spd;
              entity.position.y += (dy / dist) * spd;
              entity.hasPlayerCommand = true;
            }
          }
          break;

        case ActionType.PUNCH:
        case ActionType.KICK:
        case ActionType.GRAPPLE: {
          var cdKey = command.type;
          var cd = entity.cooldowns[cdKey] ?? 0;
          if (cd > 0) break;
          if (command.targetId) {
            var target = state.entities[command.targetId];
            if (target && target.isAlive) {
              var result = resolveAttack(entity, target, state.events, state.tick);
              if (result.hit && result.isKO) {
                entity.winStreak++;
                // DECISION: KO hype spike + roster refund wired here for
                //   player-commanded attacks, same as AI attacks in tickAI().
                applyKoHypeSpike(state, entity.playerId, target.tier ?? 1);
                refundRosterSlots(state, target.playerId, target.tier ?? 1);
              }
              var cdTime = command.type === ActionType.PUNCH ? GAME_CONSTANTS.CD_PUNCH
                         : command.type === ActionType.KICK  ? GAME_CONSTANTS.CD_KICK
                         : GAME_CONSTANTS.CD_GRAPPLE;
              entity.cooldowns[cdKey] = cdTime;
            }
          }
          queue.shift();
          break;
        }

        default:
          queue.shift();
          break;
      }
    });
  }

  // READS: state.entities (scouts), harvestStates, state.nodes
  // WRITES: harvestStates (phase transitions), player.bling (via tickHarvest)
  //
  // NODE EXCLUSIVITY
  // DECISION: Before tickHarvest runs, check if the scout's target node
  //   is owned by another player. If so, redirect to their own owned node.
  //   Contested nodes (hot/center) always have nodeOwner=null — never blocked.
  private processHarvest(deltaS: number): void {
    var state = this.state;
    Object.values(state.entities).forEach((entity) => {
      if (!entity.isTrainee || !entity.isAlive) return;
      var hs = this.harvestStates.get(entity.id);
      if (!hs) return;

      if (hs.targetNodeId) {
        var targetNode = state.nodes[hs.targetNodeId];
        if (targetNode && targetNode.nodeOwner !== null && targetNode.nodeOwner !== entity.playerId) {
          var ownedNode = Object.values(state.nodes).find(function(n) {
            return n.nodeOwner === entity.playerId;
          });
          if (ownedNode) {
            hs.targetNodeId      = ownedNode.id;
            entity.harvestTarget = ownedNode.id;
            hs.phase             = 'MOVING_TO_NODE';
            hs.phaseElapsedS     = 0;
          }
        }
      }

      var node   = hs.targetNodeId ? state.nodes[hs.targetNodeId] ?? null : null;
      var player = state.players[entity.playerId];
      if (!player) return;
      tickHarvest(entity, hs, node, player, deltaS, state.events, state.tick);
    });
  }

  private tickCooldowns(deltaS: number): void {
    Object.values(this.state.entities).forEach(function(entity) {
      Object.keys(entity.cooldowns).forEach(function(key) {
        var k   = key as ActionType;
        var cur = entity.cooldowns[k] ?? 0;
        if (cur > 0) entity.cooldowns[k] = Math.max(0, cur - deltaS);
      });
    });
  }

  private buildSnapshot(_commentary: ReturnType<CommentaryEngine['processEvents']>): Snapshot {
    var state = this.state;
    var playerData: Snapshot['players'] = {};

    Object.values(state.players).forEach(function(p) {
      playerData[p.id] = {
        bling:             p.bling             ?? 0,
        respect:           p.respect           ?? 0,
        totalCenterTimeS:  p.totalCenterTimeS  ?? 0,
        hype:              p.hype              ?? 0,
        food:              p.food              ?? 0,
        foodCap:           p.foodCap           ?? 5,
        basePosition:      { x: p.basePosition.x, y: p.basePosition.y },
        baseHp:            p.baseHp            ?? 500,
        baseMaxHp:         p.baseMaxHp         ?? 500,
        baseTreasury:      p.baseTreasury      ?? 0,
        constructionQueue: p.constructionQueue ?? [],
        baseLevel:         p.baseLevel         ?? 1,
        buildings:         p.buildings         ?? [],
        trainingQueue:     p.trainingQueue      ?? [],
        // DECISION: mediaStudioActive sent in snapshot so client can
        //   show toggle state in UI without a separate request.
        mediaStudioActive: (p as any).mediaStudioActive ?? false,
      };
    });

    var entitySnapshots = Object.values(state.entities).map(function(e) {
      return {
        id: e.id, playerId: e.playerId, discipline: e.discipline,
        tier: e.tier,
        pos: { x: e.position.x, y: e.position.y },
        hp: e.hp, maxHp: e.maxHp,
        careerState: e.careerState, aiState: e.aiState, confidence: e.confidence,
        isAlive: e.isAlive, isTrainee: e.isTrainee, isHarvesting: e.isHarvesting,
        activeProcs: e.activeProcs.map(function(p) { return p.type; }),
      };
    });

    return {
      tick: state.tick, matchElapsedS: state.matchElapsedS,
      players: playerData, entities: entitySnapshots, events: [...state.events],
    };
  }

  getState(): GameState { return this.state; }
}
