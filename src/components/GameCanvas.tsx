import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createStylizedCharacter, type CharacterRig } from '../game/characterMesh.ts';
import { createWorldMaterialLibrary } from '../game/textures.ts';
import { buildWorldScene, type BuiltWorldScene } from '../game/worldScene.ts';
import { getStageDef } from '../shared/worldsData.ts';
import { TUTORIAL_STAGE } from '../shared/tutorialStage.ts';
import { gameAudio } from '../game/audio.ts';
import type {
  CharacterCustomization,
  PlayerInputState,
  QualityPreset,
  RoomStateSnapshot,
  StageNumber,
  WorldId,
} from '../shared/types.ts';

export type CanvasMode = 'title' | 'character' | 'lobby' | 'playing' | 'victory';

export interface ProjectedLabel {
  id: string;
  name: string;
  isHost: boolean;
  voiceMuted: boolean;
  voiceSpeaking: boolean;
  hanging: boolean;
  knockedDown: boolean;
  x: number;
  y: number;
  visible: boolean;
}

interface GameCanvasProps {
  mode: CanvasMode;
  worldId: WorldId;
  stage?: StageNumber;
  /** عند true يُبنى مشهد المرحلة التعليمية بدل مرحلة الكتالوج */
  tutorialMode?: boolean;
  quality: QualityPreset;
  localCustomization: CharacterCustomization;
  snapshotRef: React.MutableRefObject<RoomStateSnapshot | null>;
  localInputRef: React.MutableRefObject<PlayerInputState>;
  secondaryInputRef?: React.MutableRefObject<PlayerInputState> | null;
  focusPlayerId: string;
  cameraSensitivity: number;
  onProjectedLabels?: (labels: ProjectedLabel[]) => void;
  onLocalStepTick?: (dt: number) => void;
}

