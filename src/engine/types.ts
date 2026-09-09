export type Direction = 'N' | 'E' | 'S' | 'W';

export type RelativeMove = 'forward' | 'backward' | 'turn_left' | 'turn_right' | 'strafe_left' | 'strafe_right';

export type WeaponType = 'spinner' | 'flipper' | 'axe' | 'ram';

export type ShieldDirection = 'front' | 'rear' | 'left' | 'right';

export type MapType = 'colosseum' | 'lava_chamber' | 'emp_cyberdome' | 'the_maze';

export interface Position {
  x: number;
  y: number;
}

export interface WeaponConfig {
  type: WeaponType;
  name: string;
  damage: number;
  energyCost: number;
  range: number;
  cooldown: number;
  currentCooldown: number;
  weightPoints: number;
  specialEffect?: 'push' | 'armor_pierce' | 'continuous';
}

export interface BotBlueprint {
  id: string;
  name: string;
  maxHp?: number;
  maxEnergy?: number;
  armor?: number; // e.g., 0-50%
  speed?: number; // 1-3
  weapons?: WeaponConfig[];
  systemPrompt?: string;
  tokenCount?: number;
}

export interface BotState {
  id: string;
  name: string;
  position: Position;
  heading: Direction;
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  armor: number;
  speed: number;
  weapons: WeaponConfig[];
  activeShield: ShieldDirection | null;
  isAlive: boolean;
  isStalled: boolean;
  empDisruptedTurns: number;
  score: {
    damageDealt: number;
    hitsLanded: number;
    hazardsTriggered: number;
    turnsSurvived: number;
  };
}

export interface HouseRobot {
  id: string;
  name: string;
  avatar: string;
  position: Position;
  homeZone: { minX: number; maxX: number; minY: number; maxY: number };
  hp: number;
  maxHp: number;
  damage: number;
  weaponName: string;
  isActive: boolean;
}

export type HazardType = 'pit' | 'spikes' | 'flame_grate' | 'wall' | 'lava' | 'obstacle_pillar';

export interface Hazard {
  id: string;
  type: HazardType;
  position: Position;
  isActive: boolean;
  damage: number;
  activeFromTurn?: number;
  description: string;
}

export interface ArenaConfig {
  mapType: MapType;
  name: string;
  description: string;
  width: number;
  height: number;
  pitPosition: Position;
  pitOpensAtTurn: number;
  hazards: Hazard[];
  houseRobots?: HouseRobot[];
  maxTurns: number;
  specialRules?: {
    lavaShrinkInterval?: number; // turns per ring collapse
    empPulseInterval?: number;   // turns per EMP blackout
  };
}

export type ActionType = 'move' | 'attack' | 'shield' | 'wait';

export interface MoveAction {
  type: 'move';
  direction: RelativeMove;
  steps: number;
}

export interface AttackAction {
  type: 'attack';
  weapon: WeaponType;
  power?: number;
}

export interface ShieldAction {
  type: 'shield';
  direction: ShieldDirection;
}

export interface WaitAction {
  type: 'wait';
}

export type BotAction = MoveAction | AttackAction | ShieldAction | WaitAction;

export interface GameEvent {
  turn: number;
  timestamp: number;
  type:
    | 'move'
    | 'collision'
    | 'attack'
    | 'shield_raised'
    | 'hazard_activated'
    | 'hazard_damage'
    | 'pit_fall'
    | 'house_robot_attack'
    | 'emp_pulse'
    | 'lava_collapse'
    | 'knockout'
    | 'stall'
    | 'match_end';
  actorId?: string;
  targetId?: string;
  details: Record<string, unknown>;
  description: string;
}

export interface ArenaState {
  turn: number;
  maxTurns: number;
  config: ArenaConfig;
  bots: Record<string, BotState>;
  houseRobots: HouseRobot[];
  winnerId: string | null;
  isGameOver: boolean;
  endReason: 'knockout' | 'pit_fall' | 'judges_decision' | 'forfeit' | null;
  events: GameEvent[];
}

export interface RadarScanResult {
  ownPosition: Position;
  ownHeading: Direction;
  isEmpDisrupted: boolean;
  arenaSize: { width: number; height: number };
  pit: {
    position: Position;
    isOpen: boolean;
    turnsUntilOpen: number;
  };
  visibleEnemies: Array<{
    id: string;
    name: string;
    position: Position;
    distance: number;
    relativeAngle: number;
    hpEstimate: number;
    heading: Direction;
  }>;
  nearbyHazards: Array<{
    type: HazardType;
    position: Position;
    isActive: boolean;
    distance: number;
  }>;
  houseRobots: Array<{
    name: string;
    position: Position;
    distance: number;
    isInZone: boolean;
  }>;
  adjacentObstacles: {
    front: boolean;
    rear: boolean;
    left: boolean;
    right: boolean;
  };
}

export interface WorkshopBudgetBreakdown {
  totalPoints: number;
  maxPoints: number;
  isValid: boolean;
  armorPoints: number;
  speedPoints: number;
  energyPoints: number;
  weaponPoints: number;
  tokenCount: number;
  maxTokens: number;
  errors: string[];
}
