// v0.1.11 — Trainer command panel, TRAIN_T1_FIGHTER/TRAIN_T2_FIGHTER commands,
//            fighter_ready flash notification, training queue in economy panel,
//            node exclusivity passive (server-side — no client changes needed)
/* ===== LAST STABLE: v0.1.10 — trainee build panel, Tech Refinery, Trainer build ===== */

import { io, Socket } from "socket.io-client";
import { Interpolator } from "./interpolation";
import { GameRenderer, worldToScreen } from "./game";
import { updateHUD, updatePortraits, showCommentaryLine, spawnDamageNumber, setStatus, showGame } from "./ui";
import { disciplineTierSprite } from "@fist/shared";

var SERVER_URL       = "http://localhost:3001";
var MATCH_DURATION_S = 600;
var socket:      Socket | null       = null;
var renderer:    GameRenderer | null = null;
var interpolator = new Interpolator();
var myPlayerId   = "";
var myDiscipline = "";
var lastSnapshot: any = null;

var selectedTraineeId: string | null = null;

// ── GLOBAL STUBS ──────────────────────────────────────────────
(window as any).openMenu   = function() { console.log('Menu'); };
(window as any).openLog    = function() { console.log('Log'); };
(window as any).issueCmd   = function(cmd: string) { console.log('CMD:', cmd); };
(window as any).useAbility = function(slot: number) { console.log('Ability:', slot); };

// ── BASE COMMAND HANDLERS ─────────────────────────────────────

(window as any).cmdRecruitTrainee = function() {
  if (!socket||!myPlayerId) return;
  socket.emit('command', { type: 'MOVE', unitId: myPlayerId, metaType: 'RECRUIT_TRAINEE', timestamp: Date.now() });
};

(window as any).cmdUpgradeBase = function() {
  if (!socket||!myPlayerId) return;
  socket.emit('command', { type: 'MOVE', unitId: myPlayerId, metaType: 'UPGRADE_BASE', timestamp: Date.now() });
};

(window as any).cmdBuildCookout = function() {
  if (!socket||!myPlayerId) return;
  socket.emit('command', { type: 'MOVE', unitId: myPlayerId, metaType: 'BUILD_COOKOUT', timestamp: Date.now() });
};

(window as any).cmdBuildTechRefinery = function() {
  if (!socket||!myPlayerId) return;
  socket.emit('command', { type: 'MOVE', unitId: myPlayerId, metaType: 'BUILD_TECH_REFINERY', timestamp: Date.now() });
};

(window as any).cmdBuildTrainer = function() {
  if (!socket||!myPlayerId) return;
  socket.emit('command', { type: 'MOVE', unitId: myPlayerId, metaType: 'BUILD_TRAINER', timestamp: Date.now() });
};

// v0.1.11 — fighter training commands
(window as any).cmdTrainT1Fighter = function() {
  if (!socket||!myPlayerId) return;
  socket.emit('command', { type: 'MOVE', unitId: myPlayerId, metaType: 'TRAIN_T1_FIGHTER', timestamp: Date.now() });
};

(window as any).cmdTrainT2Fighter = function() {
  if (!socket||!myPlayerId) return;
  socket.emit('command', { type: 'MOVE', unitId: myPlayerId, metaType: 'TRAIN_T2_FIGHTER', timestamp: Date.now() });
};

// ── TRAINEE BUILD PANEL ───────────────────────────────────────

(window as any).cmdOpenTraineeBuildPanel = function(traineeId: string) {
  selectedTraineeId = traineeId;
  var panel = document.getElementById('trainee-build-panel');
  if (!panel) return;
  panel.style.display = 'flex';
  if (lastSnapshot) {
    var p = lastSnapshot.players?.[myPlayerId];
    if (p) updateTraineeBuildPanel(p);
  }
};

(window as any).cmdCloseTraineeBuildPanel = function() {
  selectedTraineeId = null;
  var panel = document.getElementById('trainee-build-panel');
  if (panel) panel.style.display = 'none';
};

