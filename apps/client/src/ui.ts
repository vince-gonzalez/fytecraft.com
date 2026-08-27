// BOOT ORDER: loaded by main.ts
// READS: snapshot data
// WRITES: DOM elements (HUD, portraits, commentary)

// ── DISCIPLINE COLORS ─────────────────────────────────────
export var DISC_COLORS: Record<string, string> = {
  Striker:    '#ff3b3b',
  Grappler:   '#00d4aa',
  Technician: '#00e5ff',
  Brawler:    '#f5c842',
  Specialist: '#9d7fff',
};

export var CAREER_LETTER: Record<string, string> = {
  Trainee:  'T',
  Prospect: 'P',
  Fighter:  'F',
  Champion: 'C',
};

// ── HUD ───────────────────────────────────────────────────

export function updateHUD(
  bling: number,
  matchElapsedS: number,
  matchDurationS: number,
  centerTimeS: number
): void {
  var blingEl = document.getElementById('hud-bling');
  var clockEl = document.getElementById('hud-clock');
  var centerEl = document.getElementById('hud-center');

  if (blingEl) blingEl.textContent = Math.floor(bling).toString();

  if (clockEl) {
    var remaining = Math.max(0, matchDurationS - matchElapsedS);
    var mins = Math.floor(remaining / 60);
    var secs = Math.floor(remaining % 60);
    clockEl.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs;
    // Flash red under 60 seconds
    clockEl.style.color = remaining < 60 ? '#ff3b3b' : '#e8e8f0';
  }

  if (centerEl) centerEl.textContent = centerTimeS.toFixed(1) + 's';
}

// ── PORTRAITS ─────────────────────────────────────────────

export function updatePortraits(
  entities: Array<{
    id: string;
    hp: number;
    maxHp: number;
    careerState: string;
    isHarvesting: boolean;
    isAlive: boolean;
  }>,
  selectedIds: Set<string>,
  myDiscipline: string,
  onPortraitClick: (id: string) => void
): void {
  var bar = document.getElementById('hud-bottom');
  if (!bar) return;

  var color = DISC_COLORS[myDiscipline] ?? '#00e5ff';
  var myUnits = entities.filter((e) => e.isAlive && !e.isHarvesting);

  bar.innerHTML = myUnits.map((e) => {
    var hpPct = Math.round((e.hp / Math.max(1, e.maxHp)) * 100);
    var letter = CAREER_LETTER[e.careerState] ?? '?';
    var isSelected = selectedIds.has(e.id);
    var shortId = e.id.split('_')[1] ?? e.id.substring(0, 4);

    return `<div class="portrait${isSelected ? ' selected' : ''}"
      style="border-color:${isSelected ? color : ''}"
      onclick="window.__portraitClick('${e.id}')">
      <span class="portrait-career" style="color:${color}">${letter}</span>
      <span class="portrait-name">${shortId}</span>
      <div class="portrait-hp-bar">
        <div class="portrait-hp-fill" style="width:${hpPct}%;background:${hpPct < 30 ? '#ff3b3b' : color}"></div>
      </div>
    </div>`;
  }).join('');

  // Wire click handler via global (avoids inline event issues)
  (window as any).__portraitClick = onPortraitClick;
}

// ── COMMENTARY ────────────────────────────────────────────

var commentaryLines: HTMLElement[] = [];
var MAX_LINES = 3;

export function showCommentaryLine(
  text: string,
  voice: string,
  isViralClip: boolean,
  clipCaption: string | null
): void {
  var box = document.getElementById('commentary');
  if (!box) return;

  var el = document.createElement('div');
  el.className = 'commentary-line' + (isViralClip ? ' viral' : '');

  el.innerHTML = `<span class="voice-tag">${voice.replace('_', ' ')}</span>${text}`;
  box.appendChild(el);
  commentaryLines.push(el);

  // Show viral clip caption separately
  if (isViralClip && clipCaption) {
    setTimeout(() => {
      var clip = document.createElement('div');
      clip.className = 'commentary-line viral';
      clip.innerHTML = `<span class="voice-tag">CLIP</span>${clipCaption}`;
      if (box) box.appendChild(clip);
      commentaryLines.push(clip);
      if (box) trimCommentary(box as HTMLElement);
    }, 600);
  }

  if (box) trimCommentary(box as HTMLElement);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.5s';
    setTimeout(() => {
      el.remove();
      commentaryLines = commentaryLines.filter((l) => l !== el);
    }, 500);
  }, 5000);
}

function trimCommentary(box: HTMLElement): void {
  while (commentaryLines.length > MAX_LINES) {
    var old = commentaryLines.shift();
    if (old) old.remove();
  }
}

// ── DAMAGE NUMBERS ────────────────────────────────────────

export function spawnDamageNumber(
  screenX: number,
  screenY: number,
  damage: number,
  isCrit: boolean
): void {
  var el = document.createElement('div');
  el.className = 'dmg-number';
  el.textContent = isCrit ? damage + '!' : damage.toString();
  el.style.left = screenX + 'px';
  el.style.top = screenY + 'px';
  el.style.color = isCrit ? '#f5c842' : '#ff3b3b';
  el.style.fontSize = isCrit ? '28px' : '20px';
  document.body.appendChild(el);

  setTimeout(() => el.remove(), 1200);
}

// ── LOBBY STATUS ──────────────────────────────────────────

export function setStatus(msg: string): void {
  var el = document.getElementById('status');
  if (el) el.textContent = msg;
}

export function showGame(): void {
  var lobby = document.getElementById('lobby');
  var game = document.getElementById('game-container');
  var hud = document.getElementById('hud');
  var commentary = document.getElementById('commentary');

  if (lobby) lobby.style.display = 'none';
  if (game) game.style.display = 'block';
  if (hud) hud.style.display = 'block';
  if (commentary) commentary.style.display = 'block';
}

// ── FYTECRAFT ECONOMY PANEL ─────────────────────────────
// READS: snapshot.players[myPlayerId].baseTreasury / baseHp / constructionQueue
// WRITES: DOM only
export function updateEconomyPanel(snapshot: any, myPlayerId: string): void {
  if (!snapshot || !snapshot.players || !myPlayerId) return;
  var player = snapshot.players[myPlayerId];
  if (!player) return;
  var tEl = document.getElementById('econ-treasury');
  var hEl = document.getElementById('econ-base-hp');
  var qEl = document.getElementById('build-queue');
  if (tEl) tEl.textContent = String(Math.floor(player.baseTreasury ?? 0));
  if (hEl) hEl.textContent = String(Math.floor(player.baseHp ?? 500));
  if (qEl && player.constructionQueue) {
    qEl.innerHTML = '';
    if (player.constructionQueue.length === 0) {
      qEl.innerHTML = '<div class="build-item" style="color:#444466">No construction</div>';
    } else {
      player.constructionQueue.forEach(function(job: any) {
        var pct  = Math.round((1 - job.timeRemaining / job.timeTotal) * 100);
        var item = document.createElement('div');
        item.className = 'build-item';
        item.innerHTML = '<span>' + (job.type || 'Building') + '</span><span class="build-progress">' + pct + '%</span>';
        if (qEl) qEl.appendChild(item);
      });
    }
  }
}
// ── END FYTECRAFT ECONOMY PANEL ─────────────────────────
