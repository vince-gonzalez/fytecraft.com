import { Entity, AttackResult, ProcType, GameEvent } from '@fist/shared';
export declare function seedRNG(seed: number): void;
export declare function calculateDamage(attacker: Entity, defender: Entity, isCrit: boolean): number;
export declare function rollCrit(attacker: Entity): boolean;
export declare function rollProc(attacker: Entity): boolean;
export declare function selectProc(attacker: Entity, defender: Entity): ProcType;
export declare function applyProc(proc: ProcType, attacker: Entity, defender: Entity): void;
export declare function tickProcs(entity: Entity, deltaS: number): void;
export declare function handleKO(defender: Entity, attacker: Entity | null, events: GameEvent[], tick: number): void;
export declare function resolveAttack(attacker: Entity, defender: Entity, events: GameEvent[], tick: number): AttackResult;
export declare function checkCareerRecovery(entity: Entity, events: GameEvent[], tick: number): void;
//# sourceMappingURL=resolver.d.ts.map