function updateTraineeBuildPanel(playerSnap: any): void {
  var panel = document.getElementById('trainee-build-panel');
  if (!panel || panel.style.display === 'none') return;

  var bling    = playerSnap?.bling      ?? 0;
  var hype     = playerSnap?.hype       ?? 0;
  var level    = playerSnap?.baseLevel  ?? 1;
  var buildings: Array<{type:string}> = playerSnap?.buildings ?? [];
  var queue: Array<{buildingType:string}> = playerSnap?.constructionQueue ?? [];

  var has    = function(t: string) { return buildings.some(function(b: any) { return b.type === t; }); };
  var inQueue = function(t: string) { return queue.some(function(j: any) { return j.buildingType === t; }); };

  // Tech Refinery button
  var refineryBtn = document.getElementById('tbtn-tech-refinery') as HTMLButtonElement;
  var refineryLbl = document.getElementById('tbtn-tech-refinery-lbl');
  if (refineryBtn) {
    var refineryDone   = has('tech_refinery');
    var refineryQueued = inQueue('tech_refinery');
    var refineryBlock  = level < 2          ? 'Requires T2 Base'
                       : bling < 450        ? 'Need 450¤'
                       : refineryDone       ? 'Already built'
                       : refineryQueued     ? 'In queue...'
                       : null;
    refineryBtn.disabled = !!refineryBlock;
    refineryBtn.style.opacity = (refineryDone || refineryQueued) ? '0.4' : '1';
    if (refineryLbl) {
      refineryLbl.textContent = refineryDone   ? '✓ Tech Refinery'
                              : refineryQueued ? '⏳ Building...'
                              : 'Tech Refinery (450¤)';
    }
    refineryBtn.title = refineryBlock ?? 'Build Tech Refinery — unlocks upgrades';
  }

  // Trainer button
  var trainerBtn = document.getElementById('tbtn-trainer') as HTMLButtonElement;
  var trainerLbl = document.getElementById('tbtn-trainer-lbl');
  if (trainerBtn) {
    var trainerDone   = has('trainer');
    var trainerQueued = inQueue('trainer');
    var trainerBlock  = trainerDone   ? 'Already built'
                      : trainerQueued ? 'In queue...'
                      : null;
    trainerBtn.disabled = !!trainerBlock;
    trainerBtn.style.opacity = (trainerDone || trainerQueued) ? '0.4' : '1';
    if (trainerLbl) {
      trainerLbl.textContent = trainerDone   ? '✓ Trainer'
                             : trainerQueued ? '⏳ Building...'
                             : 'Trainer (free, 25s)';
    }
    trainerBtn.title = trainerBlock ?? 'Build Trainer — trains T1/T2 fighters';
  }
}

// ── TRAINER COMMAND PANEL — v0.1.11 ──────────────────────────
// Shown when player clicks the Trainer building (via base panel button).
// DECISION: Trainer panel is a third panel level — above trainee build panel.
//   Accessible via "Train Fighters" button in the base command panel
//   once Trainer is built. Clicking it toggles the trainer panel.

(window as any).cmdOpenTrainerPanel = function() {
  var panel = document.getElementById('trainer-panel');
  if (!panel) return;
  var isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'flex';
  if (!isOpen && lastSnapshot) {
    var p = lastSnapshot.players?.[myPlayerId];
    if (p) updateTrainerPanel(p);
  }
};

(window as any).cmdCloseTrainerPanel = function() {
  var panel = document.getElementById('trainer-panel');
  if (panel) panel.style.display = 'none';
};

