// v0.1.14a — Repairs from the six-verifier adversarial review of v0.1.14.
//            Recruit Trainee now gates on the live roster recount, the five advanced
//            construction routes gained a trainee-independent opener, the panel stack
//            was re-spaced so a wrapped row cannot cover the row above it, and the
//            '' vs 'none' display guards were made consistent across all four panels.
// v0.1.14 — Full v0.1.13 command reach: the ten metaType routes the server has
//            accepted since v0.1.13 but that no button emitted are now wired,
//            each pre-gated client-side against the server's own conditions.
// v0.1.17 — LEGIBILITY + REACHABILITY. Every sub-4.5:1 text colour raised, and a
//            permanent Build button added to the top HUD. The build tree was only
//            reachable by clicking the base sprite, with no affordance anywhere.
// v0.1.11 — Trainer command panel, TRAIN_T1_FIGHTER/TRAIN_T2_FIGHTER commands,
//            fighter_ready flash notification, training queue in economy panel,
//            node exclusivity passive.
/* ===== LAST STABLE: v0.1.11 — trainer panel, T1/T2 training, trainee build panel ===== */
//
// ============================================================
// CHANGE LOG — v0.1.14a
// ============================================================
// FIXED — #btn-recruit-trainee gated on the stale snapshot `food` field while the
//         server gates on canAffordRosterSlots (state.ts:310), a LIVE recount of the
//         player's alive entities. refundRosterSlots (state.ts:296) writes
//         food = max(0, getRosterSlotsUsed() - refund) AFTER resolver.ts has already
//         cleared isAlive, so it subtracts the dead unit's tier cost a second time and
//         the client read free slots the server did not have. The click emitted
//         RECRUIT_TRAINEE, recruitTrainee returned false, loop.ts discarded the
//         boolean, and nothing happened — no event, no snapshot change, no reason.
//         It is the worst button in the client to get wrong: the trainee build panel
//         opens only from a live scout, so this is the way back to every build route.
//         It now uses rosterBlockReason(), which reproduces the server's recount.
// FIXED — the HUD food readout printed that same stale field while the train buttons
//         printed the live recount, so one frame could show `Food 3/5` beside
//         `Roster full — 4/5 used`. The HUD now quotes the recount too.
// FIXED — the five advanced construction routes were reachable ONLY from
//         #tbtn-advanced inside #trainee-build-panel, which opens solely from clicking
//         one of your own live scouts (game.ts:361-367). buildCoach, buildMediaStudio,
//         buildRecoveryCenter, buildChampionshipOffice and buildPhoneBooth read no
//         entities at all, so a player with no surviving scout — the exact state in
//         which a Recovery Center or a Coaching Institute is what you want — could not
//         emit any of the five. ADDED window.cmdOpenAdvancedBuildPanelStandalone and
//         #btn-open-advanced in the ECONOMY panel, which needs no unit and no base
//         click. The panel now records which opener raised it, so the trainee panel's
//         close path (including the canvas empty-click) no longer takes down a panel
//         the economy opener put up.
// FIXED — setButtonState wrote inline opacity '1' on buttons it also set disabled, and
//         an inline style beats .build-cmd-btn:disabled{opacity:0.35}, so every
//         cost-blocked button painted identically to a live one. Three states now:
//         structural 0.4, blocked-on-cost 0.7, available 1 — applied to the advanced
//         buttons, the five train buttons, Recruit, Cookout and Upgrade Base alike.
//         The block reason is also written into the visible label, because Firefox and
//         Safari do not render title= tooltips on a disabled control.
// FIXED — all five train buttons and Recruit now evaluate the roster gate FIRST,
//         matching trainFighter (state.ts:837) and recruitTrainee (state.ts:310),
//         which both check roster slots before any building, Bling or Hype condition.
//         Previously a full roster was reported as `Need 500¤`, sending the player off
//         to earn money that could not fix the real refusal.
// FIXED — updateUI treated style.display === '' as OPEN for #base-cmd-panel, and ''
//         is exactly what it reads at load because that panel's display:none lives in
//         the stylesheet. updateBasePanel force-shows, so the base command panel put
//         itself on screen 33ms into every match with no player click. It now tests
//         for 'flex', the only value the open path ever writes.
// FIXED — updateTraineeBuildPanel and updateTrainerPanel had the same one-value guard
//         and so ran a full DOM-write pass at 30fps against stylesheet-hidden panels
//         from match start. Both now bail on '' as well as 'none', matching
//         updateAdvancedBuildPanel.
// FIXED — #tbtn-advanced received no state at all: full-opacity and clickable at T1
//         with no Trainer, opening a panel of five greyed rows. Both advanced openers
//         now grey with the T2 tier that unlocks the panel's contents, and
//         #tbtn-advanced-lbl is no longer dead markup.
// CHANGED — the T2 upgrade cost string dropped its ' · 45s' suffix (the duration is
//         still in the tooltip). #base-cmd-panel is left:50% + translateX(-50%), so it
//         is capped at 50vw, and the longer label pushed its wrap threshold up into the
//         range of an unmaximised 1080p window. See the index.html CHANGE LOG for the
//         vertical re-spacing that makes a wrapped row safe regardless.
// FIXED — the handleEvent comment pointed a maintainer at updateBasePanel for the
//         Media Studio lit state; it is rendered by updateMediaStudioToggle.
// FIXED — the v0.1.11 file history was deleted rather than stacked under the v0.1.14
//         marker. Restored above, newest first, matching state.ts:4-8.
// ============================================================
//
// ============================================================
// CHANGE LOG — v0.1.14
// ============================================================
// ADDED — ten command emitters, one per previously unreachable metaType. Spelling is
//         copied verbatim from the routes in packages/server/src/game/loop.ts:229-252:
//           window.cmdBuildCoach               -> BUILD_COACH
//           window.cmdBuildMediaStudio         -> BUILD_MEDIA_STUDIO
//           window.cmdToggleMediaStudio        -> TOGGLE_MEDIA_STUDIO
//           window.cmdBuildRecoveryCenter      -> BUILD_RECOVERY_CENTER
//           window.cmdBuildChampionshipOffice  -> BUILD_CHAMPIONSHIP_OFFICE
//           window.cmdBuildPhoneBooth          -> BUILD_PHONE_BOOTH
//           window.cmdTrainT3Fighter           -> TRAIN_T3_FIGHTER
//           window.cmdTrainT4Fighter           -> TRAIN_T4_FIGHTER
//           window.cmdTrainT5Fighter           -> TRAIN_T5_FIGHTER
//           window.cmdUpgradeBaseT3            -> UPGRADE_BASE_T3
// ADDED — window.cmdUpgradeBaseAuto: single dispatcher behind #btn-upgrade-base.
//         baseLevel 1 -> cmdUpgradeBase (UPGRADE_BASE, instant, 400 Bling).
//         baseLevel 2 -> cmdUpgradeBaseT3 (UPGRADE_BASE_T3, queued 45s, 900 + 300 Hype).
//         The server aliases both metaTypes to the same upgradeBase() and branches on
//         the CURRENT baseLevel, so firing the T3 label at level 1 would silently spend
//         400 Bling on the T2 upgrade instead. Both emitters therefore re-check
//         baseLevel from the snapshot before emitting.
// ADDED — window.cmdOpenAdvancedBuildPanel / cmdCloseAdvancedBuildPanel and
//         updateAdvancedBuildPanel(), the fourth panel (#advanced-build-panel).
//         Its update fn self-guards on display like updateTraineeBuildPanel and is
//         wired into the 33ms updateUI dispatch alongside the other three panels.
// ADDED — server-mirrored COST TABLE and ROSTER math (see the two blocks below).
//         Every new button is disabled + greyed + given a title= reason using the
//         same conditions packages/server/src/game/state.ts checks, because the
//         server has NO rejection channel: loop.ts discards every boolean return, so
//         a blocked click produces no event, no error and no snapshot change.
// CHANGED — updateBasePanel: the upgrade button now covers T1->T2, T2->T3, the
//         in-progress T3 job and the T3-is-max state, and it relabels itself.
// ADDED — updateMediaStudioToggle(): shows/hides #btn-toggle-media-studio in the ECONOMY
//         panel and renders its lit state from snapshot mediaStudioActive, never from a
//         local flag. It is called unconditionally from updateUI, so the lit state stays
//         correct with every command panel closed. The button sits in the economy panel
//         rather than the base panel because #base-cmd-panel is left:50% with
//         translateX(-50%): its usable width is capped at half the viewport (683px at
//         1366x768) and a fifth button there wrapped it up into the trainee build panel.
// CHANGED — updateTrainerPanel: T3/T4/T5 buttons added, and T1/T2 now also honour the
//         roster-slot gate the server enforces via canAffordRosterSlots(). Before this
//         they could be enabled while the server refused. See DEVIATION note below.
// CHANGED — cmdCloseTraineeBuildPanel also closes the advanced panel, so it cannot be
//         orphaned when the canvas empty-click closes its parent.
// ADDED — handleEvent toasts for media_studio_toggled, media_studio_auto_off and
//         base_upgrade_queued.
//
// DEVIATION — BUILD_COACH and BUILD_PHONE_BOOTH are gated on cost here even though the
//   server does NOT check cost for them: getBuildBlockReason() (packages/shared/src/
//   constants/game.ts:211-223) reads neither bling nor hype for those two, and buildCoach
//   / buildPhoneBooth then deduct unconditionally. Without a client gate a broke player
//   lands at -350 Bling, or -800 Bling / -300 Hype. Gating is the lesser defect.
// DEVIATION — getBuildBlockReason() is NOT used for gating anywhere in this file. It has
//   no case for media_studio, recovery_center, championship_office or base_t3_upgrade and
//   its default arm returns 'Unknown building', which would grey those buttons forever.
//   The prereq checks below mirror the server's inline guards instead.
// ============================================================

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

