import { describe, it, expect } from 'vitest';
import { initializeMatch } from '../src/engine/simulation.js';
import { createDefaultArena } from '../src/engine/arena.js';
import { createArenaTools } from '../src/mcp/tools.js';
import { BotAction } from '../engine/types.js';

describe('MCP Tools Interface', () => {
  it('should expose all 5 required tools and return valid responses', async () => {
    let state = initializeMatch(
      [{ id: 'bot-1', name: 'Alpha' }, { id: 'bot-2', name: 'Omega' }],
      createDefaultArena(10, 10, 20)
    );

    let submittedAction: BotAction | null = null;
    const context = {
      getState: () => state,
      submitAction: (botId: string, action: BotAction) => {
        submittedAction = action;
        return { success: true, message: `Action ${action.type} queued for ${botId}` };
      },
    };

    const tools = createArenaTools('bot-1', context);
    expect(tools.length).toBe(5);

    // Test get_radar_scan
    const radarTool = tools.find(t => t.name === 'get_radar_scan')!;
    const radarRes = await radarTool.handler({});
    expect(radarRes.content[0].text).toContain('"ownPosition"');
    expect(radarRes.content[0].text).toContain('"visibleEnemies"');

    // Test read_telemetry
    const telemetryTool = tools.find(t => t.name === 'read_telemetry')!;
    const telemetryRes = await telemetryTool.handler({});
    expect(telemetryRes.content[0].text).toContain('"hp": "100/100"');

    // Test move tool
    const moveTool = tools.find(t => t.name === 'move')!;
    const moveRes = await moveTool.handler({ direction: 'forward', steps: 1 });
    expect(moveRes.isError).toBeFalsy();
    expect(submittedAction).toEqual({ type: 'move', direction: 'forward', steps: 1 });

    // Test activate_weapon tool
    const weaponTool = tools.find(t => t.name === 'activate_weapon')!;
    const weaponRes = await weaponTool.handler({ weapon: 'spinner', power: 1.0 });
    expect(weaponRes.isError).toBeFalsy();
    expect(submittedAction).toEqual({ type: 'attack', weapon: 'spinner', power: 1.0 });

    // Test raise_shield tool
    const shieldTool = tools.find(t => t.name === 'raise_shield')!;
    const shieldRes = await shieldTool.handler({ direction: 'front' });
    expect(shieldRes.isError).toBeFalsy();
    expect(submittedAction).toEqual({ type: 'shield', direction: 'front' });
  });
});