function updateTrainerPanel(playerSnap: any): void {
  var panel = document.getElementById('trainer-panel');
  if (!panel || panel.style.display === 'none') return;

  var bling    = playerSnap?.bling     ?? 0;
  var hype     = playerSnap?.hype      ?? 0;
  var level    = playerSnap?.baseLevel ?? 1;
  var buildings: Array<{type:string}> = playerSnap?.buildings ?? [];
  var tQueue: Array<any> = playerSnap?.trainingQueue ?? [];

  var has         = function(t: string) { return buildings.some(function(b: any) { return b.type === t; }); };
  var hasTrainer  = has('trainer');
  var trainingT1  = tQueue.some(function(j: any) { return j.tier === 1; });
  var trainingT2  = tQueue.some(function(j: any) { return j.tier === 2; });

  // T1 Fighter button: 200 Bling, needs Trainer
  var t1Btn = document.getElementById('train-t1-btn') as HTMLButtonElement;
  var t1Lbl = document.getElementById('train-t1-lbl');
  if (t1Btn) {
    var t1Block = !hasTrainer        ? 'Build Trainer first'
                : bling < 200        ? 'Need 200¤'
                : null;
    t1Btn.disabled      = !!t1Block;
    t1Btn.style.opacity = !hasTrainer ? '0.4' : '1';
    if (t1Lbl) t1Lbl.textContent = trainingT1 ? '⏳ Training T1...' : 'Train T1 Fighter (200¤, 12s)';
    t1Btn.title = t1Block ?? 'Train T1 ' + (myDiscipline || 'Fighter') + ' (200¤, 12s)';
  }

  // T2 Fighter button: 350 Bling + 50 Hype, needs Trainer + T2 base
  var t2Btn = document.getElementById('train-t2-btn') as HTMLButtonElement;
  var t2Lbl = document.getElementById('train-t2-lbl');
  if (t2Btn) {
    var t2Block = !hasTrainer        ? 'Build Trainer first'
                : level < 2          ? 'Requires T2 Base'
                : bling < 350        ? 'Need 350¤'
                : hype  < 50         ? 'Need 50 Hype'
                : null;
    t2Btn.disabled      = !!t2Block;
    t2Btn.style.opacity = (!hasTrainer || level < 2) ? '0.4' : '1';
    if (t2Lbl) t2Lbl.textContent = trainingT2 ? '⏳ Training T2...' : 'Train T2 Fighter (350¤ + 50⚡, 20s)';
    t2Btn.title = t2Block ?? 'Train T2 ' + (myDiscipline || 'Fighter') + ' (350¤ + 50 Hype, 20s)';
  }

  // Training queue display
  var tqEl = document.getElementById('trainer-queue-display');
  if (tqEl) {
    if (tQueue.length === 0) {
      tqEl.innerHTML = '<span style="font-size:8px;color:#333355;letter-spacing:1px;">Queue empty</span>';
    } else {
      tqEl.innerHTML = '';
      tQueue.forEach(function(job: any, idx: number) {
        var pct  = Math.round((1 - job.timeRemaining / job.timeTotal) * 100);
        var item = document.createElement('div');
        item.style.cssText = 'font-size:8px;color:#8888aa;letter-spacing:1px;margin-bottom:3px;' + (idx > 0 ? 'opacity:0.5;' : '');
        item.innerHTML =
          '<div style="display:flex;justify-content:space-between;">' +
          '<span>T' + job.tier + ' ' + (job.discipline || '') + '</span>' +
          '<span style="color:#00e5ff;">' + pct + '%</span></div>' +
          '<div style="width:100%;height:3px;background:#1a1a2e;border-radius:2px;overflow:hidden;margin-top:2px;">' +
          '<div style="width:' + pct + '%;height:100%;background:#00e5ff;border-radius:2px;transition:width 0.1s;"></div></div>';
        tqEl!.appendChild(item);
      });
    }
  }
}

// ── BASE PANEL ────────────────────────────────────────────────

(window as any).__onBaseSelected = function(baseId: string, playerSnap: any) {
  if (baseId !== myPlayerId) return;
  updateBasePanel(playerSnap);
};

function updateBasePanel(playerSnap: any): void {
  var panel = document.getElementById('base-cmd-panel');
  if (!panel) return;
  panel.style.display = 'flex';

  var level    = playerSnap?.baseLevel ?? 1;
  var bling    = playerSnap?.bling     ?? 0;
  var food     = playerSnap?.food      ?? 0;
  var foodCap  = playerSnap?.foodCap   ?? 5;
  var buildings: Array<{type:string}> = playerSnap?.buildings ?? [];
  var queue: Array<{buildingType:string}> = playerSnap?.constructionQueue ?? [];
  var has     = function(t: string) { return buildings.some(function(b: any){ return b.type === t; }); };
  var inQueue = function(t: string) { return queue.some(function(j: any){ return j.buildingType === t; }); };

  var recruitBtn  = document.getElementById('btn-recruit-trainee')  as HTMLButtonElement;
  var upgradeBtn  = document.getElementById('btn-upgrade-base')      as HTMLButtonElement;
  var cookoutBtn  = document.getElementById('btn-build-cookout')     as HTMLButtonElement;
  var trainBtn    = document.getElementById('btn-open-trainer')      as HTMLButtonElement;
  var baseLevelEl = document.getElementById('base-panel-level');

  if (baseLevelEl) baseLevelEl.textContent = 'T'+level+' Base';

  if (recruitBtn){
    var canRecruit = bling >= 70 && food < foodCap;
    recruitBtn.disabled = !canRecruit;
    recruitBtn.title    = canRecruit ? 'Recruit Trainee (70¤)' : (food>=foodCap ? 'Food cap reached' : 'Need 70¤');
  }
  if (upgradeBtn){
    var canUpgrade = bling >= 400 && level < 2;
    upgradeBtn.disabled      = !canUpgrade;
    upgradeBtn.style.opacity = level >= 2 ? '0.4' : '1';
    upgradeBtn.title         = level>=2 ? 'Already upgraded' : canUpgrade ? 'Upgrade Base (400¤)' : 'Need 400¤';
  }
  if (cookoutBtn){
    var canCookout = bling >= 200 && level >= 2;
    cookoutBtn.disabled      = !canCookout;
    cookoutBtn.style.opacity = level < 2 ? '0.4' : '1';
    cookoutBtn.title         = level<2 ? 'Unlock at T2 base' : canCookout ? 'Build Cookout (200¤)' : 'Need 200¤';
  }

  // Train Fighters button — only shows if Trainer is built
  if (trainBtn) {
    var trainerBuilt = has('trainer');
    trainBtn.style.display  = trainerBuilt ? 'block' : 'none';
    trainBtn.title          = 'Open Trainer — train T1/T2 fighters';
  }
}

