import { getStageDef } from './worldsData.ts';
import type {
  BoulderRuntimeState,
  ChainLinkSnapshot,
  ChainVisualState,
  CharacterAnimState,
  CharacterCustomization,
  ContextActionHint,
  DynamicCrateState,
  GateRuntimeState,
  MirrorRuntimeState,
  PlatformDef,
  PlatformRuntimeState,
  PlayerInputState,
  PlayerSnapshot,
  RoomStateSnapshot,
  StageNumber,
  Vec3,
  WorldDef,
  WorldId,
} from './types.ts';

const CHAIN_NODES = 15;
const PLAYER_RADIUS = 0.42;
const PLAYER_HEIGHT = 1.65;
const WALK_SPEED = 6.3;
const SPRINT_SPEED = 9.0;
const JUMP_VEL = 10.7;
const DOUBLE_JUMP_VEL = 9.4;

interface InternalPlayer {
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
  onIce: boolean;
  coyoteTimer: number;
  jumpBufferTimer: number;
  jumpsLeft: number;
  landingTimer: number;
  stumbleTimer: number;
  climbTimer: number;
  pullTimer: number;
  beingDraggedTimer: number;
  hanging: boolean;
  wasHanging: boolean;
  knockedDown: boolean;
  knockdownCooldown: number;
  balance: number;
  ragdollPitch: number;
  ragdollRoll: number;
  swingingRopeId: string | null;
  ropeAngle: number;
  ropeVel: number;
  ropeYaw: number;
  contextAction: ContextActionHint;
  pullLeanX: number;
  pullLeanZ: number;
  grabbingId: string | null;
  finished: boolean;
  voiceMuted: boolean;
  voiceSpeaking: boolean;
  pingMs: number;
  input: PlayerInputState;
  prevJumpPressed: boolean;
  prevInteractPressed: boolean;
  anim: CharacterAnimState;
  lastInputSeq: number;
}

interface InternalChain {
  nodes: Vec3[];
  prevNodes: Vec3[];
  state: ChainVisualState;
  tension: number;
  wrappedAnchorId: string | null;
}

interface InternalPlatformState {
  def: PlatformDef;
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  rotY: number;
  dRotY: number;
  tiltX: number;
  tiltZ: number;
  active: boolean;
  crumbleTimer: number;
  crumbleState: 'solid' | 'shaking' | 'fallen';
  respawnTimer: number;
}

interface InternalBoulder {
  id: string;
  x: number;
  y: number;
  z: number;
  rotX: number;
  rotZ: number;
  radius: number;
}

interface InternalMirror {
  id: string;
  angle: number;
  lit: boolean;
}

export type SimEventCallback = (
  event:
    | 'checkpoint'
    | 'rescue'
    | 'fall'
    | 'star'
    | 'key'
    | 'knockdown'
    | 'gate_open'
    | 'victory',
  detail?: string,
) => void;

export function createDefaultInput(): PlayerInputState {
  return {
    moveX: 0,
    moveZ: 0,
    jumpPressed: false,
    jumpHeld: false,
    sprintHeld: false,
    crouchHeld: false,
    interactPressed: false,
    interactHeld: false,
    camYaw: 0,
    inputSeq: 0,
  };
}

export class RoomSimulation {
  public roomCode: string;
  public phase: 'lobby' | 'playing' | 'victory' = 'lobby';
  public worldId: WorldId;
  public stage: StageNumber = 1;
  public hostId: string;
  public elapsedSec = 0;
  /**
   * تجاوز اختياري لتعريف العالم (يستخدم فقط للمرحلة التعليمية المحلية
   * TUTORIAL_STAGE). عند عدم تمريره يسلك الكود المسار الأصلي تماماً
   * عبر getStageDef، والسيرفر لا يمرّره أبداً.
   */
  private worldOverride?: WorldDef;
  public checkpointIndex = 0;
  public falls = 0;
  public rescues = 0;
  public collectedStars = new Set<string>();
  public collectedKeys = new Set<string>();
  public players: InternalPlayer[] = [];
  public chains: InternalChain[] = [];
  public crates: DynamicCrateState[] = [];
  public gates = new Map<string, number>();
  public openedGates = new Set<string>();
  public platforms: InternalPlatformState[] = [];
  public boulders: InternalBoulder[] = [];
  public mirrors: InternalMirror[] = [];
  public activePlates = new Set<string>();
  public activeHazards = new Set<string>();
  public activeAnchors: Record<string, string> = {};
  public chainPullProgress: Record<string, number> = {};
  public windForce: Vec3 = { x: 0, y: 0, z: 0 };
  private onEvent?: SimEventCallback;

  constructor(
    roomCode: string,
    worldId: WorldId,
    hostId: string,
    onEvent?: SimEventCallback,
    stage: StageNumber = 1,
    worldOverride?: WorldDef,
  ) {
    this.roomCode = roomCode;
    this.worldId = worldId;
    this.stage = stage;
    this.hostId = hostId;
    this.onEvent = onEvent;
    this.worldOverride = worldOverride;
    this.resetWorld(worldId, stage);
  }

  public get world(): WorldDef {
    return this.worldOverride ?? getStageDef(this.worldId, this.stage);
  }

