// Arena Canvas & Spectator Controller
const canvas = document.getElementById('arena-canvas');
const ctx = canvas.getContext('2d');

let currentState = null;
let ws = null;
let particleEffects = [];

// DOM Elements - Tabs
const tabArena = document.getElementById('tab-arena');
const tabWorkshop = document.getElementById('tab-workshop');
const arenaViewSection = document.getElementById('arena-view-section');
const workshopSection = document.getElementById('workshop-section');

// DOM Elements - HUD
const turnCountEl = document.getElementById('turn-count');
const pitStatusEl = document.getElementById('pit-status');
const botANameEl = document.getElementById('bot-a-name');
const botAHpBar = document.getElementById('bot-a-hp-bar');
const botAHpText = document.getElementById('bot-a-hp-text');
const botAEnergyBar = document.getElementById('bot-a-energy-bar');
const botAEnergyText = document.getElementById('bot-a-energy-text');
const botAPos = document.getElementById('bot-a-pos');
const botAHeading = document.getElementById('bot-a-heading');
const botADmg = document.getElementById('bot-a-dmg');
const botAShield = document.getElementById('bot-a-shield');
const botAWeapons = document.getElementById('bot-a-weapons');

const botBNameEl = document.getElementById('bot-b-name');
const botBHpBar = document.getElementById('bot-b-hp-bar');
const botBHpText = document.getElementById('bot-b-hp-text');
const botBEnergyBar = document.getElementById('bot-b-energy-bar');
const botBEnergyText = document.getElementById('bot-b-energy-text');
const botBPos = document.getElementById('bot-b-pos');
const botBHeading = document.getElementById('bot-b-heading');
const botBDmg = document.getElementById('bot-b-dmg');
const botBShield = document.getElementById('bot-b-shield');
const botBWeapons = document.getElementById('bot-b-weapons');

const mapSelect = document.getElementById('map-select');
const eventLog = document.getElementById('event-log');
const matchOverlay = document.getElementById('match-overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg = document.getElementById('overlay-msg');

// Workshop DOM Elements
const wsArmor = document.getElementById('ws-armor');
const wsArmorVal = document.getElementById('ws-armor-val');
const wsSpeed = document.getElementById('ws-speed');
const wsSpeedVal = document.getElementById('ws-speed-val');
const wsEnergy = document.getElementById('ws-energy');
const wsEnergyVal = document.getElementById('ws-energy-val');
const wsWeapon1 = document.getElementById('ws-weapon-1');
const wsWeapon2 = document.getElementById('ws-weapon-2');
const wsPrompt = document.getElementById('ws-prompt');
const wsPointsBadge = document.getElementById('ws-points-badge');
const wsPointsBar = document.getElementById('ws-points-bar');
const wsTokensBadge = document.getElementById('ws-tokens-badge');
const wsTokensBar = document.getElementById('ws-tokens-bar');
const wsFeedback = document.getElementById('ws-feedback');
const wsCertifyBtn = document.getElementById('ws-certify-btn');

// Tab Switching
tabArena.addEventListener('click', () => {
  tabArena.classList.add('active');
  tabWorkshop.classList.remove('active');
  arenaViewSection.classList.remove('hidden');
  workshopSection.classList.add('hidden');
});

tabWorkshop.addEventListener('click', () => {
  tabWorkshop.classList.add('active');
  tabArena.classList.remove('active');
  workshopSection.classList.remove('hidden');
  arenaViewSection.classList.add('hidden');
  updateWorkshopCalculation();
});

// Connect WebSocket
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

  ws.onopen = () => {
    console.log('[WS] Connected to arena server');
    addLogEntry({ type: 'move', description: '🟢 Connected to Arena Match Server.' });
  };

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'match_init') {
      currentState = message.data.state;
      matchOverlay.classList.add('hidden');
      updateHUD(currentState);
      renderArena(currentState);
    } else if (message.type === 'turn_update') {
      currentState = message.data.state;
      updateHUD(currentState);
      renderArena(currentState);
      if (message.data.newEvents) {
        message.data.newEvents.forEach(evt => {
          addLogEntry(evt);
          triggerEventFx(evt);
        });
      }
    } else if (message.type === 'match_end') {
      currentState = message.data.state;
      updateHUD(currentState);
      renderArena(currentState);
      showMatchEndOverlay(currentState);
    }
  };

  ws.onclose = () => {
    console.log('[WS] Disconnected, retrying in 2s...');
    setTimeout(connectWebSocket, 2000);
  };
}

