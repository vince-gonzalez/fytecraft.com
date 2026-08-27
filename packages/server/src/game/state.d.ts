import { GameState, Entity, Player, MapNode, Vec2, Discipline } from '@fist/shared';
export declare function makeId(prefix: string): string;
export declare function createEntity(playerId: string, discipline: Discipline, tier: 1 | 2 | 3 | 4 | 5, position: Vec2, isTrainee?: boolean): Entity;
export declare function createPlayer(id: string, discipline: Discipline, basePosition: Vec2): Player;
export declare function createNode(id: string, position: Vec2, isContested: boolean, isCenter: boolean): MapNode;
export declare function createGameState(playerDisciplines: Record<string, Discipline>): GameState;
export declare function checkMatchEnd(state: GameState): void;
//# sourceMappingURL=state.d.ts.map