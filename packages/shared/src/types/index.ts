// BOOT ORDER: imported by all packages after constants
// READS: nothing
// WRITES: nothing — type definitions only
// v0.1.10 — Building, BuildingType, baseLevel/buildings on Player,
//            buildingType on ConstructionJob, tier on EntitySnapshot,
//            disciplineTierSprite() helper
// v0.1.11 — FighterTrainingJob, fighter_trained/fighter_ready event types,
//            nodeOwner on MapNode for node exclusivity
/* ===== LAST STABLE: v0.1.10 — trainee build panel, Tech Refinery, Trainer ===== */

// ============================================================
// ENUMS
// ============================================================

export enum Discipline {
  STRIKER    = 'Striker',
  GRAPPLER   = 'Grappler',
  BRAWLER    = 'Brawler',
  TECHNICIAN = 'Technician',
  SPECIALIST = 'Specialist',
}

export enum CareerState {
  TRAINEE   = 'Trainee',
  PROSPECT  = 'Prospect',
  FIGHTER   = 'Fighter',
  CHAMPION  = 'Champion',
}

export var CAREER_LADDER: CareerState[] = [
  CareerState.TRAINEE,
  CareerState.PROSPECT,
  CareerState.FIGHTER,
  CareerState.CHAMPION,
];

export enum AIState {
  AGGRESSIVE    = 'Aggressive',
  DEFENSIVE     = 'Defensive',
  PANICKED      = 'Panicked',
  OPPORTUNISTIC = 'Opportunistic',
}

export enum ProcType {
  BLEED   = 'BLEED',
  STAGGER = 'STAGGER',
  RAGE    = 'RAGE',
  DEVOLVE = 'DEVOLVE',
}

export enum ActionType {
  PUNCH   = 'PUNCH',
  KICK    = 'KICK',
  BLOCK   = 'BLOCK',
  GRAPPLE = 'GRAPPLE',
  ABILITY = 'ABILITY',
  MOVE    = 'MOVE',
  RETREAT = 'RETREAT',
}

export enum CommentaryTier {
  T1 = 'T1',
  T2 = 'T2',
  T3 = 'T3',
  T4 = 'T4',
  T5 = 'T5',
}

// ============================================================
// POSITION
// ============================================================

export interface Vec2 {
  x: number;
  y: number;
}

// ============================================================
// BUILDING
// ============================================================

export type BuildingType =
  | 'cookout'
  | 'tech_refinery'
  | 'trainer'
  | 'coach'
  | 'phone_booth';

export interface Building {
  type:    BuildingType;
  builtAt: number;
}

// ============================================================
// FIGHTER TRAINING JOB — v0.1.11
// DECISION: FighterTrainingJob is separate from ConstructionJob.
//   ConstructionJob = building structures (Cookout, Refinery, Trainer).
//   FighterTrainingJob = training fighters from a barracks building.
//   Kept separate so queue display can differentiate "building X"
//   from "training T2 Striker". Both live on Player.
// ============================================================

export interface FighterTrainingJob {
  tier:          1 | 2 | 3 | 4 | 5;
  discipline:    string;        // inherits player discipline
  costBling:     number;
  costHype:      number;        // 0 for T1, 50 for T2
  timeTotal:     number;
  timeRemaining: number;
}

// ============================================================
// ENTITY
// ============================================================

export interface Entity {
  id: string;
  playerId: string;
  discipline: Discipline;
  tier: 1 | 2 | 3 | 4 | 5;
  careerState: CareerState;
  position: Vec2;
  velocity: Vec2;
  confidence: number;
  hp: number;
  maxHp: number;
  baseDamage: number;
  defense: number;
  speed: number;
  cooldowns: Partial<Record<ActionType | string, number>>;
  activeProcs: ActiveProc[];
  aiState: AIState;
  memory: UnitMemory;
  isTrainee: boolean;
  traineeRole:  string | null;
  careerLadder: boolean;
  isHarvesting: boolean;
  harvestTarget: string | null;
  winStreak: number;
  koCount: number;
  struggleMeter: number;
  chainCount: number;
  isAlive: boolean;
  hasThrownInTowel: boolean;
  hasPlayerCommand?: boolean;
}

// ============================================================
// PROCS
// ============================================================

export interface ActiveProc {
  type: ProcType;
  remainingS: number;
  value: number;
  sourceId: string;
}

// ============================================================
// AI MEMORY
// ============================================================

export interface UnitMemory {
  lastHitById: string | null;
  lastKOById: string | null;
  recentMoves: ActionType[];
  failedAbilities: string[];
}

// ============================================================
// COMMANDS
// ============================================================

export interface Command {
  type: ActionType;
  unitId: string;
  targetId?: string;
  targetPos?: Vec2;
  abilityKey?: string;
  timestamp: number;
}

// ============================================================
// COMBAT RESULTS
// ============================================================