function updateHUD(state) {
  if (!state) return;
  turnCountEl.textContent = `${state.turn} / ${state.maxTurns}`;

  const isPitOpen = state.config.pitPosition.x >= 0 && state.turn >= state.config.pitOpensAtTurn;
  if (state.config.mapType === 'lava_chamber') {
    pitStatusEl.textContent = 'SHRINKING';
    pitStatusEl.style.color = '#ff6600';
  } else if (isPitOpen) {
    pitStatusEl.textContent = 'OPEN (ACTIVE)';
    pitStatusEl.style.color = '#ff3366';
  } else if (state.config.pitPosition.x >= 0) {
    const left = state.config.pitOpensAtTurn - state.turn;
    pitStatusEl.textContent = `OPENS IN ${left} TURNS`;
    pitStatusEl.style.color = '#ffb700';
  } else {
    pitStatusEl.textContent = 'N/A';
    pitStatusEl.style.color = '#64748b';
  }

  const bots = Object.values(state.bots);
  if (bots.length >= 2) {
    const [botA, botB] = bots;

    // Bot A
    botANameEl.textContent = botA.name;
    const hpPctA = Math.max(0, (botA.hp / botA.maxHp) * 100);
    botAHpBar.style.width = `${hpPctA}%`;
    botAHpText.textContent = `${botA.hp}/${botA.maxHp}`;
    const energyPctA = Math.max(0, (botA.energy / botA.maxEnergy) * 100);
    botAEnergyBar.style.width = `${energyPctA}%`;
    botAEnergyText.textContent = `${botA.energy}/${botA.maxEnergy}`;
    botAPos.textContent = `(${botA.position.x}, ${botA.position.y})`;
    botAHeading.textContent = getHeadingLabel(botA.heading);
    botADmg.textContent = botA.score.damageDealt;
    botAShield.textContent = botA.activeShield ? botA.activeShield.toUpperCase() : 'OFF';
    renderWeapons(botAWeapons, botA.weapons, botA.energy);

    // Bot B
    botBNameEl.textContent = botB.name;
    const hpPctB = Math.max(0, (botB.hp / botB.maxHp) * 100);
    botBHpBar.style.width = `${hpPctB}%`;
    botBHpText.textContent = `${botB.hp}/${botB.maxHp}`;
    const energyPctB = Math.max(0, (botB.energy / botB.maxEnergy) * 100);
    botBEnergyBar.style.width = `${energyPctB}%`;
    botBEnergyText.textContent = `${botB.energy}/${botB.maxEnergy}`;
    botBPos.textContent = `(${botB.position.x}, ${botB.position.y})`;
    botBHeading.textContent = getHeadingLabel(botB.heading);
    botBDmg.textContent = botB.score.damageDealt;
    botBShield.textContent = botB.activeShield ? botB.activeShield.toUpperCase() : 'OFF';
    renderWeapons(botBWeapons, botB.weapons, botB.energy);
  }
}

function getHeadingLabel(heading) {
  const map = { N: 'NORTH (▲)', E: 'EAST (▶)', S: 'SOUTH (▼)', W: 'WEST (◀)' };
  return map[heading] || heading;
}

function renderWeapons(container, weapons, energy) {
  container.innerHTML = '';
  weapons.forEach(w => {
    const chip = document.createElement('div');
    chip.className = 'weapon-chip';
    const isReady = w.currentCooldown === 0 && energy >= w.energyCost;
    chip.innerHTML = `
      <span>${w.name}</span>
      <span class="${isReady ? 'weapon-ready' : 'weapon-cooldown'}">
        ${isReady ? 'READY' : (w.currentCooldown > 0 ? `CD: ${w.currentCooldown}` : 'LOW NRG')}
      </span>
    `;
    container.appendChild(chip);
  });
}

function addLogEntry(evt) {
  const entry = document.createElement('div');
  entry.className = `log-entry ${evt.type}`;
  entry.textContent = `[T${evt.turn || 0}] ${evt.description}`;
  eventLog.appendChild(entry);
  eventLog.scrollTop = eventLog.scrollHeight;
}