// ── SERVER-MIRRORED COST TABLE — v0.1.14 ──────────────────────
// These are DUPLICATES, on purpose. Every number below is a non-exported server-local
// `var` in packages/server/src/game/state.ts:45-62, or an inline literal in
// trainFighter (state.ts:854-871). None of them reaches @fist/shared, so the client has
// no importable source of truth and no way to detect drift. If a server number moves,
// this block must move with it.
//
// DO NOT substitute GAME_CONSTANTS for any of these — four of its entries contradict
// the server outright: COST_COACH 0 (real 350), COST_PHONE_BOOTH 0 (real 800 + 300 Hype),
// COST_T3_FIGHTER 520 (real 500), COST_T5_FIGHTER 1050 (real 1500).
var COST_COACHING_INSTITUTE        = 350;   // state.ts:45
var TIME_COACHING_INSTITUTE_S      = 40;    // state.ts:57
var COST_MEDIA_STUDIO              = 300;   // state.ts:46
var TIME_MEDIA_STUDIO_S            = 20;    // state.ts:58
var COST_RECOVERY_CENTER           = 400;   // state.ts:47
var COST_RECOVERY_CENTER_HYPE      = 100;   // state.ts:48
var TIME_RECOVERY_CENTER_S         = 25;    // state.ts:59
var COST_CHAMPIONSHIP_OFFICE       = 600;   // state.ts:49
var COST_CHAMPIONSHIP_OFFICE_HYPE  = 250;   // state.ts:50
var TIME_CHAMPIONSHIP_OFFICE_S     = 35;    // state.ts:60
var COST_FIGHT_BOOKING_OFFICE      = 800;   // state.ts:51
var COST_FIGHT_BOOKING_OFFICE_HYPE = 300;   // state.ts:52
var TIME_FIGHT_BOOKING_OFFICE_S    = 60;    // state.ts:61
var COST_UPGRADE_BASE_T3           = 900;   // state.ts:53
var COST_UPGRADE_BASE_T3_HYPE      = 300;   // state.ts:54
var TIME_UPGRADE_BASE_T3_S         = 45;    // state.ts:62

var COST_T3_FIGHTER_BLING = 500;  var COST_T3_FIGHTER_HYPE = 100;  // state.ts:856-858
var COST_T4_FIGHTER_BLING = 800;  var COST_T4_FIGHTER_HYPE = 200;  // state.ts:862-864
var COST_T5_FIGHTER_BLING = 1500; var COST_T5_FIGHTER_HYPE = 500;  // state.ts:868-870

// ── ROSTER SLOTS — v0.1.14 ────────────────────────────────────
// trainFighter's FIRST gate is canAffordRosterSlots (state.ts:837-838), which calls
// getRosterSlotsUsed (state.ts:274-281). That helper LIVE-RECOUNTS from the player's
// alive entities — it does NOT read player.food.
//
// The snapshot's `food` field is a cached copy and is WRONG between a KO and the next
// spawn: refundRosterSlots (state.ts:290-297) subtracts the dead unit's tier cost a
// second time after resolver.ts already flagged it dead, so killing a T5 drops the
// number by 10 instead of 5. Gating on `food` would grey out buttons the server accepts.
//
// rosterSlotsUsed() below reproduces the server's live recount from snapshot.entities,
// which carries playerId, isAlive and tier for every entity (loop.ts:471-481).
// ROSTER_COST and ROSTER_HARD_CAP are server-local vars (state.ts:41-42), duplicated.
var ROSTER_COST: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 };
var ROSTER_HARD_CAP = 50;

function rosterSlotsUsed(): number {
  if (!lastSnapshot) return 0;
  var ents: Array<any> = lastSnapshot.entities ?? [];
  var sum = 0;
  var i   = 0;
  for (i = 0; i < ents.length; i++) {
    var e = ents[i];
    if (!e) continue;
    if (e.playerId !== myPlayerId) continue;
    if (!e.isAlive) continue;
    sum += ROSTER_COST[e.tier] ?? 1;
  }
  return sum;
}

// Returns a block reason string, or null when the slots are available.
function rosterBlockReason(playerSnap: any, slotsNeeded: number): string | null {
  var cap  = Math.min(playerSnap?.foodCap ?? 5, ROSTER_HARD_CAP);
  var used = rosterSlotsUsed();
  if (used + slotsNeeded > cap) {
    return 'Roster full — ' + used + '/' + cap + ' used, needs ' + slotsNeeded;
  }
  return null;
}

// ── SHARED BUTTON HELPERS — v0.1.14 ───────────────────────────
// Position of a buildingType in the construction queue, or -1 when absent.
// The queue is strictly serial: tickConstructionQueue only ever advances index 0
// (state.ts:688-690), so anything behind the head is waiting, not building.
function queuePosition(queue: Array<any>, buildingType: string): number {
  var i = 0;
  for (i = 0; i < queue.length; i++) {
    if (queue[i] && queue[i].buildingType === buildingType) return i;
  }
  return -1;
}

// v0.1.14a — THREE opacity states, not two. An inline style beats a stylesheet rule,
// so writing opacity '1' onto a button that was also set disabled defeated
// .build-cmd-btn:disabled{opacity:0.35} / .train-btn:disabled{opacity:0.35} and the
// blocked button painted pixel-identical to a live one. Structural blocks stay at 0.4;
// an affordability block now dims to 0.7; only a genuinely clickable button is at 1.
function blockOpacity(block: string | null, structural: boolean): string {
  if (structural) return '0.4';
  return block ? '0.7' : '1';
}

