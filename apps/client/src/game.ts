// BOOT ORDER: loaded by main.ts
// v0.1.14a — base sprite draw made fallback-safe, and DISC_HOME.Grappler repointed
//            at a sprite that exists on disk. See CHANGE LOG below.
// v0.1.12 — projection recalibrated for 1536x1024 semi-iso map,
//            3x unit scale, larger nodes/structures, flat map billboard render
/* ===== LAST STABLE: v0.1.11 — two-player browser match, Bling economy, trainer panel ===== */

/* ===== WORKFLOW STACK =====
   File:         apps/client/src/game.ts
   Brand:        Zengine™ / FyteCraft
   Author:       Vince Gonzalez
   Version:      v0.1.12
   Boot order:   main.ts → game.ts → interpolation.ts, input.ts, ui.ts
   Dependencies: interpolation.ts (Interpolator, RenderEntity), input.ts (InputHandler), ui.ts (CAREER_LETTER)
   Layout:       Canvas2D fullscreen, fixed HUD overlay in index.html
   Browser:      Chrome/Firefox modern — no IE
===== END STACK ===== */

/* ===== ASSET MANIFEST =====
   Fonts:        Share Tech Mono (Google), Courier New (fallback)
   Fighters T1:  trainee.png, striker.png, grappler.png, technician.png, brawler.png, specialist.png
   Fighters T2+: striker2-5, grappler2-5, technician2-5, brawler2-5, specialist2-5
   Map:          map.png (1536x1024, semi-iso octagon arena)
   Nodes:        safeNode.png, hotNode.png, centerRing.png
   Buildings T1: scrapYard.png
   Buildings T2: localGym.png, wrestlingClub.png, biggerYard.png, theAcademy.png, theLaboratory.png
   Economy:      cookout.png, techRefinery.png
   Barracks:     trainer.png, coach.png, phoneBooth.png
   Misc:         logo.png
===== END MANIFEST ===== */

/* ============================================================
   CHANGE LOG — v0.1.14a
   ============================================================
   FIXED  ASSETS.theMats loaded '/assets/theMats.png', which is not in
          public/assets and never has been. DISC_HOME maps Grappler -> 'theMats',
          so a Grappler base drew nothing at all from the moment the T1->T2 upgrade
          landed: the pulsing ring, the YOUR BASE / ENEMY BASE label, the HP bar and
          the tier badge floated over a 140x140 hole. It now loads wrestlingClub.png,
          the Grappler house sprite that is on disk.
   FIXED  drawBases called drawCentered for the base sprite as a bare statement and
          threw away the boolean it returns. The fighter draw already consumes it and
          falls back to a vector shape; the base draw now falls back to scrapYard.png,
          so any future discipline with missing art degrades to the T1 shack rather
          than to an empty patch of map.
   KNOWN  media_studio, recovery_center and championship_office have no ASSETS entry
          and no drawBases branch, so those three buildings do not render on the map
          even though v0.1.14 sells them. That needs art, not a code change.
   ============================================================ */

import { Interpolator, RenderEntity } from './interpolation';
import { InputHandler } from './input';
import { CAREER_LETTER } from './ui';

// ── CONFIG BLOCK ──────────────────────────────────────────────
// DECISION: TILE_W=48, TILE_H=32 — ratio 1.5 matches map.png aspect (1536/1024=1.5).
// Previous TILE_H=24 gave ratio 2.0, which squashed the semi-iso perspective.
// DECISION: MAP_W / MAP_H are the source image pixel dimensions — used for
//   flat billboard scaling so map fills the projected world bounding box exactly.
var TILE_W    = 48;
var TILE_H    = 32;
var MAP_W     = 1536;
var MAP_H     = 1024;

// DECISION: Unit sprite sizes increased 3x from v0.1.11.
//   Trainee: 32x40 → 96x120. Fighter: 52x64 → 156x192.
//   Sprite vertical anchor offset also scaled 3x (trainee 14→42, fighter 20→60).
var TRAINEE_SW     = 96;
var TRAINEE_SH     = 120;
var TRAINEE_ANCHOR = 42;   // px above ground dot
var FIGHTER_SW     = 156;
var FIGHTER_SH     = 192;
var FIGHTER_ANCHOR = 60;   // px above ground dot

// DECISION: Node render sizes increased ~1.8x.
//   safeNode/hotNode: 72 → 128. centerRing: 96 → 160.
var NODE_SIZE_SAFE   = 128;
var NODE_SIZE_HOT    = 128;
var NODE_SIZE_CENTER = 160;

// DECISION: Base sprite size increased from 96 to 140.
//   Secondary building offsets scaled proportionally.
var BASE_SPRITE_SIZE = 140;

// DECISION: Scroll speed tuned for TILE_H=32 (was 12 at TILE_H=24).
var CAM_SCROLL_SPD = 14;

// ── CAMERA ZOOM — v0.1.16 ─────────────────────────────────────
// DECISION: zoom is applied as a CANVAS TRANSFORM (ctx.scale) rather than by
//   multiplying TILE_W/TILE_H or the ~15 sprite-size constants. Baking it into
//   worldToScreen would have zoomed the ground plane while leaving every sprite,
//   node ring and HP bar at a fixed pixel size - the map would slide out from
//   under the units. One transform scales the whole scene coherently and no
//   draw call had to change.
// DECISION: because of that, camX/camY live in PRE-SCALE space. Every hit test
//   therefore divides the incoming screen coordinate by ZOOM before comparing
//   (see getUnitAt / getBaseAt / getUnitsInBox), and a pan of N screen pixels
//   moves the camera by N/ZOOM.
// DECISION: floor 0.45 keeps the whole arena diamond on a phone screen; ceiling
//   2.2 is where map.png's 6.25x upscale becomes indefensible.
var ZOOM     = 1;
var ZOOM_MIN = 0.45;
var ZOOM_MAX = 2.2;

