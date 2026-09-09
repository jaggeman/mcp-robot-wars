import { z } from 'zod';
import { ArenaState, BotAction, RadarScanResult } from '../engine/types.js';
import { generateRadarScan } from '../engine/arena.js';

export const MoveSchema = z.object({
  direction: z.enum(['forward', 'backward', 'turn_left', 'turn_right', 'strafe_left', 'strafe_right']).describe('Direction to move or turn'),
  steps: z.number().int().min(1).max(3).default(1).describe('Number of steps to move (subject to bot speed)'),
});

export const ActivateWeaponSchema = z.object({
  weapon: z.enum(['spinner', 'flipper', 'axe', 'ram']).describe('Which equipped weapon to discharge'),
  power: z.number().min(0.5).max(1.5).default(1.0).describe('Power setting multiplier (1.0 = standard)'),
});

export const RaiseShieldSchema = z.object({
  direction: z.enum(['front', 'rear', 'left', 'right']).describe('Relative direction to raise directional shield against incoming strikes'),
});

export const ReadTelemetrySchema = z.object({});

export const GetRadarScanSchema = z.object({});

export interface ArenaToolContext {
  getState: () => ArenaState;
  submitAction: (botId: string, action: BotAction) => { success: boolean; message: string };
}

export function createArenaTools(botId: string, context: ArenaToolContext) {
  return [
    {
      name: 'get_radar_scan',
      description: 'Scans the arena with active sensors. Returns own position, heading, relative position and distance of visible enemies, Pit countdown and status, and adjacent obstacle sensors.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        const state = context.getState();
        const scan = generateRadarScan(state, botId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(scan, null, 2),
            },
          ],
        };
      },
    },
    {
      name: 'read_telemetry',
      description: 'Reads internal telemetry of your robot: HP, current energy, armor, weapon cooldowns, and match score.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        const state = context.getState();
        const bot = state.bots[botId];
        if (!bot) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'Bot not found in arena' }) }],
            isError: true,
          };
        }
        const telemetry = {
          id: bot.id,
          name: bot.name,
          hp: `${bot.hp}/${bot.maxHp}`,
          energy: `${bot.energy}/${bot.maxEnergy}`,
          armor: `${bot.armor}%`,
          speed: bot.speed,
          heading: bot.heading,
          position: bot.position,
          activeShield: bot.activeShield,
          weapons: bot.weapons.map(w => ({
            type: w.type,
            name: w.name,
            damage: w.damage,
            energyCost: w.energyCost,
            cooldown: w.cooldown,
            currentCooldown: w.currentCooldown,
            isReady: w.currentCooldown === 0 && bot.energy >= w.energyCost,
          })),
          score: bot.score,
        };
        return {
          content: [{ type: 'text', text: JSON.stringify(telemetry, null, 2) }],
        };
      },
    },
    {
      name: 'move',
      description: 'Executes a movement or turning maneuver. "turn_left" and "turn_right" change heading 90 degrees. "forward", "backward", "strafe_left", "strafe_right" translate position.',
      inputSchema: {
        type: 'object',
        properties: {
          direction: {
            type: 'string',
            enum: ['forward', 'backward', 'turn_left', 'turn_right', 'strafe_left', 'strafe_right'],
            description: 'Direction of movement or turn',
          },
          steps: {
            type: 'integer',
            minimum: 1,
            maximum: 3,
            default: 1,
            description: 'Number of steps to move',
          },
        },
        required: ['direction'],
      },
      handler: async (args: unknown) => {
        const parsed = MoveSchema.safeParse(args);
        if (!parsed.success) {
          return {
            content: [{ type: 'text', text: `Invalid arguments: ${parsed.error.message}` }],
            isError: true,
          };
        }
        const result = context.submitAction(botId, {
          type: 'move',
          direction: parsed.data.direction,
          steps: parsed.data.steps,
        });
        return {
          content: [{ type: 'text', text: result.message }],
          isError: !result.success,
        };
      },
    },
    {
      name: 'activate_weapon',
      description: 'Fires an equipped weapon against the tile directly in front of the robot. Consumes energy and triggers weapon cooldown.',
      inputSchema: {
        type: 'object',
        properties: {
          weapon: {
            type: 'string',
            enum: ['spinner', 'flipper', 'axe', 'ram'],
            description: 'The weapon to discharge',
          },
          power: {
            type: 'number',
            minimum: 0.5,
            maximum: 1.5,
            default: 1.0,
            description: 'Power multiplier (1.0 = standard)',
          },
        },
        required: ['weapon'],
      },
      handler: async (args: unknown) => {
        const parsed = ActivateWeaponSchema.safeParse(args);
        if (!parsed.success) {
          return {
            content: [{ type: 'text', text: `Invalid arguments: ${parsed.error.message}` }],
            isError: true,
          };
        }
        const result = context.submitAction(botId, {
          type: 'attack',
          weapon: parsed.data.weapon,
          power: parsed.data.power,
        });
        return {
          content: [{ type: 'text', text: result.message }],
          isError: !result.success,
        };
      },
    },
    {
      name: 'raise_shield',
      description: 'Raises directional energy shield (front, rear, left, right) to absorb 65% of incoming attack damage for this turn. Costs 10 energy.',
      inputSchema: {
        type: 'object',
        properties: {
          direction: {
            type: 'string',
            enum: ['front', 'rear', 'left', 'right'],
            description: 'Direction relative to robot heading',
          },
        },
        required: ['direction'],
      },
      handler: async (args: unknown) => {
        const parsed = RaiseShieldSchema.safeParse(args);
        if (!parsed.success) {
          return {
            content: [{ type: 'text', text: `Invalid arguments: ${parsed.error.message}` }],
            isError: true,
          };
        }
        const result = context.submitAction(botId, {
          type: 'shield',
          direction: parsed.data.direction,
        });
        return {
          content: [{ type: 'text', text: result.message }],
          isError: !result.success,
        };
      },
    },
  ];
}