// ── JOIN / SOCKET ─────────────────────────────────────────────

(window as any).joinGame = function(discipline: string) {
  myDiscipline = discipline;
  setStatus("Connecting...");
  socket = io(SERVER_URL, { transports: ["websocket"] });

  socket.on("connect", () => {
    setStatus("Connected. Joining as " + discipline + "...");
    socket!.emit("join", { discipline });
  });

  socket.on("joined", (data: any) => {
    myPlayerId = data.playerId;
    setStatus(data.waitingFor > 0
      ? "Waiting for " + data.waitingFor + " more player(s)..."
      : "Match starting...");
  });

  socket.on("match_start", (data: any) => {
    MATCH_DURATION_S = data.matchDurationS ?? 600;
    startGame();
  });

  socket.on("snapshot", (snap: any) => {
    lastSnapshot = snap;
    if (renderer) renderer.latestSnapshot = snap;
    interpolator.applySnapshot(snap.entities ?? []);
    (snap.events ?? []).forEach((ev: any) => handleEvent(ev));
  });

  socket.on("connect_error", (err: any) => {
    setStatus("Cannot connect: " + err.message);
  });
};

function startGame(): void {
  showGame();
  var container = document.getElementById("game-container")!;
  renderer = new GameRenderer(container, interpolator, myDiscipline);
  renderer.setPlayerId(myPlayerId);
  (window as any).__sendCommand = (cmd: any) => socket?.emit("command", cmd);

  (window as any).__onTraineeSelected = function(entityId: string) {
    (window as any).cmdOpenTraineeBuildPanel(entityId);
  };

  setInterval(updateUI, 33);
}

function handleEvent(ev: any): void {
  if (ev.type === "unit_kill" || ev.type === "crit_hit") {
    var ent = interpolator.getEntity(ev.targetId);
    if (ent) {
      var sp = worldToScreen(ent.rx, ent.ry, window.innerWidth/2, window.innerHeight/2-80);
      spawnDamageNumber(sp.x, sp.y-20, ev.value??0, ev.type==="crit_hit");
    }
    renderer?.triggerHitstop(ev.type==="unit_kill"?0.2:0.06);
    renderer?.triggerShake(ev.type==="unit_kill"?1.2:0.3, ev.type==="unit_kill"?20:5);
  }

  // Construction complete flash
  if (ev.type === "construction_complete" && ev.sourceId === myPlayerId) {
    showStatusFlash('✓ ' + (ev.data?.displayName ?? 'Building') + ' complete!', '#00c878');
  }

  // Fighter ready flash — v0.1.11
  if (ev.type === "fighter_ready" && ev.sourceId === myPlayerId) {
    var tier = ev.data?.tier ?? '?';
    var disc = ev.data?.discipline ?? myDiscipline;
    showStatusFlash('🥊 T' + tier + ' ' + disc + ' ready!', '#f5c842');
  }

  if (ev.commentary){
    showCommentaryLine(ev.commentary.text, ev.commentary.voice, ev.commentary.isViralClip, ev.commentary.clipCaption);
  }
}

// ── STATUS FLASH ──────────────────────────────────────────────
// Replaces showConstructionFlash — now handles any flash with custom color.
function showStatusFlash(message: string, color: string): void {
  var existing = document.getElementById('status-flash');
  if (existing) existing.remove();

  var el = document.createElement('div');
  el.id = 'status-flash';
  el.textContent = message;
  el.style.cssText = [
    'position:fixed', 'top:60px', 'right:16px', 'z-index:9999',
    'background:rgba(8,8,14,0.96)',
    'color:' + color,
    'font-family:"Share Tech Mono","Courier New",monospace',
    'font-size:13px', 'font-weight:700',
    'padding:8px 14px', 'border-radius:4px',
    'border:1px solid ' + color,
    'box-shadow:0 0 12px ' + color + '44',
    'pointer-events:none',
    'animation:flash-in 0.15s ease-out',
  ].join(';');

  if (!document.getElementById('flash-style')) {
    var style = document.createElement('style');
    style.id = 'flash-style';
    style.textContent = '@keyframes flash-in{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}';
    document.head.appendChild(style);
  }

  document.body.appendChild(el);
  setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 3000);
}

