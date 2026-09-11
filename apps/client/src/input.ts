// BOOT ORDER: loaded by main.ts after canvas is ready
// READS: mouse events, keyboard events, touch events
// WRITES: selectedUnitIds, pending commands, camera pan/zoom via callbacks
//
// v0.1.16 — TOUCH. The client had zero touch or pointer handlers, so on a phone
//           nothing but the HTML buttons responded: no select, no move order, no
//           pan, no zoom. This adds the three gestures a mobile RTS needs, without
//           touching a single line of the mouse path.
//
// DECISION: touch is handled with TouchEvent, not PointerEvent. Pointer events
//   would unify the two code paths, but pinch needs two simultaneous pointers
//   tracked as a pair, which means rebuilding the pairing PointerEvent throws
//   away. TouchEvent hands us e.touches already grouped. The mouse path stays
//   on MouseEvent and is completely undisturbed.
//
// DECISION: single taps are deliberately NOT preventDefault'd, so the browser
//   still synthesises mousedown/mouseup/click from them. That is what makes unit
//   selection and base selection work on mobile with no duplicated logic — they
//   ride the existing click handlers in game.ts. The ONE case that is suppressed
//   is a tap on empty ground while units are selected, because there the tap
//   means "move there" and the synthesised click would immediately deselect.
//
// DECISION: there is no right button on a touch screen, so the desktop
//   right-click-to-command idiom cannot carry over. The mobile idiom is:
//     tap a unit          -> select it
//     tap empty ground    -> move the selection there
//     tap an enemy        -> attack it with the selection
//     one-finger drag     -> pan the camera
//     two-finger pinch    -> zoom
//   issueOrderAt() is shared by the touch tap and the mouse right-click so the
//   two input methods can never drift apart on what an order means.
/* ===== LAST STABLE: v0.1.15 — mouse + keyboard only, no touch, no zoom ===== */

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

// DECISION: 12px of slop before a touch becomes a drag. Apple's own threshold is
//   around 10px; fingers on a 3x display wobble more than a mouse and a tap that
//   silently turns into a 3px pan reads as an unresponsive button.
var TAP_SLOP_PX  = 12;
// DECISION: 550ms. Longer than a deliberate tap, shorter than the ~600ms where a
//   user assumes the input was dropped and taps again.
var TAP_MAX_MS   = 550;
// DECISION: pinch below 1.5px of separation change is finger noise, not intent.
var PINCH_DEAD_PX = 1.5;

export class InputHandler {
  selectedUnitIds: Set<string> = new Set();
  pendingCommands: Command[] = [];
  boxSelect: BoxSelect = { active: false, startX: 0, startY: 0, endX: 0, endY: 0 };

  private canvas: HTMLCanvasElement;
  private onCommand: (cmd: Command) => void;
  private getUnitAtScreen: (x: number, y: number) => string | null;
  private getUnitsInBox: (x1: number, y1: number, x2: number, y2: number) => string[];
  private screenToWorld: (x: number, y: number) => { x: number; y: number };
  private onPan: (dx: number, dy: number) => void;
  private onZoom: (factor: number, anchorX: number, anchorY: number) => void;
  private myPlayerId: string = '';

  // ── touch gesture state ──
  private touchStartX:  number  = 0;
  private touchStartY:  number  = 0;
  private touchLastX:   number  = 0;
  private touchLastY:   number  = 0;
  private touchStartMs: number  = 0;
  private touchPanning: boolean = false;
  private pinchDist:    number  = 0;
  private pinching:     boolean = false;

  constructor(
    canvas: HTMLCanvasElement,
    onCommand: (cmd: Command) => void,
    getUnitAtScreen: (x: number, y: number) => string | null,
    getUnitsInBox: (x1: number, y1: number, x2: number, y2: number) => string[],
    screenToWorld: (x: number, y: number) => { x: number; y: number },
    onPan?: (dx: number, dy: number) => void,
    onZoom?: (factor: number, anchorX: number, anchorY: number) => void
  ) {
    this.canvas = canvas;
    this.onCommand = onCommand;
    this.getUnitAtScreen = getUnitAtScreen;
    this.getUnitsInBox = getUnitsInBox;
    this.screenToWorld = screenToWorld;
    // DECISION: the two camera callbacks are optional and default to no-ops so
    //   this class stays constructible from any older call site rather than
    //   throwing on undefined halfway through a gesture.
    this.onPan  = onPan  || function() {};
    this.onZoom = onZoom || function() {};
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

    // v0.1.16 — touch. passive:false is required: a passive listener cannot call
    //   preventDefault, and without preventDefault on touchmove the browser pans
    //   and rubber-bands the page instead of the camera.
    this.canvas.addEventListener('touchstart',  this.onTouchStart.bind(this), { passive: false });
    this.canvas.addEventListener('touchmove',   this.onTouchMove.bind(this),  { passive: false });
    this.canvas.addEventListener('touchend',    this.onTouchEnd.bind(this),   { passive: false });
    this.canvas.addEventListener('touchcancel', this.onTouchCancel.bind(this), { passive: false });
  }

