// BOOT ORDER: entry point — runs last, starts everything
// READS: nothing on start
// WRITES: starts HTTP server, opens WebSocket
// v0.1.16 — match teardown when the last player disconnects. Without it the
//            server served exactly ONE match per process lifetime.
// v0.1.13 — version bump, no routing changes (all new commands handled in loop.ts enqueueCommand)
/* ===== LAST STABLE: v0.1.11 — two-player match, socket join/command/disconnect ===== */

/* ===== WORKFLOW STACK =====
   File:         packages/server/src/index.ts
   Brand:        Zengine™ / FyteCraft
   Author:       Vince Gonzalez
   Version:      v0.1.13
   Boot order:   first — spawns HTTP + WebSocket, then instantiates GameLoop
   Dependencies: express, socket.io, @fist/shared, ./game/state, ./game/loop
===== END STACK ===== */

import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { Discipline, Command } from '@fist/shared';
import { createGameState } from './game/state';
import { GameLoop } from './game/loop';

var app        = express();
var httpServer = createServer(app);

var io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// ============================================================
// MATCH REGISTRY
// ============================================================
var activeLoops:    Map<string, GameLoop>   = new Map();
var pendingPlayers: Map<string, Discipline> = new Map();
var MATCH_ROOM          = 'match_1';
var MIN_PLAYERS_TO_START = 2;

// ============================================================
// SOCKET HANDLERS
// ============================================================
io.on('connection', function(socket: Socket) {
  console.log(`[FYTECRAFT] Client connected: ${socket.id}`);

  socket.on('join', function(data: { discipline: Discipline }) {
    if (!Object.values(Discipline).includes(data.discipline)) {
      socket.emit('error', { message: 'Invalid discipline.' });
      return;
    }

    pendingPlayers.set(socket.id, data.discipline);
    socket.join(MATCH_ROOM);

    console.log(`[FYTECRAFT] ${socket.id} joined as ${data.discipline} (${pendingPlayers.size} waiting)`);

    socket.emit('joined', {
      playerId:    socket.id,
      discipline:  data.discipline,
      waitingFor:  Math.max(0, MIN_PLAYERS_TO_START - pendingPlayers.size),
    });

    if (pendingPlayers.size >= MIN_PLAYERS_TO_START && !activeLoops.has(MATCH_ROOM)) {
      startMatch();
    }
  });

  // DECISION: All command routing (including all new v0.1.13 meta commands)
  //   is handled inside loop.ts enqueueCommand(). index.ts just forwards.
  //   Adding new commands never requires touching index.ts — only loop.ts.
  socket.on('command', function(cmd: Command) {
    var loop = activeLoops.get(MATCH_ROOM);
    if (!loop) return;
    cmd.timestamp = Date.now();
    loop.enqueueCommand(cmd);
  });

  socket.on('disconnect', function() {
    console.log(`[FYTECRAFT] Client disconnected: ${socket.id}`);
    pendingPlayers.delete(socket.id);
    var loop = activeLoops.get(MATCH_ROOM);
    if (!loop) return;

    var state  = loop.getState();
    var player = state.players[socket.id];
    if (player) player.isConnected = false;

    // v0.1.16 - THE ONE-SHOT MATCH BUG. activeLoops was written by startMatch and
    //   never cleared, so the join handler's `!activeLoops.has(MATCH_ROOM)` guard
    //   was false forever after the first match. A second pair of players would
    //   reach "(2 waiting)" and then sit in the lobby permanently - the only way
    //   to play again was to restart the process. Reproduced live during the
    //   v0.1.16 mobile verification: first pair started fine, both disconnected,
    //   the next pair hit 2 waiting and the match never began.
    // DECISION: tear the match down only when EVERY player has gone. One player
    //   dropping mid-match must not evict the one still playing, which is why this
    //   counts survivors instead of reacting to any disconnect at all.
    var stillConnected = Object.keys(state.players).filter(function(pid) {
      return state.players[pid].isConnected;
    }).length;

    if (stillConnected === 0) {
      loop.stop();
      activeLoops.delete(MATCH_ROOM);
      console.log('[FYTECRAFT] All players gone - match torn down, lobby open again');
    }
  });
});

// ============================================================
// START MATCH
// ============================================================
function startMatch(): void {
  var playerDisciplines: Record<string, Discipline> = {};
  pendingPlayers.forEach(function(discipline, socketId) {
    playerDisciplines[socketId] = discipline;
  });
  pendingPlayers.clear();

  var state = createGameState(playerDisciplines);
  var loop  = new GameLoop(state, function(snapshot) {
    io.to(MATCH_ROOM).emit('snapshot', snapshot);
  });

  activeLoops.set(MATCH_ROOM, loop);
  loop.start();

  console.log(`[FYTECRAFT] Match started with ${Object.keys(playerDisciplines).length} players`);
  io.to(MATCH_ROOM).emit('match_start', { matchDurationS: state.matchDurationS });
}

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/health', function(_req, res) {
  res.json({
    status:        'ok',
    version:       '0.1.13',
    activeMatches: activeLoops.size,
    pendingPlayers: pendingPlayers.size,
  });
});

// ============================================================
// START SERVER
// ============================================================
var PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

httpServer.listen(PORT, function() {
  console.log(`[FYTECRAFT] Server running on port ${PORT}`);
  console.log(`[FYTECRAFT] Health: http://localhost:${PORT}/health`);
});

export default app;
