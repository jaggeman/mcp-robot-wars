import {
  ArenaConfig,
  ArenaState,
  BotAction,
  BotState,
  Direction,
  GameEvent,
  Position,
  ShieldDirection,
  WeaponConfig,
} from './types.js';
import {
  getOffsetForDirection,
  getOppositeDirection,
  isWithinBounds,
  rotateDirection,
} from './arena.js';

export function calculateDamage(
  rawDamage: number,
  target: BotState,
  attackAngle: Direction,
  isArmorPiercing = false
): { actualDamage: number; blockedByShield: boolean } {
  let damage = rawDamage;

  // Check shield mitigation
  let blockedByShield = false;
  if (target.activeShield) {
    const shieldAngle = getShieldActualDirection(target.heading, target.activeShield);
    const attackSourceAngle = getOppositeDirection(attackAngle);
    if (shieldAngle === attackSourceAngle) {
      damage *= 0.35; // 65% damage reduction
      blockedByShield = true;
    }
  }

  // Armor mitigation
  const effectiveArmor = isArmorPiercing ? target.armor * 0.4 : target.armor;
  const reduction = (100 - effectiveArmor) / 100;
  damage = Math.max(1, Math.round(damage * reduction));

  return { actualDamage: damage, blockedByShield };
}

export function getShieldActualDirection(heading: Direction, shield: ShieldDirection): Direction {
  switch (shield) {
    case 'front': return heading;
    case 'rear': return getOppositeDirection(heading);
    case 'right': return rotateDirection(heading, 'turn_right');
    case 'left': return rotateDirection(heading, 'turn_left');
  }
}

export function findBotAt(bots: Record<string, BotState>, pos: Position, excludeId?: string): BotState | undefined {
  return Object.values(bots).find(b => b.isAlive && b.id !== excludeId && b.position.x === pos.x && b.position.y === pos.y);
}

export function pushBot(
  state: ArenaState,
  target: BotState,
  direction: Direction,
  distance: number,
  events: GameEvent[],
  reason: string
): void {
  const offset = getOffsetForDirection(direction);
  let pushedSteps = 0;

  for (let i = 0; i < distance; i++) {
    const nextPos: Position = { x: target.position.x + offset.x, y: target.position.y + offset.y };

    // Check bounds / wall collision
    if (!isWithinBounds(nextPos, state.config)) {
      // Hit wall
      target.hp = Math.max(0, target.hp - 10);
      events.push({
        turn: state.turn,
        timestamp: Date.now(),
        type: 'collision',
        actorId: target.id,
        details: { targetPos: nextPos, wallDamage: 10 },
        description: `💥 ${target.name} slammed into the perimeter wall for 10 wall-impact damage!`,
      });
      break;
    }

    // Check bot collision
    const other = findBotAt(state.bots, nextPos, target.id);
    if (other) {
      target.hp = Math.max(0, target.hp - 5);
      other.hp = Math.max(0, other.hp - 5);
      events.push({
        turn: state.turn,
        timestamp: Date.now(),
        type: 'collision',
        actorId: target.id,
        targetId: other.id,
        details: { targetPos: nextPos },
        description: `💥 ${target.name} collided into ${other.name}! Both took 5 impact damage.`,
      });
      break;
    }

    // Check The Pit
    const isPit = nextPos.x === state.config.pitPosition.x && nextPos.y === state.config.pitPosition.y;
    const isPitOpen = state.turn >= state.config.pitOpensAtTurn;
    if (isPit && isPitOpen) {
      target.position = nextPos;
      target.hp = 0;
      target.isAlive = false;
      events.push({
        turn: state.turn,
        timestamp: Date.now(),
        type: 'pit_fall',
        actorId: target.id,
        details: { reason },
        description: `🕳️☠️ DISASTER! ${target.name} was launched directly into THE PIT OF OBLIVION! Instant KO!`,
      });
      return;
    }

    target.position = nextPos;
    pushedSteps++;
  }
}
