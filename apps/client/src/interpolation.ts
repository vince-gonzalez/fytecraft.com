// BOOT ORDER: loaded by game.ts
// READS: snapshots from server
// WRITES: interpolated render positions

export interface EntitySnapshot {
  id:           string;
  playerId:     string;
  pos:          { x: number; y: number };
  hp:           number;
  maxHp:        number;
  careerState:  string;
  aiState:      string;
  confidence:   number;
  isAlive:      boolean;
  isHarvesting: boolean;
  isTrainee:    boolean;
  discipline?:  string;
  activeProcs:  string[];
}

export interface RenderEntity {
  id:           string;
  playerId:     string;
  isTrainee:    boolean;
  // DECISION: discipline stored here so drawUnit can pick the correct sprite key.
  // Was missing — caused discKey to always be '' and sprites to never render.
  discipline:   string;
  rx:           number;
  ry:           number;
  prevX:        number;
  prevY:        number;
  targetX:      number;
  targetY:      number;
  hp:           number;
  maxHp:        number;
  careerState:  string;
  confidence:   number;
  isAlive:      boolean;
  isHarvesting: boolean;
  activeProcs:  string[];
}

export class Interpolator {
  private entities: Map<string, RenderEntity> = new Map();
  private alpha: number = 0;

  // WRITES: entities map
  applySnapshot(snapEntities: EntitySnapshot[]): void {
    snapEntities.forEach((snap) => {
      var existing = this.entities.get(snap.id);
      if (existing) {
        existing.prevX        = existing.rx;
        existing.prevY        = existing.ry;
        existing.targetX      = snap.pos.x;
        existing.targetY      = snap.pos.y;
        existing.hp           = snap.hp;
        existing.maxHp        = snap.maxHp;
        existing.careerState  = snap.careerState;
        existing.confidence   = snap.confidence;
        existing.isAlive      = snap.isAlive;
        existing.isHarvesting = snap.isHarvesting;
        existing.isTrainee    = snap.isTrainee;
        existing.playerId     = snap.playerId;
        existing.activeProcs  = snap.activeProcs;
        existing.discipline   = snap.discipline ?? existing.discipline;
      } else {
        this.entities.set(snap.id, {
          id:           snap.id,
          playerId:     snap.playerId,
          isTrainee:    snap.isTrainee,
          discipline:   snap.discipline ?? '',
          rx:           snap.pos.x,
          ry:           snap.pos.y,
          prevX:        snap.pos.x,
          prevY:        snap.pos.y,
          targetX:      snap.pos.x,
          targetY:      snap.pos.y,
          hp:           snap.hp,
          maxHp:        snap.maxHp,
          careerState:  snap.careerState,
          confidence:   snap.confidence,
          isAlive:      snap.isAlive,
          isHarvesting: snap.isHarvesting,
          activeProcs:  snap.activeProcs,
        });
      }
    });

    this.entities.forEach((_, id) => {
      if (!snapEntities.find((s) => s.id === id)) {
        this.entities.delete(id);
      }
    });

    this.alpha = 0;
  }

  tick(deltaMs: number, tickMs: number): void {
    this.alpha = Math.min(1, this.alpha + deltaMs / tickMs);
    this.entities.forEach((e) => {
      e.rx = e.prevX + (e.targetX - e.prevX) * this.alpha;
      e.ry = e.prevY + (e.targetY - e.prevY) * this.alpha;
    });
  }

  getEntities(): RenderEntity[] {
    return Array.from(this.entities.values());
  }

  getEntity(id: string): RenderEntity | undefined {
    return this.entities.get(id);
  }
}