export function getZoom(): number { return ZOOM; }

// ── MAP REGISTRATION — v0.1.18 ────────────────────────────────
// DECISION: the renderer used to assume the painted arena diamond touched the
//   image's edge midpoints exactly - world(0,0) at top-centre, world(100,0) at
//   right-centre, and so on. No image generator hits that, and any map drawn as
//   a real 3D camera shot puts the cage INSET inside the frame with a vanishing
//   point. Fighting that in the prompt is a losing battle, so the engine is now
//   calibratable instead: describe where the painted diamond actually sits and
//   the map is scaled and offset so the world diamond lands on it.
//
// The four numbers, all fractions of the source image (0-1):
//   MAP_DIAMOND_CX / CY       centre of the painted arena floor
//   MAP_DIAMOND_HALF_W / _H   half-width / half-height of that diamond
//
// 0.5 / 0.5 / 0.5 / 0.5 reproduces the old edge-midpoint behaviour exactly, so
// a map drawn to the original spec still works untouched.
//
// CALIBRATE IT LIVE: with the game running, open the console and call
//   __mapCal(cx, cy, halfW, halfH)      e.g. __mapCal(0.511, 0.540, 0.397, 0.349)
//   __mapCalShow(true)                  draws the world diamond over the art
// Nudge until the drawn outline sits on the painted cage floor, then read the
// numbers back with __mapCal() and bake them in here.
var MAP_DIAMOND_CX     = 0.5;
var MAP_DIAMOND_CY     = 0.5;
var MAP_DIAMOND_HALF_W = 0.5;
var MAP_DIAMOND_HALF_H = 0.5;
var MAP_CAL_OVERLAY    = false;

(window as any).__mapCal = function(cx?: number, cy?: number, hw?: number, hh?: number) {
  if (typeof cx === 'number') MAP_DIAMOND_CX     = cx;
  if (typeof cy === 'number') MAP_DIAMOND_CY     = cy;
  if (typeof hw === 'number') MAP_DIAMOND_HALF_W = hw;
  if (typeof hh === 'number') MAP_DIAMOND_HALF_H = hh;
  return 'MAP_DIAMOND_CX = ' + MAP_DIAMOND_CX +
       '; MAP_DIAMOND_CY = ' + MAP_DIAMOND_CY +
       '; MAP_DIAMOND_HALF_W = ' + MAP_DIAMOND_HALF_W +
       '; MAP_DIAMOND_HALF_H = ' + MAP_DIAMOND_HALF_H + ';';
};
(window as any).__mapCalShow = function(on: boolean) { MAP_CAL_OVERLAY = !!on; return MAP_CAL_OVERLAY; };
// ── END CONFIG ────────────────────────────────────────────────

function loadImg(src: string): { img: HTMLImageElement; loaded: boolean } {
  var obj = { img: new Image(), loaded: false };
  obj.img.src = src;
  obj.img.onload  = function() { obj.loaded = true; };
  obj.img.onerror = function() { console.error('ASSET FAILED:', src); };
  return obj;
}

var ASSETS: Record<string, { img: HTMLImageElement; loaded: boolean }> = {
  // T1 discipline sprites
  trainee:        loadImg('/assets/trainee.png'),
  striker:        loadImg('/assets/striker.png'),
  grappler:       loadImg('/assets/grappler.png'),
  technician:     loadImg('/assets/technician.png'),
  brawler:        loadImg('/assets/brawler.png'),
  specialist:     loadImg('/assets/specialist.png'),
  // T2–T5 tier sprites
  striker2:       loadImg('/assets/striker2.png'),
  striker3:       loadImg('/assets/striker3.png'),
  striker4:       loadImg('/assets/striker4.png'),
  striker5:       loadImg('/assets/striker5.png'),
  grappler2:      loadImg('/assets/grappler2.png'),
  grappler3:      loadImg('/assets/grappler3.png'),
  grappler4:      loadImg('/assets/grappler4.png'),
  grappler5:      loadImg('/assets/grappler5.png'),
  technician2:    loadImg('/assets/technician2.png'),
  technician3:    loadImg('/assets/technician3.png'),
  technician4:    loadImg('/assets/technician4.png'),
  technician5:    loadImg('/assets/technician5.png'),
  brawler2:       loadImg('/assets/brawler2.png'),
  brawler3:       loadImg('/assets/brawler3.png'),
  brawler4:       loadImg('/assets/brawler4.png'),
  brawler5:       loadImg('/assets/brawler5.png'),
  specialist2:    loadImg('/assets/specialist2.png'),
  specialist3:    loadImg('/assets/specialist3.png'),
  specialist4:    loadImg('/assets/specialist4.png'),
  specialist5:    loadImg('/assets/specialist5.png'),
  // Map
  map:            loadImg('/assets/map.png'),
  safeNode:       loadImg('/assets/safeNode.png'),
  hotNode:        loadImg('/assets/hotNode.png'),
  centerRing:     loadImg('/assets/centerRing.png'),
  // Buildings
  scrapYard:      loadImg('/assets/scrapYard.png'),
  techRefinery:   loadImg('/assets/techRefinery.png'),
  cookout:        loadImg('/assets/cookout.png'),
  trainer:        loadImg('/assets/trainer.png'),
  coach:          loadImg('/assets/coach.png'),
  phoneBooth:     loadImg('/assets/phoneBooth.png'),
  localGym:       loadImg('/assets/localGym.png'),
  // v0.1.14a - the 'theMats' KEY is what DISC_HOME.Grappler resolves to, but
  // theMats.png has never existed in public/assets. The load 404'd, loaded stayed
  // false, and every Grappler base vanished from the map the moment it reached T2.
  // wrestlingClub.png is the Grappler house sprite that is actually on disk.
  theMats:        loadImg('/assets/wrestlingClub.png'),
  biggerYard:     loadImg('/assets/biggerYard.png'),
  theAcademy:     loadImg('/assets/theAcademy.png'),
  theLaboratory:  loadImg('/assets/theLaboratory.png'),
};

