import { ArenaState, BotAction, BotBlueprint, Direction, Position } from '../engine/types.js';
import { generateRadarScan, getOffsetForDirection, rotateDirection } from '../engine/arena.js';
import { BotController } from '../runner/match.js';

export class HeuristicBot implements BotController {
  public id: string;
  public name: string;
  public blueprint: BotBlueprint;
  private strategy: 'aggressive' | 'tactical' | 'flipper_pusher';

  constructor(id: string, name: string, strategy: 'aggressive' | 'tactical' | 'flipper_pusher' = 'aggressive') {
    this.id = id;
    this.name = name;
    this.strategy = strategy;
    this.blueprint = {
      id,
      name,
      maxHp: 100,
      maxEnergy: 100,
      armor: strategy === 'tactical' ? 20 : 10,
      speed: 2,
    };
  }

  public async decideTurn(state: ArenaState): Promise<BotAction> {
    const bot = state.bots[this.id];
    if (!bot || !bot.isAlive) return { type: 'wait' };

    const radar = generateRadarScan(state, this.id);
    const enemy = radar.visibleEnemies[0];

    if (!enemy) return { type: 'wait' };

    // Check if enemy is right in front (distance 1.0, relative angle 0)
    const isEnemyDirectlyInFront = enemy.distance <= 1.1 && Math.abs(enemy.relativeAngle) <= 15;

    // 1. If enemy is right in front, attack!
    if (isEnemyDirectlyInFront) {
      // Find ready weapon
      const readyWeapons = bot.weapons.filter(w => w.currentCooldown === 0 && bot.energy >= w.energyCost);
      if (readyWeapons.length > 0) {
        // Choose best weapon
        const weapon = readyWeapons.reduce((best, cur) => cur.damage > best.damage ? cur : best);
        return {
          type: 'attack',
          weapon: weapon.type,
          power: 1.2,
        };
      } else {
        // Ram if no weapon is ready
        return {
          type: 'move',
          direction: 'forward',
          steps: 1,
        };
      }
    }

    // 2. If enemy is adjacent but to our side or rear, turn towards them!
    if (enemy.distance <= 1.5) {
      if (enemy.relativeAngle > 0 && enemy.relativeAngle <= 135) {
        return { type: 'move', direction: 'turn_right', steps: 1 };
      } else if (enemy.relativeAngle < 0 && enemy.relativeAngle >= -135) {
        return { type: 'move', direction: 'turn_left', steps: 1 };
      } else {
        return { type: 'move', direction: 'turn_right', steps: 1 };
      }
    }

    // 3. Defensive: If low HP (< 30) and enemy is approaching, raise shield
    if (this.strategy === 'tactical' && bot.hp < 30 && enemy.distance <= 2 && bot.energy >= 10) {
      return { type: 'shield', direction: 'front' };
    }

    // 4. Navigation towards enemy while avoiding The Pit if open
    const frontOffset = getOffsetForDirection(bot.heading);
    const frontTile: Position = { x: bot.position.x + frontOffset.x, y: bot.position.y + frontOffset.y };
    const isFrontTilePit = radar.pit.isOpen && frontTile.x === radar.pit.position.x && frontTile.y === radar.pit.position.y;

    if (isFrontTilePit) {
      // Avoid falling into the pit! Turn away.
      return { type: 'move', direction: 'turn_right', steps: 1 };
    }

    // Turn towards enemy if not facing them
    if (Math.abs(enemy.relativeAngle) > 45) {
      if (enemy.relativeAngle > 0) {
        return { type: 'move', direction: 'turn_right', steps: 1 };
      } else {
        return { type: 'move', direction: 'turn_left', steps: 1 };
      }
    }

    // Advance forward
    return {
      type: 'move',
      direction: 'forward',
      steps: Math.min(bot.speed, Math.floor(enemy.distance)),
    };
  }
}
