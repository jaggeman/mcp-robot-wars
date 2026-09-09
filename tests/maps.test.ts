import { describe, it, expect } from 'vitest';
import { createArenaMap, generateRadarScan } from '../src/engine/arena.js';
import { initializeMatch, executeTurn } from '../src/engine/simulation.js';

describe('Multi-Map Arena Features', () => {
  const botA = { id: 'bot-a', name: 'Bot A' };
  const botB = { id: 'bot-b', name: 'Bot B' };

  it('should collapse outer tiles into lava in Lava Chamber', () => {
    const lavaConfig = createArenaMap('lava_chamber', 8, 8, 20);
    lavaConfig.specialRules = { lavaShrinkInterval: 1 }; // shrink every turn for test

    let state = initializeMatch([botA, botB], lavaConfig);
    expect(state.config.hazards.filter(h => h.type === 'lava').length).toBe(0);

    // Turn 1 executes -> ring 1 collapses
    state = executeTurn(state, {
      'bot-a': { type: 'wait' },
      'bot-b': { type: 'wait' },
    });

    const lavaTiles = state.config.hazards.filter(h => h.type === 'lava');
    expect(lavaTiles.length).toBeGreaterThan(0);
    expect(state.events.some(e => e.type === 'lava_collapse')).toBe(true);
  });

  it('should disrupt radar sensors during EMP pulse in Cyberdome', () => {
    const empConfig = createArenaMap('emp_cyberdome', 10, 10, 20);
    empConfig.specialRules = { empPulseInterval: 2 };

    let state = initializeMatch([botA, botB], empConfig);
    
    // Turn 1
    state = executeTurn(state, { 'bot-a': { type: 'wait' }, 'bot-b': { type: 'wait' } });
    expect(state.bots['bot-a'].empDisruptedTurns).toBe(0);

    // Turn 2: EMP Pulse triggers!
    state = executeTurn(state, { 'bot-a': { type: 'wait' }, 'bot-b': { type: 'wait' } });
    
    // Radar scan should show EMP disruption
    const radar = generateRadarScan(state, 'bot-a');
    expect(radar.isEmpDisrupted).toBe(true);
    expect(radar.visibleEnemies.length).toBe(0); // Scrambled/blinded
  });
});
