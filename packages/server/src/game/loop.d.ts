import { GameState, Snapshot, Command } from '@fist/shared';
export declare class GameLoop {
    private state;
    private commentary;
    private harvestStates;
    private commandQueues;
    private confidenceDecayTimer;
    private onSnapshot;
    private intervalHandle;
    constructor(state: GameState, onSnapshot: (snapshot: Snapshot) => void);
    start(): void;
    stop(): void;
    enqueueCommand(command: Command): void;
    private tick;
    private processCommands;
    private processHarvest;
    private tickCooldowns;
    private buildSnapshot;
    getState(): GameState;
}
//# sourceMappingURL=loop.d.ts.map