function img(key: string): HTMLImageElement | null {
  var a = ASSETS[key]; return (a && a.loaded) ? a.img : null;
}

// ── ISOMETRIC PROJECTION ──────────────────────────────────────
// DECISION: worldToScreen uses TILE_W=48, TILE_H=32 (ratio 1.5).
//   This matches the 1536x1024 map aspect so iso ground plane
//   aligns with the painted arena floor without manual offset hacks.
export function worldToScreen(wx: number, wy: number, camX: number, camY: number) {
  return {
    x: (wx - wy) * TILE_W + camX,
    y: (wx + wy) * TILE_H + camY
  };
}

export function screenToWorld(sx: number, sy: number, camX: number, camY: number) {
  var rx = sx - camX, ry = sy - camY;
  return {
    x: (rx / TILE_W + ry / TILE_H) / 2,
    y: (ry / TILE_H - rx / TILE_W) / 2
  };
}

var NODES = [
  { id: 'node_center', x: 50, y: 50, center: true,  hot: true  },
  { id: 'node_c1',     x: 40, y: 42, center: false, hot: true  },
  { id: 'node_c2',     x: 60, y: 42, center: false, hot: true  },
  { id: 'node_s1',     x: 20, y: 20, center: false, hot: false },
  { id: 'node_s2',     x: 80, y: 20, center: false, hot: false },
  { id: 'node_s3',     x: 80, y: 80, center: false, hot: false },
  { id: 'node_s4',     x: 20, y: 80, center: false, hot: false },
];

var TEAM_C = ['#4fc3f7', '#ef5350', '#69f0ae', '#ffd740'];

