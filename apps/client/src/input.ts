// BOOT ORDER: loaded by main.ts after canvas is ready
// READS: mouse events, keyboard events
// WRITES: selectedUnitIds, pending commands

export interface Command {
  type: 'MOVE' | 'PUNCH' | 'KICK' | 'GRAPPLE' | 'ABILITY';
  unitId: string;
  targetId?: string;
  targetPos?: { x: number; y: number };
  abilityKey?: string;
  timestamp: number;
}

export interface BoxSelect {
  active: boolean;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export class InputHandler {
  selectedUnitIds: Set<string> = new Set();
  pendingCommands: Command[] = [];
  boxSelect: BoxSelect = { active: false, startX: 0, startY: 0, endX: 0, endY: 0 };

  private canvas: HTMLCanvasElement;
  private onCommand: (cmd: Command) => void;
  private getUnitAtScreen: (x: number, y: number) => string | null;
  private getUnitsInBox: (x1: number, y1: number, x2: number, y2: number) => string[];
  private screenToWorld: (x: number, y: number) => { x: number; y: number };
  private myPlayerId: string = '';

  constructor(
    canvas: HTMLCanvasElement,
    onCommand: (cmd: Command) => void,
    getUnitAtScreen: (x: number, y: number) => string | null,
    getUnitsInBox: (x1: number, y1: number, x2: number, y2: number) => string[],
    screenToWorld: (x: number, y: number) => { x: number; y: number }
  ) {
    this.canvas = canvas;
    this.onCommand = onCommand;
    this.getUnitAtScreen = getUnitAtScreen;
    this.getUnitsInBox = getUnitsInBox;
    this.screenToWorld = screenToWorld;
    this.bind();
  }

  setPlayerId(id: string): void {
    this.myPlayerId = id;
  }

  private bind(): void {
    this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.canvas.addEventListener('contextmenu', this.onRightClick.bind(this));
    window.addEventListener('keydown', this.onKeyDown.bind(this));
  }

  private onMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return; // left click only

    var rect = this.canvas.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;

    var hitId = this.getUnitAtScreen(x, y);

    if (hitId) {
      // Direct unit click
      if (!e.shiftKey) this.selectedUnitIds.clear();
      this.selectedUnitIds.add(hitId);
    } else {
      // Start box select
      this.boxSelect = { active: true, startX: x, startY: y, endX: x, endY: y };
      if (!e.shiftKey) this.selectedUnitIds.clear();
    }
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.boxSelect.active) return;
    var rect = this.canvas.getBoundingClientRect();
    this.boxSelect.endX = e.clientX - rect.left;
    this.boxSelect.endY = e.clientY - rect.top;
  }

  private onMouseUp(e: MouseEvent): void {
    if (!this.boxSelect.active) return;

    var b = this.boxSelect;
    var x1 = Math.min(b.startX, b.endX);
    var y1 = Math.min(b.startY, b.endY);
    var x2 = Math.max(b.startX, b.endX);
    var y2 = Math.max(b.startY, b.endY);

    // Only box-select if dragged a meaningful distance
    if (x2 - x1 > 8 || y2 - y1 > 8) {
      var ids = this.getUnitsInBox(x1, y1, x2, y2);
      ids.forEach((id) => this.selectedUnitIds.add(id));
    }

    this.boxSelect.active = false;
  }

  private onRightClick(e: MouseEvent): void {
    e.preventDefault();

    var rect = this.canvas.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;

    var targetId = this.getUnitAtScreen(x, y);
    var worldPos = this.screenToWorld(x, y);

    this.selectedUnitIds.forEach((unitId) => {
      if (targetId && targetId !== unitId) {
        // Attack command
        var cmd: Command = {
          type: 'PUNCH',
          unitId,
          targetId,
          timestamp: Date.now(),
        };
        this.onCommand(cmd);
      } else {
        // Move command
        var cmd: Command = {
          type: 'MOVE',
          unitId,
          targetPos: worldPos,
          timestamp: Date.now(),
        };
        this.onCommand(cmd);
      }
    });
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (this.selectedUnitIds.size === 0) return;

    var abilityKey: string | null = null;
    if (e.key === '1') abilityKey = 'T1';
    if (e.key === '2') abilityKey = 'T3';
    if (e.key === '3') abilityKey = 'T5';

    if (!abilityKey) return;

    this.selectedUnitIds.forEach((unitId) => {
      var cmd: Command = {
        type: 'ABILITY',
        unitId,
        abilityKey: abilityKey!,
        timestamp: Date.now(),
      };
      this.onCommand(cmd);
    });
  }

  selectUnit(id: string): void {
    this.selectedUnitIds.clear();
    this.selectedUnitIds.add(id);
  }

  isSelected(id: string): boolean {
    return this.selectedUnitIds.has(id);
  }
}
