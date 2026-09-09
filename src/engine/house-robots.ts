import { ArenaState, BotState, GameEvent, HouseRobot, Position } from './types.js';
import { rotateDirection } from './arena.js';
import { pushBot } from './combat.js';

export function createDefaultHouseRobots(width = 12, height = 12): HouseRobot[] {
  return [
    {
      id: 'house-sir-killalot',
      name: 'SIR KILLALOT',
      avatar: '🛡️💀',
      position: { x: width - 1, y: 0 },
      homeZone: { minX: width - 3, maxX: width - 1, minY: 0, maxY: 2 },
      hp: 250,
      maxHp: 250,
      damage: 25,
      weaponName: 'Hydraulic Crusher Claws',
      isActive: true,
    },
    {
      id: 'house-matilda',
      name: 'MATILDA',
      avatar: '🐗⚡',
      position: { x: 0, y: height - 1 },
      homeZone: { minX: 0, maxX: 2, minY: height - 3, maxY: height - 1 },
      hp: 180,
      maxHp: 180,
      damage: 20,
      weaponName: 'Rear Tusk & Heavy Flipper',
      isActive: true,
    },
  ];
}

export function isInsideCPZ(pos: Position, zone: { minX: number; maxX: number; minY: number; maxY: number }): boolean {
  return pos.x >= zone.minX && pos.x <= zone.maxX && pos.y >= zone.minY && pos.y <= zone.maxY;
}

export function processHouseRobotAttacks(state: ArenaState, events: GameEvent[]): void {
  if (!state.houseRobots || state.houseRobots.length === 0) return;

  for (const houseBot of state.houseRobots) {
    if (!houseBot.isActive) continue;

    // Check if any competitor is inside this House Robot's CPZ
    for (const bot of Object.values(state.bots)) {
      if (!bot.isAlive) continue;

      if (isInsideCPZ(bot.position, houseBot.homeZone)) {
        // Punish the trespasser!
        bot.hp = Math.max(0, bot.hp - houseBot.damage);
        bot.score.hazardsTriggered++;

        events.push({
          turn: state.turn,
          timestamp: Date.now(),
          type: 'house_robot_attack',
          actorId: houseBot.id,
          targetId: bot.id,
          details: { houseRobot: houseBot.name, damage: houseBot.damage },
          description: `🚨 ${houseBot.name} AWAKENS! ${bot.name} breached the Corner Patrol Zone and was crushed by ${houseBot.weaponName} for ${houseBot.damage} damage! (${bot.name} HP: ${bot.hp}/${bot.maxHp})`,
        });

        // If it's Matilda, flip and push them out of the zone
        if (houseBot.id === 'house-matilda') {
          bot.heading = rotateDirection(bot.heading, 'turn_right');
          pushBot(state, bot, 'E', 1, events, 'matilda_flipper');
        }

        if (bot.hp === 0) {
          bot.isAlive = false;
          events.push({
            turn: state.turn,
            timestamp: Date.now(),
            type: 'knockout',
            actorId: houseBot.id,
            targetId: bot.id,
            details: { reason: 'house_robot' },
            description: `💥💀 TOTAL ANNIHILATION! ${bot.name} was pulverized to scrap by ${houseBot.name}!`,
          });
        }
      }
    }
  }
}
