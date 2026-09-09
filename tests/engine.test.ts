import { describe, it, expect } from 'vitest';
import { initializeMatch, executeTurn } from '../src/engine/simulation.js';
import { createDefaultArena, generateRadarScan } from '../src/engine/arena.js';
import { BotBlueprint } from '../src/engine/types.js';

describe('MCP Robot Wars Engine', () => {
  const botA: BotBlueprint = { id: 'bot-a', name: 'RazorBot' };
  const botB: BotBlueprint = { id: 'bot-b', name: 'CrusherX' };

  it('should initialize a match with two bots at opposite corners', () => {
    const config = createDefaultArena(10, 10, 20);
    const state = initializeMatch([botA, botB], config);

    expect(state.turn).toBe(1);
    expect(state.isGameOver).toBe(false);
    expect(state.bots['bot-a'].position).toEqual({ x: 1, y: 1 });
    expect(state.bots['bot-b'].position).toEqual({ x: 8, y: 8 });
    expect(state.bots['bot-a'].hp).toBe(100);
    expect(state.bots['bot-b'].hp).toBe(100);
  });

  it('should generate accurate radar scan', () => {
    const config = createDefaultArena(10, 10, 20);
    const state = initializeMatch([botA, botB], config);
    const scan = generateRadarScan(state, 'bot-a');

    expect(scan.ownPosition).toEqual({ x: 1, y: 1 });
    expect(scan.ownHeading).toBe('E');
    expect(scan.visibleEnemies.length).toBe(1);
    expect(scan.visibleEnemies[0].id).toBe('bot-b');
    expect(scan.pit.isOpen).toBe(false);
  });

  it('should execute movement and update heading', () => {
    const config = createDefaultArena(10, 10, 20);
    let state = initializeMatch([botA, botB], config);

    // Bot A moves forward 2 steps (E)
    state = executeTurn(state, {
      'bot-a': { type: 'move', direction: 'forward', steps: 2 },
      'bot-b': { type: 'wait' },
    });

    expect(state.bots['bot-a'].position).toEqual({ x: 3, y: 1 });

    // Bot A turns right (to face S)
    state = executeTurn(state, {
      'bot-a': { type: 'move', direction: 'turn_right', steps: 1 },
      'bot-b': { type: 'wait' },
    });

    expect(state.bots['bot-a'].heading).toBe('S');
  });

  it('should deal damage with weapons', () => {
    const config = createDefaultArena(10, 10, 20);
    const state = initializeMatch([botA, botB], config);

    // Place bots adjacent: Bot A at (4, 4) facing E, Bot B at (5, 4)
    state.bots['bot-a'].position = { x: 4, y: 4 };
    state.bots['bot-a'].heading = 'E';
    state.bots['bot-b'].position = { x: 5, y: 4 };

    const nextState = executeTurn(state, {
      'bot-a': { type: 'attack', weapon: 'spinner' },
      'bot-b': { type: 'wait' },
    });

    // Bot B should have taken damage and been pushed 1 tile to (6, 4)
    expect(nextState.bots['bot-b'].hp).toBeLessThan(100);
    expect(nextState.bots['bot-b'].position).toEqual({ x: 6, y: 4 });
  });

  it('should trigger instant KO when pushed into the open Pit', () => {
    const config = createDefaultArena(10, 10, 20);
    config.pitOpensAtTurn = 1; // Pit is open immediately
    config.pitPosition = { x: 6, y: 4 };

    const state = initializeMatch([botA, botB], config);
    state.bots['bot-a'].position = { x: 4, y: 4 };
    state.bots['bot-a'].heading = 'E';
    state.bots['bot-b'].position = { x: 5, y: 4 };

    // Bot A uses spinner to push Bot B directly into the Pit at (6, 4)
    const nextState = executeTurn(state, {
      'bot-a': { type: 'attack', weapon: 'spinner' },
      'bot-b': { type: 'wait' },
    });

    expect(nextState.bots['bot-b'].hp).toBe(0);
    expect(nextState.bots['bot-b'].isAlive).toBe(false);
    expect(nextState.isGameOver).toBe(true);
    expect(nextState.winnerId).toBe('bot-a');
    expect(nextState.endReason).toBe('pit_fall');
  });
});
