#!/usr/bin/env node
// ============================================================
// FYTECRAFT PATCH v0.1.7b — ADD hasPlayerCommand TO ENTITY TYPE
// Zengine™ | Vince Gonzalez
// Run from: C:\Users\Admin\fist\
//   node patch.js
// ============================================================

var fs   = require('fs');
var path = require('path');
var ROOT = process.cwd();
var { execSync } = require('child_process');

function write(relPath, content) {
  var full = path.join(ROOT, relPath);
  fs.writeFileSync(full, content, 'utf8');
  console.log('  [WROTE]', relPath);
}
function readRel(relPath) {
  var full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, 'utf8');
}
function check(pkg) {
  try {
    execSync('npx tsc --noEmit', { cwd: path.join(ROOT, pkg), stdio: 'pipe' });
    console.log('  [PASS]', pkg);
    return true;
  } catch(e) {
    var out = (e.stdout||'').toString() + (e.stderr||'').toString();
    console.log('  [FAIL]', pkg);
    out.split('\n').filter(function(l){ return l.indexOf('error TS') !== -1; })
       .slice(0,8).forEach(function(l){ console.log('    ' + l.trim()); });
    return false;
  }
}

console.log('\n=== FYTECRAFT PATCH v0.1.7b ===\n');

// Add hasPlayerCommand to Entity interface
console.log('Phase 1: types/index.ts — add hasPlayerCommand to Entity...\n');

var typesTs = readRel('packages/shared/src/types/index.ts');
if (!typesTs) { console.log('  [SKIP] types not found'); process.exit(1); }

if (typesTs.indexOf('hasPlayerCommand') === -1) {
  // Inject after hasThrownInTowel
  var injIdx = typesTs.indexOf('hasThrownInTowel:');
  if (injIdx !== -1) {
    var injEnd = typesTs.indexOf('\n', injIdx);
    typesTs = typesTs.slice(0, injEnd) +
      '\n  hasPlayerCommand?: boolean; // set true when player issues manual command this tick' +
      typesTs.slice(injEnd);
    write('packages/shared/src/types/index.ts', typesTs);
    console.log('  hasPlayerCommand?: boolean added to Entity interface');
  }
} else {
  console.log('  [SKIP] already present');
}

// Also add it to createEntity in state.ts
console.log('\nPhase 2: state.ts — add hasPlayerCommand to createEntity return...\n');

var stateTs = readRel('packages/server/src/game/state.ts');
if (stateTs && stateTs.indexOf('hasPlayerCommand') === -1) {
  stateTs = stateTs.split(
    'isAlive: true, hasThrownInTowel: false,'
  ).join(
    'isAlive: true, hasThrownInTowel: false, hasPlayerCommand: false,'
  );
  write('packages/server/src/game/state.ts', stateTs);
  console.log('  hasPlayerCommand: false added to createEntity');
} else {
  console.log('  [SKIP] already present or state.ts not found');
}

// Rebuild shared
console.log('\nPhase 3: Rebuild shared + check...\n');
try {
  execSync('npx tsc', { cwd: path.join(ROOT, 'packages/shared'), stdio: 'pipe' });
  console.log('  [PASS] shared rebuilt');
} catch(e) { console.log('  [FAIL] shared'); }

check('packages/server');
check('apps/client');

console.log('\n=== PATCH v0.1.7b COMPLETE ===\n');
console.log('RESTART:');
console.log('  taskkill /F /IM node.exe');
console.log('  Terminal 1: cd packages\\server && npx ts-node src\\index.ts');
console.log('  Terminal 2: cd apps\\client && npm run dev');
console.log('  Browser: Two tabs\n');
console.log('Zengine\u2122 | FyteCraft v0.1.7b | Vince Gonzalez');
