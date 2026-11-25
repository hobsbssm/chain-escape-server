export type LanguageCode = 'ar' | 'en';
export type QualityPreset = 'low' | 'medium' | 'high';

export type WorldId =
  | 'sky_islands'
  | 'ancient_jungle'
  | 'lava_factory'
  | 'frozen_peak'
  | 'lost_temple'
  | 'the_abyss';

export type StageNumber = 1 | 2;

export type CharacterAnimState =
  | 'idle'
  | 'walking'
  | 'running'
  | 'jumping'
  | 'falling'
  | 'landing'
  | 'climbing'
  | 'hanging'
  | 'pulling'
  | 'sliding'
  | 'stumbling'
  | 'celebrating'
  | 'dragged'
  | 'swinging'
  | 'knocked_down';

export type ChainVisualState =
  | 'relaxed'
  | 'tensioned'
  | 'swinging'
  | 'pulling'
  | 'collision';

export type ContextActionHint =
  | 'none'
  | 'pull_friend'
  | 'help_ally'
  | 'hoist_ally'
  | 'grab_crate'
  | 'anchor'
  | 'winch'
  | 'chain_pull'
  | 'swing_rope'
  | 'rotate_mirror'
  | 'collect_key';

export type OutfitId = 'hoodie' | 'parka' | 'forge' | 'temple' | 'void_suit';
export type HatId = 'goggles' | 'cap' | 'beanie' | 'horns' | 'crown' | 'ninja' | 'none';
export type AccessoryId = 'bedroll' | 'lantern' | 'cape' | 'wings' | 'none';
export type FaceStyleId = 'determined' | 'cheerful' | 'masked' | 'bandaged';

