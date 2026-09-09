import { BotBlueprint, BotState, Direction, WeaponConfig, WeaponType } from './types.js';

export const STANDARD_WEAPONS: Record<WeaponType, WeaponConfig> = {
  spinner: {
    type: 'spinner',
    name: 'High-Velocity Spinner',
    damage: 25,
    energyCost: 20,
    range: 1,
    cooldown: 1,
    currentCooldown: 0,
    specialEffect: 'push',
  },
  flipper: {
    type: 'flipper',
    name: 'Pneumatic Flipper',
    damage: 15,
    energyCost: 15,
    range: 1,
    cooldown: 0,
    currentCooldown: 0,
    specialEffect: 'push',
  },
  axe: {
    type: 'axe',
    name: 'Titanium Top-Axe',
    damage: 30,
    energyCost: 15,
    range: 1,
    cooldown: 1,
    currentCooldown: 0,
    specialEffect: 'armor_pierce',
  },
  ram: {
    type: 'ram',
    name: 'Reinforced Ramming Wedge',
    damage: 10,
    energyCost: 5,
    range: 1,
    cooldown: 0,
    currentCooldown: 0,
    specialEffect: 'push',
  },
};

export function createBot(blueprint: BotBlueprint, startPos = { x: 0, y: 0 }, startHeading: Direction = 'E'): BotState {
  const defaultWeapons: WeaponConfig[] = [
    { ...STANDARD_WEAPONS.ram },
    { ...STANDARD_WEAPONS.spinner },
  ];

  return {
    id: blueprint.id,
    name: blueprint.name,
    position: { ...startPos },
    heading: startHeading,
    hp: blueprint.maxHp ?? 100,
    maxHp: blueprint.maxHp ?? 100,
    energy: blueprint.maxEnergy ?? 100,
    maxEnergy: blueprint.maxEnergy ?? 100,
    armor: blueprint.armor ?? 10, // 10% base damage reduction
    speed: blueprint.speed ?? 2, // max 2 steps per turn
    weapons: (blueprint.weapons && blueprint.weapons.length > 0)
      ? blueprint.weapons.map(w => ({ ...w, currentCooldown: 0 }))
      : defaultWeapons,
    activeShield: null,
    isAlive: true,
    isStalled: false,
    score: {
      damageDealt: 0,
      hitsLanded: 0,
      hazardsTriggered: 0,
      turnsSurvived: 0,
    },
  };
}
