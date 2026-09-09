import { ArenaState, BotAction, BotBlueprint } from '../engine/types.js';
import { generateRadarScan } from '../engine/arena.js';
import { BotController } from '../runner/match.js';

export interface LLMCompletionProvider {
  (messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): Promise<string>;
}

export class LLMAgentBot implements BotController {
  public id: string;
  public name: string;
  public blueprint: BotBlueprint;
  private llmProvider?: LLMCompletionProvider;
  private systemPrompt: string;

  constructor(id: string, name: string, llmProvider?: LLMCompletionProvider) {
    this.id = id;
    this.name = name;
    this.llmProvider = llmProvider;
    this.blueprint = {
      id,
      name,
      maxHp: 100,
      maxEnergy: 100,
      armor: 15,
      speed: 2,
    };

    this.systemPrompt = `You are ${name}, a battle-hardened combat AI in MCP Robot Wars.
Your goal is to destroy the opposing robot and win the arena match.
You operate under strict token and turn constraints.

Each turn you receive your RADAR scan and BOT TELEMETRY.
Analyze enemy position, distance, relative angle, weapon readiness, and arena hazards (especially THE PIT).

Respond with a single valid JSON action object:
- {"type": "move", "direction": "forward" | "backward" | "turn_left" | "turn_right" | "strafe_left" | "strafe_right", "steps": 1 | 2}
- {"type": "attack", "weapon": "spinner" | "flipper" | "axe" | "ram", "power": 1.0}
- {"type": "shield", "direction": "front" | "rear" | "left" | "right"}
- {"type": "wait"}

IMPORTANT: Output ONLY the JSON object, nothing else.`;
  }

  public async decideTurn(state: ArenaState): Promise<BotAction> {
    const bot = state.bots[this.id];
    if (!bot || !bot.isAlive) return { type: 'wait' };

    const radar = generateRadarScan(state, this.id);
    const telemetry = {
      hp: bot.hp,
      energy: bot.energy,
      heading: bot.heading,
      position: bot.position,
      weapons: bot.weapons.map(w => ({ type: w.type, ready: w.currentCooldown === 0 && bot.energy >= w.energyCost })),
    };

    if (!this.llmProvider) {
      // Fallback if no LLM API key configured in mock mode: basic tactical choice
      if (radar.visibleEnemies.length > 0 && radar.visibleEnemies[0].distance <= 1.2) {
        return { type: 'attack', weapon: 'spinner', power: 1.0 };
      }
      return { type: 'move', direction: 'forward', steps: 1 };
    }

    const userPrompt = `TURN ${state.turn}/${state.maxTurns}:
Radar Scan: ${JSON.stringify(radar)}
Bot Telemetry: ${JSON.stringify(telemetry)}
Choose your next tactical action JSON:`;

    try {
      const responseText = await this.llmProvider([
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: userPrompt },
      ]);

      const cleaned = responseText.trim().replace(/^```json\s*|```$/g, '');
      const action = JSON.parse(cleaned) as BotAction;
      return action;
    } catch (err) {
      console.warn(`[LLMAgentBot] Failed to parse LLM response for ${this.name}:`, err);
      return { type: 'wait' };
    }
  }
}
