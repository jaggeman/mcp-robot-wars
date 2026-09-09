import {
  ArenaConfig,
  ArenaState,
  BotAction,
  BotBlueprint,
  BotState,
  Direction,
  GameEvent,
  Position,
  WeaponType,
} from './types.js';
import { createDefaultArena, getOffsetForDirection, getOppositeDirection, isWithinBounds, rotateDirection } from './arena.js';
import { createBot } from './bot.js';
import { calculateDamage, findBotAt, pushBot } from './combat.js';

export function initializeMatch(
  blueprints: [BotBlueprint, BotBlueprint],
  config: ArenaConfig = createDefaultArena()
): ArenaState {
  const startPositions: Position[] = [
    { x: 1, y: 1 },
    { x: config.width - 2, y: config.height - 2 },
  ];
  const startHeadings: Direction[] = ['E', 'W'];

  const bots: Record<string, BotState> = {
    [blueprints[0].id]: createBot(blueprints[0], startPositions[0], startHeadings[0]),
    [blueprints[1].id]: createBot(blueprints[1], startPositions[1], startHeadings[1]),
  };

  const initialEvents: GameEvent[] = [
    {
      turn: 0,
      timestamp: Date.now(),
      type: 'move',
      description: `🏁 MATCH STARTED! ${blueprints[0].name} vs ${blueprints[1].name} in ${config.name}!`,
      details: {},
    },
  ];

  return {
    turn: 1,
    maxTurns: config.maxTurns,
    config,
    bots,
    winnerId: null,
    isGameOver: false,
    endReason: null,
    events: initialEvents,
  };
}