function showMatchEndOverlay(state) {
  matchOverlay.classList.remove('hidden');
  const winner = state.winnerId ? state.bots[state.winnerId] : null;

  if (winner) {
    overlayTitle.textContent = `🏆 ${winner.name} WINS!`;
    overlayTitle.style.color = '#00ff88';
    overlayMsg.textContent = `Victory in ${state.config.name} by ${state.endReason ? state.endReason.toUpperCase().replace('_', ' ') : 'DOMINATION'}!`;
  } else {
    overlayTitle.textContent = '💥 MATCH DRAW!';
    overlayTitle.style.color = '#ffb700';
    overlayMsg.textContent = 'Both robots were destroyed or tied on points.';
  }
}

function triggerEventFx(evt) {
  if (evt.type === 'attack' || evt.type === 'collision' || evt.type === 'house_robot_attack') {
    const actor = currentState && currentState.bots[evt.actorId];
    if (actor) {
      createSparkExplosion(actor.position.x, actor.position.y);
    }
  }
}

function createSparkExplosion(gridX, gridY) {
  const cellSize = canvas.width / (currentState?.config.width || 12);
  const px = gridX * cellSize + cellSize / 2;
  const py = gridY * cellSize + cellSize / 2;

  for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4 + 1;
    particleEffects.push({
      x: px,
      y: py,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.0,
      decay: Math.random() * 0.05 + 0.03,
      color: Math.random() > 0.5 ? '#ff3366' : '#ffea00',
    });
  }
}