  // ── SHARED ORDER PATH ───────────────────────────────────────
  // Used by the mouse right-click AND the touch tap so an order means exactly
  // the same thing on both. Returns true if any order was actually issued.
  private issueOrderAt(x: number, y: number): boolean {
    if (this.selectedUnitIds.size === 0) return false;

    var targetId = this.getUnitAtScreen(x, y);
    var worldPos = this.screenToWorld(x, y);
    var issued   = false;

    this.selectedUnitIds.forEach((unitId) => {
      if (targetId && targetId !== unitId) {
        this.onCommand({
          type: 'PUNCH',
          unitId: unitId,
          targetId: targetId,
          timestamp: Date.now(),
        });
      } else {
        this.onCommand({
          type: 'MOVE',
          unitId: unitId,
          targetPos: worldPos,
          timestamp: Date.now(),
        });
      }
      issued = true;
    });

    return issued;
  }

  private localX(clientX: number): number {
    return clientX - this.canvas.getBoundingClientRect().left;
  }

  private localY(clientY: number): number {
    return clientY - this.canvas.getBoundingClientRect().top;
  }

  // ── TOUCH ───────────────────────────────────────────────────

  private onTouchStart(e: TouchEvent): void {
    if (e.touches.length === 1) {
      var t = e.touches[0];
      this.touchStartX  = this.touchLastX = this.localX(t.clientX);
      this.touchStartY  = this.touchLastY = this.localY(t.clientY);
      this.touchStartMs = Date.now();
      this.touchPanning = false;
      this.pinching     = false;
      return;
    }

    if (e.touches.length === 2) {
      // A second finger cancels any in-flight tap or pan and starts a pinch.
      this.pinching     = true;
      this.touchPanning = false;
      this.pinchDist    = this.touchSeparation(e);
      e.preventDefault();
    }
  }

  private onTouchMove(e: TouchEvent): void {
    if (this.pinching && e.touches.length === 2) {
      e.preventDefault();
      var dist = this.touchSeparation(e);
      if (this.pinchDist > 0 && Math.abs(dist - this.pinchDist) > PINCH_DEAD_PX) {
        var ax = (this.localX(e.touches[0].clientX) + this.localX(e.touches[1].clientX)) / 2;
        var ay = (this.localY(e.touches[0].clientY) + this.localY(e.touches[1].clientY)) / 2;
        this.onZoom(dist / this.pinchDist, ax, ay);
        this.pinchDist = dist;
      }
      return;
    }

    if (e.touches.length !== 1) return;

    var t  = e.touches[0];
    var x  = this.localX(t.clientX);
    var y  = this.localY(t.clientY);

    if (!this.touchPanning) {
      var travelled = Math.abs(x - this.touchStartX) + Math.abs(y - this.touchStartY);
      if (travelled <= TAP_SLOP_PX) return;   // still a candidate tap — leave it alone
      this.touchPanning = true;
    }

    // DECISION: the camera follows the finger, so dragging left moves the view
    //   left — the map tracks under the thumb the way every map app behaves.
    e.preventDefault();
    this.onPan(x - this.touchLastX, y - this.touchLastY);
    this.touchLastX = x;
    this.touchLastY = y;
  }

  private onTouchEnd(e: TouchEvent): void {
    if (this.pinching) {
      // Only leave pinch mode once every finger is off the glass, otherwise
      // lifting one of two fingers snaps the camera as the survivor becomes a pan.
      if (e.touches.length === 0) { this.pinching = false; this.pinchDist = 0; }
      e.preventDefault();
      return;
    }

    if (this.touchPanning) { this.touchPanning = false; return; }

    var heldMs = Date.now() - this.touchStartMs;
    if (heldMs > TAP_MAX_MS) return;

    // A real tap. If it landed on a unit, do nothing and let the synthesised
    // click run the existing selection path. If it landed on empty ground with
    // a selection active, it is an order — and the synthesised click MUST be
    // suppressed, because game.ts's click handler would deselect on empty ground.
    var hit = this.getUnitAtScreen(this.touchStartX, this.touchStartY);
    if (hit) return;

    if (this.issueOrderAt(this.touchStartX, this.touchStartY)) {
      e.preventDefault();
    }
  }

  private onTouchCancel(): void {
    this.touchPanning = false;
    this.pinching     = false;
    this.pinchDist    = 0;
  }

  private touchSeparation(e: TouchEvent): number {
    var dx = e.touches[0].clientX - e.touches[1].clientX;
    var dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ── MOUSE ───────────────────────────────────────────────────

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
    this.issueOrderAt(e.clientX - rect.left, e.clientY - rect.top);
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