export interface AttackResult {
  hit: boolean;
  damage: number;
  isCrit: boolean;
  proc: ProcType | null;
  isKO: boolean;
  careerDropped: boolean;
  traineeExited: boolean;
}

// ============================================================
// NODES
// DECISION: nodeOwner added in v0.1.11 for safe node exclusivity.
//   nodeOwner is set at game creation time and never changes.
//   null = contested node (hot nodes, center) — any team can harvest.
//   string = playerId who owns this safe node exclusively.
// ============================================================

export interface MapNode {
  id: string;
  position: Vec2;
  isContested: boolean;
  isCenter: boolean;
  blingYield: number;
  currentHolderId: string | null;
  accumulatedHoldTime: Record<string, number>;
  nodeOwner: string | null; // v0.1.11 — null = open, playerId = exclusive
}

// ============================================================
// CONSTRUCTION JOB
// ============================================================

export interface ConstructionJob {
  type:              string;
  buildingType:      BuildingType;
  costBling:         number;
  timeTotal:         number;
  timeRemaining:     number;
  assignedTraineeId: string | null;
}

// ============================================================
// PLAYER
// ============================================================

export interface Player {
  id: string;
  discipline: Discipline;
  bling: number;
  respect: number;
  totalCenterTimeS: number;
  entities: string[];
  basePosition: Vec2;
  isConnected: boolean;
  hype:              number;
  food:              number;
  foodCap:           number;
  baseTreasury:      number;
  baseHp:            number;
  baseMaxHp:         number;
  constructionQueue: ConstructionJob[];
  baseLevel:         number;
  buildings:         Building[];
  trainingQueue:     FighterTrainingJob[]; // v0.1.11
}

// ============================================================
// GAME STATE
// ============================================================

export interface GameState {
  tick: number;
  matchElapsedS: number;
  matchDurationS: number;
  players: Record<string, Player>;
  entities: Record<string, Entity>;
  nodes: Record<string, MapNode>;
  events: GameEvent[];
  phase: 'WAR' | 'ENDED';
  winnerId: string | null;
}

// ============================================================
// EVENTS
// ============================================================

export type GameEventType =
  | 'limb_break'
  | 'torso_trauma'
  | 'reset_shockwave'
  | 'unit_kill'
  | 'hero_entry'
  | 'hero_ability'
  | 'venue_transition'
  | 'final_descent'
  | '1v1_standoff'
  | 'comeback'
  | 'humiliation'
  | 'miss_streak'
  | 'clutch_evade'
  | 'bleed_out'
  | 'last_unit_alive'
  | 'crit_hit'
  | 'proc_chain'
  | 'career_drop'
  | 'career_recovery'
  | 'trainee_exit'
  | 'confidence_collapse'
  | 'comeback_arc'
  | 'champion_at_risk'
  | 'trainee_deployed'
  | 'bling_spent'
  | 'bling_harvested'
  | 'upgrade_purchased'
  | 'base_expanded'
  | 'tech_refinery_built'
  | 'trainer_built'
  | 'construction_complete'
  | 'fighter_trained'      // v0.1.11 — training job entered queue
  | 'fighter_ready'        // v0.1.11 — fighter spawned from training
  | 'cage_control_achieved'
  | 'phase_transition'
  | 'match_end';

export interface GameEvent {
  type: GameEventType;
  tick: number;
  sourceId?: string;
  targetId?: string;
  value?: number;
  data?: Record<string, unknown>;
}

// ============================================================
// NETWORK SNAPSHOT
// ============================================================

export interface EntitySnapshot {
  id: string;
  playerId: string;
  pos: Vec2;
  hp: number;
  maxHp: number;
  careerState: CareerState;
  aiState: AIState;
  confidence: number;
  isAlive: boolean;
  isHarvesting: boolean;
  isTrainee: boolean;
  discipline?: string;
  tier?: number;          // v0.1.10
  activeProcs: ProcType[];
}

export interface PlayerSnapshot {
  bling:             number;
  respect:           number;
  totalCenterTimeS:  number;
  hype:              number;
  food:              number;
  foodCap:           number;
  basePosition:      Vec2;
  baseHp:            number;
  baseMaxHp:         number;
  baseTreasury:      number;
  constructionQueue: ConstructionJob[];
  baseLevel:         number;
  buildings:         Building[];
  trainingQueue:     FighterTrainingJob[]; // v0.1.11
}

export interface Snapshot {
  tick: number;
  matchElapsedS: number;
  players: Record<string, PlayerSnapshot>;
  entities: EntitySnapshot[];
  events: GameEvent[];
}

// ============================================================
// SPRITE HELPERS
// ============================================================

export function disciplineTierSprite(discipline: string, tier: number): string {
  var base = discipline.toLowerCase();
  if (tier <= 1) return base;
  return base + tier;
}