// Canvas Rendering
function renderArena(state) {
  if (!state) return;
  const { width, height, pitPosition, pitOpensAtTurn, hazards, houseRobots, mapType } = state.config;
  const cellSize = canvas.width / width;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw Grid Tiles
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#0b0f19' : '#0e1422';
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);

      ctx.strokeStyle = '#172033';
      ctx.lineWidth = 1;
      ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
  }

  // Draw House Robot Corner Patrol Zones (CPZ)
  if (houseRobots && houseRobots.length > 0) {
    houseRobots.forEach(h => {
      const z = h.homeZone;
      const zx = z.minX * cellSize;
      const zy = z.minY * cellSize;
      const zw = (z.maxX - z.minX + 1) * cellSize;
      const zh = (z.maxY - z.minY + 1) * cellSize;

      ctx.fillStyle = 'rgba(255, 51, 102, 0.08)';
      ctx.fillRect(zx, zy, zw, zh);
      ctx.strokeStyle = 'rgba(255, 51, 102, 0.4)';
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(zx, zy, zw, zh);
      ctx.setLineDash([]);

      // Draw House Robot Guardian
      const hx = h.position.x * cellSize + cellSize / 2;
      const hy = h.position.y * cellSize + cellSize / 2;
      ctx.font = `${cellSize * 0.6}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(h.id.includes('killalot') ? '🛡️' : '🐗', hx, hy);
    });
  }

  // Draw Hazards (Pit, Spikes, Flames, Lava, Pillars)
  const isPitOpen = pitPosition.x >= 0 && state.turn >= pitOpensAtTurn;

  // The Pit
  if (pitPosition.x >= 0) {
    const pitPx = pitPosition.x * cellSize;
    const pitPy = pitPosition.y * cellSize;
    if (isPitOpen) {
      ctx.fillStyle = '#ff0044';
      ctx.shadowColor = '#ff0044';
      ctx.shadowBlur = 15;
      ctx.fillRect(pitPx + 2, pitPy + 2, cellSize - 4, cellSize - 4);
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#000';
      ctx.font = `bold ${cellSize * 0.4}px Orbitron`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PIT', pitPx + cellSize / 2, pitPy + cellSize / 2);
    } else {
      ctx.fillStyle = '#3a2d0b';
      ctx.fillRect(pitPx + 2, pitPy + 2, cellSize - 4, cellSize - 4);
      ctx.strokeStyle = '#ffb700';
      ctx.lineWidth = 2;
      ctx.strokeRect(pitPx + 4, pitPy + 4, cellSize - 8, cellSize - 8);

      ctx.fillStyle = '#ffb700';
      ctx.font = `bold ${cellSize * 0.28}px Orbitron`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`LOCKED`, pitPx + cellSize / 2, pitPy + cellSize / 2);
    }
  }

  // Other Hazards
  hazards.forEach(h => {
    if (h.type === 'pit') return;
    const hx = h.position.x * cellSize;
    const hy = h.position.y * cellSize;

    if (h.type === 'lava') {
      ctx.fillStyle = 'rgba(255, 68, 0, 0.85)';
      ctx.fillRect(hx, hy, cellSize, cellSize);
      ctx.strokeStyle = '#ffea00';
      ctx.strokeRect(hx + 1, hy + 1, cellSize - 2, cellSize - 2);
    } else if (h.type === 'spikes') {
      ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
      ctx.fillRect(hx + 3, hy + 3, cellSize - 6, cellSize - 6);
      ctx.fillStyle = '#00f0ff';
      ctx.font = `${cellSize * 0.4}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡', hx + cellSize / 2, hy + cellSize / 2);
    } else if (h.type === 'flame_grate') {
      ctx.fillStyle = 'rgba(255, 100, 0, 0.18)';
      ctx.fillRect(hx + 3, hy + 3, cellSize - 6, cellSize - 6);
      ctx.fillStyle = '#ff6600';
      ctx.font = `${cellSize * 0.4}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔥', hx + cellSize / 2, hy + cellSize / 2);
    } else if (h.type === 'obstacle_pillar') {
      ctx.fillStyle = '#475569';
      ctx.fillRect(hx + 2, hy + 2, cellSize - 4, cellSize - 4);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.strokeRect(hx + 2, hy + 2, cellSize - 4, cellSize - 4);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = `bold ${cellSize * 0.35}px Orbitron`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🧱', hx + cellSize / 2, hy + cellSize / 2);
    }
  });

  // Draw Bots
  const bots = Object.values(state.bots);
  bots.forEach((bot, idx) => {
    if (!bot.isAlive) {
      const wx = bot.position.x * cellSize + cellSize / 2;
      const wy = bot.position.y * cellSize + cellSize / 2;
      ctx.fillStyle = '#475569';
      ctx.font = `${cellSize * 0.5}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💥', wx, wy);
      return;
    }

    const bx = bot.position.x * cellSize + cellSize / 2;
    const by = bot.position.y * cellSize + cellSize / 2;
    const botRadius = cellSize * 0.38;
    const isBotA = idx === 0;

    ctx.save();
    ctx.translate(bx, by);

    const angleMap = { E: 0, S: Math.PI / 2, W: Math.PI, N: -Math.PI / 2 };
    ctx.rotate(angleMap[bot.heading] || 0);

    // Bot Chassis
    ctx.shadowColor = isBotA ? '#ff3366' : '#0088ff';
    ctx.shadowBlur = 10;
    ctx.fillStyle = isBotA ? '#ff3366' : '#0088ff';
    ctx.beginPath();
    ctx.roundRect(-botRadius, -botRadius, botRadius * 2, botRadius * 2, 6);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Heading Pointer / Wedge
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(botRadius * 0.9, 0);
    ctx.lineTo(botRadius * 0.2, -botRadius * 0.5);
    ctx.lineTo(botRadius * 0.2, botRadius * 0.5);
    ctx.closePath();
    ctx.fill();

    // Shield effect if active
    if (bot.activeShield) {
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, 0, botRadius * 1.3, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.restore();

    // Mini HP-bar above bot
    const barW = cellSize * 0.8;
    const barH = 4;
    const barX = bx - barW / 2;
    const barY = by - cellSize * 0.45;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = isBotA ? '#ff3366' : '#0088ff';
    ctx.fillRect(barX, barY, (bot.hp / bot.maxHp) * barW, barH);
  });

  // Render & update particles
  for (let i = particleEffects.length - 1; i >= 0; i--) {
    const p = particleEffects[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= p.decay;

    if (p.life <= 0) {
      particleEffects.splice(i, 1);
      continue;
    }

    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }
}

function animationLoop() {
  if (currentState && !arenaViewSection.classList.contains('hidden')) {
    renderArena(currentState);
  }
  requestAnimationFrame(animationLoop);
}

// Workshop Real-time Calculation
function updateWorkshopCalculation() {
  const armor = parseInt(wsArmor.value, 10);
  const speed = parseInt(wsSpeed.value, 10);
  const energy = parseInt(wsEnergy.value, 10);
  const w1 = wsWeapon1.value;
  const w2 = wsWeapon2.value;
  const promptText = wsPrompt.value;

  wsArmorVal.textContent = `${armor}% (${Math.round(armor / 2)} pts)`;
  wsSpeedVal.textContent = `Speed ${speed} (${Math.max(0, (speed - 1) * 15)} pts)`;
  wsEnergyVal.textContent = `${energy} Energy (${Math.max(0, Math.round((energy - 80) / 2))} pts)`;

  const weaponCosts = { spinner: 35, flipper: 25, axe: 25, ram: 10, none: 0 };
  const w1Cost = weaponCosts[w1] || 0;
  const w2Cost = weaponCosts[w2] || 0;

  const totalPoints = Math.round(armor / 2) + Math.max(0, (speed - 1) * 15) + Math.max(0, Math.round((energy - 80) / 2)) + w1Cost + w2Cost;
  
  // Estimate tokens
  const words = promptText.trim().split(/\s+/).filter(Boolean).length;
  const estimatedTokens = Math.ceil(Math.max(words * 1.3, promptText.length / 3.8));

  // Update Badges
  wsPointsBadge.textContent = `${totalPoints} / 100 PTS`;
  wsPointsBadge.className = totalPoints <= 100 ? 'badge-good' : 'badge-bad';
  wsPointsBar.style.width = `${Math.min(100, (totalPoints / 100) * 100)}%`;
  wsPointsBar.className = `bar-fill ${totalPoints <= 100 ? 'hp-bar-b' : 'hp-bar-a'}`;

  wsTokensBadge.textContent = `${estimatedTokens} / 500 TOKENS`;
  wsTokensBadge.className = estimatedTokens <= 500 ? 'badge-good' : 'badge-bad';
  wsTokensBar.style.width = `${Math.min(100, (estimatedTokens / 500) * 100)}%`;
  wsTokensBar.className = `bar-fill ${estimatedTokens <= 500 ? 'energy-bar' : 'hp-bar-a'}`;

  if (totalPoints > 100) {
    wsFeedback.className = 'ws-feedback invalid';
    wsFeedback.textContent = `❌ Overweight! Total weight points (${totalPoints} pts) exceed 100 pts budget.`;
  } else if (estimatedTokens > 500) {
    wsFeedback.className = 'ws-feedback invalid';
    wsFeedback.textContent = `❌ Prompt too large! Estimated token count (${estimatedTokens}) exceeds 500 limit.`;
  } else {
    wsFeedback.className = 'ws-feedback valid';
    wsFeedback.textContent = `✅ Combat Legal! Blueprint verified within 100 pts and 500 tokens.`;
  }
}

[wsArmor, wsSpeed, wsEnergy, wsWeapon1, wsWeapon2].forEach(el => {
  el.addEventListener('input', updateWorkshopCalculation);
});
wsPrompt.addEventListener('input', updateWorkshopCalculation);

wsCertifyBtn.addEventListener('click', () => {
  updateWorkshopCalculation();
  if (wsFeedback.classList.contains('valid')) {
    alert(`🎉 Blueprint Certified! Saved to local workshop.`);
  } else {
    alert(`⚠️ Cannot certify! Please resolve budget errors first.`);
  }
});

// Button Handlers
document.getElementById('start-btn').addEventListener('click', async () => {
  const bot1Strategy = document.getElementById('bot1-strategy').value;
  const bot2Strategy = document.getElementById('bot2-strategy').value;
  const mapType = mapSelect.value;

  await fetch('/api/matches/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bot1Strategy, bot2Strategy, mapType }),
  });
});

document.getElementById('step-btn').addEventListener('click', async () => {
  await fetch('/api/matches/step', { method: 'POST' });
});

document.getElementById('pause-btn').addEventListener('click', async () => {
  await fetch('/api/matches/pause', { method: 'POST' });
});

document.getElementById('reset-btn').addEventListener('click', async () => {
  const mapType = mapSelect.value;
  await fetch('/api/matches/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mapType }),
  });
});

document.getElementById('overlay-restart-btn').addEventListener('click', async () => {
  matchOverlay.classList.add('hidden');
  const mapType = mapSelect.value;
  await fetch('/api/matches/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mapType }),
  });
});

document.getElementById('clear-feed').addEventListener('click', () => {
  eventLog.innerHTML = '';
});

// Start WebSocket & Render loop
connectWebSocket();
requestAnimationFrame(animationLoop);
