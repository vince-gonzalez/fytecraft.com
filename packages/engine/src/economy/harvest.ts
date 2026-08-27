// BOOT ORDER: loaded by server tick loop alongside combat
// READS: entity.isHarvesting, entity.harvestTarget, player.bling
// WRITES: entity.isHarvesting, player.bling, node.currentHolderId

import {
  Entity,
  Player,
  MapNode,
  GameEvent,
  GameEventType,
  Vec2,
} from '@fist/shared';

import { GAME_CONSTANTS } from '@fist/shared';

// ============================================================
// DISTANCE UTILITY
// ============================================================

function distance(a: Vec2, b: Vec2): number {
  var dx = a.x - b.x;
  var dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// How close a trainee must be to a node before harvest begins.
// Matches AI_NODE_REACH in loop.ts so the two systems stay in sync.
var HARVEST_ARRIVE_DIST = 2.5;

// How close a trainee must be to base to complete drop-off.
// Base positions are fixed corners — trainee walks back toward basePosition.
var DROPOFF_ARRIVE_DIST = 4.0;

// ============================================================
// EFFECTIVE WORKERS FORMULA
// GDD: effectiveWorkers = floor(3 * sqrt(trainees))
// ============================================================

export function getEffectiveWorkers(traineeCount: number): number {
  return Math.floor(3 * Math.sqrt(traineeCount));
}

// ============================================================
// INCOME PER SECOND
// DECISION: getIncomePerSecond has no node reference — uses BASE_YIELD constant.
// Per-node yield (HOT=45, SAFE=25) is applied in tickHarvest where node IS in scope.
// ============================================================

export function getIncomePerSecond(traineeCount: number): number {
  var effective     = getEffectiveWorkers(traineeCount);
  var yieldPerCycle = effective * GAME_CONSTANTS.BASE_YIELD;
  return yieldPerCycle / GAME_CONSTANTS.ROUND_TRIP_S;
}

// ============================================================
// HARVEST STATE MACHINE
// IDLE -> MOVING_TO_NODE -> HARVESTING -> RETURNING -> DROP_OFF -> MOVING_TO_NODE
//
// DECISION: MOVING_TO_NODE and RETURNING transitions are now distance-based,
//   not timer-based. The AI in loop.ts moves the entity body; harvest.ts reads
//   entity.position to detect arrival. This keeps both systems in sync without
//   a shared timer that could fire before the entity physically arrives.
// ============================================================

export type HarvestPhase =
  | 'IDLE'
  | 'MOVING_TO_NODE'
  | 'HARVESTING'
  | 'RETURNING'
  | 'DROP_OFF';

export interface HarvestState {
  phase:         HarvestPhase;
  phaseElapsedS: number;
  carryingBling: number;
  targetNodeId:  string | null;
}

// READS: harvestStates, node positions, base positions
// WRITES: harvestStates, entity.isHarvesting, player.bling, player.baseTreasury, events[]
export function tickHarvest(
  entity:      Entity,
  state:       HarvestState,
  node:        MapNode | null,
  player:      Player,
  deltaS:      number,
  events:      GameEvent[],
  tick:        number
): void {
  if (!entity.isTrainee || !entity.isAlive) return;

  state.phaseElapsedS += deltaS;

  switch (state.phase) {

    case 'IDLE':
      // Transition as soon as we have a target node
      if (state.targetNodeId && node) {
        state.phase         = 'MOVING_TO_NODE';
        state.phaseElapsedS = 0;
        entity.isHarvesting = false;
      }
      break;

    case 'MOVING_TO_NODE':
      // DECISION: transition on physical arrival, not a fixed timer.
      // The AI tick moves entity.position toward the node each frame.
      // Once close enough, start harvesting. If node is null (bad ID),
      // stay in MOVING_TO_NODE until the node resolves — don't advance state.
      entity.isHarvesting = false;
      if (node && distance(entity.position, node.position) <= HARVEST_ARRIVE_DIST) {
        state.phase         = 'HARVESTING';
        state.phaseElapsedS = 0;
        entity.isHarvesting = true;
      }
      break;

    case 'HARVESTING':
      // Fixed 10-second harvest at the node. Entity stays still (AI respects this phase).
      entity.isHarvesting = true;
      if (state.phaseElapsedS >= GAME_CONSTANTS.HARVEST_TIME_S) {
        // Use node's blingYield if available, fall back to BASE_YIELD
        state.carryingBling = node
          ? ((node as any).blingYield || GAME_CONSTANTS.BASE_YIELD)
          : GAME_CONSTANTS.BASE_YIELD;
        state.phase         = 'RETURNING';
        state.phaseElapsedS = 0;
        entity.isHarvesting = false; // walking back
      }
      break;

    case 'RETURNING':
      // DECISION: transition on physical arrival at base (same distance-based logic).
      // player.basePosition is the drop-off target.
      // The AI tick handles movement back toward base during this phase.
      entity.isHarvesting = false;
      var basePos = player.basePosition;
      if (basePos && distance(entity.position, basePos) <= DROPOFF_ARRIVE_DIST) {
        state.phase         = 'DROP_OFF';
        state.phaseElapsedS = 0;
      }
      // Safety fallback: if trainee is stuck returning for > 30s, force drop-off.
      // Prevents permanent RETURNING lock if pathfinding fails.
      if (state.phaseElapsedS >= 30) {
        state.phase         = 'DROP_OFF';
        state.phaseElapsedS = 0;
      }
      break;

    case 'DROP_OFF':
      var amount = state.carryingBling;

      // Deposit to spendable bling
      player.bling += amount;

      // Deposit to base treasury (economy panel + construction budget)
      if ((player as any).baseTreasury !== undefined) {
        (player as any).baseTreasury += amount;
      }

      state.carryingBling = 0;
      state.phase         = 'MOVING_TO_NODE';
      state.phaseElapsedS = 0;
      entity.isHarvesting = false;

      events.push({
        type:     'bling_harvested' as GameEventType,
        tick,
        sourceId: entity.id,
        targetId: player.id,
        value:    amount,
      });
      break;
  }
}

// ============================================================
// CENTER NODE HOLD — accumulate hold time, award center bonus
// Held if: one player has a living non-trainee fighter within
// CAGE_CONTROL_RADIUS AND no enemy is in the same radius.
// ============================================================

export function tickCenterHold(
  centerNode: MapNode,
  players:    Record<string, Player>,
  entities:   Record<string, Entity>,
  deltaS:     number
): void {
  var unitsNearCenter: Record<string, string[]> = {};

  Object.values(entities).forEach(function(e) {
    if (!e.isAlive || e.isTrainee) return;
    var dist = distance(e.position, centerNode.position);
    if (dist <= GAME_CONSTANTS.CAGE_CONTROL_RADIUS) {
      if (!unitsNearCenter[e.playerId]) unitsNearCenter[e.playerId] = [];
      unitsNearCenter[e.playerId].push(e.id);
    }
  });

  var playerIdsNearCenter = Object.keys(unitsNearCenter);

  if (playerIdsNearCenter.length === 1) {
    var holderId = playerIdsNearCenter[0];
    centerNode.currentHolderId = holderId;

    var holder = players[holderId];
    if (holder) {
      holder.totalCenterTimeS += deltaS;
      holder.bling            += GAME_CONSTANTS.CENTER_BONUS_PER_SEC * deltaS;

      if (!centerNode.accumulatedHoldTime[holderId]) {
        centerNode.accumulatedHoldTime[holderId] = 0;
      }
      centerNode.accumulatedHoldTime[holderId] += deltaS;
    }
  } else {
    centerNode.currentHolderId = null;
  }
}

// ============================================================
// SPEND BLING — validates and deducts
// ============================================================

export function spendBling(
  player: Player,
  amount: number,
  events: GameEvent[],
  tick:   number
): boolean {
  if (player.bling < amount) return false;

  player.bling -= amount;

  events.push({
    type:     'bling_spent' as GameEventType,
    tick,
    sourceId: player.id,
    value:    amount,
  });

  return true;
}

// ============================================================
// CONFIDENCE PASSIVE DECAY
// ============================================================

export function tickConfidenceDecay(entity: Entity): void {
  entity.confidence = Math.max(
    0,
    entity.confidence - GAME_CONSTANTS.CONFIDENCE_PASSIVE_DECAY
  );
}
