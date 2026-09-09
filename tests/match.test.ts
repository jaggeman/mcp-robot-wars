import { describe, it, expect } from 'vitest';
import { MatchRunner } from '../src/runner/match.js';
import { HeuristicBot } from '../src/bots/heuristic-bot.js';
import { createDefaultArena } from '../src/engine/arena.js';

describe('Match Runner Integration', () => {
  it('should run a full 1v1 match between two heuristic bots to conclusion', async () => {
    const bot1 = new HeuristicBot('bot-1', 'Hypno-Disc', 'aggressive');
    const bot2 = new HeuristicBot('bot-2', 'Chaos-2', 'tactical');

    const arenaConfig = createDefaultArena(10, 10, 25);
    const runner = new MatchRunner([bot1, bot2], {
      config: arenaConfig,
      turnTimeoutMs: 1000,
      delayBetweenTurnsMs: 0,
    });

    const finalState = await runner.run();

    expect(finalState.isGameOver).toBe(true);
    expect(finalState.endReason).not.toBeNull();
    expect(['knockout', 'pit_fall', 'judges_decision']).toContain(finalState.endReason);
    expect(finalState.events.length).toBeGreaterThan(5);
  });
});
