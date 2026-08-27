// BOOT ORDER: loaded by main.ts
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
   Buildings T2: localGym.png, theMats.png, biggerYard.png, theAcademy.png, theLaboratory.png
   Economy:      cookout.png, techRefinery.png
   Barracks:     trainer.png, coach.png, phoneBooth.png
   Misc:         logo.png
===== END MANIFEST ===== */

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
  theMats:        loadImg('/assets/theMats.png'),
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
    ctx.save();
    ctx.fillStyle  = color;
    ctx.font       = 'bold 11px "Share Tech Mono","Courier New",monospace';
    ctx.textAlign  = 'center';
    ctx.shadowColor = color;
    ctx.shadowBlur  = 8;
    ctx.fillText(pid === myId ? 'YOUR BASE' : 'ENEMY BASE', sc.x, sc.y - (BASE_SPRITE_SIZE * 0.6));
    ctx.restore();

    // Base building sprite — BASE_SPRITE_SIZE
    drawCentered(ctx, sprKey, sc.x, sc.y, BASE_SPRITE_SIZE, BASE_SPRITE_SIZE);

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
    ctx.fillStyle = '#f5c842';
    ctx.font      = '9px "Share Tech Mono","Courier New",monospace';
    ctx.textAlign = 'center';
    ctx.fillText('\u00a4' + Math.floor(player.baseTreasury || 0), sc.x, by + bh + 11);

    // Level badge
    ctx.fillStyle = level >= 2 ? '#f5c842' : '#8888aa';
    ctx.font      = 'bold 9px "Share Tech Mono","Courier New",monospace';
    ctx.fillText('T' + level, sc.x + (BASE_SPRITE_SIZE * 0.4), sc.y - (BASE_SPRITE_SIZE * 0.6));
  });
}

export class GameRenderer {
  private canvas:         HTMLCanvasElement;
  private ctx:            CanvasRenderingContext2D;
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
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2;';
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;

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

    window.addEventListener('resize', () => {
      this.canvas.width  = window.innerWidth;
      this.canvas.height = window.innerHeight;
    });

    this.input = new InputHandler(
      this.canvas,
      (cmd)        => { (window as any).__sendCommand?.(cmd); },
      (x, y)       => this.getUnitAt(x, y),
      (x1,y1,x2,y2) => this.getUnitsInBox(x1,y1,x2,y2),
      (x, y)       => screenToWorld(x, y, this.camX, this.camY)
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
      if (e.button === 1) { dragging = true; dragX = e.clientX - this.camX; dragY = e.clientY - this.camY; }
    });
    this.canvas.addEventListener('mousemove', (e) => {
      if (dragging) { this.camX = e.clientX - dragX; this.camY = e.clientY - dragY; }
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
      if (this.keys['w'] || this.keys['ArrowUp'])    this.camY += CAM_SCROLL_SPD;
      if (this.keys['s'] || this.keys['ArrowDown'])  this.camY -= CAM_SCROLL_SPD;
      if (this.keys['a'] || this.keys['ArrowLeft'])  this.camX += CAM_SCROLL_SPD;
      if (this.keys['d'] || this.keys['ArrowRight']) this.camX -= CAM_SCROLL_SPD;
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
    var W   = this.canvas.width;
    var H   = this.canvas.height;

    ctx.clearRect(0, 0, W, H);
    // DECISION: Background fill matches the arena perimeter/crowd dark tone.
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, W, H);

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
      ctx.drawImage(mapImg, minX, minY, maxX - minX, maxY - minY);
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
      ctx.fillStyle   = node.center ? '#00e5ff' : node.hot ? '#f5c842' : '#8888aa';
      ctx.font        = 'bold 9px "Share Tech Mono","Courier New",monospace';
      ctx.textAlign   = 'center';
      ctx.fillText(
        node.center ? 'CENTER' : node.hot ? 'HOT' : 'SAFE',
        p.x,
        p.y - (size / 2) - 6
      );
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
      ctx.fillStyle = color;
      ctx.font      = 'bold 10px "Share Tech Mono","Courier New",monospace';
      ctx.textAlign = 'center';
      ctx.fillText(CAREER_LETTER[e.careerState] ?? '?', p.x, barY - 4);
    }

    ctx.restore();
  }

  private drawMinimap(): void {
    if (!this.mmCtx || !this.mmCanvas) return;
    var mc  = this.mmCtx;
    var mmW = this.mmCanvas.width  = this.mmCanvas.offsetWidth  || 110;
    var mmH = this.mmCanvas.height = this.mmCanvas.offsetHeight || 70;
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
  private getBaseAt(sx: number, sy: number): string | null {
    if (!this.latestSnapshot?.players) return null;
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

  private getUnitAt(sx: number, sy: number): string | null {
    for (var e of this.interpolator.getEntities()) {
      if (!e.isAlive) continue;
      var p  = worldToScreen(e.rx, e.ry, this.camX, this.camY);
      var dx = sx - p.x, dy = sy - p.y;
      if (Math.sqrt(dx * dx + dy * dy) < (e.isTrainee ? 18 : 28)) return e.id;
    }
    return null;
  }

  private getUnitsInBox(x1: number, y1: number, x2: number, y2: number): string[] {
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