export interface CharacterCustomization {
  name: string;
  colorHex: string;
  outfit: OutfitId;
  hat: HatId;
  accessory: AccessoryId;
  face: FaceStyleId;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PlatformDef {
  id: string;
  kind:
    | 'stone'
    | 'wood'
    | 'jungle'
    | 'ice'
    | 'metal'
    | 'temple'
    | 'void'
    | 'moving'
    | 'crumbling'
    | 'cracked'
    | 'vanishing'
    | 'phasing'
    | 'gear'
    | 'bounce'
    | 'bridge'
    | 'hanging_bridge'
    | 'elevator'
    | 'timed_gate'
    | 'weight_platform'
    | 'falling_pillar';
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  moveAxis?: [number, number, number];
  moveRange?: number;
  moveSpeed?: number;
  movePhase?: number;
  rotSpeed?: number;
  crumbleDelay?: number;
  phasePeriod?: number;
  phaseOffset?: number;
  timedPeriod?: number;
  timedOpenRatio?: number;
  friction?: number;
  bounceForce?: number;
  gateId?: string;
  gateOpenOffset?: [number, number, number];
  tiltAxis?: 'x' | 'z';
  maxTilt?: number;
  sinkFactor?: number;
  pillarDelay?: number;
  decorativeArch?: boolean;
  bannerColor?: string;
  waterfall?: boolean;
}

export interface PuzzleElementDef {
  id: string;
  kind:
    | 'pressure_plate'
    | 'trap_plate'
    | 'heavy_crate'
    | 'chain_anchor'
    | 'winch_lever'
    | 'chain_pull_winch'
    | 'key_item'
    | 'mirror_pedestal'
    | 'mirror_receptor'
    | 'swing_rope';
  x: number;
  y: number;
  z: number;
  targetGateId?: string;
  plateGroupId?: string;
  requiredOnGroup?: number;
  requiredPullers?: number;
  ropeLength?: number;
  mirrorAngle?: number;
  receptorAngle?: number;
  beamLength?: number;
  w?: number;
  h?: number;
  d?: number;
}

export interface HazardDef {
  id: string;
  kind:
    | 'pendulum_log'
    | 'pendulum_hammer'
    | 'spinning_log'
    | 'rolling_boulder'
    | 'wind_zone'
    | 'wind_fan'
    | 'piston_crusher'
    | 'steam_pipe'
    | 'laser_beam'
    | 'gravity_zone';
  x: number;
  y: number;
  z: number;
  length: number;
  speed: number;
  amplitude: number;
  phase?: number;
  axis?: 'x' | 'z';
  w?: number;
  h?: number;
  d?: number;
  radius?: number;
  period?: number;
  activeRatio?: number;
  gravityScale?: number;
  dirX?: number;
  dirY?: number;
  dirZ?: number;
}

export interface CheckpointDef {
  index: number;
  x: number;
  y: number;
  z: number;
}

export interface StarDef {
  id: string;
  x: number;
  y: number;
  z: number;
}

export interface WorldDef {
  id: WorldId;
  stage: StageNumber;
  order: number;
  nameAr: string;
  nameEn: string;
  stageTitleAr: string;
  stageTitleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  skyTopHex: string;
  skyHorizonHex: string;
  fogHex: string;
  fogDensity: number;
  ambientSkyHex: string;
  ambientGroundHex: string;
  sunHex: string;
  gravity: number;
  allowDoubleJump: boolean;
  chainMaxLength: number;
  parTimeSec: number;
  spawn: Vec3;
  finish: Vec3;
  fallLimitY: number;
  platforms: PlatformDef[];
  puzzles: PuzzleElementDef[];
  hazards: HazardDef[];
  checkpoints: CheckpointDef[];
  stars: StarDef[];
}

export interface PlayerInputState {
  moveX: number;
  moveZ: number;
  jumpPressed: boolean;
  jumpHeld: boolean;
  sprintHeld: boolean;
  crouchHeld: boolean;
  interactPressed: boolean;
  interactHeld: boolean;
  camYaw: number;
  inputSeq?: number;
}

export interface PlayerSnapshot {
  id: string;
  slot: number;
  isHost: boolean;
  connected: boolean;
  customization: CharacterCustomization;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  grounded: boolean;
  anim: CharacterAnimState;
  hanging: boolean;
  knockedDown: boolean;
  balance: number;
  swingingRopeId: string | null;
  contextAction: ContextActionHint;
  pullLeanX: number;
  pullLeanZ: number;
  ragdollPitch: number;
  ragdollRoll: number;
  grabbingId: string | null;
  finished: boolean;
  voiceMuted: boolean;
  voiceSpeaking: boolean;
  pingMs: number;
  lastInputSeq?: number;
}

export interface ChainLinkSnapshot {
  pairIndex: number;
  state: ChainVisualState;
  tension: number;
  nodes: Vec3[];
}

export interface DynamicCrateState {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  pullers: number;
}

export interface GateRuntimeState {
  id: string;
  openProgress: number;
}

export interface PlatformRuntimeState {
  id: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  tiltX: number;
  tiltZ: number;
  active: boolean;
  crumbleProgress: number;
}

export interface BoulderRuntimeState {
  id: string;
  x: number;
  y: number;
  z: number;
  rotX: number;
  rotZ: number;
}

export interface MirrorRuntimeState {
  id: string;
  angle: number;
  lit: boolean;
}

export interface RoomStateSnapshot {
  roomCode: string;
  phase: 'lobby' | 'playing' | 'victory';
  worldId: WorldId;
  stage: StageNumber;
  hostId: string;
  elapsedSec: number;
  checkpointIndex: number;
  falls: number;
  rescues: number;
  collectedStars: string[];
  collectedKeys: string[];
  players: PlayerSnapshot[];
  chains: ChainLinkSnapshot[];
  crates: DynamicCrateState[];
  gates: GateRuntimeState[];
  platforms: PlatformRuntimeState[];
  boulders: BoulderRuntimeState[];
  mirrors: MirrorRuntimeState[];
  activePlates: string[];
  activeHazards: string[];
  activeAnchors: Record<string, string>;
  windForce: Vec3;
  chainPullProgress: Record<string, number>;
}

export interface FriendEntry {
  id: string;
  name: string;
  status: 'online' | 'in_room' | 'offline';
  roomCode?: string;
  colorHex: string;
}

export interface StageProgressRecord {
  unlocked: boolean;
  completed: boolean;
  bestStars: number;
  bestTimeSec: number | null;
}

export interface WorldProgressRecord {
  unlocked: boolean;
  completed: boolean;
  bestStars: number;
  bestTimeSec: number | null;
  stages?: Record<StageNumber, StageProgressRecord>;
}

export interface PlayerProfileStats {
  level: number;
  xp: number;
  totalCompletions: number;
  totalRescues: number;
  totalFalls: number;
  unlockedOutfits: OutfitId[];
  unlockedHats: HatId[];
  worldProgress: Record<WorldId, WorldProgressRecord>;
}

export type ClientToServerMessage =
  | {
      type: 'room:create';
      playerId: string;
      customization: CharacterCustomization;
      worldId: WorldId;
      stage?: StageNumber;
    }
  | {
      type: 'room:join';
      roomCode: string;
      playerId: string;
      customization: CharacterCustomization;
    }
  | {
      type: 'room:leave';
    }
  | {
      type: 'room:select_world';
      worldId: WorldId;
      stage?: StageNumber;
    }
  | {
      type: 'room:update_custom';
      customization: CharacterCustomization;
    }
  | {
      type: 'room:start';
    }
  | {
      type: 'room:restart';
    }
  | {
      type: 'game:input';
      input: PlayerInputState;
    }
  | {
      type: 'voice:state';
      muted: boolean;
      speaking: boolean;
    }
  | {
      type: 'voice:signal';
      targetPlayerId: string;
      signal: unknown;
    }
  | {
      type: 'ping';
      clientTime: number;
    };

export type ServerToClientMessage =
  | {
      type: 'room:joined';
      roomCode: string;
      playerId: string;
      state: RoomStateSnapshot;
    }
  | {
      type: 'room:state';
      state: RoomStateSnapshot;
    }
  | {
      type: 'room:event';
      event:
        | 'checkpoint'
        | 'rescue'
        | 'fall'
        | 'star'
        | 'key'
        | 'knockdown'
        | 'gate_open'
        | 'victory'
        | 'host_migrated'
        | 'player_joined'
        | 'player_left';
      detail?: string;
    }
  | {
      type: 'room:error';
      message: string;
    }
  | {
      type: 'voice:signal';
      fromPlayerId: string;
      signal: unknown;
    }
  | {
      type: 'pong';
      clientTime: number;
    };