// v0.1.14a — Firefox and Safari do not render title= on a DISABLED control, so a reason
// that lives only in the tooltip is unreadable there. Affordability reasons are short
// and specific ('Need 500¤', 'Roster full — 4/5 used, needs 3'), so they go into the
// visible label too. Structural labels already say why ('✓ Built', '⏳ Building...').
function withReason(label: string, block: string | null, structural: boolean): string {
  if (!block || structural) return label;
  return label + ' — ' + block;
}

// The house button-state idiom, applied in one place: disabled + opacity + label + title.
// `structural` means unavailable for a reason money cannot fix (wrong tier, missing
// prereq, already built) — those grey out; a pure affordability block dims to 0.7.
function setButtonState(
  btnId: string,
  lblId: string,
  block: string | null,
  structural: boolean,
  label: string,
  tip: string,
): void {
  var btn = document.getElementById(btnId) as HTMLButtonElement;
  if (!btn) return;
  btn.disabled      = !!block;
  btn.style.opacity = blockOpacity(block, structural);
  btn.title         = block ?? tip;
  var lbl = document.getElementById(lblId);
  if (lbl) lbl.textContent = withReason(label, block, structural);
}

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

// ── v0.1.14 — THE TEN PREVIOUSLY UNREACHABLE ROUTES ───────────
// Envelope is identical to the seven above and is not optional: loop.ts:229-252
// dispatches on metaType and reads command.unitId as the PLAYER id for every meta
// route. `type: 'MOVE'` is inert filler. A misspelled metaType does not error — it
// falls through to the per-entity queue at loop.ts:255-258 and is swallowed.

(window as any).cmdBuildCoach = function() {
  if (!socket||!myPlayerId) return;
  socket.emit('command', { type: 'MOVE', unitId: myPlayerId, metaType: 'BUILD_COACH', timestamp: Date.now() });
};

(window as any).cmdBuildMediaStudio = function() {
  if (!socket||!myPlayerId) return;
  socket.emit('command', { type: 'MOVE', unitId: myPlayerId, metaType: 'BUILD_MEDIA_STUDIO', timestamp: Date.now() });
};

(window as any).cmdToggleMediaStudio = function() {
  if (!socket||!myPlayerId) return;
  socket.emit('command', { type: 'MOVE', unitId: myPlayerId, metaType: 'TOGGLE_MEDIA_STUDIO', timestamp: Date.now() });
};

(window as any).cmdBuildRecoveryCenter = function() {
  if (!socket||!myPlayerId) return;
  socket.emit('command', { type: 'MOVE', unitId: myPlayerId, metaType: 'BUILD_RECOVERY_CENTER', timestamp: Date.now() });
};

(window as any).cmdBuildChampionshipOffice = function() {
  if (!socket||!myPlayerId) return;
  socket.emit('command', { type: 'MOVE', unitId: myPlayerId, metaType: 'BUILD_CHAMPIONSHIP_OFFICE', timestamp: Date.now() });
};

(window as any).cmdBuildPhoneBooth = function() {
  if (!socket||!myPlayerId) return;
  socket.emit('command', { type: 'MOVE', unitId: myPlayerId, metaType: 'BUILD_PHONE_BOOTH', timestamp: Date.now() });
};

(window as any).cmdTrainT3Fighter = function() {
  if (!socket||!myPlayerId) return;
  socket.emit('command', { type: 'MOVE', unitId: myPlayerId, metaType: 'TRAIN_T3_FIGHTER', timestamp: Date.now() });
};

(window as any).cmdTrainT4Fighter = function() {
  if (!socket||!myPlayerId) return;
  socket.emit('command', { type: 'MOVE', unitId: myPlayerId, metaType: 'TRAIN_T4_FIGHTER', timestamp: Date.now() });
};

(window as any).cmdTrainT5Fighter = function() {
  if (!socket||!myPlayerId) return;
  socket.emit('command', { type: 'MOVE', unitId: myPlayerId, metaType: 'TRAIN_T5_FIGHTER', timestamp: Date.now() });
};

// UPGRADE_BASE_T3 is an ALIAS on the server — loop.ts:231 routes it to the same
// upgradeBase() as UPGRADE_BASE, and that function branches on the CURRENT baseLevel,
// not on the metaType. Emitting it at baseLevel 1 would silently perform the 400 Bling
// T1->T2 upgrade. The baseLevel === 2 guard below is what makes the alias safe.
(window as any).cmdUpgradeBaseT3 = function() {
  if (!socket||!myPlayerId) return;
  var p = lastSnapshot ? lastSnapshot.players?.[myPlayerId] : null;
  if (!p || (p.baseLevel ?? 1) !== 2) return;
  socket.emit('command', { type: 'MOVE', unitId: myPlayerId, metaType: 'UPGRADE_BASE_T3', timestamp: Date.now() });
};

// Single dispatcher behind #btn-upgrade-base. Picks the route that matches the tier
// the snapshot actually reports, so the button's label and its effect cannot diverge.
(window as any).cmdUpgradeBaseAuto = function() {
  if (!socket||!myPlayerId) return;
  var p     = lastSnapshot ? lastSnapshot.players?.[myPlayerId] : null;
  var level = p ? (p.baseLevel ?? 1) : 1;
  if (level === 2) { (window as any).cmdUpgradeBaseT3(); return; }
  if (level === 1) { (window as any).cmdUpgradeBase();   return; }
  // level 3 is max — upgradeBase() returns false at state.ts:387. Emit nothing.
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
  // v0.1.14 — the advanced panel is a child of this one. Closing the parent (including
  // the canvas empty-click path in game.ts) must not leave it orphaned on screen.
  // v0.1.14a — but ONLY when this panel is the one that raised it. The economy-panel
  // opener exists for the player who has no live scout to click; a stray click on empty
  // map must not take that panel away from them.
  if (advancedPanelOwner === 'trainee') (window as any).cmdCloseAdvancedBuildPanel();
};

