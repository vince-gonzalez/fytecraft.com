export declare enum Discipline {
    STRIKER = "Striker",
    GRAPPLER = "Grappler",
    BRAWLER = "Brawler",
    TECHNICIAN = "Technician",
    SPECIALIST = "Specialist"
}
export declare enum CareerState {
    TRAINEE = "Trainee",
    PROSPECT = "Prospect",
    FIGHTER = "Fighter",
    CHAMPION = "Champion"
}
export declare var CAREER_LADDER: CareerState[];
export declare enum AIState {
    AGGRESSIVE = "Aggressive",
    DEFENSIVE = "Defensive",
    PANICKED = "Panicked",
    OPPORTUNISTIC = "Opportunistic"
}
export declare enum ProcType {
    BLEED = "BLEED",// 2% HP/sec for 5s
    STAGGER = "STAGGER",// +1.5s cooldown delay on defender
    RAGE = "RAGE",// +25% DMG on attacker for 4s
    DEVOLVE = "DEVOLVE"
}
export declare enum ActionType {
    PUNCH = "PUNCH",
    KICK = "KICK",
    BLOCK = "BLOCK",
    GRAPPLE = "GRAPPLE",
    ABILITY = "ABILITY",
    MOVE = "MOVE",
    RETREAT = "RETREAT"
}
export declare enum CommentaryTier {
    T1 = "T1",// damage > 5% HP
    T2 = "T2",// chain >= 3
    T3 = "T3",// KO
    T4 = "T4",// comeback
    T5 = "T5"
}
export interface Vec2 {
    x: number;
    y: number;
}
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
    isHarvesting: boolean;
    harvestTarget: string | null;
    winStreak: number;
    koCount: number;
    struggleMeter: number;
    chainCount: number;
    isAlive: boolean;
    hasThrownInTowel: boolean;
}
export interface ActiveProc {
    type: ProcType;
    remainingS: number;
    value: number;
    sourceId: string;
}
export interface UnitMemory {
    lastHitById: string | null;
    lastKOById: string | null;
    recentMoves: ActionType[];
    failedAbilities: string[];
}
export interface Command {
    type: ActionType;
    unitId: string;
    targetId?: string;
    targetPos?: Vec2;
    abilityKey?: string;
    timestamp: number;
}
export interface AttackResult {
    hit: boolean;
    damage: number;
    isCrit: boolean;
    proc: ProcType | null;
    isKO: boolean;
    careerDropped: boolean;
    traineeExited: boolean;
}
export interface MapNode {
    id: string;
    position: Vec2;
    isContested: boolean;
    isCenter: boolean;
    currentHolderId: string | null;
    accumulatedHoldTime: Record<string, number>;
}
export interface Player {
    id: string;
    discipline: Discipline;
    bling: number;
    respect: number;
    totalCenterTimeS: number;
    entities: string[];
    basePosition: Vec2;
    isConnected: boolean;
}
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
export type GameEventType = 'limb_break' | 'torso_trauma' | 'reset_shockwave' | 'unit_kill' | 'hero_entry' | 'hero_ability' | 'venue_transition' | 'final_descent' | '1v1_standoff' | 'comeback' | 'humiliation' | 'miss_streak' | 'clutch_evade' | 'bleed_out' | 'last_unit_alive' | 'crit_hit' | 'proc_chain' | 'career_drop' | 'career_recovery' | 'trainee_exit' | 'confidence_collapse' | 'comeback_arc' | 'champion_at_risk' | 'trainee_deployed' | 'bling_spent' | 'bling_harvested' | 'upgrade_purchased' | 'base_expanded' | 'cage_control_achieved' | 'phase_transition' | 'match_end';
export interface GameEvent {
    type: GameEventType;
    tick: number;
    sourceId?: string;
    targetId?: string;
    value?: number;
    data?: Record<string, unknown>;
}
export interface EntitySnapshot {
    id: string;
    pos: Vec2;
    hp: number;
    maxHp: number;
    careerState: CareerState;
    aiState: AIState;
    confidence: number;
    isAlive: boolean;
    isHarvesting: boolean;
    activeProcs: ProcType[];
}
export interface Snapshot {
    tick: number;
    matchElapsedS: number;
    players: Record<string, {
        bling: number;
        respect: number;
        totalCenterTimeS: number;
    }>;
    entities: EntitySnapshot[];
    events: GameEvent[];
}
//# sourceMappingURL=index.d.ts.map