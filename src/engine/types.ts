export type Direction = 'N' | 'E' | 'S' | 'W';

export type RelativeMove = 'forward' | 'backward' | 'turn_left' | 'turn_right' | 'strafe_left' | 'strafe_right';

export type WeaponType = 'spinner' | 'flipper' | 'axe' | 'ram';

export type ShieldDirection = 'front' | 'rear' | 'left' | 'right';

export interface Position {
  x: number;
  y: number;
}

export interface WeaponConfig {
  type: WeaponType;
  name: string;
  damage: number;
  energyCost: number;
  range: number; // usually 1 tile
  cooldown: number; // turns
  currentCooldown: number;
  specialEffect?: 'push' | 'armor_pierce' | 'continuous';
}

export interface BotBlueprint {
  id: string;
  name: string;
  maxHp?: number;
  maxEnergy?: number;
  armor?: number; // percentage reduction or flat
  speed?: number; // max tiles per move
  weapons?: WeaponConfig[];
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
  score: {
    damageDealt: number;
    hitsLanded: number;
    hazardsTriggered: number;
    turnsSurvived: number;
  };
}

export type HazardType = 'pit' | 'spikes' | 'flame_grate' | 'wall';

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
  name: string;
  width: number;
  height: number;
  pitPosition: Position;
  pitOpensAtTurn: number;
  hazards: Hazard[];
  maxTurns: number;
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
  winnerId: string | null;
  isGameOver: boolean;
  endReason: 'knockout' | 'pit_fall' | 'judges_decision' | 'forfeit' | null;
  events: GameEvent[];
}

export interface RadarScanResult {
  ownPosition: Position;
  ownHeading: Direction;
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
    relativeAngle: number; // degrees relative to own heading
    hpEstimate: number; // approximate or exact
    heading: Direction;
  }>;
  nearbyHazards: Array<{
    type: HazardType;
    position: Position;
    isActive: boolean;
    distance: number;
  }>;
  adjacentObstacles: {
    front: boolean;
    rear: boolean;
    left: boolean;
    right: boolean;
  };
}