export function executeTurn(
  state: ArenaState,
  actions: Record<string, BotAction>
): ArenaState {
  if (state.isGameOver) return state;

  const currentTurn = state.turn;
  const newEvents: GameEvent[] = [];

  // Reset turn-temporary states (e.g. active shields) and regenerate small energy (+5)
  for (const bot of Object.values(state.bots)) {
    if (!bot.isAlive) continue;
    bot.activeShield = null;
    bot.energy = Math.min(bot.maxEnergy, bot.energy + 5);
    bot.score.turnsSurvived++;
    for (const weapon of bot.weapons) {
      if (weapon.currentCooldown > 0) {
        weapon.currentCooldown--;
      }
    }
  }

  // Check if The Pit just opened this turn
  if (currentTurn === state.config.pitOpensAtTurn) {
    newEvents.push({
      turn: currentTurn,
      timestamp: Date.now(),
      type: 'hazard_activated',
      description: `⚠️🚨 KLAXONS SOUNDING! THE PIT OF OBLIVION HAS OPENED AT (${state.config.pitPosition.x}, ${state.config.pitPosition.y})!`,
      details: { pitPosition: state.config.pitPosition },
    });
  }

  // 1. Process Shield Actions first (defensive stance takes priority)
  for (const [botId, action] of Object.entries(actions)) {
    const bot = state.bots[botId];
    if (!bot || !bot.isAlive) continue;

    if (action.type === 'shield') {
      if (bot.energy >= 10) {
        bot.energy -= 10;
        bot.activeShield = action.direction;
        newEvents.push({
          turn: currentTurn,
          timestamp: Date.now(),
          type: 'shield_raised',
          actorId: bot.id,
          details: { direction: action.direction },
          description: `🛡️ ${bot.name} raised energy shield facing ${action.direction}!`,
        });
      } else {
        newEvents.push({
          turn: currentTurn,
          timestamp: Date.now(),
          type: 'stall',
          actorId: bot.id,
          details: { reason: 'low_energy' },
          description: `⚠️ ${bot.name} attempted to raise shield but had insufficient energy!`,
        });
      }
    }
  }

  // 2. Process Move Actions
  for (const [botId, action] of Object.entries(actions)) {
    const bot = state.bots[botId];
    if (!bot || !bot.isAlive) continue;

    if (action.type === 'move') {
      executeMoveAction(state, bot, action.direction, action.steps, newEvents);
    }
  }

  // 3. Process Attack Actions
  for (const [botId, action] of Object.entries(actions)) {
    const bot = state.bots[botId];
    if (!bot || !bot.isAlive) continue;

    if (action.type === 'attack') {
      executeAttackAction(state, bot, action.weapon, action.power ?? 1, newEvents);
    }
  }

  // 4. Resolve Floor Hazard Damage for bots standing on hazards
  const isPitOpen = currentTurn >= state.config.pitOpensAtTurn;
  for (const bot of Object.values(state.bots)) {
    if (!bot.isAlive) continue;

    // Check Pit
    if (isPitOpen && bot.position.x === state.config.pitPosition.x && bot.position.y === state.config.pitPosition.y) {
      bot.hp = 0;
      bot.isAlive = false;
      newEvents.push({
        turn: currentTurn,
        timestamp: Date.now(),
        type: 'pit_fall',
        actorId: bot.id,
        details: {},
        description: `🕳️☠️ ${bot.name} stumbled directly into THE PIT! Instant KO!`,
      });
      continue;
    }

    // Check Spikes / Flames
    for (const hazard of state.config.hazards) {
      if (hazard.type === 'pit') continue;
      if (hazard.isActive && bot.position.x === hazard.position.x && bot.position.y === hazard.position.y) {
        bot.hp = Math.max(0, bot.hp - hazard.damage);
        bot.score.hazardsTriggered++;
        newEvents.push({
          turn: currentTurn,
          timestamp: Date.now(),
          type: 'hazard_damage',
          actorId: bot.id,
          details: { hazardType: hazard.type, damage: hazard.damage },
          description: `🔥⚠️ ${bot.name} was scorched by ${hazard.description} taking ${hazard.damage} hazard damage! (HP: ${bot.hp}/${bot.maxHp})`,
        });
        if (bot.hp === 0) {
          bot.isAlive = false;
          newEvents.push({
            turn: currentTurn,
            timestamp: Date.now(),
            type: 'knockout',
            actorId: bot.id,
            details: { reason: 'hazard' },
            description: `💥💀 ${bot.name} was DESTROYED by arena hazards!`,
          });
        }
      }
    }
  }

  // 5. Check Game Over Conditions
  const aliveBots = Object.values(state.bots).filter(b => b.isAlive);
  let isGameOver = false;
  let winnerId: string | null = null;
  let endReason: 'knockout' | 'pit_fall' | 'judges_decision' | 'forfeit' | null = null;

  if (aliveBots.length === 1) {
    isGameOver = true;
    winnerId = aliveBots[0].id;
    const hasPitFall = newEvents.some(e => e.type === 'pit_fall') || state.events.some(e => e.type === 'pit_fall');
    endReason = hasPitFall ? 'pit_fall' : 'knockout';
    newEvents.push({
      turn: currentTurn,
      timestamp: Date.now(),
      type: 'match_end',
      details: { winnerId, reason: endReason },
      description: `🏆 VICTORY! ${aliveBots[0].name} is the champion of the arena!`,
    });
  } else if (aliveBots.length === 0) {
    isGameOver = true;
    winnerId = null; // Draw / mutual destruction
    endReason = 'knockout';
    newEvents.push({
      turn: currentTurn,
      timestamp: Date.now(),
      type: 'match_end',
      details: { winnerId: null, reason: 'draw' },
      description: `💥 MUTUAL DESTRUCTION! Both robots destroyed! Match is a DRAW!`,
    });
  } else if (currentTurn >= state.maxTurns) {
    isGameOver = true;
    endReason = 'judges_decision';
    // Judge decision based on HP and score
    const [botA, botB] = aliveBots;
    const scoreA = botA.hp * 2 + botA.score.damageDealt;
    const scoreB = botB.hp * 2 + botB.score.damageDealt;

    if (scoreA > scoreB) winnerId = botA.id;
    else if (scoreB > scoreA) winnerId = botB.id;
    else winnerId = null;

    const winnerName = winnerId ? state.bots[winnerId].name : 'Nobody (Tie)';
    newEvents.push({
      turn: currentTurn,
      timestamp: Date.now(),
      type: 'match_end',
      details: { winnerId, reason: 'judges_decision', scoreA, scoreB },
      description: `⏱️ TIME IS UP! Judges' Decision: ${winnerName} wins on points (${scoreA} pts vs ${scoreB} pts)!`,
    });
  }

  return {
    ...state,
    turn: currentTurn + 1,
    isGameOver,
    winnerId,
    endReason,
    events: [...state.events, ...newEvents],
  };
}

