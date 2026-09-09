import { BotBlueprint, WeaponConfig, WeaponType, WorkshopBudgetBreakdown } from './types.js';

export const MAX_WORKSHOP_POINTS = 100;
export const MAX_SYSTEM_PROMPT_TOKENS = 500;

export const WEAPON_WEIGHT_POINTS: Record<WeaponType, number> = {
  spinner: 35,
  flipper: 25,
  axe: 25,
  ram: 10,
};

export function estimateTokenCount(text: string): number {
  if (!text || text.trim().length === 0) return 0;
  // Standard token estimate: ~4 characters per token or word-based
  const words = text.trim().split(/\s+/).length;
  const chars = text.length;
  return Math.ceil(Math.max(words * 1.3, chars / 3.8));
}

export function validateBotBlueprint(blueprint: BotBlueprint): WorkshopBudgetBreakdown {
  const errors: string[] = [];

  const armor = blueprint.armor ?? 10;
  const speed = blueprint.speed ?? 2;
  const maxEnergy = blueprint.maxEnergy ?? 100;
  const weapons = blueprint.weapons ?? [];
  const systemPrompt = blueprint.systemPrompt ?? '';

  // Calculate points
  const armorPoints = Math.round(armor / 2);
  const speedPoints = Math.max(0, (speed - 1) * 15);
  const energyPoints = Math.max(0, Math.round((maxEnergy - 80) / 2));

  let weaponPoints = 0;
  for (const weapon of weapons) {
    const pts = weapon.weightPoints ?? WEAPON_WEIGHT_POINTS[weapon.type] ?? 15;
    weaponPoints += pts;
  }

  const totalPoints = armorPoints + speedPoints + energyPoints + weaponPoints;
  const tokenCount = estimateTokenCount(systemPrompt);

  if (totalPoints > MAX_WORKSHOP_POINTS) {
    errors.push(`Total component weight (${totalPoints} pts) exceeds maximum budget (${MAX_WORKSHOP_POINTS} pts).`);
  }

  if (tokenCount > MAX_SYSTEM_PROMPT_TOKENS) {
    errors.push(`System prompt token count (${tokenCount} tokens) exceeds maximum limit (${MAX_SYSTEM_PROMPT_TOKENS} tokens).`);
  }

  if (weapons.length === 0) {
    errors.push('Robot must equip at least one weapon.');
  }

  if (weapons.length > 2) {
    errors.push('Robot can equip at most 2 weapon slots.');
  }

  if (speed < 1 || speed > 3) {
    errors.push('Speed must be between 1 and 3.');
  }

  if (armor < 0 || armor > 50) {
    errors.push('Armor must be between 0% and 50%.');
  }

  return {
    totalPoints,
    maxPoints: MAX_WORKSHOP_POINTS,
    isValid: errors.length === 0,
    armorPoints,
    speedPoints,
    energyPoints,
    weaponPoints,
    tokenCount,
    maxTokens: MAX_SYSTEM_PROMPT_TOKENS,
    errors,
  };
}
