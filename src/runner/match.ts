import { ArenaConfig, ArenaState, BotAction, BotBlueprint, GameEvent } from '../engine/types.js';
import { createDefaultArena } from '../engine/arena.js';
import { executeTurn, initializeMatch } from '../engine/simulation.js';

export interface BotController {
  id: string;
  name: string;
  blueprint: BotBlueprint;
  decideTurn: (state: ArenaState) => Promise<BotAction>;
}

export interface MatchOptions {
  config?: ArenaConfig;
  turnTimeoutMs?: number;
  delayBetweenTurnsMs?: number;
  onTurnComplete?: (state: ArenaState, turnEvents: GameEvent[]) => void;
  onMatchEnd?: (state: ArenaState) => void;
}

export class MatchRunner {
  private state: ArenaState;
  private botControllers: Record<string, BotController> = {};
  private options: MatchOptions;
  private isRunning = false;
  private isPaused = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(bots: [BotController, BotController], options: MatchOptions = {}) {
    this.options = {
      config: createDefaultArena(),
      turnTimeoutMs: 5000,
      delayBetweenTurnsMs: 600,
      ...options,
    };

    this.botControllers[bots[0].id] = bots[0];
    this.botControllers[bots[1].id] = bots[1];

    this.state = initializeMatch([bots[0].blueprint, bots[1].blueprint], this.options.config);
  }

  public getState(): ArenaState {
    return this.state;
  }

  public async step(): Promise<ArenaState> {
    if (this.state.isGameOver) return this.state;

    const previousEventsCount = this.state.events.length;
    const actions: Record<string, BotAction> = {};

    // Collect actions from all alive bots concurrently with timeout protection
    const actionPromises = Object.values(this.botControllers).map(async (controller) => {
      const bot = this.state.bots[controller.id];
      if (!bot || !bot.isAlive) return;

      try {
        const timeoutPromise = new Promise<BotAction>((_, reject) =>
          setTimeout(() => reject(new Error(`Turn decision timeout (${this.options.turnTimeoutMs}ms)`)), this.options.turnTimeoutMs)
        );

        const action = await Promise.race([
          controller.decideTurn(this.state),
          timeoutPromise,
        ]);

        actions[controller.id] = action;
      } catch (err) {
        console.warn(`[MatchRunner] Bot ${controller.name} (${controller.id}) turn failed:`, err);
        actions[controller.id] = { type: 'wait' };
      }
    });

    await Promise.all(actionPromises);

    // Execute the turn in simulation
    this.state = executeTurn(this.state, actions);
    const newEvents = this.state.events.slice(previousEventsCount);

    if (this.options.onTurnComplete) {
      this.options.onTurnComplete(this.state, newEvents);
    }

    if (this.state.isGameOver && this.options.onMatchEnd) {
      this.options.onMatchEnd(this.state);
    }

    return this.state;
  }

  public async run(): Promise<ArenaState> {
    this.isRunning = true;

    while (this.isRunning && !this.state.isGameOver) {
      if (this.isPaused) {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      await this.step();

      if (!this.state.isGameOver && this.options.delayBetweenTurnsMs) {
        await new Promise(resolve => setTimeout(resolve, this.options.delayBetweenTurnsMs));
      }
    }

    this.isRunning = false;
    return this.state;
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timer) clearTimeout(this.timer);
  }
}
