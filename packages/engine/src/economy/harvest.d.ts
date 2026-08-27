import { Entity, Player, MapNode, GameEvent } from '@fist/shared';
export declare function getEffectiveWorkers(traineeCount: number): number;
export declare function getIncomePerSecond(traineeCount: number): number;
export type HarvestPhase = 'IDLE' | 'MOVING_TO_NODE' | 'HARVESTING' | 'RETURNING' | 'DROP_OFF';
export interface HarvestState {
    phase: HarvestPhase;
    phaseElapsedS: number;
    carryingBling: number;
    targetNodeId: string | null;
}
export declare function tickHarvest(entity: Entity, state: HarvestState, node: MapNode | null, player: Player, deltaS: number, events: GameEvent[], tick: number): void;
export declare function tickCenterHold(centerNode: MapNode, players: Record<string, Player>, entities: Record<string, Entity>, deltaS: number): void;
export declare function spendBling(player: Player, amount: number, events: GameEvent[], tick: number): boolean;
export declare function tickConfidenceDecay(entity: Entity): void;
//# sourceMappingURL=harvest.d.ts.map