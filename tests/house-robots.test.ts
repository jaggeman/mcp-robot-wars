import { describe, it, expect } from 'vitest';
import { createColosseumMap } from '../src/engine/arena.js';
import { initializeMatch, executeTurn } from '../src/engine/simulation.js';

describe('House Robots & CPZ Mechanics', () => {
  const botA = { id: 'bot-a', name: 'IntruderBot' };
  const botB = { id: 'bot-b', name: 'SafeBot' };

  it('should trigger Sir Killalot attack when a bot enters his Corner Patrol Zone', () => {
    const config = createColosseumMap(12, 12, 20);
    const state = initializeMatch([botA, botB], config);

    // Place IntruderBot inside Sir Killalot CPZ (x: 10, y: 1)
    state.bots['bot-a'].position = { x: 10, y: 1 };
    state.bots['bot-b'].position = { x: 5, y: 5 };

    const nextState = executeTurn(state, {
      'bot-a': { type: 'wait' },
      'bot-b': { type: 'wait' },
    });

    expect(nextState.bots['bot-a'].hp).toBeLessThan(100);
    expect(nextState.events.some(e => e.type === 'house_robot_attack' && e.description.includes('SIR KILLALOT'))).toBe(true);
  });
});
