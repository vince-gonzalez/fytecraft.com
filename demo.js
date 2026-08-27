// FIST — text demo client
// Run from fist/ root: node demo.js
// Connects two fake players, starts a match, prints live output.
// Keep the server running in another terminal first.

var io = require('socket.io-client');

var SERVER = 'http://localhost:3001';
var tickCount = 0;
var matchStarted = false;

console.log('\n[FIST DEMO] Connecting two players to ' + SERVER + '...\n');

// ── Player 1: Striker ──────────────────────────────────────
var p1 = io(SERVER);

p1.on('connect', function() {
  console.log('[P1] Connected — joining as Striker');
  p1.emit('join', { discipline: 'Striker' });
});

p1.on('joined', function(data) {
  console.log('[P1] Joined. Waiting for ' + data.waitingFor + ' more player(s)...');
});

p1.on('match_start', function(data) {
  console.log('\n[MATCH] STARTED — ' + (data.matchDurationS / 60) + ' minute King of the Hill\n');
  matchStarted = true;
});

p1.on('snapshot', function(snap) {
  tickCount++;

  // Print a summary every 60 ticks (roughly every second)
  if (tickCount % 60 !== 0) return;

  var seconds = Math.floor(snap.matchElapsedS);
  var mins = Math.floor(seconds / 60);
  var secs = seconds % 60;
  var timeStr = mins + ':' + (secs < 10 ? '0' : '') + secs;

  console.log('── TICK ' + snap.tick + ' | TIME ' + timeStr + ' ─────────────────────');

  // Players
  Object.keys(snap.players).forEach(function(pid) {
    var p = snap.players[pid];
    var label = pid === p1.id ? 'P1(Striker)' : 'P2(Grappler)';
    console.log('  ' + label + ' | Bling: ' + Math.floor(p.bling) + ' | Center time: ' + p.totalCenterTimeS.toFixed(1) + 's | Respect: ' + p.respect);
  });

  // Entities
  var alive = snap.entities.filter(function(e) { return e.isAlive; });
  var trainees = alive.filter(function(e) { return e.isHarvesting; });
  var fighters = alive.filter(function(e) { return !e.isHarvesting; });

  console.log('  Units alive: ' + alive.length + ' (' + trainees.length + ' harvesting, ' + fighters.length + ' fighting)');

  if (fighters.length > 0) {
    fighters.forEach(function(e) {
      var hpPct = Math.round((e.hp / e.maxHp) * 100);
      var conf = Math.round(e.confidence * 100);
      var procs = e.activeProcs.length > 0 ? ' [' + e.activeProcs.join(',') + ']' : '';
      console.log('    Fighter ' + e.id.split('_')[1] + ' | ' + e.careerState + ' | HP: ' + hpPct + '% | Conf: ' + conf + '%' + procs);
    });
  }

  // Events this tick
  if (snap.events.length > 0) {
    console.log('  Events: ');
    snap.events.forEach(function(ev) {
      console.log('    >> ' + ev.type + (ev.value ? ' (' + Math.round(ev.value) + ')' : ''));
    });
  }

  console.log('');

  // Auto-stop after 30 seconds of match time
  if (snap.matchElapsedS > 30) {
    console.log('[DEMO] 30 seconds elapsed — demo complete.');
    console.log('[DEMO] The server is still running. Ctrl+C to stop it.');
    p1.disconnect();
    p2.disconnect();
    process.exit(0);
  }
});

p1.on('disconnect', function() {
  console.log('[P1] Disconnected');
});

p1.on('connect_error', function(err) {
  console.log('[ERROR] Cannot connect to server: ' + err.message);
  console.log('[ERROR] Make sure the server is running: cd packages/server && npx ts-node src/index.ts');
  process.exit(1);
});

// ── Player 2: Grappler ─────────────────────────────────────
var p2 = io(SERVER);

p2.on('connect', function() {
  console.log('[P2] Connected — joining as Grappler');
  p2.emit('join', { discipline: 'Grappler' });
});

p2.on('joined', function(data) {
  console.log('[P2] Joined. Waiting for ' + data.waitingFor + ' more player(s)...');
});

// Send a simulated attack command from P2 every 3 seconds once match starts
var cmdInterval = setInterval(function() {
  if (!matchStarted) return;

  // P2 pretends to punch at a target — server will handle if valid
  // In a real client this comes from mouse clicks
  p2.emit('command', {
    type: 'PUNCH',
    unitId: 'demo_unit',
    timestamp: Date.now(),
  });
}, 3000);

process.on('exit', function() {
  clearInterval(cmdInterval);
});