const _projVec = new THREE.Vector3();
const _camTargetPos = new THREE.Vector3();
const _camDesiredPos = new THREE.Vector3();

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  mode,
  worldId,
  stage = 1,
  tutorialMode = false,
  quality,
  localCustomization,
  snapshotRef,
  localInputRef,
  focusPlayerId,
  cameraSensitivity,
  onProjectedLabels,
  onLocalStepTick,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const propsRef = useRef({
    mode,
    worldId,
    stage,
    tutorialMode,
    quality,
    localCustomization,
    focusPlayerId,
    cameraSensitivity,
    onProjectedLabels,
    onLocalStepTick,
  });
  propsRef.current = {
    mode,
    worldId,
    stage,
    tutorialMode,
    quality,
    localCustomization,
    focusPlayerId,
    cameraSensitivity,
    onProjectedLabels,
    onLocalStepTick,
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl && propsRef.current.quality !== 'low',
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = !isSoftwareGl && propsRef.current.quality !== 'low';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(
      isSoftwareGl
        ? 1
        : propsRef.current.quality === 'low'
        ? 0.9
        : Math.min(window.devicePixelRatio, propsRef.current.quality === 'high' ? 2 : 1.5),
    );
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    const scene = new THREE.Scene();
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    scene.environment = pmremGenerator.fromScene(roomEnv, 0.04).texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      54,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.2,
      420,
    );

    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0xb45309, 0.72);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.55);
    keyLight.position.set(16, 28, 18);
    keyLight.castShadow = !isSoftwareGl && propsRef.current.quality !== 'low';
    keyLight.shadow.mapSize.set(
      propsRef.current.quality === 'high' ? 1024 : 512,
      propsRef.current.quality === 'high' ? 1024 : 512,
    );
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 95;
    keyLight.shadow.camera.left = -26;
    keyLight.shadow.camera.right = 26;
    keyLight.shadow.camera.top = 26;
    keyLight.shadow.camera.bottom = -26;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);
    scene.add(keyLight.target);

    const rimLight = new THREE.DirectionalLight(0xfde68a, 0.5);
    rimLight.position.set(-14, 12, -20);
    scene.add(rimLight);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const mats = createWorldMaterialLibrary(maxAniso, isSoftwareGl);

    let activeWorldKey = '';
    let activeQuality: QualityPreset = propsRef.current.quality;
    let builtWorld: BuiltWorldScene | null = null;
    let currentWorldDef = propsRef.current.tutorialMode
      ? TUTORIAL_STAGE
      : getStageDef(propsRef.current.worldId, propsRef.current.stage);

    const rebuildWorld = (wId: WorldId, st: StageNumber, q: QualityPreset) => {
      if (builtWorld) {
        scene.remove(builtWorld.group);
        builtWorld.dispose();
        builtWorld = null;
      }
      const wDef = propsRef.current.tutorialMode
        ? TUTORIAL_STAGE
        : getStageDef(wId, st);
      currentWorldDef = wDef;
      scene.fog = new THREE.FogExp2(wDef.fogHex, wDef.fogDensity);
      scene.background = new THREE.Color(wDef.skyHorizonHex);
      hemiLight.color.set(wDef.ambientSkyHex);
      hemiLight.groundColor.set(wDef.ambientGroundHex);
      keyLight.color.set(wDef.sunHex);
      builtWorld = buildWorldScene(wDef, mats, q);
      scene.add(builtWorld.group);
      activeWorldKey = propsRef.current.tutorialMode ? 'tutorial' : `${wId}_${st}`;
      activeQuality = q;
    };

    rebuildWorld(propsRef.current.worldId, propsRef.current.stage, propsRef.current.quality);

    const playerRigs = new Map<
      string,
      {
        rig: CharacterRig;
        customHash: string;
        prevGrounded: boolean;
        prevKnocked: boolean;
        stepAccum: number;
      }
    >();

    const showcaseGroup = new THREE.Group();
    scene.add(showcaseGroup);

    const pedGeo = new THREE.CylinderGeometry(1.4, 1.6, 0.35, 24);
    const pedMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.7,
    });
    const pedRingGeo = new THREE.TorusGeometry(1.45, 0.06, 8, 32);
    pedRingGeo.rotateX(Math.PI / 2);
    const pedRingMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 1.2,
    });
    const pedestal = new THREE.Mesh(pedGeo, pedMat);
    pedestal.position.set(0, 1.5, -2.5);
    const pedRing = new THREE.Mesh(pedRingGeo, pedRingMat);
    pedRing.position.set(0, 1.68, -2.5);
    showcaseGroup.add(pedestal, pedRing);

    const customRig = createStylizedCharacter(propsRef.current.localCustomization, mats.contactShadow);
    customRig.root.position.set(0, 1.68, -2.5);
    showcaseGroup.add(customRig.root);
    let lastLocalCustomJson = JSON.stringify(propsRef.current.localCustomization);

    const titleGroup = new THREE.Group();
    scene.add(titleGroup);
    const titleTrio: CharacterRig[] = [
      createStylizedCharacter(
        { name: 'HUSSIN', colorHex: '#ef4444', outfit: 'hoodie', hat: 'goggles', accessory: 'bedroll', face: 'determined' },
        mats.contactShadow,
      ),
      createStylizedCharacter(
        { name: 'Yazan', colorHex: '#eab308', outfit: 'forge', hat: 'cap', accessory: 'bedroll', face: 'cheerful' },
        mats.contactShadow,
      ),
      createStylizedCharacter(
        { name: 'Lolo', colorHex: '#a855f7', outfit: 'temple', hat: 'goggles', accessory: 'cape', face: 'cheerful' },
        mats.contactShadow,
      ),
    ];
    titleTrio[0].root.position.set(1.8, 1.5, -1.5);
    titleTrio[0].root.rotation.y = Math.PI * 0.9;
    titleTrio[1].root.position.set(0.1, 1.5, -2.8);
    titleTrio[1].root.rotation.y = Math.PI * 0.95;
    titleTrio[2].root.position.set(-1.6, 1.5, -2.2);
    titleTrio[2].root.rotation.y = Math.PI * 1.05;
    titleTrio.forEach((r) => titleGroup.add(r.root));

    let camYaw = 0;
    let camPitch = 0.36;
    let previewSpinYaw = 0.25;
    let dragging = false;
    let lastPtrX = 0;
    let lastPtrY = 0;
    let cameraShake = 0;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.button !== 2) return;
      dragging = true;
      lastPtrX = e.clientX;
      lastPtrY = e.clientY;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastPtrX;
      const dy = e.clientY - lastPtrY;
      lastPtrX = e.clientX;
      lastPtrY = e.clientY;
      const sens = 0.005 * propsRef.current.cameraSensitivity;
      if (propsRef.current.mode === 'character') {
        previewSpinYaw += dx * 0.01;
      } else if (propsRef.current.mode === 'playing') {
        camYaw -= dx * sens;
        camPitch = THREE.MathUtils.clamp(camPitch + dy * sens * 0.7, 0.14, 0.85);
      }
    };
    const onPointerUp = () => {
      dragging = false;
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const clock = new THREE.Clock();
    let elapsed = 0;
    let frameId = 0;
    let disposed = false;

    const camLookCurrent = new THREE.Vector3(0, 2, -6);
    const camPosCurrent = new THREE.Vector3(0, 6, 8);
    let lastLabelEmit = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const poll = () => {
        if (disposed) return;
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (disposed) return;
      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      elapsed += dt;

      const {
        mode: curMode,
        worldId: curWorldId,
        stage: curStage,
        tutorialMode: curTutorial,
        quality: curQuality,
        localCustomization: curCustom,
        focusPlayerId: curFocusId,
        onLocalStepTick: stepCb,
        onProjectedLabels: labelCb,
      } = propsRef.current;

      const nextKey = curTutorial ? 'tutorial' : `${curWorldId}_${curStage}`;
      if (nextKey !== activeWorldKey || curQuality !== activeQuality) {
        rebuildWorld(curWorldId, curStage, curQuality);
        renderer.setPixelRatio(
          isSoftwareGl ? 1 : curQuality === 'low' ? 0.9 : Math.min(window.devicePixelRatio, curQuality === 'high' ? 2 : 1.5),
        );
        renderer.shadowMap.enabled = !isSoftwareGl && curQuality !== 'low';
        keyLight.castShadow = !isSoftwareGl && curQuality !== 'low';
      }

      localInputRef.current.camYaw = camYaw;
      if (stepCb && curMode === 'playing') {
        stepCb(dt);
      }

      const snap = snapshotRef.current;

      titleGroup.visible = curMode === 'title';
      showcaseGroup.visible = curMode === 'character';

      let targetFov = 54;

      if (curMode === 'title') {
        titleTrio.forEach((rig) => {
          rig.updateAnimation(dt, 'idle', 0, false, true);
        });
        if (builtWorld) {
          const makeCatenary = (a: THREE.Vector3, b: THREE.Vector3, sag: number) => {
            const nodes: { x: number; y: number; z: number }[] = [];
            for (let k = 0; k <= 10; k++) {
              const t = k / 10;
              const sway = Math.sin(elapsed * 2.1 + k * 0.45) * 0.025 * Math.sin(t * Math.PI);
              nodes.push({
                x: THREE.MathUtils.lerp(a.x, b.x, t) + sway,
                y: THREE.MathUtils.lerp(a.y, b.y, t) + 0.72 - Math.sin(t * Math.PI) * sag,
                z: THREE.MathUtils.lerp(a.z, b.z, t),
              });
            }
            return { nodes, tension: 0.15, pulling: false };
          };
          builtWorld.updateCustomChains([
            makeCatenary(titleTrio[0].root.position, titleTrio[1].root.position, 0.34),
            makeCatenary(titleTrio[1].root.position, titleTrio[2].root.position, 0.32),
          ]);
        }
        _camTargetPos.set(0, 3.2, -16);
        _camDesiredPos.set(Math.sin(elapsed * 0.22) * 3.5 + 3.2, 4.4 + Math.sin(elapsed * 0.35) * 0.4, 3.8);
      } else if (curMode === 'character') {
        if (builtWorld) {
          builtWorld.updateCustomChains([]);
        }
        const customJson = JSON.stringify(curCustom);
        if (customJson !== lastLocalCustomJson) {
          customRig.updateCustomization(curCustom);
          lastLocalCustomJson = customJson;
        }
        previewSpinYaw += dt * 0.35;
        customRig.root.rotation.y = previewSpinYaw;
        customRig.updateAnimation(dt, 'idle', 0, false, true);
        _camTargetPos.set(0.65, 2.55, -2.5);
        _camDesiredPos.set(0.65, 2.9, 1.35);
      } else if (snap) {
        if (builtWorld) {
          builtWorld.updateFromSnapshot(snap, dt, elapsed);
        }

        const activeIds = new Set<string>();
        let sumX = 0;
        let sumY = 0;
        let sumZ = 0;
        let maxSpread = 0;
        let focusPlayer = snap.players[0];

        for (const p of snap.players) {
          activeIds.add(p.id);
          if (p.id === curFocusId) focusPlayer = p;
          sumX += p.x;
          sumY += p.y;
          sumZ += p.z;

          let entry = playerRigs.get(p.id);
          const cHash = JSON.stringify(p.customization);
          if (!entry) {
            const rig = createStylizedCharacter(p.customization, mats.contactShadow);
            scene.add(rig.root);
            entry = { rig, customHash: cHash, prevGrounded: p.grounded, prevKnocked: p.knockedDown, stepAccum: 0 };
            playerRigs.set(p.id, entry);
          } else if (entry.customHash !== cHash) {
            entry.rig.updateCustomization(p.customization);
            entry.customHash = cHash;
          }

          const lerpAlpha = Math.min(1, 22 * dt);
          entry.rig.root.position.x = THREE.MathUtils.lerp(entry.rig.root.position.x, p.x, lerpAlpha);
          entry.rig.root.position.y = THREE.MathUtils.lerp(entry.rig.root.position.y, p.y, lerpAlpha);
          entry.rig.root.position.z = THREE.MathUtils.lerp(entry.rig.root.position.z, p.z, lerpAlpha);

          let dyaw = p.yaw - entry.rig.root.rotation.y;
          while (dyaw > Math.PI) dyaw -= Math.PI * 2;
          while (dyaw < -Math.PI) dyaw += Math.PI * 2;
          entry.rig.root.rotation.y += dyaw * Math.min(1, 16 * dt);

          const speed = Math.hypot(p.vx, p.vz);
          entry.rig.updateAnimation(dt, p.anim, speed, p.hanging, p.grounded, {
            pullLeanX: p.pullLeanX,
            pullLeanZ: p.pullLeanZ,
            yaw: p.yaw,
            ragdollPitch: p.ragdollPitch,
            ragdollRoll: p.ragdollRoll,
          });

          if (!entry.prevGrounded && p.grounded && builtWorld) {
            const dustColor =
              curWorldId === 'frozen_peak'
                ? 0xe0f2fe
                : curWorldId === 'lava_factory'
                ? 0xfb923c
                : curWorldId === 'ancient_jungle'
                ? 0xbef264
                : 0xe2e8f0;
            builtWorld.spawnBurst(p.x, p.y + 0.1, p.z, dustColor, 7);
            gameAudio.playLand(Math.min(1.4, Math.abs(p.vy) / 10 + 0.5));
            cameraShake = Math.max(cameraShake, 0.12);
          }
          entry.prevGrounded = p.grounded;

          if (!entry.prevKnocked && p.knockedDown && builtWorld) {
            builtWorld.spawnBurst(p.x, p.y + 0.6, p.z, 0xef4444, 10);
            cameraShake = Math.max(cameraShake, 0.24);
          }
          entry.prevKnocked = p.knockedDown;

          if (p.grounded && speed > 1.2) {
            entry.stepAccum += speed * dt;
            if (entry.stepAccum > 2.2) {
              entry.stepAccum = 0;
              builtWorld?.spawnFootprint(p.x, p.y, p.z, p.yaw);
              gameAudio.playFootstep(
                curWorldId === 'frozen_peak'
                  ? 'ice'
                  : curWorldId === 'lava_factory'
                  ? 'metal'
                  : 'stone',
              );
            }
          }
        }

        for (const [id, entry] of playerRigs.entries()) {
          if (!activeIds.has(id)) {
            scene.remove(entry.rig.root);
            entry.rig.dispose();
            playerRigs.delete(id);
          }
        }

        for (const ch of snap.chains) {
          if (ch.tension > 0.72) {
            gameAudio.playChainClink(ch.tension);
            break;
          }
        }

        const count = Math.max(1, snap.players.length);
        const avgX = sumX / count;
        const avgY = sumY / count;
        const avgZ = sumZ / count;

        for (const p of snap.players) {
          maxSpread = Math.max(maxSpread, Math.hypot(p.x - avgX, p.z - avgZ));
        }

        if (curMode === 'lobby') {
          _camTargetPos.set(avgX, avgY + 1.2, avgZ);
          _camDesiredPos.set(avgX, avgY + 2.8, avgZ + 6.4);
        } else if (curMode === 'victory') {
          const ang = elapsed * 0.55;
          _camTargetPos.set(avgX, avgY + 1.2, avgZ);
          _camDesiredPos.set(avgX + Math.sin(ang) * 7.5, avgY + 3.6, avgZ + Math.cos(ang) * 7.5);
        } else if (focusPlayer) {
          const tx = THREE.MathUtils.lerp(focusPlayer.x, avgX, 0.34);
          const ty = THREE.MathUtils.lerp(focusPlayer.y, avgY, 0.34) + 1.45;
          const tz = THREE.MathUtils.lerp(focusPlayer.z, avgZ, 0.34);
          _camTargetPos.set(tx, ty, tz);

          const focusSpeed = Math.hypot(focusPlayer.vx, focusPlayer.vz);
          if (focusSpeed > 6.6) {
            targetFov = 61;
          }

          let narrowZoom = 0;
          for (const plat of snap.platforms) {
            if (!plat.active) continue;
            const def = currentWorldDef.platforms.find((d) => d.id === plat.id);
            if (
              def &&
              def.w <= 5.6 &&
              Math.abs(focusPlayer.x - plat.x) <= def.w * 0.6 &&
              Math.abs(focusPlayer.z - plat.z) <= def.d * 0.55
            ) {
              narrowZoom = 1.35;
              break;
            }
          }

          const camDist = 8.8 - narrowZoom + Math.min(7.2, maxSpread * 0.75);
          const horiz = Math.cos(camPitch) * camDist;
          const vert = Math.sin(camPitch) * camDist;
          _camDesiredPos.set(
            tx + Math.sin(camYaw) * horiz,
            ty + vert,
            tz + Math.cos(camYaw) * horiz,
          );

          // Obstruction avoidance: keep camera clear of tall gates/walls/pillars
          for (const plat of snap.platforms) {
            if (!plat.active) continue;
            const def = currentWorldDef.platforms.find((d) => d.id === plat.id);
            if (!def) continue;
            if (
              Math.abs(_camDesiredPos.x - plat.x) < def.w / 2 + 0.65 &&
              Math.abs(_camDesiredPos.z - plat.z) < def.d / 2 + 0.65 &&
              _camDesiredPos.y < plat.y + def.h / 2 + 0.85 &&
              _camDesiredPos.y > plat.y - def.h / 2 - 0.5
            ) {
              _camDesiredPos.y = plat.y + def.h / 2 + 1.05;
            }
          }
        }

        keyLight.position.set(avgX + 16, avgY + 28, avgZ + 18);
        keyLight.target.position.set(avgX, avgY, avgZ);
      }

      if (Math.abs(camera.fov - targetFov) > 0.05) {
        camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 6, dt);
        camera.updateProjectionMatrix();
      }

      camLookCurrent.x = THREE.MathUtils.damp(camLookCurrent.x, _camTargetPos.x, 8, dt);
      camLookCurrent.y = THREE.MathUtils.damp(camLookCurrent.y, _camTargetPos.y, 8, dt);
      camLookCurrent.z = THREE.MathUtils.damp(camLookCurrent.z, _camTargetPos.z, 8, dt);

      camPosCurrent.x = THREE.MathUtils.damp(camPosCurrent.x, _camDesiredPos.x, 7, dt);
      camPosCurrent.y = THREE.MathUtils.damp(camPosCurrent.y, _camDesiredPos.y, 7, dt);
      camPosCurrent.z = THREE.MathUtils.damp(camPosCurrent.z, _camDesiredPos.z, 7, dt);

      cameraShake = Math.max(0, cameraShake - dt * 0.6);
      const sx = cameraShake > 0 ? (Math.random() - 0.5) * cameraShake : 0;
      const sy = cameraShake > 0 ? (Math.random() - 0.5) * cameraShake : 0;

      camera.position.set(camPosCurrent.x + sx, camPosCurrent.y + sy, camPosCurrent.z);
      camera.lookAt(camLookCurrent);

      for (const entry of playerRigs.values()) {
        entry.rig.root.visible = curMode === 'playing' || curMode === 'lobby' || curMode === 'victory';
      }

      renderer.render(scene, camera);

      if (labelCb && snap && (curMode === 'playing' || curMode === 'lobby') && elapsed - lastLabelEmit > 0.05) {
        lastLabelEmit = elapsed;
        const w = container.clientWidth;
        const h = container.clientHeight;
        const labels: ProjectedLabel[] = snap.players.map((p) => {
          _projVec.set(p.x, p.y + (p.knockedDown ? 1.45 : 2.15), p.z);
          _projVec.project(camera);
          const visible = _projVec.z < 1 && _projVec.x >= -1.1 && _projVec.x <= 1.1;
          return {
            id: p.id,
            name: p.customization.name,
            isHost: p.isHost,
            voiceMuted: p.voiceMuted,
            voiceSpeaking: p.voiceSpeaking,
            hanging: p.hanging,
            knockedDown: p.knockedDown,
            x: ((_projVec.x + 1) / 2) * w,
            y: ((-_projVec.y + 1) / 2) * h,
            visible,
          };
        });
        labelCb(labels);
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      domEl.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', onResize);
      domEl.removeEventListener('webglcontextlost', handleContextLost);

      for (const entry of playerRigs.values()) {
        entry.rig.dispose();
      }
      customRig.dispose();
      titleTrio.forEach((r) => r.dispose());
      pedGeo.dispose();
      pedMat.dispose();
      pedRingGeo.dispose();
      pedRingMat.dispose();
      if (builtWorld) builtWorld.dispose();
      mats.dispose();
      if (scene.environment) scene.environment.dispose();
      renderer.dispose();
      if (domEl.parentNode === container) {
        container.removeChild(domEl);
      }
    };
  }, [snapshotRef, localInputRef]);

  return <div ref={mountRef} className="fixed inset-0 w-full h-full overflow-hidden" />;
};
