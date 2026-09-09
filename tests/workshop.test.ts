import { describe, it, expect } from 'vitest';
import { validateBotBlueprint, estimateTokenCount, MAX_WORKSHOP_POINTS, MAX_SYSTEM_PROMPT_TOKENS } from '../src/engine/workshop.js';
import { STANDARD_WEAPONS } from '../src/engine/bot.js';

describe('Workshop & Token Budget Validation', () => {
  it('should validate a balanced bot blueprint within 100 points budget', () => {
    const blueprint = {
      id: 'custom-bot',
      name: 'TitanViper',
      armor: 20, // 10 pts
      speed: 2,  // 15 pts
      maxEnergy: 100, // 10 pts
      weapons: [
        STANDARD_WEAPONS.spinner, // 35 pts
        STANDARD_WEAPONS.ram,     // 10 pts
      ], // total = 80 pts <= 100
      systemPrompt: 'You are TitanViper. Track enemy with radar and attack aggressively.',
    };

    const result = validateBotBlueprint(blueprint);
    expect(result.isValid).toBe(true);
    expect(result.totalPoints).toBe(80);
    expect(result.errors.length).toBe(0);
  });

  it('should reject a bot that exceeds weight budget', () => {
    const overloadedBot = {
      id: 'heavy-tank',
      name: 'Overloader',
      armor: 40, // 20 pts
      speed: 3,  // 30 pts
      maxEnergy: 140, // 30 pts
      weapons: [
        STANDARD_WEAPONS.spinner, // 35 pts
        STANDARD_WEAPONS.axe,     // 25 pts
      ], // total = 140 pts > 100
      systemPrompt: 'Crush everything.',
    };

    const result = validateBotBlueprint(overloadedBot);
    expect(result.isValid).toBe(false);
    expect(result.totalPoints).toBe(140);
    expect(result.errors.some(e => e.includes('exceeds maximum budget'))).toBe(true);
  });

  it('should reject system prompts that exceed 500 token limit', () => {
    const hugePrompt = 'Tactical battle directive '.repeat(150); // ~450 words / ~600 tokens
    const bot = {
      id: 'talkative-bot',
      name: 'ChatterBox',
      armor: 10,
      speed: 2,
      weapons: [STANDARD_WEAPONS.ram],
      systemPrompt: hugePrompt,
    };

    const result = validateBotBlueprint(bot);
    expect(result.isValid).toBe(false);
    expect(result.tokenCount).toBeGreaterThan(MAX_SYSTEM_PROMPT_TOKENS);
    expect(result.errors.some(e => e.includes('token count'))).toBe(true);
  });
});