function updateTraineeBuildPanel(playerSnap: any): void {
  var panel = document.getElementById('trainee-build-panel');
  // v0.1.14a — '' is the value at load, because display:none lives in the stylesheet
  // (index.html) and not inline. It means CLOSED. Testing only 'none' ran this whole
  // pass at 30fps against a panel the player had never opened.
  if (!panel || panel.style.display === 'none' || panel.style.display === '') return;

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

// ── ADVANCED BUILD PANEL — v0.1.14 ────────────────────────────
// #advanced-build-panel, z-index 63, bottom 334px (v0.1.14a; was 258px) — the trainer
// panel's slot, which the
// two share mutually exclusively. It carries the five construction routes the server has
// accepted since v0.1.13 with no button behind them. It is a separate panel rather than
// five more buttons in the trainee build row because that row wraps at narrow widths and
// would have grown upward into the trainer panel at 1366px.
//
// Every gate below mirrors the server's own guard, because there is no rejection
// channel: loop.ts calls each build fn as a bare statement and discards the boolean,
// so a refused build emits nothing and changes nothing. Whatever is greyed here is the
// only explanation the player will ever get.

// v0.1.14a — which opener raised the panel: 'trainee', 'economy', or '' when closed.
// The trainee build panel closes its own child, and the canvas empty-click routes
// through that close path (game.ts:370). Before this flag, a panel opened from the
// economy button — the opener that exists for a player with NO live scout — was torn
// down by any stray click on empty map.
var advancedPanelOwner = '';

function openAdvancedPanel(owner: string): void {
  var panel = document.getElementById('advanced-build-panel');
  if (!panel) return;
  // '' is the value at load (display:none is in the stylesheet, not inline) and it
  // means CLOSED. Treating it as open makes the first click a no-op.
  var isOpen = panel.style.display !== 'none' && panel.style.display !== '';
  // This panel shares the trainer panel's screen slot — see the CSS note. Adding
  // T3/T4/T5 grew the trainer panel to 266px empty and ~351px at a five-row queue, and
  // the training queue is uncapped server-side, so no fixed offset above it is safe.
  // The two are mutually exclusive instead.
  if (!isOpen) (window as any).cmdCloseTrainerPanel();
  panel.style.display = isOpen ? 'none' : 'flex';
  advancedPanelOwner  = isOpen ? '' : owner;
  // Convention: prime one immediate update so the panel is never blank for a frame.
  if (!isOpen && lastSnapshot) {
    var p = lastSnapshot.players?.[myPlayerId];
    if (p) updateAdvancedBuildPanel(p);
  }
}

// Opener inside #trainee-build-panel. Requires a live scout to have been clicked.
(window as any).cmdOpenAdvancedBuildPanel = function() {
  openAdvancedPanel('trainee');
};

// v0.1.14a — the trainee-independent opener, #btn-open-advanced in the economy panel.
// None of the five build fns behind this panel reads player.entities: buildCoach
// (state.ts:479), buildMediaStudio (513), buildRecoveryCenter (573),
// buildChampionshipOffice (613) and buildPhoneBooth (652) read baseLevel, bling, hype,
// buildings and constructionQueue and nothing else, and every ConstructionJob they push
// carries assignedTraineeId: null. Gating the only opener on a live trainee invented a
// requirement the server does not have, and locked the five routes out entirely for a
// player whose scouts were dead or whose roster was full of fighters.
(window as any).cmdOpenAdvancedBuildPanelStandalone = function() {
  openAdvancedPanel('economy');
};

(window as any).cmdCloseAdvancedBuildPanel = function() {
  var panel = document.getElementById('advanced-build-panel');
  if (panel) panel.style.display = 'none';
  advancedPanelOwner = '';
};

// v0.1.14a — the two openers for #advanced-build-panel. Neither had any state before:
// #tbtn-advanced was full-opacity and clickable at T1 with no Trainer, and opening it
// showed five greyed rows. Both now carry the T2 gate that unlocks the cheapest thing
// inside (Media Studio, 300¤, baseLevel >= 2), and #tbtn-advanced-lbl — which nothing
// read — is finally wired.
function updateAdvancedOpeners(playerSnap: any): void {
  var level = playerSnap?.baseLevel ?? 1;
  var block = level < 2 ? 'Requires T2 Base' : null;
  var tip   = 'Advanced structures — Coaching Institute, Media Studio, Recovery Center, ' +
              'Championship Office, Fight Booking Office';
  setButtonState('tbtn-advanced', 'tbtn-advanced-lbl', block, level < 2, '⚙ Advanced ▸', tip);
  setButtonState('btn-open-advanced', 'btn-open-advanced-lbl', block, level < 2, '⚙ Advanced Build', tip);
}

function updateAdvancedBuildPanel(playerSnap: any): void {
  var panel = document.getElementById('advanced-build-panel');
  // Self-guarding idiom — copied from updateTraineeBuildPanel/updateTrainerPanel.
  // This fn NEVER writes panel.style.display, so it is safe to call unconditionally
  // from updateUI. (updateBasePanel force-shows and must stay externally gated.)
  if (!panel || panel.style.display === 'none' || panel.style.display === '') return;

  var bling = playerSnap?.bling     ?? 0;
  var hype  = playerSnap?.hype      ?? 0;
  var level = playerSnap?.baseLevel ?? 1;
  var buildings: Array<{type:string}>     = playerSnap?.buildings         ?? [];
  var queue:     Array<{buildingType:string}> = playerSnap?.constructionQueue ?? [];

  var has = function(t: string) { return buildings.some(function(b: any) { return b.type === t; }); };

  // Shared label logic for a queued job: index 0 is ticking, everything behind it waits.
  var queuedLabel = function(pos: number, name: string) {
    return pos === 0 ? '⏳ ' + name + ' — building...'
                     : '⏳ ' + name + ' — waiting #' + (pos + 1);
  };

  // ── Coaching Institute (BUILD_COACH) — 350¤, 40s, T2 + Trainer ──
  // Server prereqs: getBuildBlockReason('coach') — baseLevel >= 2, has trainer,
  // not already built (shared/game.ts:211-215) — plus the same-type queue guard
  // (state.ts:485). The cost check is OURS: the helper never reads bling, and
  // buildCoach deducts 350 unconditionally at state.ts:488-489.
  var coachPos   = queuePosition(queue, 'coach');
  var coachDone  = has('coach');
  var coachBlock = coachDone            ? 'Already built'
                 : coachPos >= 0        ? 'Already in the construction queue'
                 : level < 2            ? 'Requires T2 Base'
                 : !has('trainer')      ? 'Requires Trainer'
                 : bling < COST_COACHING_INSTITUTE ? 'Need ' + COST_COACHING_INSTITUTE + '¤'
                 : null;
  setButtonState(
    'abtn-coach', 'abtn-coach-lbl', coachBlock,
    coachDone || coachPos >= 0 || level < 2 || !has('trainer'),
    coachDone   ? '✓ Coaching Institute'
    : coachPos >= 0 ? queuedLabel(coachPos, 'Coaching Institute')
    : 'Coaching Institute (' + COST_COACHING_INSTITUTE + '¤)',
    'Build the Coaching Institute — ' + COST_COACHING_INSTITUTE + '¤, ' +
      TIME_COACHING_INSTITUTE_S + 's. Unlocks T3 and T4 fighter training.',
  );

  // ── Media Studio (BUILD_MEDIA_STUDIO) — 300¤, 20s, T2 ──
  // Server: state.ts:516-523, four inline guards, no shared helper, no Hype cost.
  var msPos   = queuePosition(queue, 'media_studio');
  var msDone  = has('media_studio');
  var msBlock = msDone         ? 'Already built'
              : msPos >= 0     ? 'Already in the construction queue'
              : level < 2      ? 'Requires T2 Base'
              : bling < COST_MEDIA_STUDIO ? 'Need ' + COST_MEDIA_STUDIO + '¤'
              : null;
  setButtonState(
    'abtn-media-studio', 'abtn-media-studio-lbl', msBlock,
    msDone || msPos >= 0 || level < 2,
    msDone   ? '✓ Media Studio'
    : msPos >= 0 ? queuedLabel(msPos, 'Media Studio')
    : 'Media Studio (' + COST_MEDIA_STUDIO + '¤)',
    'Build the Media Studio — ' + COST_MEDIA_STUDIO + '¤, ' + TIME_MEDIA_STUDIO_S +
      's. Once built, its on/off switch appears in the economy panel, top left: -10¤/sec → +3 Hype/sec.',
  );

  // ── Recovery Center (BUILD_RECOVERY_CENTER) — 400¤ + 100 Hype, 25s, T2 ──
  // Server: state.ts:576-584. Effect that is actually wired: training time x0.80 for
  // every tier, applied at QUEUE time (state.ts:894-896) — it does not retroactively
  // speed up jobs already in the training queue. The advertised cooldown reduction is
  // NOT implemented anywhere in packages/engine, so it is not promised here.
  var rcPos   = queuePosition(queue, 'recovery_center');
  var rcDone  = has('recovery_center');
  var rcBlock = rcDone     ? 'Already built'
              : rcPos >= 0 ? 'Already in the construction queue'
              : level < 2  ? 'Requires T2 Base'
              : bling < COST_RECOVERY_CENTER      ? 'Need ' + COST_RECOVERY_CENTER + '¤'
              : hype  < COST_RECOVERY_CENTER_HYPE ? 'Need ' + COST_RECOVERY_CENTER_HYPE + ' Hype'
              : null;
  setButtonState(
    'abtn-recovery-center', 'abtn-recovery-center-lbl', rcBlock,
    rcDone || rcPos >= 0 || level < 2,
    rcDone   ? '✓ Recovery Center'
    : rcPos >= 0 ? queuedLabel(rcPos, 'Recovery Center')
    : 'Recovery Center (' + COST_RECOVERY_CENTER + '¤ + ' + COST_RECOVERY_CENTER_HYPE + '⚡)',
    'Build the Recovery Center — ' + COST_RECOVERY_CENTER + '¤ + ' +
      COST_RECOVERY_CENTER_HYPE + ' Hype, ' + TIME_RECOVERY_CENTER_S +
      's. Cuts fighter training time by 20% on every tier, for jobs queued after it finishes.',
  );

  // ── Championship Office (BUILD_CHAMPIONSHIP_OFFICE) — 600¤ + 250 Hype, 35s, T3 ──
  // Server: state.ts:616-624. baseLevel >= 3 is the ONLY building prereq — no Trainer,
  // no Coach, no Tech Refinery, unlike the Fight Booking Office. Both effects are live:
  // KO Hype spike x2 (state.ts:800-803) and center-hold Hype x2 (loop.ts:177-180).
  var coPos   = queuePosition(queue, 'championship_office');
  var coDone  = has('championship_office');
  var coBlock = coDone     ? 'Already built'
              : coPos >= 0 ? 'Already in the construction queue'
              : level < 3  ? 'Requires T3 Base'
              : bling < COST_CHAMPIONSHIP_OFFICE      ? 'Need ' + COST_CHAMPIONSHIP_OFFICE + '¤'
              : hype  < COST_CHAMPIONSHIP_OFFICE_HYPE ? 'Need ' + COST_CHAMPIONSHIP_OFFICE_HYPE + ' Hype'
              : null;
  setButtonState(
    'abtn-championship-office', 'abtn-championship-office-lbl', coBlock,
    coDone || coPos >= 0 || level < 3,
    coDone   ? '✓ Championship Office'
    : coPos >= 0 ? queuedLabel(coPos, 'Championship Office')
    : 'Championship Office (' + COST_CHAMPIONSHIP_OFFICE + '¤ + ' + COST_CHAMPIONSHIP_OFFICE_HYPE + '⚡)',
    'Build the Championship Office — ' + COST_CHAMPIONSHIP_OFFICE + '¤ + ' +
      COST_CHAMPIONSHIP_OFFICE_HYPE + ' Hype, ' + TIME_CHAMPIONSHIP_OFFICE_S +
      's. Doubles KO Hype to 30 and doubles center-hold Hype to 1.0/sec.',
  );

  // ── Fight Booking Office (BUILD_PHONE_BOOTH) — 800¤ + 300 Hype, 60s, T3 ──
  // Server prereqs: getBuildBlockReason('phone_booth') — baseLevel >= 3, trainer, coach,
  // tech_refinery, not built (shared/game.ts:217-223) — plus the queue guard
  // (state.ts:658). The cost check is OURS again: the helper reads neither bling nor
  // hype, and buildPhoneBooth deducts 800 Bling + 300 Hype unconditionally.
  //
  // The metaType keeps the old 'phone_booth' spelling; the label never does. The server
  // itself writes 'Fight Booking Office' into ConstructionJob.type (state.ts:667), which
  // is the string the construction queue and the completion flash both print.
  var pbPos      = queuePosition(queue, 'phone_booth');
  var pbDone     = has('phone_booth');
  var pbStruct   = pbDone || pbPos >= 0 || level < 3 ||
                   !has('trainer') || !has('coach') || !has('tech_refinery');
  var pbBlock = pbDone            ? 'Already built'
              : pbPos >= 0        ? 'Already in the construction queue'
              : level < 3         ? 'Requires T3 Base'
              : !has('trainer')   ? 'Requires Trainer'
              : !has('coach')     ? 'Requires Coaching Institute'
              : !has('tech_refinery') ? 'Requires Tech Refinery'
              : bling < COST_FIGHT_BOOKING_OFFICE      ? 'Need ' + COST_FIGHT_BOOKING_OFFICE + '¤'
              : hype  < COST_FIGHT_BOOKING_OFFICE_HYPE ? 'Need ' + COST_FIGHT_BOOKING_OFFICE_HYPE + ' Hype'
              : null;
  setButtonState(
    'abtn-phone-booth', 'abtn-phone-booth-lbl', pbBlock, pbStruct,
    pbDone   ? '✓ Fight Booking Office'
    : pbPos >= 0 ? queuedLabel(pbPos, 'Fight Booking Office')
    : 'Fight Booking Office (' + COST_FIGHT_BOOKING_OFFICE + '¤ + ' + COST_FIGHT_BOOKING_OFFICE_HYPE + '⚡)',
    'Build the Fight Booking Office — ' + COST_FIGHT_BOOKING_OFFICE + '¤ + ' +
      COST_FIGHT_BOOKING_OFFICE_HYPE + ' Hype, ' + TIME_FIGHT_BOOKING_OFFICE_S +
      's. Unlocks T5 Paragon training.',
  );

  // Queue note — construction is one job at a time, so a 25s building sitting behind a
  // 60s one is not ticking at all. Say so rather than implying five parallel timers.
  var noteEl = document.getElementById('advanced-queue-note');
  if (noteEl) {
    if (queue.length === 0) {
      noteEl.textContent = 'Construction runs one job at a time. Queue empty.';
    } else {
      var head = queue[0] as any;
      noteEl.textContent = 'Construction runs one job at a time. Now building: ' +
        (head.type || 'Building') + ' · ' + queue.length + ' job' +
        (queue.length === 1 ? '' : 's') + ' queued.';
    }
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
  // v0.1.14 — '' is the initial value (display:none lives in the stylesheet, not inline),
  // and it means CLOSED. Treating it as open made the first click a no-op, which now
  // matters: T3/T4/T5 live behind this toggle.
  var isOpen = panel.style.display !== 'none' && panel.style.display !== '';
  // v0.1.14 — shares its slot with the advanced build panel; only one may be open.
  if (!isOpen) (window as any).cmdCloseAdvancedBuildPanel();
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
  // v0.1.14a — same two-value guard as updateAdvancedBuildPanel. '' means CLOSED; the
  // one-value test walked snapshot.entities five times a frame, via rosterBlockReason,
  // for five buttons nobody could see.
  if (!panel || panel.style.display === 'none' || panel.style.display === '') return;

  var bling    = playerSnap?.bling     ?? 0;
  var hype     = playerSnap?.hype      ?? 0;
  var level    = playerSnap?.baseLevel ?? 1;
  var buildings: Array<{type:string}> = playerSnap?.buildings ?? [];
  var tQueue: Array<any> = playerSnap?.trainingQueue ?? [];

  var has          = function(t: string) { return buildings.some(function(b: any) { return b.type === t; }); };
  var hasTrainer   = has('trainer');
  var hasCoach     = has('coach');         // v0.1.14 — the T3 and T4 gate
  var hasBooking   = has('phone_booth');   // v0.1.14 — the T5 gate
  var trainingT1   = tQueue.some(function(j: any) { return j.tier === 1; });
  var trainingT2   = tQueue.some(function(j: any) { return j.tier === 2; });
  var trainingT3   = tQueue.some(function(j: any) { return j.tier === 3; });
  var trainingT4   = tQueue.some(function(j: any) { return j.tier === 4; });
  var trainingT5   = tQueue.some(function(j: any) { return j.tier === 5; });

  // v0.1.14 — Recovery Center bakes a x0.80 multiplier into trainTime at QUEUE time
  // (state.ts:894-896), so the honest advertised duration changes once it is built.
  var hasRecovery  = has('recovery_center');
  var trainSecs    = function(base: number) {
    return hasRecovery ? String(Math.round(base * 0.80 * 10) / 10) : String(base);
  };

  // T1 Fighter button: 200 Bling, needs Trainer
  var t1Btn = document.getElementById('train-t1-btn') as HTMLButtonElement;
  var t1Lbl = document.getElementById('train-t1-lbl');
  if (t1Btn) {
    // v0.1.14 — the roster clause is new. canAffordRosterSlots is trainFighter's FIRST
    // gate (state.ts:837-838) and applies to every tier, T1 included; without it this
    // button was enabled in states the server silently refused.
    // v0.1.14a — roster FIRST, matching the server's own order. trainFighter's first
    // statement after the player lookup is canAffordRosterSlots (state.ts:837), ahead of
    // every building/Bling/Hype check at 854-871. Reporting 'Need 200¤' to a player whose
    // roster is full sends them to earn money that cannot fix the refusal.
    var t1Block = rosterBlockReason(playerSnap, ROSTER_COST[1]) ??
                 (!hasTrainer ? 'Build Trainer first'
                : bling < 200 ? 'Need 200¤'
                : null);
    t1Btn.disabled      = !!t1Block;
    t1Btn.style.opacity = blockOpacity(t1Block, !hasTrainer);
    if (t1Lbl) t1Lbl.textContent = trainingT1 ? '⏳ Training T1...'
      : withReason('Train T1 Fighter (200¤, ' + trainSecs(12) + 's)', t1Block, !hasTrainer);
    t1Btn.title = t1Block ?? 'Train T1 ' + (myDiscipline || 'Fighter') + ' (200¤, ' + trainSecs(12) + 's) · 1 roster slot';
  }

  // T2 Fighter button: 350 Bling + 50 Hype, needs Trainer + T2 base
  var t2Btn = document.getElementById('train-t2-btn') as HTMLButtonElement;
  var t2Lbl = document.getElementById('train-t2-lbl');
  if (t2Btn) {
    var t2Struct = !hasTrainer || level < 2;
    var t2Block  = rosterBlockReason(playerSnap, ROSTER_COST[2]) ??
                  (!hasTrainer ? 'Build Trainer first'
                 : level < 2   ? 'Requires T2 Base'
                 : bling < 350 ? 'Need 350¤'
                 : hype  < 50  ? 'Need 50 Hype'
                 : null);
    t2Btn.disabled      = !!t2Block;
    t2Btn.style.opacity = blockOpacity(t2Block, t2Struct);
    if (t2Lbl) t2Lbl.textContent = trainingT2 ? '⏳ Training T2...'
      : withReason('Train T2 Fighter (350¤ + 50⚡, ' + trainSecs(20) + 's)', t2Block, t2Struct);
    t2Btn.title = t2Block ?? 'Train T2 ' + (myDiscipline || 'Fighter') + ' (350¤ + 50 Hype, ' + trainSecs(20) + 's) · 2 roster slots';
  }

  // ── v0.1.14 — T3 / T4 / T5 ──────────────────────────────────
  // trainFighter reads baseLevel for tier 2 ONLY (state.ts:849). Tiers 3, 4 and 5 never
  // touch it, so no base-tier reason is shown on these three: the real requirement is
  // the building, and the building is what carries the tier gate upstream.

  // T3 Icon: 500 Bling + 100 Hype, needs Coaching Institute, 3 roster slots
  var t3Btn = document.getElementById('train-t3-btn') as HTMLButtonElement;
  var t3Lbl = document.getElementById('train-t3-lbl');
  if (t3Btn) {
    var t3Block = rosterBlockReason(playerSnap, ROSTER_COST[3]) ??
                 (!hasCoach                    ? 'Requires Coaching Institute'
                : bling < COST_T3_FIGHTER_BLING ? 'Need ' + COST_T3_FIGHTER_BLING + '¤'
                : hype  < COST_T3_FIGHTER_HYPE  ? 'Need ' + COST_T3_FIGHTER_HYPE + ' Hype'
                : null);
    t3Btn.disabled      = !!t3Block;
    t3Btn.style.opacity = blockOpacity(t3Block, !hasCoach);
    if (t3Lbl) {
      t3Lbl.textContent = trainingT3
        ? '⏳ Training T3...'
        : withReason('Train T3 Icon (' + COST_T3_FIGHTER_BLING + '¤ + ' + COST_T3_FIGHTER_HYPE + '⚡, ' +
            trainSecs(30) + 's)', t3Block, !hasCoach);
    }
    t3Btn.title = t3Block ?? 'Train T3 Icon ' + (myDiscipline || 'Fighter') + ' (' +
      COST_T3_FIGHTER_BLING + '¤ + ' + COST_T3_FIGHTER_HYPE + ' Hype, ' + trainSecs(30) + 's) · 3 roster slots';
  }

  // T4 Monument: 800 Bling + 200 Hype, needs Coaching Institute, 4 roster slots
  var t4Btn = document.getElementById('train-t4-btn') as HTMLButtonElement;
  var t4Lbl = document.getElementById('train-t4-lbl');
  if (t4Btn) {
    var t4Block = rosterBlockReason(playerSnap, ROSTER_COST[4]) ??
                 (!hasCoach                    ? 'Requires Coaching Institute'
                : bling < COST_T4_FIGHTER_BLING ? 'Need ' + COST_T4_FIGHTER_BLING + '¤'
                : hype  < COST_T4_FIGHTER_HYPE  ? 'Need ' + COST_T4_FIGHTER_HYPE + ' Hype'
                : null);
    t4Btn.disabled      = !!t4Block;
    t4Btn.style.opacity = blockOpacity(t4Block, !hasCoach);
    if (t4Lbl) {
      t4Lbl.textContent = trainingT4
        ? '⏳ Training T4...'
        : withReason('Train T4 Monument (' + COST_T4_FIGHTER_BLING + '¤ + ' + COST_T4_FIGHTER_HYPE + '⚡, ' +
            trainSecs(45) + 's)', t4Block, !hasCoach);
    }
    t4Btn.title = t4Block ?? 'Train T4 Monument ' + (myDiscipline || 'Fighter') + ' (' +
      COST_T4_FIGHTER_BLING + '¤ + ' + COST_T4_FIGHTER_HYPE + ' Hype, ' + trainSecs(45) + 's) · 4 roster slots';
  }

  // T5 Paragon: 1500 Bling + 500 Hype, needs the Fight Booking Office, 5 roster slots.
  // GAME_CONSTANTS.COST_T5_FIGHTER says 1050 — it is dead and wrong by 450. Gating on it
  // would enable this button 450 Bling early and the server would silently refuse.
  var t5Btn = document.getElementById('train-t5-btn') as HTMLButtonElement;
  var t5Lbl = document.getElementById('train-t5-lbl');
  if (t5Btn) {
    var t5Block = rosterBlockReason(playerSnap, ROSTER_COST[5]) ??
                 (!hasBooking                  ? 'Requires Fight Booking Office'
                : bling < COST_T5_FIGHTER_BLING ? 'Need ' + COST_T5_FIGHTER_BLING + '¤'
                : hype  < COST_T5_FIGHTER_HYPE  ? 'Need ' + COST_T5_FIGHTER_HYPE + ' Hype'
                : null);
    t5Btn.disabled      = !!t5Block;
    t5Btn.style.opacity = blockOpacity(t5Block, !hasBooking);
    if (t5Lbl) {
      t5Lbl.textContent = trainingT5
        ? '⏳ Training T5...'
        : withReason('Train T5 Paragon (' + COST_T5_FIGHTER_BLING + '¤ + ' + COST_T5_FIGHTER_HYPE + '⚡, ' +
            trainSecs(60) + 's)', t5Block, !hasBooking);
    }
    t5Btn.title = t5Block ?? 'Train T5 Paragon ' + (myDiscipline || 'Fighter') + ' (' +
      COST_T5_FIGHTER_BLING + '¤ + ' + COST_T5_FIGHTER_HYPE + ' Hype, ' + trainSecs(60) + 's) · 5 roster slots';
  }

  // Training queue display
  var tqEl = document.getElementById('trainer-queue-display');
  if (tqEl) {
    if (tQueue.length === 0) {
      tqEl.innerHTML = '<span style="font-size:8px;color:#8f8fb8;letter-spacing:1px;">Queue empty</span>';
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

// v0.1.17 - THE PERMANENT BUILD ENTRY POINT.
// DECISION: a Build button lives in the top HUD and is always present, so the
//   build tree can never again be reachable only through an undiscoverable canvas
//   click. It toggles, so the same button also closes the panel.
// DECISION: it reads lastSnapshot directly rather than waiting for the next tick,
//   so the panel is populated the instant it opens instead of showing stale
//   costs for one frame.
(window as any).cmdOpenBasePanel = function() {
  var panel = document.getElementById('base-cmd-panel');
  if (!panel) return;
  var isOpen = panel.style.display === 'flex';
  if (isOpen) {
    panel.style.display = 'none';
    (window as any).cmdCloseTrainerPanel();
    (window as any).cmdCloseAdvancedBuildPanel();
    return;
  }
  var p = lastSnapshot && lastSnapshot.players ? lastSnapshot.players[myPlayerId] : null;
  if (p) updateBasePanel(p);
  else   panel.style.display = 'flex';
};

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
  var hype     = playerSnap?.hype      ?? 0;   // v0.1.14 — T3 upgrade costs Hype too
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
    // v0.1.14a — this used to read `food < foodCap` off the snapshot. recruitTrainee
    // does not: its FIRST gate is canAffordRosterSlots (state.ts:310), which live-
    // recounts the player's alive entities. player.food is a cached copy the server
    // only re-syncs on spawn and recruit, and refundRosterSlots (state.ts:296) writes
    // max(0, getRosterSlotsUsed() - refund) AFTER resolver.ts:199 already cleared
    // isAlive — so every KO subtracts that tier's cost twice and the field reports free
    // slots that do not exist. The click then emitted RECRUIT_TRAINEE, the server
    // refused, loop.ts:236 discarded the boolean, and the player got nothing at all:
    // no event, no snapshot change, no explanation, standing at the one button that
    // leads back to a live scout and therefore to every trainee-panel build route.
    // Roster is checked first because that is the order the server refuses in.
    var recruitBlock = rosterBlockReason(playerSnap, ROSTER_COST[1]);
    if (!recruitBlock && bling < 70) recruitBlock = 'Need 70¤';
    recruitBtn.disabled      = !!recruitBlock;
    recruitBtn.style.opacity = blockOpacity(recruitBlock, false);
    recruitBtn.title         = recruitBlock ?? 'Recruit Trainee (70¤)';
  }
  // ── UPGRADE BASE — v0.1.14 spans BOTH steps ─────────────────
  // upgradeBase() (state.ts:341-389) branches on the current baseLevel:
  //   level 1 -> INSTANT T1->T2, 400 Bling, no Hype, no queue, +5 Hype, base_expanded.
  //   level 2 -> QUEUED  T2->T3, 900 Bling + 300 Hype, 45s job 'World Promo HQ'.
  //              baseLevel does NOT move until the job clears the serial queue.
  //   level 3 -> returns false (max).
  // 'base_t3_upgrade' is deliberately never pushed to player.buildings (state.ts:702-708),
  // so T3 is detected from baseLevel, never by scanning buildings[].
  if (upgradeBtn){
    var upLbl   = document.getElementById('btn-upgrade-base-lbl');
    var upCost  = document.getElementById('btn-upgrade-base-cost');
    var t3Queued = inQueue('base_t3_upgrade');
    var upBlock: string | null = null;
    var upLabel  = 'Upgrade Base';
    var upCostTx = '400¤';
    var upTip    = 'Upgrade Base to T2 (400¤, instant)';
    var upStruct = false;

    if (level >= 3) {
      upBlock  = 'Base is already T3 — max tier';
      upLabel  = '✓ T3 Base';
      upCostTx = 'Max tier';
      upStruct = true;
    } else if (t3Queued) {
      upBlock  = 'World Promo HQ already in the construction queue';
      upLabel  = '⏳ World Promo HQ';
      upCostTx = 'Upgrading to T3';
      upStruct = true;
    } else if (level === 2) {
      upLabel  = 'World Promo HQ';
      // v0.1.14a — no ' · 45s' suffix. #base-cmd-panel is left:50% + translateX(-50%),
      // so it is capped at 50vw; the longer string widened the panel enough to move its
      // wrap threshold into ordinary 1080p window sizes. The duration is in upTip.
      upCostTx = COST_UPGRADE_BASE_T3 + '¤+' + COST_UPGRADE_BASE_T3_HYPE + '⚡';
      upTip    = 'Upgrade Base to T3 — ' + COST_UPGRADE_BASE_T3 + '¤ + ' +
                 COST_UPGRADE_BASE_T3_HYPE + ' Hype, queued for ' + TIME_UPGRADE_BASE_T3_S + 's';
      upBlock  = bling < COST_UPGRADE_BASE_T3      ? 'Need ' + COST_UPGRADE_BASE_T3 + '¤'
               : hype  < COST_UPGRADE_BASE_T3_HYPE ? 'Need ' + COST_UPGRADE_BASE_T3_HYPE + ' Hype'
               : null;
    } else {
      upBlock  = bling < 400 ? 'Need 400¤' : null;
    }

    upgradeBtn.disabled      = !!upBlock;
    upgradeBtn.style.opacity = blockOpacity(upBlock, upStruct);
    upgradeBtn.title         = upBlock ?? upTip;
    if (upLbl)  upLbl.textContent  = upLabel;
    if (upCost) upCost.textContent = upCostTx;
  }
  if (cookoutBtn){
    var cookoutBlock = level < 2   ? 'Unlock at T2 base'
                     : bling < 200 ? 'Need 200¤'
                     : null;
    cookoutBtn.disabled      = !!cookoutBlock;
    // v0.1.14a — was opacity '1' while disabled on cost, which an inline style makes win
    // over .cmd-btn:disabled{opacity:0.35}: the blocked button looked live.
    cookoutBtn.style.opacity = blockOpacity(cookoutBlock, level < 2);
    cookoutBtn.title         = cookoutBlock ?? 'Build Cookout (200¤)';
  }

  // Train Fighters button — only shows if Trainer is built
  if (trainBtn) {
    var trainerBuilt = has('trainer');
    trainBtn.style.display  = trainerBuilt ? 'block' : 'none';
    trainBtn.title          = has('phone_booth') ? 'Open Trainer — train T1 through T5 fighters'
                            : has('coach')       ? 'Open Trainer — train T1 through T4 fighters'
                            : 'Open Trainer — train T1/T2 fighters';
  }

}

// ── MEDIA STUDIO TOGGLE — v0.1.14 ─────────────────────────────
// Lives in the economy panel, not the base panel: #base-cmd-panel is left:50% with
// translateX(-50%), so its shrink-to-fit width is capped at half the viewport (683px at
// 1366x768) and a fifth button there wrapped the panel up into the trainee build panel.
// The economy panel is top-left with no width cap, and it is where Bling and Hype are
// already read — which is what this button trades between.
//
// This fn is called from updateUI unconditionally, so the lit state stays correct even
// with every command panel closed. It only ever touches its own button.
function updateMediaStudioToggle(playerSnap: any): void {
  // toggleMediaStudio's ONLY gate is player.buildings containing 'media_studio'
  // (state.ts:551-552). A studio still in the construction queue does NOT satisfy it,
  // because the building is pushed to buildings[] only on completion (state.ts:713-716)
  // — and the 'media_studio_built' event fires at QUEUE time, 20 seconds early, so it is
  // useless as an "ownable now" signal. buildings[] is the truth; that is what is read.
  //
  // Lit state comes from snapshot mediaStudioActive every 33ms and is never cached
  // locally: the server flips it off by itself when Bling runs out (state.ts:767-779),
  // and toggleMediaStudio's return value is not an ack — `false` means both "rejected"
  // and "toggled off successfully".
  var msBuildings: Array<{type:string}> = playerSnap?.buildings ?? [];
  var msBtn   = document.getElementById('btn-toggle-media-studio') as HTMLButtonElement;
  var msLbl   = document.getElementById('btn-toggle-media-studio-lbl');
  var msState = document.getElementById('btn-toggle-media-studio-state');
  if (msBtn) {
    var studioBuilt  = msBuildings.some(function(b: any) { return b.type === 'media_studio'; });
    var studioActive = !!playerSnap?.mediaStudioActive;
    msBtn.style.display = studioBuilt ? 'block' : 'none';
    if (studioBuilt) {
      msBtn.disabled = false;
      msBtn.style.opacity = '1';
      // The accent is set inline as well as through .active because this button already
      // carries inline styles, and an inline colour beats the .active class rule.
      if (studioActive) {
        msBtn.classList.add('active');
        msBtn.style.borderColor = '#c084fc';
        msBtn.style.color       = '#c084fc';
      } else {
        msBtn.classList.remove('active');
        msBtn.style.borderColor = '#2a2a44';
        msBtn.style.color       = '#8888aa';
      }
      if (msLbl)   msLbl.textContent   = 'Media Studio';
      if (msState) msState.textContent = studioActive ? '● ON · -10¤/s → +3⚡/s' : '○ OFF';
      msBtn.title = studioActive
        ? 'Media Studio is ON — converting 10 Bling/sec into 3 Hype/sec. It shuts itself off when Bling runs out. Click to stop.'
        : 'Media Studio is OFF. Click to convert 10 Bling/sec into 3 Hype/sec.';
    }
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
    // v0.1.17 - open the base panel as the match begins.
    // DECISION: before this, the ONLY way to reach any build command was to click
    //   the base sprite on the canvas, and nothing anywhere said so. Recruit,
    //   Upgrade, Cookout, the trainee panel and every v0.1.13 structure sat behind
    //   an invisible affordance, which read as "building is broken" because there
    //   was no way to discover it. v0.1.14a made this worse by removing the
    //   accidental auto-open that was at least showing the buttons.
    //   The panel is now opened deliberately, once, on match start.
    window.setTimeout(function() { (window as any).cmdOpenBasePanel(); }, 400);
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

  // ── v0.1.14 event toasts ────────────────────────────────────
  // Snapshot events are per-tick only (loop.ts clears state.events every tick), so these
  // are transient notices. The persistent lit/unlit rendering is driven by the snapshot
  // field in updateMediaStudioToggle (economy panel), not by these. v0.1.14a — this
  // said updateBasePanel, which has never contained any media-studio code; the toggle
  // was moved to the economy panel in v0.1.14 and this comment was not moved with it.
  if (ev.type === "media_studio_toggled" && ev.sourceId === myPlayerId) {
    var studioOn = !!(ev.data && ev.data.active);
    showStatusFlash(
      studioOn ? '🎥 Media Studio ON — -10¤/sec → +3 Hype/sec' : '🎥 Media Studio OFF',
      studioOn ? '#c084fc' : '#8888aa',
    );
  }

  // The server shuts the studio off by itself once Bling can no longer cover a tick.
  // Nothing re-enables it — the player has to press the toggle again.
  if (ev.type === "media_studio_auto_off" && ev.sourceId === myPlayerId) {
    showStatusFlash('🎥 Media Studio shut off — out of Bling', '#ef5350');
  }

  // The T2->T3 upgrade is queued, not instant: baseLevel does not move for 45s, so
  // without this the 900 Bling + 300 Hype would appear to vanish for nothing.
  if (ev.type === "base_upgrade_queued" && ev.sourceId === myPlayerId) {
    showStatusFlash('🏗 World Promo HQ queued — T3 Base in ' + TIME_UPGRADE_BASE_T3_S + 's', '#c084fc');
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
  // v0.1.14a — the HUD quotes the SAME live recount the roster gates use. p.food is a
  // cached field the server re-syncs only on spawn and recruit, and refundRosterSlots
  // double-subtracts on a KO, so the old readout could show 'Food 3/5' in the same frame
  // as a button reading 'Roster full — 4/5 used'. One number, one source.
  if (foodEl)  foodEl.textContent  = rosterSlotsUsed() + '/' +
                                     Math.min(p.foodCap ?? 5, ROSTER_HARD_CAP);
  if (ctEl)    ctEl.textContent    = (p.totalCenterTimeS??0).toFixed(1)+'s';

  var treasuryEl = document.getElementById('econ-treasury');
  var baseHpEl   = document.getElementById('econ-base-hp');
  if (treasuryEl) treasuryEl.textContent = String(Math.floor(p.baseTreasury??0));
  if (baseHpEl)   baseHpEl.textContent   = String(Math.floor(p.baseHp??500));

  // Construction queue
  var qEl = document.getElementById('build-queue');
  if (qEl && p.constructionQueue) {
    if (p.constructionQueue.length === 0) {
      qEl.innerHTML = '<div class="build-item" style="color:#8f8fb8">No construction</div>';
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

  // Keep panels live if open.
  // updateBasePanel force-shows the panel, so it stays externally gated here.
  // The other three self-guard on display and are called unconditionally.
  // A panel update fn that is not in this list renders once on open and then freezes.
  //
  // v0.1.14a — the gate tests for 'flex', not for "anything that is not 'none'".
  // #base-cmd-panel's display:none lives in the stylesheet (index.html), so its INLINE
  // style.display reads '' at load; '' !== 'none' was true, updateBasePanel ran on the
  // very first 33ms tick, and its unconditional panel.style.display = 'flex' put the
  // base command panel on screen with no player click. 'flex' is the only value the
  // open path ever writes, so testing for it reads '' and 'none' both as closed.
  var basePanel = document.getElementById('base-cmd-panel');
  if (basePanel && basePanel.style.display === 'flex') updateBasePanel(p);
  updateTraineeBuildPanel(p);
  updateTrainerPanel(p);
  updateAdvancedBuildPanel(p);   // v0.1.14
  updateMediaStudioToggle(p);    // v0.1.14 — economy panel, always live
  updateAdvancedOpeners(p);      // v0.1.14a — both openers for the advanced panel

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