  public resetWorld(worldId: WorldId, stage: StageNumber = this.stage): void {
    this.worldId = worldId;
    this.stage = stage;
    const w = this.worldOverride ?? getStageDef(worldId, stage);
    this.elapsedSec = 0;
    this.checkpointIndex = 0;
    this.falls = 0;
    this.rescues = 0;
    this.collectedStars.clear();
    this.collectedKeys.clear();
    this.openedGates.clear();
    this.activePlates.clear();
    this.activeHazards.clear();
    this.activeAnchors = {};
    this.chainPullProgress = {};
    this.windForce = { x: 0, y: 0, z: 0 };

    this.platforms = w.platforms.map((def) => ({
      def,
      x: def.x,
      y: def.y,
      z: def.z,
      dx: 0,
      dy: 0,
      dz: 0,
      rotY: 0,
      dRotY: 0,
      tiltX: 0,
      tiltZ: 0,
      active: true,
      crumbleTimer: 0,
      crumbleState: 'solid',
      respawnTimer: 0,
    }));

    this.gates.clear();
    for (const p of w.platforms) {
      if (p.gateId) {
        this.gates.set(p.gateId, 0);
      }
    }

    this.crates = w.puzzles
      .filter((p) => p.kind === 'heavy_crate')
      .map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        z: p.z,
        vx: 0,
        vz: 0,
        pullers: 0,
      }));

    this.mirrors = w.puzzles
      .filter((p) => p.kind === 'mirror_pedestal')
      .map((p) => ({
        id: p.id,
        angle: p.mirrorAngle ?? 1,
        lit: (p.mirrorAngle ?? 1) === (p.receptorAngle ?? 0),
      }));

    for (const pz of w.puzzles) {
      if (pz.kind === 'chain_pull_winch') {
        this.chainPullProgress[pz.id] = 0;
      }
    }

    this.boulders = w.hazards
      .filter((h) => h.kind === 'rolling_boulder')
      .map((h) => ({
        id: h.id,
        x: h.x,
        y: h.y,
        z: h.z,
        rotX: 0,
        rotZ: 0,
        radius: h.radius ?? 1.15,
      }));

    this.respawnAllPlayers(false);
  }

  public addPlayer(id: string, customization: CharacterCustomization, isHost: boolean): InternalPlayer {
    const existing = this.players.find((p) => p.id === id);
    if (existing) {
      existing.connected = true;
      existing.customization = customization;
      return existing;
    }
    const slot = this.players.length;
    const cp = this.world.checkpoints[this.checkpointIndex] || this.world.spawn;
    const offsetX = (slot - 0.5) * 1.5;
    const player: InternalPlayer = {
      id,
      slot,
      isHost,
      connected: true,
      customization,
      x: cp.x + offsetX,
      y: cp.y + 1.4,
      z: cp.z,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      grounded: true,
      onIce: false,
      coyoteTimer: 0.15,
      jumpBufferTimer: 0,
      jumpsLeft: this.world.allowDoubleJump ? 2 : 1,
      landingTimer: 0,
      stumbleTimer: 0,
      climbTimer: 0,
      pullTimer: 0,
      beingDraggedTimer: 0,
      hanging: false,
      wasHanging: false,
      knockedDown: false,
      knockdownCooldown: 0,
      balance: 100,
      ragdollPitch: 0,
      ragdollRoll: 0,
      swingingRopeId: null,
      ropeAngle: 0,
      ropeVel: 0,
      ropeYaw: 0,
      contextAction: this.players.length > 0 ? 'pull_friend' : 'none',
      pullLeanX: 0,
      pullLeanZ: 0,
      grabbingId: null,
      finished: false,
      voiceMuted: true,
      voiceSpeaking: false,
      pingMs: 18,
      input: createDefaultInput(),
      prevJumpPressed: false,
      prevInteractPressed: false,
      anim: 'idle',
      lastInputSeq: 0,
    };
    this.players.push(player);
    this.rebuildChains();
    return player;
  }

  public removePlayer(id: string): void {
    const idx = this.players.findIndex((p) => p.id === id);
    if (idx === -1) return;
    this.players.splice(idx, 1);
    this.players.forEach((p, i) => {
      p.slot = i;
    });
    if (this.hostId === id && this.players.length > 0) {
      this.hostId = this.players[0].id;
      this.players[0].isHost = true;
    }
    this.rebuildChains();
  }

  public setPlayerConnected(id: string, connected: boolean): void {
    const p = this.players.find((pl) => pl.id === id);
    if (p) p.connected = connected;
  }

  public setPlayerInput(id: string, input: PlayerInputState): void {
    const p = this.players.find((pl) => pl.id === id);
    if (!p) return;
    if (
      typeof input.inputSeq === 'number' &&
      Number.isFinite(input.inputSeq) &&
      input.inputSeq > p.lastInputSeq
    ) {
      p.lastInputSeq = input.inputSeq;
    }
    const jumpEdge = input.jumpPressed && !p.prevJumpPressed;
    const interactEdge = input.interactPressed && !p.prevInteractPressed;
    p.prevJumpPressed = input.jumpPressed;
    p.prevInteractPressed = input.interactPressed;
    p.input = {
      ...input,
      jumpPressed: p.input.jumpPressed || jumpEdge,
      interactPressed: p.input.interactPressed || interactEdge,
    };
  }

  private rebuildChains(): void {
    this.chains = [];
    for (let i = 0; i < this.players.length - 1; i++) {
      const a = this.players[i];
      const b = this.players[i + 1];
      const nodes: Vec3[] = [];
      const prevNodes: Vec3[] = [];
      for (let k = 0; k < CHAIN_NODES; k++) {
        const t = k / (CHAIN_NODES - 1);
        const pos = {
          x: a.x + (b.x - a.x) * t,
          y: a.y + 0.8 + (b.y - a.y) * t - Math.sin(t * Math.PI) * 0.45,
          z: a.z + (b.z - a.z) * t,
        };
        nodes.push({ ...pos });
        prevNodes.push({ ...pos });
      }
      this.chains.push({
        nodes,
        prevNodes,
        state: 'relaxed',
        tension: 0,
        wrappedAnchorId: null,
      });
    }
  }

  private respawnAllPlayers(countFall: boolean): void {
    if (countFall) {
      this.falls += 1;
      this.onEvent?.('fall');
    }
    const cp = this.world.checkpoints[this.checkpointIndex] || this.world.spawn;
    const n = Math.max(1, this.players.length);
    this.players.forEach((p, idx) => {
      const offsetX = (idx - (n - 1) / 2) * 1.45;
      p.x = cp.x + offsetX;
      p.y = cp.y + 1.5;
      p.z = cp.z;
      p.vx = 0;
      p.vy = 0;
      p.vz = 0;
      p.grounded = false;
      p.hanging = false;
      p.wasHanging = false;
      p.knockedDown = false;
      p.knockdownCooldown = 0;
      p.balance = 100;
      p.ragdollPitch = 0;
      p.ragdollRoll = 0;
      p.swingingRopeId = null;
      p.pullLeanX = 0;
      p.pullLeanZ = 0;
      p.grabbingId = null;
      p.stumbleTimer = 0;
      p.climbTimer = 0;
      p.pullTimer = 0;
      p.beingDraggedTimer = 0;
      p.jumpsLeft = this.world.allowDoubleJump ? 2 : 1;
    });
    this.activeAnchors = {};
    this.rebuildChains();
  }

  public triggerKnockdown(player: InternalPlayer, impulseX: number, impulseY: number, impulseZ: number): void {
    if (player.knockdownCooldown > 0) return;
    player.vx += impulseX;
    player.vy = Math.max(player.vy, impulseY);
    player.vz += impulseZ;
    player.balance = 0;
    player.stumbleTimer = 0.65;
    player.swingingRopeId = null;
    player.grabbingId = null;
    if (!player.knockedDown) {
      player.knockedDown = true;
      player.knockdownCooldown = 1.1;
      player.ragdollPitch = 1.28;
      player.ragdollRoll = (Math.random() > 0.5 ? 1 : -1) * 0.42;
      this.onEvent?.('knockdown', player.customization.name);
    }
  }

  public recoverKnockdown(helper: InternalPlayer | null, knocked: InternalPlayer): void {
    if (!knocked.knockedDown) return;
    knocked.knockedDown = false;
    knocked.balance = 100;
    knocked.knockdownCooldown = 1.25;
    knocked.ragdollPitch = 0;
    knocked.ragdollRoll = 0;
    knocked.stumbleTimer = 0;
    knocked.vy = Math.max(knocked.vy, 3.2);
    this.rescues += 1;
    this.onEvent?.('rescue', helper ? `${helper.customization.name}->${knocked.customization.name}` : knocked.customization.name);
  }

  public step(dt: number): void {
    if (this.phase !== 'playing') {
      if (this.phase === 'victory') {
        for (const p of this.players) {
          p.anim = 'celebrating';
        }
      }
      return;
    }

    const clampedDt = Math.min(dt, 0.05);
    this.elapsedSec += clampedDt;

    this.updatePlatforms(clampedDt);
    this.updateWind(this.elapsedSec);
    this.updatePlayers(clampedDt);
    this.updateCratesAndPuzzles(clampedDt);
    this.updateHazardsAndBoulders(clampedDt);
    this.updateChains(clampedDt);
    this.resolvePlatformCollisions();
    this.updateCheckpointsStarsAndFinish();
    this.updateContextActions();
    this.updatePlayerAnimations();
  }

  private updatePlatforms(dt: number): void {
    const t = this.elapsedSec;
    for (const p of this.platforms) {
      const prevX = p.x;
      const prevY = p.y;
      const prevZ = p.z;
      const prevRot = p.rotY;

      if ((p.def.kind === 'moving' || p.def.kind === 'elevator') && p.def.moveAxis) {
        const range = p.def.moveRange ?? 3;
        const speed = p.def.moveSpeed ?? 1;
        const phase = p.def.movePhase ?? 0;
        const rawWave = Math.sin(t * speed + phase);
        const offset =
          p.def.kind === 'elevator'
            ? Math.tanh(rawWave * 1.55) / Math.tanh(1.55) * range
            : rawWave * range;
        p.x = p.def.x + p.def.moveAxis[0] * offset;
        p.y = p.def.y + p.def.moveAxis[1] * offset;
        p.z = p.def.z + p.def.moveAxis[2] * offset;
      }

      if (p.def.kind === 'gear' && p.def.rotSpeed) {
        p.rotY += p.def.rotSpeed * dt;
      }

      if (p.def.kind === 'phasing' || p.def.kind === 'vanishing') {
        const period = p.def.phasePeriod ?? 5;
        const offset = p.def.phaseOffset ?? 0;
        const cycle = ((t + offset) % period) / period;
        p.active = cycle < 0.65;
      }

      if (p.def.kind === 'timed_gate') {
        const period = p.def.timedPeriod ?? 5.4;
        const openRatio = p.def.timedOpenRatio ?? 0.52;
        const cycle = ((t + (p.def.phaseOffset ?? 0)) % period) / period;
        const isOpen = cycle < openRatio;
        const targetY = isOpen ? p.def.y + 4.3 : p.def.y;
        p.y += (targetY - p.y) * Math.min(1, 9 * dt);
        p.active = p.y < p.def.y + 2.4;
      }

      if (p.def.kind === 'crumbling' || p.def.kind === 'cracked' || p.def.kind === 'falling_pillar') {
        const delay = p.def.pillarDelay ?? p.def.crumbleDelay ?? 1.05;
        if (p.crumbleState === 'shaking') {
          p.crumbleTimer += dt;
          if (p.def.kind === 'falling_pillar') {
            p.tiltZ = Math.min(0.45, (p.crumbleTimer / delay) * 0.45);
          }
          if (p.crumbleTimer >= delay) {
            p.crumbleState = 'fallen';
            p.active = false;
            p.respawnTimer = 0;
          }
        } else if (p.crumbleState === 'fallen') {
          if (p.def.kind === 'falling_pillar') {
            p.y -= 10 * dt;
          }
          p.respawnTimer += dt;
          if (p.respawnTimer >= 3.2) {
            p.crumbleState = 'solid';
            p.crumbleTimer = 0;
            p.tiltZ = 0;
            p.y = p.def.y;
            p.active = true;
          }
        }
      }

      if (p.def.kind === 'weight_platform' || p.def.kind === 'hanging_bridge') {
        let totalWeight = 0;
        let torqueX = 0;
        let torqueZ = 0;
        for (const pl of this.players) {
          if (
            pl.grounded &&
            Math.abs(pl.x - p.x) <= p.def.w / 2 + 0.4 &&
            Math.abs(pl.z - p.z) <= p.def.d / 2 + 0.4 &&
            Math.abs(pl.y - (p.y + p.def.h / 2)) < 0.8
          ) {
            totalWeight += 1;
            torqueX += (pl.x - p.x) / Math.max(1, p.def.w / 2);
            torqueZ += (pl.z - p.z) / Math.max(1, p.def.d / 2);
          }
        }
        const maxTilt = p.def.maxTilt ?? 0.28;
        const targetTiltZ = Math.max(-maxTilt, Math.min(maxTilt, -torqueX * 0.24));
        const targetTiltX = Math.max(-maxTilt, Math.min(maxTilt, torqueZ * 0.24));
        p.tiltZ += (targetTiltZ - p.tiltZ) * Math.min(1, 6 * dt);
        p.tiltX += (targetTiltX - p.tiltX) * Math.min(1, 6 * dt);
        const sinkFactor = p.def.sinkFactor ?? 0.4;
        const targetY = p.def.y - Math.min(1.8, totalWeight * sinkFactor);
        p.y += (targetY - p.y) * Math.min(1, 5 * dt);
      }

      if (p.def.gateId) {
        const open = this.gates.get(p.def.gateId) ?? 0;
        if (p.def.kind === 'bridge') {
          p.active = open > 0.55;
          p.y = p.def.y - (1 - open) * 4.5;
        } else {
          const off = p.def.gateOpenOffset ?? [0, 4.6, 0];
          p.x = p.def.x + off[0] * open;
          p.y = p.def.y + off[1] * open;
          p.z = p.def.z + off[2] * open;
          p.active = open < 0.85;
        }
      }

      p.dx = p.x - prevX;
      p.dy = p.y - prevY;
      p.dz = p.z - prevZ;
      p.dRotY = p.rotY - prevRot;
    }
  }

  private getEffectiveGravityForPlayer(p: InternalPlayer): number {
    let g = this.world.gravity;
    for (const hz of this.world.hazards) {
      if (hz.kind === 'gravity_zone') {
        const hw = (hz.w ?? 10) / 2;
        const hh = (hz.h ?? 10) / 2;
        const hd = (hz.d ?? 12) / 2;
        if (
          Math.abs(p.x - hz.x) <= hw &&
          Math.abs(p.y - hz.y) <= hh &&
          Math.abs(p.z - hz.z) <= hd
        ) {
          g *= hz.gravityScale ?? 0.55;
        }
      }
    }
    return g;
  }

  private getWindAtPoint(x: number, y: number, z: number): Vec3 {
    let fx = 0;
    let fy = 0;
    let fz = 0;
    for (const hz of this.world.hazards) {
      if (hz.kind === 'wind_zone') {
        const hw = (hz.w ?? 12) / 2;
        const hd = (hz.d ?? 14) / 2;
        if (Math.abs(x - hz.x) <= hw && Math.abs(z - hz.z) <= hd) {
          fx += this.windForce.x;
          fz += this.windForce.z;
        }
      } else if (hz.kind === 'wind_fan') {
        const hw = (hz.w ?? 12) / 2;
        const hh = (hz.h ?? 5) / 2;
        const hd = (hz.d ?? 12) / 2;
        const centerX = hz.x + (hz.dirX ?? 1) * hw * 0.7;
        const centerZ = hz.z + (hz.dirZ ?? 0) * hd * 0.7;
        if (
          Math.abs(x - centerX) <= hw &&
          Math.abs(y - hz.y) <= hh &&
          Math.abs(z - centerZ) <= hd
        ) {
          const pulse = 0.65 + 0.35 * Math.sin(this.elapsedSec * (hz.speed || 1));
          fx += (hz.dirX ?? 1) * hz.amplitude * pulse;
          fy += (hz.dirY ?? 0) * hz.amplitude * pulse;
          fz += (hz.dirZ ?? 0) * hz.amplitude * pulse;
        }
      }
    }
    return { x: fx, y: fy, z: fz };
  }

  private updateWind(t: number): void {
    const windHazard = this.world.hazards.find((h) => h.kind === 'wind_zone');
    const fanHazard = this.world.hazards.find((h) => h.kind === 'wind_fan');
    if (windHazard) {
      const wave = Math.sin(t * windHazard.speed);
      const strength = Math.abs(wave) > 0.35 ? Math.sign(wave) * windHazard.amplitude : 0;
      this.windForce = {
        x: windHazard.axis === 'z' ? 0 : strength,
        y: 0,
        z: windHazard.axis === 'z' ? strength : 0,
      };
    } else if (fanHazard) {
      this.windForce = {
        x: (fanHazard.dirX ?? 1) * fanHazard.amplitude * 0.75,
        y: 0,
        z: (fanHazard.dirZ ?? 0) * fanHazard.amplitude * 0.75,
      };
    } else {
      this.windForce = { x: 0, y: 0, z: 0 };
    }
  }

  private updatePlayers(dt: number): void {
    for (const p of this.players) {
      if (p.landingTimer > 0) p.landingTimer = Math.max(0, p.landingTimer - dt);
      if (p.stumbleTimer > 0) p.stumbleTimer = Math.max(0, p.stumbleTimer - dt);
      if (p.climbTimer > 0) p.climbTimer = Math.max(0, p.climbTimer - dt);
      if (p.pullTimer > 0) p.pullTimer = Math.max(0, p.pullTimer - dt);
      if (p.beingDraggedTimer > 0) p.beingDraggedTimer = Math.max(0, p.beingDraggedTimer - dt);
      if (p.knockdownCooldown > 0) p.knockdownCooldown = Math.max(0, p.knockdownCooldown - dt);

      if (!p.knockedDown && p.balance < 100) {
        p.balance = Math.min(100, p.balance + 28 * dt);
      }

      // Knocked down players cannot move or jump on their own — teammate rescue/pull is strictly required!
      if (p.knockedDown) {
        p.input.jumpPressed = false;
        p.input.interactPressed = false;
        p.vx *= Math.pow(0.08, dt);
        p.vz *= Math.pow(0.08, dt);
        const gravity = this.getEffectiveGravityForPlayer(p);
        p.vy = Math.max(p.vy - gravity * dt, -26);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.ragdollPitch += (1.35 - p.ragdollPitch) * Math.min(1, 8 * dt);
        p.ragdollRoll += (Math.sin(this.elapsedSec * 2.5 + p.slot) * 0.25 - p.ragdollRoll) * Math.min(1, 5 * dt);
        continue;
      }

      // Handle Rope Swinging mode
      if (p.swingingRopeId) {
        const ropeDef = this.world.puzzles.find((pz) => pz.id === p.swingingRopeId);
        if (!ropeDef) {
          p.swingingRopeId = null;
        } else {
          const len = ropeDef.ropeLength ?? 5.0;
          const gravity = this.getEffectiveGravityForPlayer(p);
          const forwardDrive = -p.input.moveZ * 11.5;
          const steerTurn = -p.input.moveX * 2.2;
          p.ropeYaw += steerTurn * dt;
          p.ropeVel += (-(gravity / len) * Math.sin(p.ropeAngle) + forwardDrive / len) * dt;
          p.ropeVel *= 0.992;
          p.ropeAngle = Math.max(-1.15, Math.min(1.15, p.ropeAngle + p.ropeVel * dt));

          const cosA = Math.cos(p.ropeAngle);
          const sinA = Math.sin(p.ropeAngle);
          const dirX = Math.sin(p.ropeYaw);
          const dirZ = -Math.cos(p.ropeYaw);
          p.x = ropeDef.x + dirX * sinA * len;
          p.y = ropeDef.y - cosA * len - 0.8;
          p.z = ropeDef.z + dirZ * sinA * len;
          p.vx = dirX * cosA * p.ropeVel * len;
          p.vy = sinA * p.ropeVel * len;
          p.vz = dirZ * cosA * p.ropeVel * len;
          p.yaw = Math.atan2(dirX, dirZ);

          if (p.input.jumpPressed || p.input.interactPressed) {
            p.input.jumpPressed = false;
            p.input.interactPressed = false;
            p.swingingRopeId = null;
            p.vy = Math.max(8.4, p.vy + 6.5);
            p.vx += dirX * 4.5;
            p.vz += dirZ * 4.5;
            p.jumpsLeft = 1;
          }
          continue;
        }
      }

      // Jump buffer & Coyote time
      if (p.grounded) {
        p.coyoteTimer = 0.15;
        p.jumpsLeft = this.world.allowDoubleJump ? 2 : 1;
      } else {
        p.coyoteTimer = Math.max(0, p.coyoteTimer - dt);
      }

      if (p.input.jumpPressed) {
        p.jumpBufferTimer = 0.15;
        p.input.jumpPressed = false;
      } else {
        p.jumpBufferTimer = Math.max(0, p.jumpBufferTimer - dt);
      }

      // Context-smart Interact / Help / Rope / Mirror / Pull!
      if (p.input.interactPressed) {
        p.input.interactPressed = false;

        // 1) Immediate lift of nearby knocked-down ally!
        const knockedAlly = this.players.find(
          (other) =>
            other.id !== p.id &&
            other.knockedDown &&
            Math.hypot(other.x - p.x, other.y - p.y, other.z - p.z) < 2.8,
        );
        if (knockedAlly) {
          this.recoverKnockdown(p, knockedAlly);
          p.pullTimer = 0.45;
        } else if (p.grabbingId) {
          if (this.activeAnchors[p.grabbingId] === p.id) {
            delete this.activeAnchors[p.grabbingId];
          }
          p.grabbingId = null;
        } else {
          // 2) Try mirror pedestal rotation
          const nearMirror = this.world.puzzles.find(
            (pz) =>
              pz.kind === 'mirror_pedestal' &&
              Math.hypot(pz.x - p.x, pz.y - p.y, pz.z - p.z) < 2.6,
          );
          if (nearMirror) {
            const mState = this.mirrors.find((m) => m.id === nearMirror.id);
            if (mState) {
              mState.angle = (mState.angle + 1) % 4;
              mState.lit = mState.angle === (nearMirror.receptorAngle ?? 0);
            }
          } else {
            // 3) Try swing rope grab
            const nearRope = this.world.puzzles.find(
              (pz) =>
                pz.kind === 'swing_rope' &&
                Math.hypot(pz.x - p.x, pz.z - p.z) < 3.4 &&
                p.y > pz.y - (pz.ropeLength ?? 5) - 2.6 &&
                p.y < pz.y + 1.5,
            );
            if (nearRope) {
              p.swingingRopeId = nearRope.id;
              p.ropeAngle = -0.35;
              p.ropeVel = 2.6;
              p.ropeYaw = 0;
            } else {
              // 4) Try crate, anchor, winch_lever, or chain_pull_winch
              let bestId: string | null = null;
              let bestDist = 2.6;
              for (const c of this.crates) {
                const d = Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z);
                if (d < bestDist) {
                  bestDist = d;
                  bestId = c.id;
                }
              }
              for (const pz of this.world.puzzles) {
                if (
                  pz.kind === 'chain_anchor' ||
                  pz.kind === 'winch_lever' ||
                  pz.kind === 'chain_pull_winch'
                ) {
                  const d = Math.hypot(pz.x - p.x, pz.y - p.y, pz.z - p.z);
                  if (d < 2.7 && d < bestDist) {
                    bestDist = d;
                    bestId = pz.id;
                    if (pz.kind === 'chain_anchor') {
                      this.activeAnchors[pz.id] = p.id;
                    }
                  }
                }
              }
              p.grabbingId = bestId;
              if (!bestId) {
                p.pullTimer = 0.55;
              }
            }
          }
        }
      }

      if (p.input.interactHeld && !p.grabbingId) {
        p.pullTimer = Math.max(p.pullTimer, 0.08);
      }

      // Compute camera-relative movement vector
      const rawX = p.input.moveX;
      const rawZ = p.input.moveZ;
      const mag = Math.hypot(rawX, rawZ);
      const normX = mag > 1 ? rawX / mag : rawX;
      const normZ = mag > 1 ? rawZ / mag : rawZ;

      const sinY = Math.sin(p.input.camYaw);
      const cosY = Math.cos(p.input.camYaw);
      const worldMoveX = normX * cosY + normZ * sinY;
      const worldMoveZ = -normX * sinY + normZ * cosY;

      const maxSpeed = p.grabbingId
        ? 3.3
        : p.input.crouchHeld
        ? 3.4
        : p.input.sprintHeld
        ? SPRINT_SPEED
        : WALK_SPEED;

      const targetVx = worldMoveX * maxSpeed;
      const targetVz = worldMoveZ * maxSpeed;

      const accel = p.grounded ? (p.onIce ? 2.8 : 16.5) : 8.5;
      const blend = Math.min(1, accel * dt);
      p.vx += (targetVx - p.vx) * blend;
      p.vz += (targetVz - p.vz) * blend;

      if (mag > 0.12 && !p.grabbingId) {
        const desiredYaw = Math.atan2(worldMoveX, worldMoveZ);
        let diff = desiredYaw - p.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        p.yaw += diff * Math.min(1, 13 * dt);
      }

      // Wind zone / fan push
      if (!p.input.crouchHeld && !p.grabbingId) {
        const wForce = this.getWindAtPoint(p.x, p.y + 0.8, p.z);
        p.vx += wForce.x * dt;
        p.vy += wForce.y * dt;
        p.vz += wForce.z * dt;
      }

      // Jump (with coyote time or double jump)
      if (p.jumpBufferTimer > 0) {
        if (p.coyoteTimer > 0 || p.hanging) {
          p.vy = JUMP_VEL;
          p.grounded = false;
          p.hanging = false;
          p.coyoteTimer = 0;
          p.jumpBufferTimer = 0;
          p.jumpsLeft = this.world.allowDoubleJump ? 1 : 0;
        } else if (p.jumpsLeft > 0) {
          p.vy = DOUBLE_JUMP_VEL;
          p.jumpsLeft -= 1;
          p.jumpBufferTimer = 0;
        }
      }

      const gravity = this.getEffectiveGravityForPlayer(p);
      if (!p.input.jumpHeld && p.vy > 4.2) {
        p.vy -= gravity * 0.8 * dt;
      }

      p.vy -= gravity * dt;
      p.vy = Math.max(p.vy, -28);

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
    }
  }

  private updateHazardsAndBoulders(dt: number): void {
    this.activeHazards.clear();

    // Update rolling boulders
    for (const b of this.boulders) {
      const hz = this.world.hazards.find((h) => h.id === b.id);
      if (!hz) continue;
      const distTraveled = (this.elapsedSec * hz.speed + (hz.phase ?? 0) * hz.speed) % hz.amplitude;
      if (hz.axis === 'x') {
        b.x = hz.x + distTraveled;
        b.rotZ -= hz.speed * dt;
      } else {
        b.z = hz.z + distTraveled;
        b.rotX += hz.speed * dt;
      }

      let floorY = hz.y - 1.0;
      for (const plat of this.platforms) {
        if (!plat.active) continue;
        if (
          Math.abs(b.x - plat.x) <= plat.def.w / 2 &&
          Math.abs(b.z - plat.z) <= plat.def.d / 2
        ) {
          const topY = plat.y + plat.def.h / 2;
          if (topY > floorY && topY <= hz.y + 2.0) {
            floorY = topY;
          }
        }
      }
      b.y = floorY + b.radius;

      for (const p of this.players) {
        const dist = Math.hypot(p.x - b.x, p.y + 0.7 - b.y, p.z - b.z);
        if (dist < b.radius + PLAYER_RADIUS * 0.9) {
          const ux = (p.x - b.x) / (dist || 1);
          const uz = (p.z - b.z) / (dist || 1);
          this.triggerKnockdown(p, ux * 10, 5.2, uz * 10);
        }
      }
    }

    // Evaluate hazards
    for (const hz of this.world.hazards) {
      if (hz.kind === 'pendulum_log' || hz.kind === 'pendulum_hammer') {
        const angle = Math.sin(this.elapsedSec * hz.speed + (hz.phase ?? 0)) * hz.amplitude;
        const bobX = hz.x + Math.sin(angle) * hz.length;
        const bobY = hz.y - Math.cos(angle) * hz.length;
        const bobZ = hz.z;
        const hitRadius = hz.kind === 'pendulum_hammer' ? 1.55 : 1.3;
        for (const p of this.players) {
          const dist = Math.hypot(p.x - bobX, p.y + 0.8 - bobY, p.z - bobZ);
          if (dist < hitRadius) {
            const pushDir = Math.sign(p.x - bobX) || 1;
            if (hz.kind === 'pendulum_hammer') {
              this.triggerKnockdown(p, pushDir * 12.5, 5.4, 2.5);
            } else {
              p.vx += pushDir * 10;
              p.vy = Math.max(p.vy, 4.4);
              p.stumbleTimer = 0.48;
              p.balance = Math.max(0, p.balance - 45);
              if (p.balance <= 10) {
                this.triggerKnockdown(p, pushDir * 6, 3.5, 0);
              }
            }
          }
        }
      } else if (hz.kind === 'spinning_log') {
        const a = this.elapsedSec * hz.speed + (hz.phase ?? 0);
        const halfLen = hz.length / 2;
        const cosA = Math.cos(a);
        const sinA = Math.sin(a);
        for (const p of this.players) {
          if (Math.abs(p.y + 0.6 - hz.y) < 1.1) {
            const rx = p.x - hz.x;
            const rz = p.z - hz.z;
            const proj = Math.max(-halfLen, Math.min(halfLen, rx * cosA + rz * sinA));
            const cx = hz.x + proj * cosA;
            const cz = hz.z + proj * sinA;
            const d = Math.hypot(p.x - cx, p.z - cz);
            if (d < 0.88) {
              const tangX = -sinA * hz.speed * proj;
              const tangZ = cosA * hz.speed * proj;
              this.triggerKnockdown(p, tangX * 1.8 + Math.sign(p.x - cx || 1) * 4, 5.0, tangZ * 1.8);
            }
          }
        }
      } else if (hz.kind === 'piston_crusher') {
        const trapTriggered = Array.from(this.activePlates).some((pid) => {
          const pz = this.world.puzzles.find((x) => x.id === pid && x.kind === 'trap_plate');
          return pz ? Math.hypot(pz.x - hz.x, pz.z - hz.z) < 14 : false;
        });
        const speedMul = trapTriggered ? 1.55 : 1.0;
        const drop = (Math.sin(this.elapsedSec * hz.speed * speedMul + (hz.phase ?? 0)) + 1) * 0.5;
        const headY = hz.y - drop * hz.amplitude;
        for (const p of this.players) {
          if (
            Math.abs(p.x - hz.x) < 1.65 &&
            Math.abs(p.z - hz.z) < 1.65 &&
            p.y + PLAYER_HEIGHT > headY - 1.1 &&
            p.y < headY + 1.1
          ) {
            this.triggerKnockdown(p, (p.x >= hz.x ? 1 : -1) * 10, 4.2, 5);
          }
        }
      } else if (hz.kind === 'steam_pipe') {
        const period = hz.period ?? 4.0;
        const activeRatio = hz.activeRatio ?? 0.52;
        const cycle = ((this.elapsedSec + (hz.phase ?? 0)) % period) / period;
        const isActive = cycle < activeRatio;
        if (isActive) {
          this.activeHazards.add(hz.id);
          const hw = (hz.w ?? 3.2) / 2;
          const hd = (hz.d ?? 3.2) / 2;
          for (const p of this.players) {
            if (
              Math.abs(p.x - hz.x) <= hw &&
              Math.abs(p.z - hz.z) <= hd &&
              p.y >= hz.y - 0.5 &&
              p.y <= hz.y + (hz.h ?? 4.5)
            ) {
              p.vy = Math.max(p.vy, hz.amplitude);
              p.grounded = false;
            }
          }
        }
      } else if (hz.kind === 'laser_beam') {
        this.activeHazards.add(hz.id);
        const offset = Math.sin(this.elapsedSec * hz.speed + (hz.phase ?? 0)) * hz.amplitude;
        const lx = hz.axis === 'x' ? hz.x + offset : hz.x;
        const lz = hz.axis === 'z' ? hz.z + offset : hz.z;
        const halfSpan = hz.length / 2;
        for (const p of this.players) {
          if (p.input.crouchHeld) continue; // Crouch cleanly ducks laser beams!
          const distZ = hz.axis === 'z' ? Math.abs(p.z - lz) : Math.abs(p.z - lz) - halfSpan;
          const distX = hz.axis === 'z' ? Math.abs(p.x - lx) - halfSpan : Math.abs(p.x - lx);
          const inSpanX = hz.axis === 'z' ? Math.abs(p.x - lx) <= halfSpan : Math.abs(p.x - lx) < 0.55;
          const inSpanZ = hz.axis === 'z' ? Math.abs(p.z - lz) < 0.55 : Math.abs(p.z - lz) <= halfSpan;
          if (inSpanX && inSpanZ && p.y < hz.y + 0.65 && p.y + PLAYER_HEIGHT > hz.y - 0.35 && distX < 0.6 && distZ < 0.6) {
            this.triggerKnockdown(p, 0, 5.2, (p.z >= lz ? 1 : -1) * 9.5);
          }
        }
      }
    }
  }

  private updateCratesAndPuzzles(dt: number): void {
    // Update heavy crates
    for (const c of this.crates) {
      const pullers = this.players.filter((p) => p.grabbingId === c.id);
      c.pullers = pullers.length;
      if (pullers.length > 0) {
        let sumVx = 0;
        let sumVz = 0;
        for (const p of pullers) {
          sumVx += p.vx;
          sumVz += p.vz;
        }
        const speedBoost = pullers.length >= 2 ? 1.05 : 0.6;
        c.vx = (sumVx / pullers.length) * speedBoost;
        c.vz = (sumVz / pullers.length) * speedBoost;
        c.x += c.vx * dt;
        c.z += c.vz * dt;
        for (const p of pullers) {
          const dx = p.x - c.x;
          const dz = p.z - c.z;
          const d = Math.hypot(dx, dz) || 1;
          if (d > 2.1) {
            p.x = c.x + (dx / d) * 2.1;
            p.z = c.z + (dz / d) * 2.1;
          }
        }
      } else {
        c.vx *= 0.8;
        c.vz *= 0.8;
      }

      let floorY = -999;
      for (const plat of this.platforms) {
        if (!plat.active) continue;
        if (
          Math.abs(c.x - plat.x) <= plat.def.w / 2 &&
          Math.abs(c.z - plat.z) <= plat.def.d / 2
        ) {
          const topY = plat.y + plat.def.h / 2;
          if (topY > floorY && topY <= c.y + 1.2) {
            floorY = topY;
          }
        }
      }
      if (floorY > -900) {
        c.y = floorY + 0.9;
      } else {
        c.y -= 10 * dt;
        if (c.y < this.world.fallLimitY) {
          const def = this.world.puzzles.find((pz) => pz.id === c.id);
          if (def) {
            c.x = def.x;
            c.y = def.y;
            c.z = def.z;
          }
        }
      }
    }

    // Evaluate pressure plates, trap plates, winches, keys, mirrors, chain pull winches
    this.activePlates.clear();
    const groupCounts = new Map<string, { count: number; required: number; gateId: string }>();

    for (const pz of this.world.puzzles) {
      if (pz.kind === 'pressure_plate' && pz.targetGateId) {
        let pressed = false;
        for (const p of this.players) {
          if (Math.hypot(p.x - pz.x, p.z - pz.z) < 1.35 && Math.abs(p.y - pz.y) < 1.6) {
            pressed = true;
            break;
          }
        }
        if (!pressed) {
          for (const c of this.crates) {
            if (Math.hypot(c.x - pz.x, c.z - pz.z) < 1.55 && Math.abs(c.y - 0.9 - pz.y) < 1.6) {
              pressed = true;
              break;
            }
          }
        }
        if (pressed) {
          this.activePlates.add(pz.id);
        }
        const gKey = pz.plateGroupId ?? pz.id;
        const existing = groupCounts.get(gKey) ?? {
          count: 0,
          required: pz.requiredOnGroup ?? 1,
          gateId: pz.targetGateId,
        };
        if (pressed) existing.count += 1;
        groupCounts.set(gKey, existing);
      } else if (pz.kind === 'trap_plate') {
        const hw = (pz.w ?? 2.4) / 2;
        const hd = (pz.d ?? 2.4) / 2;
        const stepped = this.players.some(
          (p) => Math.abs(p.x - pz.x) <= hw && Math.abs(p.z - pz.z) <= hd && Math.abs(p.y - pz.y) < 1.2,
        );
        if (stepped) {
          this.activePlates.add(pz.id);
        }
      } else if (pz.kind === 'winch_lever' && pz.targetGateId) {
        const pulled = this.players.some(
          (p) =>
            p.grabbingId === pz.id ||
            (Math.hypot(p.x - pz.x, p.z - pz.z) < 1.6 && Math.abs(p.y - pz.y) < 1.8),
        );
        if (pulled) {
          this.activePlates.add(pz.id);
          const cur = this.gates.get(pz.targetGateId) ?? 0;
          const next = Math.min(1, cur + dt * 1.45);
          this.gates.set(pz.targetGateId, next);
          if (next > 0.95 && !this.openedGates.has(pz.targetGateId)) {
            this.openedGates.add(pz.targetGateId);
            this.onEvent?.('gate_open', pz.targetGateId);
          }
        }
      } else if (pz.kind === 'chain_pull_winch' && pz.targetGateId) {
        const pullingPlayers = this.players.filter(
          (p) =>
            !p.knockedDown &&
            (p.grabbingId === pz.id ||
              (Math.hypot(p.x - pz.x, p.z - pz.z) < 3.4 &&
                (p.input.interactHeld || p.pullTimer > 0))),
        );
        const curProg = this.chainPullProgress[pz.id] ?? 0;
        const req = Math.min(this.players.length || 1, pz.requiredPullers ?? 1);
        const nextProg =
          pullingPlayers.length >= req
            ? Math.min(1, curProg + dt * (0.45 + pullingPlayers.length * 0.25))
            : curProg > 0.98
            ? 1
            : Math.max(0, curProg - dt * 0.12);
        this.chainPullProgress[pz.id] = nextProg;
        if (pullingPlayers.length >= req) {
          this.activePlates.add(pz.id);
        }
        const curGate = this.gates.get(pz.targetGateId) ?? 0;
        if (nextProg > curGate) {
          this.gates.set(pz.targetGateId, nextProg);
        }
        if (nextProg >= 0.96 && !this.openedGates.has(pz.targetGateId)) {
          this.openedGates.add(pz.targetGateId);
          this.gates.set(pz.targetGateId, 1);
          this.onEvent?.('gate_open', pz.targetGateId);
        }
      } else if (pz.kind === 'key_item' && pz.targetGateId) {
        if (!this.collectedKeys.has(pz.id)) {
          const picked = this.players.some(
            (p) => !p.knockedDown && Math.hypot(p.x - pz.x, p.y + 0.8 - pz.y, p.z - pz.z) < 1.85,
          );
          if (picked) {
            this.collectedKeys.add(pz.id);
            this.onEvent?.('key', pz.id);
          }
        }
        if (this.collectedKeys.has(pz.id)) {
          const gKey = `keys_${pz.targetGateId}`;
          const existing = groupCounts.get(gKey) ?? {
            count: 0,
            required: pz.requiredOnGroup ?? 3,
            gateId: pz.targetGateId,
          };
          existing.count += 1;
          groupCounts.set(gKey, existing);
        }
      } else if (pz.kind === 'mirror_pedestal' && pz.targetGateId) {
        const mState = this.mirrors.find((m) => m.id === pz.id);
        const isLit = mState ? mState.lit : false;
        const gKey = pz.plateGroupId ?? `mir_${pz.targetGateId}`;
        const existing = groupCounts.get(gKey) ?? {
          count: 0,
          required: pz.requiredOnGroup ?? 1,
          gateId: pz.targetGateId,
        };
        if (isLit) existing.count += 1;
        groupCounts.set(gKey, existing);
      }
    }

    for (const info of groupCounts.values()) {
      const targetOpen = info.count >= info.required ? 1 : 0;
      const cur = this.gates.get(info.gateId) ?? 0;
      const latched = this.openedGates.has(info.gateId) ? 1 : targetOpen;
      const next = cur + (latched - cur) * Math.min(1, dt * 4.5);
      this.gates.set(info.gateId, next);
      if (targetOpen === 1 && !this.openedGates.has(info.gateId)) {
        this.openedGates.add(info.gateId);
        this.onEvent?.('gate_open', info.gateId);
      }
    }
  }

  private updateChains(dt: number): void {
    for (const p of this.players) {
      p.pullLeanX = 0;
      p.pullLeanZ = 0;
    }
    if (this.players.length < 2) return;

    const maxLen = this.world.chainMaxLength;
    const segRest = maxLen / (CHAIN_NODES - 1);
    const baseGravity = this.world.gravity * 0.82;
    const subDt = dt * 0.5;
    const last = CHAIN_NODES - 1;

    for (let i = 0; i < this.chains.length; i++) {
      const pA = this.players[i];
      const pB = this.players[i + 1];
      const chain = this.chains[i];

      const pullA = !pA.grabbingId && !pA.knockedDown && (pA.input.interactHeld || pA.pullTimer > 0);
      const pullB = !pB.grabbingId && !pB.knockedDown && (pB.input.interactHeld || pB.pullTimer > 0);
      const someonePulling = pullA || pullB;

      const anchorId = Object.keys(this.activeAnchors).find(
        (aid) => this.activeAnchors[aid] === pA.id || this.activeAnchors[aid] === pB.id,
      );
      chain.wrappedAnchorId = anchorId ?? null;

      // Run 2 stabilized Verlet sub-steps per physics tick to prevent any jitter or stretching
      for (let stepIdx = 0; stepIdx < 2; stepIdx++) {
        chain.nodes[0].x = pA.x;
        chain.nodes[0].y = pA.knockedDown ? pA.y + 0.32 : pA.y + 0.72;
        chain.nodes[0].z = pA.z;

        chain.nodes[last].x = pB.x;
        chain.nodes[last].y = pB.knockedDown ? pB.y + 0.32 : pB.y + 0.72;
        chain.nodes[last].z = pB.z;

        const verletGravity = someonePulling ? baseGravity * 0.16 : baseGravity;
        for (let k = 1; k < last; k++) {
          const node = chain.nodes[k];
          const prev = chain.prevNodes[k];
          const vx = (node.x - prev.x) * 0.90;
          const vy = (node.y - prev.y) * 0.90;
          const vz = (node.z - prev.z) * 0.90;
          prev.x = node.x;
          prev.y = node.y;
          prev.z = node.z;

          const wind = this.getWindAtPoint(node.x, node.y, node.z);
          node.x += vx + wind.x * 0.35 * subDt * subDt;
          node.y += vy - verletGravity * subDt * subDt;
          node.z += vz + wind.z * 0.35 * subDt * subDt;

          if (someonePulling) {
            const t = k / last;
            const lineX = chain.nodes[0].x + (chain.nodes[last].x - chain.nodes[0].x) * t;
            const lineY = chain.nodes[0].y + (chain.nodes[last].y - chain.nodes[0].y) * t;
            const lineZ = chain.nodes[0].z + (chain.nodes[last].z - chain.nodes[0].z) * t;
            const straighten = Math.min(1, 14 * subDt);
            node.x += (lineX - node.x) * straighten;
            node.y += (lineY - node.y) * straighten;
            node.z += (lineZ - node.z) * straighten;
          }
        }

        if (anchorId) {
          const pz = this.world.puzzles.find((x) => x.id === anchorId);
          if (pz) {
            const mid = Math.floor(CHAIN_NODES / 2);
            chain.nodes[mid].x = pz.x;
            chain.nodes[mid].y = pz.y + 1.1;
            chain.nodes[mid].z = pz.z;
          }
        }

        // Distance constraints + environment/obstacle collisions (10 iterations per substep)
        for (let iter = 0; iter < 10; iter++) {
          for (let k = 0; k < last; k++) {
            const n1 = chain.nodes[k];
            const n2 = chain.nodes[k + 1];
            const dx = n2.x - n1.x;
            const dy = n2.y - n1.y;
            const dz = n2.z - n1.z;
            const dist = Math.hypot(dx, dy, dz) || 0.0001;
            if (dist > segRest) {
              const diff = (dist - segRest) / dist;
              const w1 = k === 0 ? 0 : 0.5;
              const w2 = k + 1 === last ? 0 : 0.5;
              const wSum = w1 + w2;
              if (wSum > 0) {
                n1.x += dx * diff * (w1 / wSum);
                n1.y += dy * diff * (w1 / wSum);
                n1.z += dz * diff * (w1 / wSum);
                n2.x -= dx * diff * (w2 / wSum);
                n2.y -= dy * diff * (w2 / wSum);
                n2.z -= dz * diff * (w2 / wSum);
              }
            }
          }

          // Collide chain links with platforms, crates, and rolling boulders
          for (let k = 1; k < last; k++) {
            const n = chain.nodes[k];
            for (const plat of this.platforms) {
              if (!plat.active || plat.def.gateId) continue;
              const halfW = plat.def.w / 2;
              const halfD = plat.def.d / 2;
              const topY = plat.y + plat.def.h / 2;
              const bottomY = plat.y - plat.def.h / 2;
              if (
                Math.abs(n.x - plat.x) < halfW &&
                Math.abs(n.z - plat.z) < halfD &&
                n.y < topY + 0.08 &&
                n.y > bottomY
              ) {
                n.y = topY + 0.08;
              }
            }
            for (const c of this.crates) {
              if (Math.abs(n.x - c.x) < 1.0 && Math.abs(n.z - c.z) < 1.0 && n.y < c.y + 0.95 && n.y > c.y - 0.9) {
                n.y = c.y + 0.95;
              }
            }
            for (const b of this.boulders) {
              const bd = Math.hypot(n.x - b.x, n.y - b.y, n.z - b.z);
              if (bd < b.radius + 0.08 && bd > 0.001) {
                const push = (b.radius + 0.08 - bd) / bd;
                n.x += (n.x - b.x) * push;
                n.y += (n.y - b.y) * push;
                n.z += (n.z - b.z) * push;
              }
            }
          }
        }
      }

      // Active Teammate Pull / Hoist / Stand-up Rescue
      const applyPullTowards = (puller: InternalPlayer, target: InternalPlayer, strength: number) => {
        const pdx = puller.x - target.x;
        const pdy = puller.y - target.y;
        const pdz = puller.z - target.z;
        const pDist = Math.hypot(pdx, pdy, pdz) || 0.0001;

        if (target.knockedDown && pDist <= 2.9) {
          this.recoverKnockdown(puller, target);
          return;
        }
        if (pDist <= 1.25) return;

        const ux = pdx / pDist;
        const uy = pdy / pDist;
        const uz = pdz / pDist;

        if (Math.hypot(puller.input.moveX, puller.input.moveZ) < 0.15) {
          puller.yaw = Math.atan2(-ux, -uz);
        }

        if (target.hanging || (!target.grounded && puller.y > target.y + 0.35)) {
          target.vx += ux * 26 * strength * dt;
          target.vy += Math.max(uy, 0.55) * 34 * strength * dt;
          target.vz += uz * 26 * strength * dt;
          // رفع الإنقاذ: عند سحب شريك معلق/ساقط، أعطِه حداً أدنى لسرعة
          // الصعود وإلا بقي متدلياً ملاصقاً لوجه الجرف إلى الأبد — مكون
          // السرعة العمودية للسحب (uy) صغير عندما يتدلى الشريك أمام
          // الحافة لا تحتها مباشرة، فيغلب الجاذبية على الرفع.
          target.vy = Math.max(target.vy, 5.0);
          const hoistStep = Math.min(pDist - 1.15, 3.8 * strength * dt);
          target.x += ux * hoistStep;
          target.y += Math.max(uy, 0.45) * hoistStep;
          target.z += uz * hoistStep;
          // اللاعب المُرفوع يُسحب فعلياً: تفعيل مساعد التسلق على الحافة
          // الأخيرة (كما في فرع السحب الأرضي) وإلا علق عند حافة المنصة
          // إلى الأبد دون أن يتمكن من الصعود رغم وصوله لمستواها.
          target.beingDraggedTimer = 0.22;
          if (target.y >= puller.y - 0.45) {
            target.hanging = false;
            target.vy = Math.max(target.vy, 3.4);
          }
        } else {
          const desiredSpeed = 8.4 * strength;
          const blend = Math.min(1, 10 * dt);
          target.vx += (ux * desiredSpeed - target.vx) * blend;
          target.vz += (uz * desiredSpeed - target.vz) * blend;
          if (target.grounded && (uy > 0.15 || puller.y > target.y + 0.25)) {
            target.vy = Math.max(target.vy, 3.8);
          }
          const reelStep = Math.min(pDist - 1.25, 2.5 * strength * dt);
          target.x += ux * reelStep;
          target.z += uz * reelStep;
          target.beingDraggedTimer = 0.22;
        }

        if (target.knockedDown && pDist < 3.2) {
          this.recoverKnockdown(puller, target);
        }

        const hSpd = Math.hypot(target.vx, target.vz);
        if (hSpd > 12.5) {
          target.vx = (target.vx / hSpd) * 12.5;
          target.vz = (target.vz / hSpd) * 12.5;
        }
        target.vy = Math.min(target.vy, 13.5);
      };

      if (pullA && !pullB) {
        applyPullTowards(pA, pB, pA.input.crouchHeld ? 1.25 : 1.0);
      } else if (pullB && !pullA) {
        applyPullTowards(pB, pA, pB.input.crouchHeld ? 1.25 : 1.0);
      } else if (pullA && pullB) {
        applyPullTowards(pA, pB, 0.55);
        applyPullTowards(pB, pA, 0.55);
      }

      // Player-to-player cooperative chain tension physics
      const dx = pB.x - pA.x;
      const dy = pB.y - pA.y;
      const dz = pB.z - pA.z;
      const dist = Math.hypot(dx, dy, dz) || 0.0001;
      const tensionRatio = Math.min(1.5, dist / maxLen);
      chain.tension = Math.max(
        someonePulling ? 0.72 : 0,
        Math.max(0, Math.min(1, (tensionRatio - 0.72) / 0.28)),
      );

      // Lean visuals based on tension
      if (chain.tension > 0.15) {
        const ux = dx / dist;
        const uz = dz / dist;
        const leanAmp = chain.tension * 0.45;
        pA.pullLeanX += ux * leanAmp;
        pA.pullLeanZ += uz * leanAmp;
        pB.pullLeanX -= ux * leanAmp;
        pB.pullLeanZ -= uz * leanAmp;
      }

      let chainColliding = false;
      for (let k = 1; k < last; k++) {
        if (chain.nodes[k].y < Math.min(pA.y, pB.y) + 0.15) {
          chainColliding = true;
          break;
        }
      }

      if (dist > maxLen) {
        const excess = dist - maxLen;
        const nx = dx / dist;
        const ny = dy / dist;
        const nz = dz / dist;

        const resistA =
          (pA.knockedDown ? 0.15 : 0) +
          (pA.grounded ? 0.75 : 0.2) +
          (pA.input.crouchHeld ? 0.3 : 0) +
          (pA.grabbingId ? 0.35 : 0) +
          (pullA ? 0.45 : 0);
        const resistB =
          (pB.knockedDown ? 0.15 : 0) +
          (pB.grounded ? 0.75 : 0.2) +
          (pB.input.crouchHeld ? 0.3 : 0) +
          (pB.grabbingId ? 0.35 : 0) +
          (pullB ? 0.45 : 0);

        const shareA = resistB / (resistA + resistB);
        const shareB = resistA / (resistA + resistB);

        const posPull = Math.min(excess, 0.55) * 0.68;
        pA.x += nx * posPull * shareA;
        pA.y += ny * posPull * shareA;
        pA.z += nz * posPull * shareA;

        pB.x -= nx * posPull * shareB;
        pB.y -= ny * posPull * shareB;
        pB.z -= nz * posPull * shareB;

        const relVx = pB.vx - pA.vx;
        const relVy = pB.vy - pA.vy;
        const relVz = pB.vz - pA.vz;
        const relAlong = relVx * nx + relVy * ny + relVz * nz;
        if (relAlong > 0) {
          const impulse = relAlong * 0.92 + excess * 18 * dt;
          pA.vx += nx * impulse * shareA;
          pA.vy += ny * impulse * shareA;
          pA.vz += nz * impulse * shareA;
          pB.vx -= nx * impulse * shareB;
          pB.vy -= ny * impulse * shareB;
          pB.vz -= nz * impulse * shareB;
        }

        if (!pA.grounded && !pA.knockedDown && pB.grounded && pA.y < pB.y - 1.35 && ny > 0.22) {
          pA.hanging = true;
          pA.wasHanging = true;
          pA.vy = Math.max(pA.vy, -1.8);
        }
        if (!pB.grounded && !pB.knockedDown && pA.grounded && pB.y < pA.y - 1.35 && ny < -0.22) {
          pB.hanging = true;
          pB.wasHanging = true;
          pB.vy = Math.max(pB.vy, -1.8);
        }

        if (excess > 0.35 && !pA.grounded && pA.stumbleTimer <= 0) {
          pA.stumbleTimer = 0.25;
        }
        if (excess > 0.35 && !pB.grounded && pB.stumbleTimer <= 0) {
          pB.stumbleTimer = 0.25;
        }
      } else {
        pA.hanging = false;
        pB.hanging = false;
      }

      if (anchorId) {
        chain.state = 'swinging';
      } else if (someonePulling || pA.grabbingId || pB.grabbingId || pA.hanging || pB.hanging) {
        chain.state = 'pulling';
      } else if (chain.tension > 0.45) {
        chain.state = 'tensioned';
      } else if (chainColliding) {
        chain.state = 'collision';
      } else {
        chain.state = 'relaxed';
      }
    }
  }

  private resolvePlatformCollisions(): void {
    for (const p of this.players) {
      if (p.swingingRopeId) {
        p.grounded = false;
        continue;
      }
      const wasGrounded = p.grounded;
      const prevVy = p.vy;
      p.grounded = false;
      p.onIce = false;

      for (const plat of this.platforms) {
        if (!plat.active) continue;
        const halfW = plat.def.w / 2 + PLAYER_RADIUS * 0.7;
        const halfD = plat.def.d / 2 + PLAYER_RADIUS * 0.7;
        const dx = p.x - plat.x;
        const dz = p.z - plat.z;
        const tiltOffsetY = -dx * Math.sin(plat.tiltZ) + dz * Math.sin(plat.tiltX);
        const topY = plat.y + plat.def.h / 2 + tiltOffsetY;
        const bottomY = plat.y - plat.def.h / 2;

        if (Math.abs(dx) <= halfW && Math.abs(dz) <= halfD) {
          if (p.y >= topY - 0.65 && p.y <= topY + 0.42 && p.vy <= 0.6) {
            p.y = topY;
            p.vy = 0;
            p.grounded = true;
            p.hanging = false;

            if (p.wasHanging) {
              p.wasHanging = false;
              this.rescues += 1;
              this.onEvent?.('rescue', p.customization.name);
            }

            if (!wasGrounded && prevVy < -6.5) {
              p.landingTimer = 0.2;
            }
            if (!wasGrounded && prevVy < -20.5) {
              this.triggerKnockdown(p, 0, 2.0, 0);
            }

            p.x += plat.dx;
            p.y += plat.dy;
            p.z += plat.dz;
            if (plat.dRotY !== 0) {
              const c = Math.cos(plat.dRotY);
              const s = Math.sin(plat.dRotY);
              const rx = p.x - plat.x;
              const rz = p.z - plat.z;
              p.x = plat.x + rx * c - rz * s;
              p.z = plat.z + rx * s + rz * c;
            }

            if (plat.def.kind === 'ice') {
              p.onIce = true;
            }
            if (
              (plat.def.kind === 'crumbling' ||
                plat.def.kind === 'cracked' ||
                plat.def.kind === 'falling_pillar') &&
              plat.crumbleState === 'solid'
            ) {
              plat.crumbleState = 'shaking';
            }
            if (plat.def.kind === 'bounce' && !p.knockedDown) {
              p.vy = plat.def.bounceForce ?? 15;
              p.grounded = false;
              p.jumpsLeft = 1;
            }
            continue;
          }

          if (
            !p.knockedDown &&
            p.y < topY - 0.35 &&
            p.y > topY - 1.45 &&
            (p.input.jumpHeld ||
              p.beingDraggedTimer > 0 ||
              Math.hypot(p.input.moveX, p.input.moveZ) > 0.3)
          ) {
            p.vy = 7.2;
            p.climbTimer = 0.32;
          }

          if (p.y + PLAYER_HEIGHT > bottomY + 0.2 && p.y < topY - 0.45) {
            const penX = halfW - Math.abs(dx);
            const penZ = halfD - Math.abs(dz);
            if (penX < penZ) {
              p.x += Math.sign(dx || 1) * penX;
              p.vx = 0;
            } else {
              p.z += Math.sign(dz || 1) * penZ;
              p.vz = 0;
            }
          }
        }
      }

      for (const c of this.crates) {
        if (p.grabbingId === c.id) continue;
        const half = 1.05;
        const dx = p.x - c.x;
        const dz = p.z - c.z;
        if (
          Math.abs(dx) < half &&
          Math.abs(dz) < half &&
          p.y < c.y + 0.9 &&
          p.y + PLAYER_HEIGHT > c.y - 0.9
        ) {
          if (p.y >= c.y + 0.45 && p.vy <= 0) {
            p.y = c.y + 0.9;
            p.vy = 0;
            p.grounded = true;
          } else {
            const px = half - Math.abs(dx);
            const pz = half - Math.abs(dz);
            if (px < pz) p.x += Math.sign(dx || 1) * px;
            else p.z += Math.sign(dz || 1) * pz;
          }
        }
      }
    }

    if (this.players.length > 0) {
      const allFallen = this.players.every((p) => p.y < this.world.fallLimitY);
      const anyWayTooLow = this.players.some((p) => p.y < this.world.fallLimitY - 6);
      if (allFallen || anyWayTooLow) {
        this.respawnAllPlayers(true);
      }
    }
  }

  private updateCheckpointsStarsAndFinish(): void {
    for (const cp of this.world.checkpoints) {
      if (cp.index > this.checkpointIndex) {
        const reached = this.players.some(
          (p) => Math.hypot(p.x - cp.x, p.z - cp.z) < 4.5 && Math.abs(p.y - cp.y) < 3.5,
        );
        if (reached) {
          this.checkpointIndex = cp.index;
          this.onEvent?.('checkpoint', String(cp.index));
        }
      }
    }

    for (const st of this.world.stars) {
      if (this.collectedStars.has(st.id)) continue;
      const touched = this.players.some(
        (p) => Math.hypot(p.x - st.x, p.y + 0.8 - st.y, p.z - st.z) < 1.75,
      );
      if (touched) {
        this.collectedStars.add(st.id);
        this.onEvent?.('star', st.id);
      }
    }

    const fin = this.world.finish;
    let finishedCount = 0;
    for (const p of this.players) {
      const dist = Math.hypot(p.x - fin.x, p.z - fin.z);
      if (dist < 4.5 && Math.abs(p.y - fin.y) < 4.2 && !p.knockedDown) {
        p.finished = true;
        finishedCount += 1;
      } else {
        p.finished = false;
      }
    }
    if (this.players.length > 0 && finishedCount === this.players.length) {
      this.phase = 'victory';
      this.onEvent?.('victory');
    }
  }

  private updateContextActions(): void {
    for (const p of this.players) {
      if (p.knockedDown) {
        p.contextAction = 'none';
        continue;
      }
      if (p.swingingRopeId) {
        p.contextAction = 'swing_rope';
        continue;
      }
      const knockedAlly = this.players.some(
        (other) =>
          other.id !== p.id &&
          other.knockedDown &&
          Math.hypot(other.x - p.x, other.y - p.y, other.z - p.z) < 2.8,
      );
      if (knockedAlly) {
        p.contextAction = 'help_ally';
        continue;
      }

      const hangingOrLowAlly = this.players.some(
        (other) =>
          other.id !== p.id &&
          (other.hanging || other.y < p.y - 1.3),
      );

      let found: ContextActionHint | null = null;
      for (const pz of this.world.puzzles) {
        const d = Math.hypot(pz.x - p.x, pz.z - p.z);
        if (pz.kind === 'mirror_pedestal' && d < 2.6 && Math.abs(pz.y - p.y) < 2.0) {
          found = 'rotate_mirror';
          break;
        }
        if (pz.kind === 'swing_rope' && d < 3.4 && p.y > pz.y - (pz.ropeLength ?? 5) - 2.6) {
          found = 'swing_rope';
          break;
        }
        if (pz.kind === 'chain_pull_winch' && d < 3.2 && Math.abs(pz.y - p.y) < 2.0) {
          found = 'chain_pull';
          break;
        }
        if (pz.kind === 'winch_lever' && d < 2.6 && Math.abs(pz.y - p.y) < 2.0) {
          found = 'winch';
          break;
        }
        if (pz.kind === 'chain_anchor' && d < 2.6 && Math.abs(pz.y - p.y) < 2.0) {
          found = 'anchor';
          break;
        }
      }
      if (!found) {
        for (const c of this.crates) {
          if (Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z) < 2.5) {
            found = 'grab_crate';
            break;
          }
        }
      }
      if (found) {
        p.contextAction = found;
      } else if (hangingOrLowAlly) {
        p.contextAction = 'hoist_ally';
      } else if (this.players.length >= 2) {
        p.contextAction = 'pull_friend';
      } else {
        p.contextAction = 'none';
      }
    }
  }

  private updatePlayerAnimations(): void {
    for (const p of this.players) {
      if (this.phase === 'victory') {
        p.anim = 'celebrating';
        continue;
      }
      if (p.knockedDown) {
        p.anim = 'knocked_down';
        continue;
      }
      if (p.swingingRopeId) {
        p.anim = 'swinging';
        continue;
      }
      if (p.hanging) {
        p.anim = 'hanging';
        continue;
      }
      if (p.climbTimer > 0) {
        p.anim = 'climbing';
        continue;
      }
      if (p.grabbingId || (!p.grabbingId && (p.input.interactHeld || p.pullTimer > 0))) {
        p.anim = 'pulling';
        continue;
      }
      if (p.beingDraggedTimer > 0) {
        p.anim = 'dragged';
        continue;
      }
      if (p.stumbleTimer > 0) {
        p.anim = 'stumbling';
        continue;
      }
      if (!p.grounded) {
        p.anim = p.vy > 1.2 ? 'jumping' : 'falling';
        continue;
      }
      if (p.landingTimer > 0) {
        p.anim = 'landing';
        continue;
      }
      const speed = Math.hypot(p.vx, p.vz);
      if (
        p.input.crouchHeld ||
        (p.onIce && speed > 2.0 && Math.hypot(p.input.moveX, p.input.moveZ) < 0.2)
      ) {
        p.anim = 'sliding';
      } else if (speed > 6.7) {
        p.anim = 'running';
      } else if (speed > 0.55) {
        p.anim = 'walking';
      } else {
        p.anim = 'idle';
      }
    }
  }

  public getSnapshot(): RoomStateSnapshot {
    const players: PlayerSnapshot[] = this.players.map((p) => ({
      id: p.id,
      slot: p.slot,
      isHost: p.isHost,
      connected: p.connected,
      customization: p.customization,
      x: p.x,
      y: p.y,
      z: p.z,
      vx: p.vx,
      vy: p.vy,
      vz: p.vz,
      yaw: p.yaw,
      grounded: p.grounded,
      anim: p.anim,
      hanging: p.hanging,
      knockedDown: p.knockedDown,
      balance: p.balance,
      swingingRopeId: p.swingingRopeId,
      contextAction: p.contextAction,
      pullLeanX: p.pullLeanX,
      pullLeanZ: p.pullLeanZ,
      ragdollPitch: p.ragdollPitch,
      ragdollRoll: p.ragdollRoll,
      grabbingId: p.grabbingId,
      finished: p.finished,
      voiceMuted: p.voiceMuted,
      voiceSpeaking: p.voiceSpeaking,
      pingMs: p.pingMs,
      lastInputSeq: p.lastInputSeq,
    }));

    const chains: ChainLinkSnapshot[] = this.chains.map((c, idx) => ({
      pairIndex: idx,
      state: c.state,
      tension: c.tension,
      nodes: c.nodes.map((n) => ({ x: n.x, y: n.y, z: n.z })),
    }));

    const gates: GateRuntimeState[] = Array.from(this.gates.entries()).map(([id, openProgress]) => ({
      id,
      openProgress,
    }));

    const platforms: PlatformRuntimeState[] = this.platforms.map((p) => {
      const delay = p.def.pillarDelay ?? p.def.crumbleDelay ?? 1.05;
      return {
        id: p.def.id,
        x: p.x,
        y: p.y,
        z: p.z,
        rotY: p.rotY,
        tiltX: p.tiltX,
        tiltZ: p.tiltZ,
        active: p.active,
        crumbleProgress: p.crumbleState === 'shaking' ? Math.min(1, p.crumbleTimer / delay) : 0,
      };
    });

    const boulders: BoulderRuntimeState[] = this.boulders.map((b) => ({
      id: b.id,
      x: b.x,
      y: b.y,
      z: b.z,
      rotX: b.rotX,
      rotZ: b.rotZ,
    }));

    const mirrors: MirrorRuntimeState[] = this.mirrors.map((m) => ({
      id: m.id,
      angle: m.angle,
      lit: m.lit,
    }));

    return {
      roomCode: this.roomCode,
      phase: this.phase,
      worldId: this.worldId,
      stage: this.stage,
      hostId: this.hostId,
      elapsedSec: this.elapsedSec,
      checkpointIndex: this.checkpointIndex,
      falls: this.falls,
      rescues: this.rescues,
      collectedStars: Array.from(this.collectedStars),
      collectedKeys: Array.from(this.collectedKeys),
      players,
      chains,
      crates: this.crates.map((c) => ({ ...c })),
      gates,
      platforms,
      boulders,
      mirrors,
      activePlates: Array.from(this.activePlates),
      activeHazards: Array.from(this.activeHazards),
      activeAnchors: { ...this.activeAnchors },
      windForce: { ...this.windForce },
      chainPullProgress: { ...this.chainPullProgress },
    };
  }
}