function rgba(hex: string, a: number): string {
  var r = parseInt(hex.slice(1,3), 16);
  var g = parseInt(hex.slice(3,5), 16);
  var b = parseInt(hex.slice(5,7), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a.toFixed(2) + ')';
}

// ── LEGIBLE CANVAS TEXT — v0.1.15 ─────────────────────────────
// DECISION: every text draw in this renderer now goes through outlinedText().
//   Before this there were 5 fillText calls and 0 strokeText, so a label's
//   legibility depended entirely on what happened to be behind it — the gold
//   treasury readout over a gold cage floor was invisible. One site used
//   shadowBlur as a glow in the label's OWN colour, which spreads that colour
//   outward and does the opposite of separating a glyph from its background.
// DECISION: the outline is stroked BEFORE the fill, with lineJoin 'round' so
//   thin monospace stems do not grow spikes at the joins, and miterLimit 2 as
//   a second guard. Stroke width scales off the font size rather than sitting
//   at a fixed 3px, because this helper serves 9px badges and 11px labels.
// DECISION: OUTLINE_INK is near-black at 0.85, not pure #000 — a full-black
//   ring reads as a sticker cutout against the dark arena floor.
var OUTLINE_INK = 'rgba(4,4,8,0.85)';

function outlinedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  fill: string,
  fontPx: number,
  bold: boolean
): void {
  ctx.save();
  ctx.font        = (bold ? 'bold ' : '') + fontPx + 'px "Share Tech Mono","Courier New",monospace';
  ctx.textAlign   = 'center';
  ctx.lineJoin    = 'round';
  ctx.miterLimit  = 2;
  ctx.lineWidth   = Math.max(2, Math.round(fontPx / 3));
  ctx.strokeStyle = OUTLINE_INK;
  ctx.strokeText(text, x, y);
  ctx.fillStyle   = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawCentered(
  ctx: CanvasRenderingContext2D,
  key: string,
  x: number, y: number,
  w: number, h: number
): boolean {
  var i = img(key);
  if (!i) return false;
  ctx.drawImage(i, x - w/2, y - h/2, w, h);
  return true;
}

// DISCIPLINE → base sprite at level 2
var DISC_HOME: Record<string, string> = {
  Striker:    'localGym',
  Grappler:   'theMats',
  Brawler:    'biggerYard',
  Technician: 'theAcademy',
  Specialist: 'theLaboratory',
};

// READS: snapshot.players, camX/camY, myPlayerId
// WRITES: canvas — base sprites, rings, labels, secondary buildings, HP bars
function drawBases(
  ctx: CanvasRenderingContext2D,
  snapshot: any,
  cx: number, cy: number,
  myId: string
): void {
  if (!snapshot || !snapshot.players) return;
  var nowMs = Date.now();

  Object.keys(snapshot.players).forEach(function(pid, idx) {
    var player = snapshot.players[pid];
    var bp     = player.basePosition;
    if (!bp) return;

    var sc     = worldToScreen(bp.x, bp.y, cx, cy);
    var color  = (pid === myId) ? TEAM_C[0] : TEAM_C[1];
    var alpha  = 0.55 + 0.3 * ((Math.sin(nowMs * 0.002 + idx * Math.PI) + 1) / 2);
    var level  = player.baseLevel ?? 1;
    var discKey = DISC_HOME[player.discipline ?? ''] ?? 'scrapYard';
    var sprKey  = level >= 2 ? discKey : 'scrapYard';

    // Pulsing ring
    ctx.save();
    ctx.beginPath();
    for (var k = 0; k < 8; k++) {
      var ang = (Math.PI * 2 / 8) * k + Math.PI / 8;
      // DECISION: ring radius scaled with BASE_SPRITE_SIZE (was hardcoded 56/40)
      var px = sc.x + (BASE_SPRITE_SIZE * 0.6) * Math.cos(ang);
      var py = sc.y + (BASE_SPRITE_SIZE * 0.43) * Math.sin(ang);
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle   = rgba(color, 0.12);
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth   = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur  = 20;
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Label
    // v0.1.15 - was fillStyle + shadowBlur 8 in the label's own colour, which
    //   bloomed the glyph outward instead of separating it from the art behind.
    outlinedText(ctx, pid === myId ? 'YOUR BASE' : 'ENEMY BASE',
                 sc.x, sc.y - (BASE_SPRITE_SIZE * 0.6), color, 11, true);

    // Base building sprite — BASE_SPRITE_SIZE
    // v0.1.14a - consume the boolean, the same idiom the fighter draw already uses.
    // A discipline sprite that fails to load used to leave a 140x140 hole with the
    // ring, the label and the HP bar floating over empty map. scrapYard.png is always
    // present, so a missing house degrades to the T1 shack instead of to nothing.
    if (!drawCentered(ctx, sprKey, sc.x, sc.y, BASE_SPRITE_SIZE, BASE_SPRITE_SIZE)) {
      drawCentered(ctx, 'scrapYard', sc.x, sc.y, BASE_SPRITE_SIZE, BASE_SPRITE_SIZE);
    }

    // Secondary buildings — offsets scaled with BASE_SPRITE_SIZE
    // DECISION: offsets proportionally larger than v0.1.11 to match bigger base sprite.
    //   Cookout: row right (+90px per slot). TechRefinery: above-right. Trainer: above-left.
    //   Coach replaces trainer visual slot. PhoneBooth: directly above.
    var buildings: any[] = (player.buildings ?? []);

    var cookouts = buildings.filter(function(b: any) { return b.type === 'cookout'; });
    cookouts.forEach(function(_b: any, ci: number) {
      drawCentered(ctx, 'cookout', sc.x + 90 + ci * 48, sc.y - 30, 64, 64);
    });

    var hasTechRefinery = buildings.some(function(b: any) { return b.type === 'tech_refinery'; });
    if (hasTechRefinery) drawCentered(ctx, 'techRefinery', sc.x + 100, sc.y - 75, 68, 68);

    var hasCoach = buildings.some(function(b: any) { return b.type === 'coach'; });
    var hasTrainer = buildings.some(function(b: any) { return b.type === 'trainer'; });
    // DECISION: Coach and Trainer share the above-left slot. Coach takes visual priority.
    if (hasCoach)        drawCentered(ctx, 'coach',    sc.x - 100, sc.y - 75, 68, 68);
    else if (hasTrainer) drawCentered(ctx, 'trainer',  sc.x - 100, sc.y - 75, 68, 68);

    var hasPhoneBooth = buildings.some(function(b: any) { return b.type === 'phone_booth'; });
    if (hasPhoneBooth) drawCentered(ctx, 'phoneBooth', sc.x, sc.y - 140, 68, 68);

    // HP bar — width scaled with base sprite
    var hp    = player.baseHp    ?? 500;
    var maxHp = player.baseMaxHp ?? 500;
    var hpPct = hp / Math.max(1, maxHp);
    var bw    = BASE_SPRITE_SIZE * 0.85;
    var bh    = 6;
    var bx    = sc.x - bw / 2;
    var by    = sc.y + BASE_SPRITE_SIZE * 0.55;
    ctx.fillStyle = '#1a1a28';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = hpPct > 0.5 ? '#00e5ff' : hpPct > 0.25 ? '#f5c842' : '#ef5350';
    ctx.fillRect(bx, by, bw * hpPct, bh);

    // Treasury
    outlinedText(ctx, '¤' + Math.floor(player.baseTreasury || 0),
                 sc.x, by + bh + 11, '#f5c842', 9, false);

    // Level badge
    outlinedText(ctx, 'T' + level,
                 sc.x + (BASE_SPRITE_SIZE * 0.4), sc.y - (BASE_SPRITE_SIZE * 0.6),
                 level >= 2 ? '#f5c842' : '#8888aa', 9, true);
  });
}

export class GameRenderer {
  private canvas:         HTMLCanvasElement;
  private ctx:            CanvasRenderingContext2D;
  // v0.1.15 - DPR state. canvas.width is the BACKING STORE in device pixels;
  //   viewW/viewH are CSS pixels and are what every draw coordinate speaks in.
  private dpr:            number = 1;
  private viewW:          number = 0;
  private viewH:          number = 0;
  private mmCanvas:       HTMLCanvasElement | null = null;
  private mmCtx:          CanvasRenderingContext2D | null = null;
  private interpolator:   Interpolator;
  private input:          InputHandler;
  private myDiscipline:   string;
  private myPlayerId:     string = '';
  private camX:           number;
  private camY:           number;
  private hitstopFrames:  number = 0;
  private shakeX:         number = 0;
  private shakeY:         number = 0;
  private shakeFrames:    number = 0;
  private keys:           Record<string, boolean> = {};
  private raf:            number = 0;
  private selectedBaseId: string | null = null;
  latestSnapshot:         any = null;

  constructor(container: HTMLElement, interpolator: Interpolator, myDiscipline: string) {
    this.interpolator = interpolator;
    this.myDiscipline = myDiscipline;

    this.canvas = document.createElement('canvas');
    // v0.1.16 - touch-action:none hands pan/pinch to the game instead of the browser.
    //   Taps still synthesise a click, so the existing mouse select path is untouched.
    this.canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2;touch-action:none;';
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    // v0.1.15 - the backing store was sized in CSS pixels, so on every phone
    //   (DPR 2-3) and every HiDPI laptop the whole game was upscaled by the
    //   compositor. Sprites, the 9px labels and the HP bars all resolved soft.
    this.syncCanvasSize();

    // DECISION: Camera default recalibrated for TILE_H=32.
    //   worldToScreen(50,50) = screenX=0+camX, screenY=100*32+camY = 3200+camY.
    //   We want world center near screen center, so camY = screenH/2 - 3200.
    //   That pushes us far up — instead anchor on P1 base at (12,12):
    //   screenY = 24*32+camY. We want that at ~40% screen height.
    //   camY = screenH*0.4 - 768. camX = screenW/2 (x cancels at wx=wy).
    this.camX = window.innerWidth  / 2;
    this.camY = window.innerHeight * 0.4 - 768;

    var mm = document.getElementById('minimap-canvas') as HTMLCanvasElement;
    if (mm) { this.mmCanvas = mm; this.mmCtx = mm.getContext('2d'); }

    window.addEventListener('resize', () => { this.syncCanvasSize(); });
    // v0.1.15 - a phone rotation fires orientationchange before the new
    //   innerWidth has settled in some mobile browsers, so re-sync on both.
    window.addEventListener('orientationchange', () => {
      window.setTimeout(() => { this.syncCanvasSize(); }, 120);
    });

    this.input = new InputHandler(
      this.canvas,
      (cmd)        => { (window as any).__sendCommand?.(cmd); },
      (x, y)       => this.getUnitAt(x, y),
      (x1,y1,x2,y2) => this.getUnitsInBox(x1,y1,x2,y2),
      (x, y)       => screenToWorld(x / ZOOM, y / ZOOM, this.camX, this.camY),
      // v0.1.16 - touch pan: N screen pixels is N/ZOOM camera pixels.
      (dx, dy)     => { this.camX += dx / ZOOM; this.camY += dy / ZOOM; },
      // v0.1.16 - pinch zoom, anchored so the world point under the pinch
      //   midpoint stays put. cam' = cam + S * (1/Z' - 1/Z).
      (factor, ax, ay) => {
        var prev = ZOOM;
        var next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, prev * factor));
        if (next === prev) return;
        ZOOM = next;
        this.camX += ax * (1 / next - 1 / prev);
        this.camY += ay * (1 / next - 1 / prev);
      }
    );

    // Left-click: base > trainee > deselect
    this.canvas.addEventListener('click', (e) => {
      var rect   = this.canvas.getBoundingClientRect();
      var sx     = e.clientX - rect.left;
      var sy     = e.clientY - rect.top;

      var baseId = this.getBaseAt(sx, sy);
      if (baseId) {
        this.selectedBaseId = baseId;
        (window as any).__onBaseSelected?.(baseId, this.latestSnapshot?.players?.[baseId]);
        return;
      }

      var unitId = this.getUnitAt(sx, sy);
      if (unitId) {
        var ent = this.interpolator.getEntities().find(function(e) { return e.id === unitId; });
        if (ent && ent.isTrainee && ent.playerId === this.myPlayerId) {
          (window as any).__onTraineeSelected?.(unitId);
          return;
        }
      }

      (window as any).cmdCloseTraineeBuildPanel?.();
    });

    window.addEventListener('keydown', (e) => { this.keys[e.key] = true;  });
    window.addEventListener('keyup',   (e) => { this.keys[e.key] = false; });

    var dragging = false, dragX = 0, dragY = 0;
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 1) { dragging = true; dragX = e.clientX / ZOOM - this.camX; dragY = e.clientY / ZOOM - this.camY; }
    });
    this.canvas.addEventListener('mousemove', (e) => {
      if (dragging) { this.camX = e.clientX / ZOOM - dragX; this.camY = e.clientY / ZOOM - dragY; }
    });
    this.canvas.addEventListener('mouseup', (e) => {
      if (e.button === 1) dragging = false;
    });

    this.loop();
  }

  setPlayerId(id: string): void { this.myPlayerId = id; }

  private loop(): void {
    var last = performance.now();
    var tick = (now: number) => {
      var delta = now - last; last = now;
      if (this.keys['w'] || this.keys['ArrowUp'])    this.camY += CAM_SCROLL_SPD / ZOOM;
      if (this.keys['s'] || this.keys['ArrowDown'])  this.camY -= CAM_SCROLL_SPD / ZOOM;
      if (this.keys['a'] || this.keys['ArrowLeft'])  this.camX += CAM_SCROLL_SPD / ZOOM;
      if (this.keys['d'] || this.keys['ArrowRight']) this.camX -= CAM_SCROLL_SPD / ZOOM;
      if (this.shakeFrames > 0) { this.shakeFrames--; this.shakeX *= 0.8; this.shakeY *= 0.8; }
      else { this.shakeX = 0; this.shakeY = 0; }
      if (this.hitstopFrames > 0) { this.hitstopFrames--; this.raf = requestAnimationFrame(tick); return; }
      this.interpolator.tick(delta, 1000 / 60);
      this.draw();
      this.drawMinimap();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private draw(): void {
    var ctx = this.ctx;
    var cx  = this.camX + this.shakeX;
    var cy  = this.camY + this.shakeY;
    // v0.1.15 - CSS pixels. canvas.width is now the device-pixel backing store
    //   and would double every clear and fill under the DPR transform.
    var W   = this.viewW;
    var H   = this.viewH;

    ctx.clearRect(0, 0, W, H);
    // DECISION: Background fill matches the arena perimeter/crowd dark tone.
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, W, H);

    // v0.1.16 - everything below this point draws in PRE-ZOOM space. The clear
    //   and the background fill above deliberately sit outside it, so they always
    //   cover the real viewport no matter how far out the player has pinched.
    ctx.save();
    ctx.scale(ZOOM, ZOOM);

    // ── MAP — flat billboard scaled to world bounding box ────
    // DECISION: Map is drawn as a simple scaled rectangle aligned to the
    //   projected bounding box of world(0,0)→(100,100).
    //   No diamond clip — the image itself provides the visual boundary.
    //   This is correct for semi-iso pre-rendered backgrounds.
    var mapImg = img('map');
    if (mapImg) {
      var tl = worldToScreen(0,   0,   cx, cy);
      var tr = worldToScreen(100, 0,   cx, cy);
      var bl = worldToScreen(0,   100, cx, cy);
      var br = worldToScreen(100, 100, cx, cy);
      var minX = Math.min(tl.x, tr.x, bl.x, br.x);
      var minY = Math.min(tl.y, tr.y, bl.y, br.y);
      var maxX = Math.max(tl.x, tr.x, bl.x, br.x);
      var maxY = Math.max(tl.y, tr.y, bl.y, br.y);

      // v0.1.18 - scale the image so its PAINTED diamond covers the world
      //   diamond, instead of assuming the painted diamond is the whole frame.
      //   If the art's arena spans 79% of the image width, the image is drawn
      //   1/0.79 times wider than the world box so the arena itself lines up.
      var worldW = maxX - minX;
      var worldH = maxY - minY;
      var drawW  = worldW / (2 * MAP_DIAMOND_HALF_W);
      var drawH  = worldH / (2 * MAP_DIAMOND_HALF_H);
      var drawX  = (minX + worldW / 2) - MAP_DIAMOND_CX * drawW;
      var drawY  = (minY + worldH / 2) - MAP_DIAMOND_CY * drawH;
      ctx.drawImage(mapImg, drawX, drawY, drawW, drawH);

      // Calibration overlay - the true world diamond and the four safe-node
      // anchors, so the art can be dialled in against real geometry, by eye,
      // once, instead of by re-rolling prompts.
      if (MAP_CAL_OVERLAY) {
        ctx.save();
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth   = 3;
        ctx.setLineDash([12, 8]);
        ctx.beginPath();
        ctx.moveTo(tl.x, tl.y);
        ctx.lineTo(tr.x, tr.y);
        ctx.lineTo(br.x, br.y);
        ctx.lineTo(bl.x, bl.y);
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#ff3b3b';
        [[20,20],[80,20],[80,80],[20,80],[50,50]].forEach(function(n) {
          var q = worldToScreen(n[0], n[1], cx, cy);
          ctx.beginPath();
          ctx.arc(q.x, q.y, 9, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();
      }
    }

    // ── NODES ────────────────────────────────────────────────
    NODES.forEach((node) => {
      var p    = worldToScreen(node.x, node.y, cx, cy);
      var key  = node.center ? 'centerRing' : node.hot ? 'hotNode' : 'safeNode';
      var size = node.center ? NODE_SIZE_CENTER : node.hot ? NODE_SIZE_HOT : NODE_SIZE_SAFE;
      var drawn = drawCentered(ctx, key, p.x, p.y, size, size);

      if (!drawn) {
        // Fallback diamond if sprite not loaded
        var fsz  = node.center ? 28 : 18;
        var fcol = node.center ? '#00e5ff' : node.hot ? '#f5c842' : '#8888aa';
        ctx.save();
        ctx.globalAlpha  = 0.85;
        ctx.fillStyle    = fcol;
        ctx.strokeStyle  = fcol;
        ctx.lineWidth    = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - fsz);
        ctx.lineTo(p.x + fsz * 1.6, p.y);
        ctx.lineTo(p.x, p.y + fsz);
        ctx.lineTo(p.x - fsz * 1.6, p.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.globalAlpha = 0.9;
      outlinedText(ctx,
        node.center ? 'CENTER' : node.hot ? 'HOT' : 'SAFE',
        p.x, p.y - (size / 2) - 6,
        node.center ? '#00e5ff' : node.hot ? '#f5c842' : '#8888aa', 9, true);
      ctx.restore();
    });

    drawBases(ctx, this.latestSnapshot, cx, cy, this.myPlayerId);

    // ── UNITS ────────────────────────────────────────────────
    // DECISION: Sort by ry so units further "down" the iso plane
    //   render on top of units further "up" — correct painter's order.
    var entities = this.interpolator.getEntities().slice().sort(function(a, b) {
      return (a.ry + a.rx) - (b.ry + b.rx);
    });
    entities.forEach((e) => {
      if (!e.isAlive) return;
      this.drawUnit(ctx, e, cx, cy);
    });

    // v0.1.16 - close the zoom transform HERE. Everything above is world space
    //   and scales with the pinch; the box-select rectangle below is a screen-space
    //   overlay built from raw pointer coordinates and must not be scaled twice.
    ctx.restore();

    // ── BOX SELECT ───────────────────────────────────────────
    var b = this.input.boxSelect;
    if (b.active) {
      var x1 = Math.min(b.startX, b.endX), y1 = Math.min(b.startY, b.endY);
      var bw = Math.abs(b.endX - b.startX), bh = Math.abs(b.endY - b.startY);
      ctx.save();
      ctx.strokeStyle  = '#00e5ff';
      ctx.lineWidth    = 1;
      ctx.globalAlpha  = 0.8;
      ctx.strokeRect(x1, y1, bw, bh);
      ctx.globalAlpha  = 0.05;
      ctx.fillStyle    = '#00e5ff';
      ctx.fillRect(x1, y1, bw, bh);
      ctx.restore();
    }
  }

  private drawUnit(ctx: CanvasRenderingContext2D, e: RenderEntity, cx: number, cy: number): void {
    var p      = worldToScreen(e.rx, e.ry, cx, cy);
    var color  = (e.playerId === this.myPlayerId) ? TEAM_C[0] : TEAM_C[1];
    var isOwn  = (e.playerId === this.myPlayerId);
    var sel    = this.input.isSelected(e.id);

    // DECISION: sprite width/height driven by CONFIG BLOCK constants (3x scale).
    var sw     = e.isTrainee ? TRAINEE_SW     : FIGHTER_SW;
    var sh     = e.isTrainee ? TRAINEE_SH     : FIGHTER_SH;
    var anchor = e.isTrainee ? TRAINEE_ANCHOR : FIGHTER_ANCHOR;
    var hitR   = e.isTrainee ? 18             : 28; // click/selection hit radius

    ctx.save();

    if (e.confidence < 0.3) ctx.globalAlpha = Math.random() > 0.25 ? 1 : 0.4;

    // Selection ring
    if (sel) {
      ctx.strokeStyle  = '#00e5ff';
      ctx.lineWidth    = 2;
      ctx.globalAlpha  = 0.85;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 6, sw * 0.55, sw * 0.22, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = e.confidence < 0.3 ? (Math.random() > 0.25 ? 1 : 0.4) : 1;
    }

    // Sprite key resolution
    // DECISION: trainees always use 'trainee' sprite.
    //   Fighters use discipline+tier key. Falls back to T1 key gracefully.
    var discKey: string;
    if (e.isTrainee) {
      discKey = 'trainee';
    } else {
      var tier      = (e as any).tier ?? 1;
      var base      = e.discipline ? e.discipline.toLowerCase() : '';
      var tieredKey = tier > 1 ? base + tier : base;
      discKey       = (ASSETS[tieredKey] && ASSETS[tieredKey].loaded) ? tieredKey : base;
    }

    var drawn = drawCentered(ctx, discKey, p.x, p.y - anchor, sw, sh);

    if (!drawn) {
      // Fallback shape
      ctx.fillStyle   = color;
      ctx.strokeStyle = color;
      ctx.lineWidth   = 1.5;
      if (e.isTrainee) {
        ctx.beginPath(); ctx.arc(p.x, p.y, hitR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - hitR);
        ctx.lineTo(p.x + hitR * 1.3, p.y);
        ctx.lineTo(p.x, p.y + hitR);
        ctx.lineTo(p.x - hitR * 1.3, p.y);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }

    // Ground dot
    ctx.fillStyle   = color;
    ctx.shadowColor = color;
    ctx.shadowBlur  = isOwn ? 8 : 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y + (e.isTrainee ? 12 : 18), 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Proc indicators
    e.activeProcs.forEach(function(proc, i) {
      var pc = proc === 'BLEED' ? '#ff3b3b' : proc === 'RAGE' ? '#f5c842' : '#9d7fff';
      ctx.fillStyle = pc;
      ctx.beginPath();
      ctx.arc(p.x - sw * 0.3 + i * 9, p.y - anchor - sh * 0.1, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // HP bar — scaled with sprite width
    if (!e.isTrainee) {
      var hpPct = e.hp / Math.max(1, e.maxHp);
      var barW  = sw * 0.85;
      var barH  = 5;
      var barY  = p.y - anchor - sh * 0.56;
      ctx.fillStyle = '#22223a';
      ctx.fillRect(p.x - barW / 2, barY, barW, barH);
      ctx.fillStyle = hpPct > 0.5 ? '#00e5ff' : hpPct > 0.25 ? '#f5c842' : '#ff3b3b';
      ctx.fillRect(p.x - barW / 2, barY, barW * hpPct, barH);

      // Career letter
      outlinedText(ctx, CAREER_LETTER[e.careerState] ?? '?', p.x, barY - 4, color, 10, true);
    }

    ctx.restore();
  }

  // ── CANVAS SIZING — v0.1.15 ─────────────────────────────────
  // DECISION: backing store = CSS size x devicePixelRatio, then the context is
  //   scaled by the same factor, so every existing draw call keeps speaking in
  //   CSS pixels and no call site had to change. Assigning canvas.width resets
  //   all context state, so setTransform must follow it every time - that is
  //   why this lives in one method instead of being inlined at both call sites.
  // DECISION: dpr is capped at 3. Some Android devices report 3.5-4, which at
  //   a 2400px-wide viewport is a 9600px backing store - the fill rate collapses
  //   for detail no screen can resolve.
  private syncCanvasSize(): void {
    this.dpr   = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    this.viewW = window.innerWidth;
    this.viewH = window.innerHeight;
    this.canvas.width  = Math.round(this.viewW * this.dpr);
    this.canvas.height = Math.round(this.viewH * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  private drawMinimap(): void {
    if (!this.mmCtx || !this.mmCanvas) return;
    var mc  = this.mmCtx;
    // v0.1.15 - the minimap backing store tracked CSS size but not DPR, so the
    //   node and unit dots were resampled up and smeared on any HiDPI screen.
    var mmW = this.mmCanvas.offsetWidth  || 110;
    var mmH = this.mmCanvas.offsetHeight || 70;
    this.mmCanvas.width  = Math.round(mmW * this.dpr);
    this.mmCanvas.height = Math.round(mmH * this.dpr);
    mc.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    mc.clearRect(0, 0, mmW, mmH);
    mc.fillStyle = '#0a0a14';
    mc.fillRect(0, 0, mmW, mmH);

    var sx = mmW / 100, sy = mmH / 100;

    NODES.forEach(function(n) {
      mc.fillStyle = n.center ? '#00e5ff' : n.hot ? '#f5c842' : '#555577';
      mc.fillRect(n.x * sx - 2, n.y * sy - 2, 4, 4);
    });

    this.interpolator.getEntities().forEach((e) => {
      if (!e.isAlive) return;
      mc.fillStyle = (e.playerId === this.myPlayerId) ? TEAM_C[0] : TEAM_C[1];
      var ds = e.isTrainee ? 2 : 3;
      mc.fillRect(e.rx * sx - ds / 2, e.ry * sy - ds / 2, ds, ds);
    });

    if (this.latestSnapshot?.players) {
      Object.keys(this.latestSnapshot.players).forEach((pid, idx) => {
        var bp = this.latestSnapshot.players[pid].basePosition;
        if (!bp) return;
        mc.strokeStyle = idx === 0 ? TEAM_C[0] : TEAM_C[1];
        mc.lineWidth   = 1;
        mc.strokeRect(bp.x * sx - 5, bp.y * sy - 5, 10, 10);
      });
    }

    mc.strokeStyle = 'rgba(255,255,255,0.15)';
    mc.lineWidth   = 1;
    mc.strokeRect(0, 0, mmW, mmH);
  }

  // Returns playerId of base clicked, or null
  // DECISION: hit radius scales with BASE_SPRITE_SIZE
  // v0.1.16 - sx/sy arrive as raw screen pixels but worldToScreen returns pre-zoom
  //   coordinates, so every hit test divides by ZOOM first. Without this, pinching
  //   out makes every unit and base unclickable except near the top-left corner.
  private getBaseAt(sxRaw: number, syRaw: number): string | null {
    if (!this.latestSnapshot?.players) return null;
    var sx = sxRaw / ZOOM, sy = syRaw / ZOOM;
    var found: string | null = null;
    Object.keys(this.latestSnapshot.players).forEach((pid) => {
      var bp = this.latestSnapshot.players[pid].basePosition;
      if (!bp) return;
      var sc = worldToScreen(bp.x, bp.y, this.camX, this.camY);
      var dx = sx - sc.x, dy = sy - sc.y;
      if (Math.sqrt(dx * dx + dy * dy) < BASE_SPRITE_SIZE * 0.6) found = pid;
    });
    return found;
  }

  private getUnitAt(sxRaw: number, syRaw: number): string | null {
    var sx = sxRaw / ZOOM, sy = syRaw / ZOOM;
    for (var e of this.interpolator.getEntities()) {
      if (!e.isAlive) continue;
      var p  = worldToScreen(e.rx, e.ry, this.camX, this.camY);
      var dx = sx - p.x, dy = sy - p.y;
      if (Math.sqrt(dx * dx + dy * dy) < (e.isTrainee ? 18 : 28)) return e.id;
    }
    return null;
  }

  private getUnitsInBox(x1Raw: number, y1Raw: number, x2Raw: number, y2Raw: number): string[] {
    var x1 = x1Raw / ZOOM, y1 = y1Raw / ZOOM, x2 = x2Raw / ZOOM, y2 = y2Raw / ZOOM;
    return this.interpolator.getEntities().filter((e) => {
      if (!e.isAlive) return false;
      var p = worldToScreen(e.rx, e.ry, this.camX, this.camY);
      return p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2;
    }).map((e) => e.id);
  }

  triggerHitstop(durationS: number): void {
    this.hitstopFrames = Math.round(durationS * 60);
  }

  triggerShake(intensity: number, frames: number): void {
    this.shakeFrames = frames;
    this.shakeX      = (Math.random() - 0.5) * intensity * 8;
    this.shakeY      = (Math.random() - 0.5) * intensity * 8;
  }

  getSelectedIds(): Set<string> { return this.input.selectedUnitIds; }
}