function executeMoveAction(
  state: ArenaState,
  bot: BotState,
  direction: 'forward' | 'backward' | 'turn_left' | 'turn_right' | 'strafe_left' | 'strafe_right',
  steps = 1,
  events: GameEvent[]
): void {
  const maxSteps = Math.min(steps, bot.speed);

  if (direction === 'turn_left' || direction === 'turn_right') {
    bot.heading = rotateDirection(bot.heading, direction);
    events.push({
      turn: state.turn,
      timestamp: Date.now(),
      type: 'move',
      actorId: bot.id,
      details: { turn: direction, newHeading: bot.heading },
      description: `🔄 ${bot.name} turned ${direction.replace('turn_', '')} to face ${bot.heading}.`,
    });
    return;
  }

  // Calculate direction vector
  let moveDir: Direction = bot.heading;
  if (direction === 'backward') {
    moveDir = getOppositeDirection(bot.heading);
  } else if (direction === 'strafe_left') {
    moveDir = rotateDirection(bot.heading, 'turn_left');
  } else if (direction === 'strafe_right') {
    moveDir = rotateDirection(bot.heading, 'turn_right');
  }

  const offset = getOffsetForDirection(moveDir);

  for (let s = 0; s < maxSteps; s++) {
    const nextPos: Position = { x: bot.position.x + offset.x, y: bot.position.y + offset.y };

    // Wall collision
    if (!isWithinBounds(nextPos, state.config)) {
      bot.hp = Math.max(0, bot.hp - 3);
      events.push({
        turn: state.turn,
        timestamp: Date.now(),
        type: 'collision',
        actorId: bot.id,
        details: { collision: 'wall' },
        description: `🧱 ${bot.name} bumped into the arena perimeter wall! (3 damage)`,
      });
      break;
    }

    // Bot collision (Ramming!)
    const targetBot = findBotAt(state.bots, nextPos, bot.id);
    if (targetBot) {
      const ramDamage = 12;
      const { actualDamage } = calculateDamage(ramDamage, targetBot, moveDir);
      targetBot.hp = Math.max(0, targetBot.hp - actualDamage);
      bot.score.damageDealt += actualDamage;
      bot.score.hitsLanded++;

      // Rammer takes minor recoil
      bot.hp = Math.max(0, bot.hp - 3);

      events.push({
        turn: state.turn,
        timestamp: Date.now(),
        type: 'attack',
        actorId: bot.id,
        targetId: targetBot.id,
        details: { action: 'ram', damage: actualDamage },
        description: `🚜💥 RAMMING ATTACK! ${bot.name} rammed ${targetBot.name} for ${actualDamage} damage! (${targetBot.name} HP: ${targetBot.hp}/${targetBot.maxHp})`,
      });

      // Push opponent back 1 tile in ram direction
      pushBot(state, targetBot, moveDir, 1, events, 'ram');

      if (targetBot.hp === 0 && targetBot.isAlive) {
        targetBot.isAlive = false;
        events.push({
          turn: state.turn,
          timestamp: Date.now(),
          type: 'knockout',
          actorId: bot.id,
          targetId: targetBot.id,
          details: { reason: 'ram_damage' },
          description: `💥💀 KNOCKOUT! ${targetBot.name} was wrecked by ${bot.name}'s ramming attack!`,
        });
      }
      break;
    }

    // Pit collision
    const isPit = nextPos.x === state.config.pitPosition.x && nextPos.y === state.config.pitPosition.y;
    const isPitOpen = state.turn >= state.config.pitOpensAtTurn;
    if (isPit && isPitOpen) {
      bot.position = nextPos;
      bot.hp = 0;
      bot.isAlive = false;
      events.push({
        turn: state.turn,
        timestamp: Date.now(),
        type: 'pit_fall',
        actorId: bot.id,
        details: {},
        description: `🕳️☠️ SUICIDE DIVE! ${bot.name} drove straight into the open PIT! Instant KO!`,
      });
      break;
    }

    bot.position = nextPos;
  }

  events.push({
    turn: state.turn,
    timestamp: Date.now(),
    type: 'move',
    actorId: bot.id,
    details: { newPos: bot.position },
    description: `🏎️ ${bot.name} moved to (${bot.position.x}, ${bot.position.y}).`,
  });
}