// ── UI UPDATE LOOP (33ms) ─────────────────────────────────────

function updateUI(): void {
  if (!lastSnapshot) return;
  var p = lastSnapshot.players?.[myPlayerId];
  if (!p) return;

  var elapsed   = lastSnapshot.matchElapsedS ?? 0;
  var remaining = Math.max(0, MATCH_DURATION_S - elapsed);
  var mins = Math.floor(remaining/60), secs = Math.floor(remaining%60);
  var clockEl = document.getElementById('hud-clock');
  if (clockEl) clockEl.textContent = mins+':'+(secs<10?'0':'')+secs;

  var blingEl = document.getElementById('hud-bling');
  var hypeEl  = document.getElementById('hud-hype');
  var foodEl  = document.getElementById('hud-food');
  var ctEl    = document.getElementById('hud-center-time');
  if (blingEl) blingEl.textContent = String(Math.floor(p.bling??0));
  if (hypeEl)  hypeEl.textContent  = String(Math.floor(p.hype??0));
  if (foodEl)  foodEl.textContent  = (p.food??0)+'/'+(p.foodCap??5);
  if (ctEl)    ctEl.textContent    = (p.totalCenterTimeS??0).toFixed(1)+'s';

  var treasuryEl = document.getElementById('econ-treasury');
  var baseHpEl   = document.getElementById('econ-base-hp');
  if (treasuryEl) treasuryEl.textContent = String(Math.floor(p.baseTreasury??0));
  if (baseHpEl)   baseHpEl.textContent   = String(Math.floor(p.baseHp??500));

  // Construction queue
  var qEl = document.getElementById('build-queue');
  if (qEl && p.constructionQueue) {
    if (p.constructionQueue.length === 0) {
      qEl.innerHTML = '<div class="build-item" style="color:#333355">No construction</div>';
    } else {
      qEl.innerHTML = '';
      p.constructionQueue.forEach(function(job: any, idx: number) {
        var pct  = Math.round((1 - job.timeRemaining / job.timeTotal) * 100);
        var item = document.createElement('div');
        item.className = 'build-item';
        item.style.cssText = idx > 0 ? 'opacity:0.5;' : '';
        item.innerHTML =
          '<div class="build-item-row"><span>' + (job.type||'Building') + '</span>' +
          '<span class="build-pct">' + pct + '%</span></div>' +
          '<div class="build-bar-track"><div class="build-bar-fill" style="width:' + pct + '%;"></div></div>';
        qEl!.appendChild(item);
      });
    }
  }

  // Training queue in economy panel — v0.1.11
  var tqDisplayEl = document.getElementById('training-queue-display');
  if (tqDisplayEl && p.trainingQueue) {
    if (p.trainingQueue.length === 0) {
      tqDisplayEl.innerHTML = '';
      tqDisplayEl.style.display = 'none';
    } else {
      tqDisplayEl.style.display = 'block';
      tqDisplayEl.innerHTML = '';
      p.trainingQueue.forEach(function(job: any, idx: number) {
        var pct  = Math.round((1 - job.timeRemaining / job.timeTotal) * 100);
        var item = document.createElement('div');
        item.className = 'build-item';
        item.style.cssText = idx > 0 ? 'opacity:0.5;' : '';
        item.innerHTML =
          '<div class="build-item-row">' +
          '<span>T' + job.tier + ' ' + (job.discipline||'') + '</span>' +
          '<span class="build-pct">' + pct + '%</span></div>' +
          '<div class="build-bar-track"><div class="build-bar-fill" style="width:' + pct + '%;background:#f5c842;"></div></div>';
        tqDisplayEl!.appendChild(item);
      });
    }
  }

  // Keep panels live if open
  var basePanel = document.getElementById('base-cmd-panel');
  if (basePanel && basePanel.style.display !== 'none') updateBasePanel(p);
  updateTraineeBuildPanel(p);
  updateTrainerPanel(p);

  // Portraits
  var sel = renderer?.getSelectedIds() ?? new Set<string>();
  updatePortraits(
    interpolator.getEntities().map((e) => ({
      id:e.id, hp:e.hp, maxHp:e.maxHp, careerState:e.careerState,
      isHarvesting:e.isHarvesting, isAlive:e.isAlive,
    })),
    sel, myDiscipline,
    (id: string) => { sel.clear(); sel.add(id); }
  );
}
