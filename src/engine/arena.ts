import { ArenaConfig, ArenaState, Direction, Hazard, Position, RadarScanResult } from './types.js';

export function createDefaultArena(width = 12, height = 12, maxTurns = 30): ArenaConfig {
  const pitX = Math.floor(width / 2);
  const pitY = Math.floor(height / 2);

  const hazards: Hazard[] = [
    {
      id: 'hazard-pit',
      type: 'pit',
      position: { x: pitX, y: pitY },
      isActive: false,
      activeFromTurn: 6,
      damage: 9999, // Instant KO
      description: 'The Pit of Oblivion (Opens on Turn 6)',
    },
    {
      id: 'hazard-spikes-1',
      type: 'spikes',
      position: { x: 2, y: 2 },
      isActive: true,
      damage: 15,
      description: 'Pneumatic Floor Spikes (NW)',
    },
    {
      id: 'hazard-spikes-2',
      type: 'spikes',
      position: { x: width - 3, y: 2 },
      isActive: true,
      damage: 15,
      description: 'Pneumatic Floor Spikes (NE)',
    },
    {
      id: 'hazard-flame-1',
      type: 'flame_grate',
      position: { x: 2, y: height - 3 },
      isActive: true,
      damage: 20,
      description: 'Inferno Flame Grate (SW)',
    },
    {
      id: 'hazard-flame-2',
      type: 'flame_grate',
      position: { x: width - 3, y: height - 3 },
      isActive: true,
      damage: 20,
      description: 'Inferno Flame Grate (SE)',
    },
  ];

  return {
    name: 'The Steel Colosseum',
    width,
    height,
    pitPosition: { x: pitX, y: pitY },
    pitOpensAtTurn: 6,
    hazards,
    maxTurns,
  };
}

export function isWithinBounds(pos: Position, config: ArenaConfig): boolean {
  return pos.x >= 0 && pos.x < config.width && pos.y >= 0 && pos.y < config.height;
}

export function manhattanDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function euclideanDistance(a: Position, b: Position): number {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

export function getOffsetForDirection(heading: Direction): Position {
  switch (heading) {
    case 'N': return { x: 0, y: -1 };
    case 'S': return { x: 0, y: 1 };
    case 'E': return { x: 1, y: 0 };
    case 'W': return { x: -1, y: 0 };
  }
}

export function rotateDirection(current: Direction, turn: 'turn_left' | 'turn_right'): Direction {
  const dirs: Direction[] = ['N', 'E', 'S', 'W'];
  const idx = dirs.indexOf(current);
  if (turn === 'turn_right') {
    return dirs[(idx + 1) % 4];
  } else {
    return dirs[(idx + 3) % 4];
  }
}

export function getOppositeDirection(dir: Direction): Direction {
  switch (dir) {
    case 'N': return 'S';
    case 'S': return 'N';
    case 'E': return 'W';
    case 'W': return 'E';
  }
}

export function getRelativeAngle(fromPos: Position, fromHeading: Direction, toPos: Position): number {
  const dx = toPos.x - fromPos.x;
  const dy = toPos.y - fromPos.y;
  let targetAngle = Math.atan2(dy, dx) * (180 / Math.PI); // -180 to 180 (0 is East, 90 is South)
  if (targetAngle < 0) targetAngle += 360;

  const headingAngles: Record<Direction, number> = {
    E: 0,
    S: 90,
    W: 180,
    N: 270,
  };

  const ownAngle = headingAngles[fromHeading];
  let diff = (targetAngle - ownAngle + 360) % 360;
  if (diff > 180) diff -= 360;
  return Math.round(diff);
}

export function generateRadarScan(state: ArenaState, botId: string): RadarScanResult {
  const bot = state.bots[botId];
  if (!bot) {
    throw new Error(`Bot ${botId} not found in arena.`);
  }

  const isPitOpen = state.turn >= state.config.pitOpensAtTurn;
  const turnsUntilPit = Math.max(0, state.config.pitOpensAtTurn - state.turn);

  const visibleEnemies = Object.values(state.bots)
    .filter(other => other.id !== botId && other.isAlive)
    .map(other => ({
      id: other.id,
      name: other.name,
      position: { ...other.position },
      distance: Number(euclideanDistance(bot.position, other.position).toFixed(2)),
      relativeAngle: getRelativeAngle(bot.position, bot.heading, other.position),
      hpEstimate: other.hp,
      heading: other.heading,
    }));

  const nearbyHazards = state.config.hazards.map(h => {
    const active = h.type === 'pit' ? isPitOpen : h.isActive;
    return {
      type: h.type,
      position: { ...h.position },
      isActive: active,
      distance: Number(euclideanDistance(bot.position, h.position).toFixed(2)),
    };
  });

  // Check adjacent tiles
  const checkTileObstacle = (offset: Position) => {
    const targetPos = { x: bot.position.x + offset.x, y: bot.position.y + offset.y };
    if (!isWithinBounds(targetPos, state.config)) return true;
    const hasBot = Object.values(state.bots).some(b => b.id !== botId && b.isAlive && b.position.x === targetPos.x && b.position.y === targetPos.y);
    return hasBot;
  };

  const frontOffset = getOffsetForDirection(bot.heading);
  const rearOffset = getOffsetForDirection(getOppositeDirection(bot.heading));
  const rightDir = rotateDirection(bot.heading, 'turn_right');
  const leftDir = rotateDirection(bot.heading, 'turn_left');
  const rightOffset = getOffsetForDirection(rightDir);
  const leftOffset = getOffsetForDirection(leftDir);

  return {
    ownPosition: { ...bot.position },
    ownHeading: bot.heading,
    arenaSize: { width: state.config.width, height: state.config.height },
    pit: {
      position: { ...state.config.pitPosition },
      isOpen: isPitOpen,
      turnsUntilOpen: turnsUntilPit,
    },
    visibleEnemies,
    nearbyHazards,
    adjacentObstacles: {
      front: checkTileObstacle(frontOffset),
      rear: checkTileObstacle(rearOffset),
      left: checkTileObstacle(leftOffset),
      right: checkTileObstacle(rightOffset),
    },
  };
}