function executeAttackAction(
  state: ArenaState,
  bot: BotState,
  weaponType: WeaponType,
  power = 1,
  events: GameEvent[]
): void {
  const weapon = bot.weapons.find(w => w.type === weaponType);
  if (!weapon) {
    events.push({
      turn: state.turn,
      timestamp: Date.now(),
      type: 'stall',
      actorId: bot.id,
      details: { error: 'unknown_weapon' },
      description: `⚠️ ${bot.name} tried to fire weapon ${weaponType}, but it's not equipped!`,
    });
    return;
  }

  if (weapon.currentCooldown > 0) {
    events.push({
      turn: state.turn,
      timestamp: Date.now(),
      type: 'stall',
      actorId: bot.id,
      details: { error: 'cooldown', currentCooldown: weapon.currentCooldown },
      description: `⚠️ ${bot.name}'s ${weapon.name} is overheated / on cooldown (${weapon.currentCooldown} turns left)!`,
    });
    return;
  }

  if (bot.energy < weapon.energyCost) {
    events.push({
      turn: state.turn,
      timestamp: Date.now(),
      type: 'stall',
      actorId: bot.id,
      details: { error: 'insufficient_energy' },
      description: `⚠️ ${bot.name} lacked energy (${bot.energy}/${weapon.energyCost}) to fire ${weapon.name}!`,
    });
    return;
  }

  // Consume energy and set cooldown
  bot.energy -= weapon.energyCost;
  weapon.currentCooldown = weapon.cooldown;

  // Determine target tile (tile directly in front of bot)
  const offset = getOffsetForDirection(bot.heading);
  const targetTile: Position = { x: bot.position.x + offset.x, y: bot.position.y + offset.y };

  const targetBot = findBotAt(state.bots, targetTile, bot.id);
  if (!targetBot) {
    events.push({
      turn: state.turn,
      timestamp: Date.now(),
      type: 'attack',
      actorId: bot.id,
      details: { weapon: weapon.name, hit: false, targetTile },
      description: `💨 ${bot.name} unleashed ${weapon.name} at (${targetTile.x}, ${targetTile.y}) but hit empty air!`,
    });
    return;
  }

  // Calculate damage
  const isArmorPiercing = weapon.specialEffect === 'armor_pierce';
  const rawDamage = Math.round(weapon.damage * Math.max(0.5, Math.min(1.5, power)));
  const { actualDamage, blockedByShield } = calculateDamage(rawDamage, targetBot, bot.heading, isArmorPiercing);

  targetBot.hp = Math.max(0, targetBot.hp - actualDamage);
  bot.score.damageDealt += actualDamage;
  bot.score.hitsLanded++;

  const shieldNote = blockedByShield ? ' (65% absorbed by directional shield!)' : '';
  events.push({
    turn: state.turn,
    timestamp: Date.now(),
    type: 'attack',
    actorId: bot.id,
    targetId: targetBot.id,
    details: { weapon: weapon.name, damage: actualDamage, blockedByShield, hit: true },
    description: `⚡💥 ${bot.name} struck ${targetBot.name} with ${weapon.name} for ${actualDamage} damage${shieldNote}! (${targetBot.name} HP: ${targetBot.hp}/${targetBot.maxHp})`,
  });

  // Weapon special effects
  if (weapon.type === 'spinner') {
    pushBot(state, targetBot, bot.heading, 1, events, 'spinner');
  } else if (weapon.type === 'flipper') {
    // Flipper launches opponent 2 tiles back and randomizes their heading!
    pushBot(state, targetBot, bot.heading, 2, events, 'flipper');
    if (targetBot.isAlive) {
      targetBot.heading = rotateDirection(targetBot.heading, 'turn_right');
      events.push({
        turn: state.turn,
        timestamp: Date.now(),
        type: 'move',
        actorId: targetBot.id,
        details: { flipped: true },
        description: `🌀 ${targetBot.name} was FLIPPED through the air and disoriented!`,
      });
    }
  }

  // Check target knockout
  if (targetBot.hp === 0 && targetBot.isAlive) {
    targetBot.isAlive = false;
    events.push({
      turn: state.turn,
      timestamp: Date.now(),
      type: 'knockout',
      actorId: bot.id,
      targetId: targetBot.id,
      details: { weapon: weapon.name },
      description: `💥💀 KNOCKOUT! ${targetBot.name} was ripped apart by ${bot.name}'s ${weapon.name}!`,
    });
  }
}
