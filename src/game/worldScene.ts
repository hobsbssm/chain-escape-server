import * as THREE from 'three';
import type { QualityPreset, RoomStateSnapshot, WorldDef } from '../shared/types.ts';
import type { WorldMaterialLibrary } from './textures.ts';

const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();
const _rollQuat = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);
const _mat4 = new THREE.Matrix4();

export interface BuiltWorldScene {
  group: THREE.Group;
  updateFromSnapshot: (snap: RoomStateSnapshot, dt: number, elapsed: number) => void;
  updateCustomChains: (
    chains: { nodes: { x: number; y: number; z: number }[]; tension?: number; pulling?: boolean }[],
  ) => void;
  spawnBurst: (x: number, y: number, z: number, colorHex: number, count?: number) => void;
  spawnFootprint: (x: number, y: number, z: number, yaw: number) => void;
  dispose: () => void;
}

function createSkyBackdropMesh(world: WorldDef): THREE.Mesh {
  const geo = new THREE.SphereGeometry(260, 24, 16);
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, world.skyTopHex);
  grad.addColorStop(0.55, world.skyHorizonHex);
  grad.addColorStop(1, world.fogHex);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false });
  return new THREE.Mesh(geo, mat);
}

export function buildWorldScene(
  world: WorldDef,
  mats: WorldMaterialLibrary,
  quality: QualityPreset,
): BuiltWorldScene {
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];

  const skyDome = createSkyBackdropMesh(world);
  group.add(skyDome);
  disposables.push(skyDome.geometry, skyDome.material as THREE.Material);

  const decoCount = quality === 'low' ? 14 : quality === 'medium' ? 28 : 42;
  const dummy = new THREE.Object3D();

  if (world.id === 'sky_islands' || world.id === 'lost_temple') {
    const cloudGeo = new THREE.SphereGeometry(4.5, 10, 8);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      metalness: 0,
      transparent: true,
      opacity: 0.82,
    });
    const clouds = new THREE.InstancedMesh(cloudGeo, cloudMat, decoCount);
    for (let i = 0; i < decoCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      dummy.position.set(
        side * (16 + Math.random() * 55),
        -10 + Math.random() * 14,
        15 - Math.random() * 180,
      );
      dummy.scale.set(1.4 + Math.random() * 1.8, 0.55 + Math.random() * 0.4, 1.2 + Math.random() * 1.5);
      dummy.updateMatrix();
      clouds.setMatrixAt(i, dummy.matrix);
    }
    clouds.instanceMatrix.needsUpdate = true;
    clouds.computeBoundingSphere();
    group.add(clouds);
    disposables.push(cloudGeo, cloudMat);

    const islGeo = new THREE.ConeGeometry(5, 7, 7);
    islGeo.rotateX(Math.PI);
    const islMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 });
    const islCount = quality === 'low' ? 8 : 14;
    const islands = new THREE.InstancedMesh(islGeo, islMat, islCount);
    for (let i = 0; i < islCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      dummy.position.set(side * (24 + Math.random() * 45), 4 + Math.random() * 18, -10 - i * 11);
      const s = 0.8 + Math.random() * 1.6;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      islands.setMatrixAt(i, dummy.matrix);
    }
    islands.instanceMatrix.needsUpdate = true;
    islands.computeBoundingSphere();
    group.add(islands);
    disposables.push(islGeo, islMat);
  } else if (world.id === 'ancient_jungle') {
    const trunkGeo = new THREE.CylinderGeometry(1.1, 1.6, 22, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4b331d, roughness: 0.92 });
    const canopyGeo = new THREE.DodecahedronGeometry(4.8, 0);
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85 });
    const treeCount = quality === 'low' ? 12 : 22;
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, treeCount);
    for (let i = 0; i < treeCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const tx = side * (16 + Math.random() * 34);
      const ty = -6 + Math.random() * 8;
      const tz = 6 - i * 8.5;
      dummy.position.set(tx, ty, tz);
      dummy.scale.set(1, 0.9 + Math.random() * 0.5, 1);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);

      dummy.position.set(tx, ty + 11.5, tz);
      dummy.scale.set(1.2 + Math.random() * 0.6, 0.8 + Math.random() * 0.4, 1.2 + Math.random() * 0.6);
      dummy.updateMatrix();
      canopies.setMatrixAt(i, dummy.matrix);
    }
    trunks.instanceMatrix.needsUpdate = true;
    canopies.instanceMatrix.needsUpdate = true;
    group.add(trunks, canopies);
    disposables.push(trunkGeo, trunkMat, canopyGeo, canopyMat);
  } else if (world.id === 'lava_factory') {
    const lavaGeo = new THREE.PlaneGeometry(240, 320);
    lavaGeo.rotateX(-Math.PI / 2);
    const lavaMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: new THREE.Color('#ea580c'),
      emissiveIntensity: 1.15,
      roughness: 0.35,
    });
    const lavaSea = new THREE.Mesh(lavaGeo, lavaMat);
    lavaSea.position.set(0, -13, -75);
    group.add(lavaSea);
    disposables.push(lavaGeo, lavaMat);
  } else if (world.id === 'frozen_peak') {
    const peakGeo = new THREE.ConeGeometry(8, 26, 6);
    const peakMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.55 });
    const peakCount = quality === 'low' ? 10 : 18;
    const peaks = new THREE.InstancedMesh(peakGeo, peakMat, peakCount);
    for (let i = 0; i < peakCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      dummy.position.set(side * (22 + Math.random() * 45), -4, 10 - i * 9.5);
      dummy.scale.set(1 + Math.random(), 0.8 + Math.random() * 1.4, 1 + Math.random());
      dummy.updateMatrix();
      peaks.setMatrixAt(i, dummy.matrix);
    }
    peaks.instanceMatrix.needsUpdate = true;
    peaks.computeBoundingSphere();
    group.add(peaks);
    disposables.push(peakGeo, peakMat);
  } else if (world.id === 'the_abyss') {
    const crystalGeo = new THREE.OctahedronGeometry(2.6, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: new THREE.Color('#6b21a8'),
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.5,
    });
    const crystalCount = quality === 'low' ? 12 : 24;
    const crystals = new THREE.InstancedMesh(crystalGeo, crystalMat, crystalCount);
    for (let i = 0; i < crystalCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      dummy.position.set(side * (16 + Math.random() * 38), -4 + Math.random() * 20, -i * 7.2);
      dummy.rotation.set(Math.random(), Math.random(), Math.random());
      dummy.scale.setScalar(0.6 + Math.random() * 1.3);
      dummy.updateMatrix();
      crystals.setMatrixAt(i, dummy.matrix);
    }
    crystals.instanceMatrix.needsUpdate = true;
    crystals.computeBoundingSphere();
    group.add(crystals);
    disposables.push(crystalGeo, crystalMat);
  }

  // Platforms
  const platformGroups = new Map<string, THREE.Group>();
  const waterfallMeshes: THREE.Mesh[] = [];
  const grassMat = new THREE.MeshStandardMaterial({
    color: world.id === 'lost_temple' ? 0x4d7c0f : world.id === 'ancient_jungle' ? 0x16a34a : 0x65a30d,
    roughness: 0.88,
  });
  const snowCapMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.65 });
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.9 });
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: new THREE.Color('#0284c7'),
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.72,
    roughness: 0.15,
  });
  disposables.push(grassMat, snowCapMat, ropeMat, waterMat);

  for (const p of world.platforms) {
    const pGroup = new THREE.Group();
    pGroup.position.set(p.x, p.y, p.z);

    let mainMat: THREE.Material = mats.stone;
    if (p.kind === 'wood' || p.kind === 'bridge' || p.kind === 'hanging_bridge') mainMat = mats.wood;
    else if (p.kind === 'jungle') mainMat = mats.jungle;
    else if (p.kind === 'cracked') mainMat = mats.cracked;
    else if (p.kind === 'ice') mainMat = mats.ice;
    else if (p.kind === 'metal' || p.kind === 'gear' || p.kind === 'elevator' || p.kind === 'timed_gate') mainMat = mats.metal;
    else if (p.kind === 'temple' || p.kind === 'falling_pillar' || p.kind === 'weight_platform') mainMat = mats.temple;
    else if (p.kind === 'void') mainMat = mats.voidCrystal;
    else if (p.kind === 'bounce') mainMat = mats.bouncePad;
    else if (p.kind === 'crumbling') mainMat = mats.crumble;
    else if (p.kind === 'phasing' || p.kind === 'vanishing') mainMat = mats.phasing;

    if (p.kind === 'gear') {
      const cylGeo = new THREE.CylinderGeometry(p.w * 0.48, p.w * 0.48, p.h, 16);
      const mesh = new THREE.Mesh(cylGeo, mainMat);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      pGroup.add(mesh);
      const toothGeo = new THREE.BoxGeometry(1.1, p.h * 0.9, 1.1);
      for (let t = 0; t < 8; t++) {
        const ang = (t / 8) * Math.PI * 2;
        const tooth = new THREE.Mesh(toothGeo, mats.metal);
        tooth.position.set(Math.cos(ang) * (p.w * 0.48), 0, Math.sin(ang) * (p.w * 0.48));
        tooth.rotation.y = ang;
        pGroup.add(tooth);
      }
      disposables.push(cylGeo, toothGeo);
    } else {
      const boxGeo = new THREE.BoxGeometry(p.w, p.h, p.d);
      const mesh = new THREE.Mesh(boxGeo, mainMat);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      pGroup.add(mesh);
      disposables.push(boxGeo);

      if ((p.kind === 'stone' || p.kind === 'temple' || p.kind === 'jungle') && p.h >= 2.2) {
        const capGeo = new THREE.BoxGeometry(p.w + 0.16, 0.24, p.d + 0.16);
        const cap = new THREE.Mesh(
          capGeo,
          world.id === 'frozen_peak' ? snowCapMat : grassMat,
        );
        cap.position.y = p.h / 2 - 0.08;
        cap.receiveShadow = true;
        pGroup.add(cap);

        const bellyGeo = new THREE.ConeGeometry(Math.min(p.w, p.d) * 0.48, p.h * 1.25, 6);
        bellyGeo.rotateX(Math.PI);
        const belly = new THREE.Mesh(bellyGeo, mainMat);
        belly.position.y = -p.h * 0.85;
        pGroup.add(belly);
        disposables.push(capGeo, bellyGeo);
      }

      if (p.kind === 'bridge' || p.kind === 'hanging_bridge') {
        const railGeo = new THREE.CylinderGeometry(0.07, 0.07, p.d, 6);
        railGeo.rotateX(Math.PI / 2);
        const rL = new THREE.Mesh(railGeo, ropeMat);
        rL.position.set(-p.w / 2 + 0.15, p.h / 2 + 0.65, 0);
        const rR = rL.clone();
        rR.position.x = p.w / 2 - 0.15;
        pGroup.add(rL, rR);
        disposables.push(railGeo);
      }

      if (p.kind === 'weight_platform') {
        const fulcGeo = new THREE.CylinderGeometry(0.45, 0.65, 0.9, 10);
        const fulc = new THREE.Mesh(fulcGeo, mats.gold);
        fulc.position.y = -p.h / 2 - 0.45;
        pGroup.add(fulc);
        disposables.push(fulcGeo);
      }

      if (p.kind === 'elevator') {
        const frameGeo = new THREE.BoxGeometry(p.w + 0.22, 0.25, p.d + 0.22);
        const frame = new THREE.Mesh(frameGeo, mats.gold);
        frame.position.y = p.h / 2 - 0.05;
        pGroup.add(frame);
        disposables.push(frameGeo);
      }

      if (p.kind === 'timed_gate') {
        const stripeGeo = new THREE.BoxGeometry(p.w + 0.1, 0.35, p.d + 0.1);
        const stripe = new THREE.Mesh(stripeGeo, mats.laser);
        stripe.position.y = 0;
        pGroup.add(stripe);
        disposables.push(stripeGeo);
      }

      if (p.kind === 'bounce') {
        const ringGeo = new THREE.TorusGeometry(p.w * 0.36, 0.14, 8, 20);
        ringGeo.rotateX(Math.PI / 2);
        const ringMat = new THREE.MeshStandardMaterial({
          color: 0xfef08a,
          emissive: 0x10b981,
          emissiveIntensity: 0.9,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.y = p.h / 2 + 0.1;
        pGroup.add(ring);
        disposables.push(ringGeo, ringMat);
      }

      if (p.waterfall && quality !== 'low') {
        const wfGeo = new THREE.BoxGeometry(2.2, 16, 0.35);
        const wf = new THREE.Mesh(wfGeo, waterMat);
        wf.position.set(p.w / 2 - 0.2, -7.8, 0);
        pGroup.add(wf);
        waterfallMeshes.push(wf);
        disposables.push(wfGeo);
      }
    }

    if (p.bannerColor) {
      const poleGeo = new THREE.CylinderGeometry(0.07, 0.07, 3.2, 8);
      const flagGeo = new THREE.BoxGeometry(0.9, 1.3, 0.06);
      const flagMat = new THREE.MeshStandardMaterial({ color: p.bannerColor, roughness: 0.7 });
      const pole = new THREE.Mesh(poleGeo, mats.wood);
      pole.position.set(-p.w / 2 + 0.5, p.h / 2 + 1.6, 0);
      const flag = new THREE.Mesh(flagGeo, flagMat);
      flag.position.set(-p.w / 2 + 1.0, p.h / 2 + 2.3, 0);
      pGroup.add(pole, flag);
      disposables.push(poleGeo, flagGeo, flagMat);
    }

    group.add(pGroup);
    platformGroups.set(p.id, pGroup);
  }

  // Golden Finish Escape Portal
  const portalGroup = new THREE.Group();
  portalGroup.position.set(world.finish.x, world.finish.y - 0.5, world.finish.z);
  const archGeo = new THREE.TorusGeometry(2.6, 0.38, 12, 28, Math.PI);
  const archMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.28, metalness: 0.8 });
  const arch = new THREE.Mesh(archGeo, archMat);
  arch.position.y = 1.8;
  const swirlGeo = new THREE.CircleGeometry(2.3, 24);
  const swirlMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
  });
  const swirl = new THREE.Mesh(swirlGeo, swirlMat);
  swirl.position.y = 2.1;
  const pillarGeo = new THREE.BoxGeometry(0.85, 2.2, 0.85);
  const pL = new THREE.Mesh(pillarGeo, mats.stone);
  pL.position.set(-2.6, 1.1, 0);
  const pR = pL.clone();
  pR.position.x = 2.6;
  portalGroup.add(arch, swirl, pL, pR);
  group.add(portalGroup);
  disposables.push(archGeo, archMat, swirlGeo, swirlMat, pillarGeo);

  // Checkpoints
  const cpMeshes = new Map<number, THREE.Mesh>();
  const cpBaseGeo = new THREE.CylinderGeometry(1.1, 1.3, 0.2, 16);
  const cpFlagGeo = new THREE.OctahedronGeometry(0.45, 0);
  disposables.push(cpBaseGeo, cpFlagGeo);

  for (const cp of world.checkpoints) {
    if (cp.index === 0) continue;
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.25,
      roughness: 0.2,
    });
    const base = new THREE.Mesh(cpBaseGeo, baseMat);
    base.position.set(cp.x, cp.y - 0.15, cp.z);
    const crystal = new THREE.Mesh(cpFlagGeo, crystalMat);
    crystal.position.set(cp.x, cp.y + 1.1, cp.z);
    group.add(base, crystal);
    cpMeshes.set(cp.index, crystal);
    disposables.push(baseMat, crystalMat);
  }

  // Stars
  const starMeshes = new Map<string, THREE.Mesh>();
  const starGeo = new THREE.OctahedronGeometry(0.55, 0);
  const starMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: new THREE.Color('#eab308'),
    emissiveIntensity: 0.9,
    roughness: 0.18,
    metalness: 0.85,
  });
  disposables.push(starGeo, starMat);
  for (const st of world.stars) {
    const m = new THREE.Mesh(starGeo, starMat);
    m.position.set(st.x, st.y, st.z);
    group.add(m);
    starMeshes.set(st.id, m);
  }

  // Puzzles (Crates, Pressure Plates, Trap Plates, Chain Anchors, Winches, Chain Pull Winches, Keys, Mirrors, Ropes)
  const crateMeshes = new Map<string, THREE.Mesh>();
  const plateMeshes = new Map<string, THREE.Mesh>();
  const anchorRings = new Map<string, THREE.Mesh>();
  const keyMeshes = new Map<string, THREE.Group>();
  const mirrorGroups = new Map<string, { frame: THREE.Group; beam: THREE.Mesh }>();
  const ropePivots = new Map<string, THREE.Group>();

  const crateGeo = new THREE.BoxGeometry(1.75, 1.75, 1.75);
  const plateGeo = new THREE.CylinderGeometry(1.15, 1.25, 0.22, 16);
  const postGeo = new THREE.CylinderGeometry(0.24, 0.3, 1.35, 12);
  const ringGeo = new THREE.TorusGeometry(0.4, 0.09, 8, 16);
  disposables.push(crateGeo, plateGeo, postGeo, ringGeo);

  for (const pz of world.puzzles) {
    if (pz.kind === 'heavy_crate') {
      const m = new THREE.Mesh(crateGeo, mats.wood);
      m.castShadow = true;
      m.receiveShadow = true;
      m.position.set(pz.x, pz.y, pz.z);
      group.add(m);
      crateMeshes.set(pz.id, m);
    } else if (pz.kind === 'pressure_plate' || pz.kind === 'trap_plate') {
      const isTrap = pz.kind === 'trap_plate';
      const pMat = new THREE.MeshStandardMaterial({
        color: isTrap ? 0xdc2626 : 0xf97316,
        emissive: isTrap ? 0x7f1d1d : 0x9a3412,
        emissiveIntensity: 0.55,
        roughness: 0.4,
      });
      const m = new THREE.Mesh(plateGeo, pMat);
      m.position.set(pz.x, pz.y, pz.z);
      group.add(m);
      plateMeshes.set(pz.id, m);
      disposables.push(pMat);
    } else if (
      pz.kind === 'chain_anchor' ||
      pz.kind === 'winch_lever' ||
      pz.kind === 'chain_pull_winch'
    ) {
      const post = new THREE.Mesh(postGeo, mats.metal);
      post.position.set(pz.x, pz.y + 0.65, pz.z);
      post.castShadow = true;
      const colorHex =
        pz.kind === 'chain_pull_winch'
          ? 0xf43f5e
          : pz.kind === 'winch_lever'
          ? 0xf59e0b
          : 0x38bdf8;
      const rMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 0.7,
        roughness: 0.2,
        metalness: 0.8,
      });
      const ring = new THREE.Mesh(ringGeo, rMat);
      ring.position.set(pz.x, pz.y + 1.3, pz.z);
      group.add(post, ring);
      anchorRings.set(pz.id, ring);
      disposables.push(rMat);
    } else if (pz.kind === 'key_item') {
      const kGrp = new THREE.Group();
      kGrp.position.set(pz.x, pz.y, pz.z);
      const bowGeo = new THREE.TorusGeometry(0.32, 0.08, 8, 16);
      const shaftGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.72, 8);
      const bow = new THREE.Mesh(bowGeo, mats.gold);
      bow.position.y = 0.25;
      const shaft = new THREE.Mesh(shaftGeo, mats.gold);
      shaft.position.y = -0.25;
      kGrp.add(bow, shaft);
      group.add(kGrp);
      keyMeshes.set(pz.id, kGrp);
      disposables.push(bowGeo, shaftGeo);
    } else if (pz.kind === 'mirror_pedestal') {
      const base = new THREE.Mesh(postGeo, mats.temple);
      base.position.set(pz.x, pz.y + 0.65, pz.z);
      const frame = new THREE.Group();
      frame.position.set(pz.x, pz.y + 1.55, pz.z);
      const mirrorGeo = new THREE.BoxGeometry(1.1, 0.9, 0.14);
      const mirrorMesh = new THREE.Mesh(mirrorGeo, mats.ice);
      const beamLen = pz.beamLength ?? 8;
      const beamGeo = new THREE.CylinderGeometry(0.09, 0.09, beamLen, 8);
      beamGeo.rotateX(Math.PI / 2);
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.75,
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.z = -beamLen / 2;
      frame.add(mirrorMesh, beam);
      group.add(base, frame);
      mirrorGroups.set(pz.id, { frame, beam });
      disposables.push(mirrorGeo, beamGeo, beamMat);
    } else if (pz.kind === 'mirror_receptor') {
      const gemGeo = new THREE.OctahedronGeometry(0.55, 0);
      const gemMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xb45309,
        emissiveIntensity: 0.75,
      });
      const gem = new THREE.Mesh(gemGeo, gemMat);
      gem.position.set(pz.x, pz.y + 0.5, pz.z);
      group.add(gem);
      disposables.push(gemGeo, gemMat);
    } else if (pz.kind === 'swing_rope') {
      const len = pz.ropeLength ?? 5.0;
      const pivot = new THREE.Group();
      pivot.position.set(pz.x, pz.y, pz.z);
      const beamGeo = new THREE.BoxGeometry(2.4, 0.3, 0.3);
      const beam = new THREE.Mesh(beamGeo, mats.wood);
      const vineGeo = new THREE.CylinderGeometry(0.075, 0.075, len, 8);
      const vine = new THREE.Mesh(vineGeo, ropeMat);
      vine.position.y = -len / 2;
      const knotGeo = new THREE.SphereGeometry(0.22, 10, 8);
      const knot = new THREE.Mesh(knotGeo, mats.gold);
      knot.position.y = -len;
      pivot.add(vine, knot);
      const anchor = new THREE.Mesh(beamGeo, mats.wood);
      anchor.position.set(pz.x, pz.y, pz.z);
      group.add(anchor, pivot);
      ropePivots.set(pz.id, pivot);
      disposables.push(beamGeo, vineGeo, knotGeo);
    }
  }

  // Hazards
  const hazardMeshes = new Map<string, THREE.Group>();
  const boulderMeshes = new Map<string, THREE.Mesh>();
  const steamJets = new Map<string, THREE.Mesh>();

  for (const hz of world.hazards) {
    if (hz.kind === 'pendulum_log' || hz.kind === 'pendulum_hammer') {
      const hGrp = new THREE.Group();
      hGrp.position.set(hz.x, hz.y, hz.z);
      const rodGeo = new THREE.CylinderGeometry(0.08, 0.08, hz.length, 8);
      const rod = new THREE.Mesh(rodGeo, mats.chainMetal);
      rod.position.y = -hz.length / 2;
      const headGeo =
        hz.kind === 'pendulum_hammer'
          ? new THREE.CylinderGeometry(0.75, 0.75, 2.4, 12)
          : new THREE.CylinderGeometry(0.55, 0.55, 2.8, 12);
      headGeo.rotateX(Math.PI / 2);
      const head = new THREE.Mesh(
        headGeo,
        hz.kind === 'pendulum_hammer' || world.id === 'lost_temple' ? mats.metal : mats.wood,
      );
      head.position.y = -hz.length;
      head.castShadow = true;
      hGrp.add(rod, head);
      group.add(hGrp);
      hazardMeshes.set(hz.id, hGrp);
      disposables.push(rodGeo, headGeo);
    } else if (hz.kind === 'spinning_log') {
      const hGrp = new THREE.Group();
      hGrp.position.set(hz.x, hz.y, hz.z);
      const logGeo = new THREE.CylinderGeometry(0.38, 0.38, hz.length, 12);
      logGeo.rotateZ(Math.PI / 2);
      const log = new THREE.Mesh(logGeo, world.id === 'the_abyss' ? mats.voidCrystal : mats.wood);
      log.castShadow = true;
      hGrp.add(log);
      group.add(hGrp);
      hazardMeshes.set(hz.id, hGrp);
      disposables.push(logGeo);
    } else if (hz.kind === 'rolling_boulder') {
      const rad = hz.radius ?? 1.15;
      const bGeo = new THREE.DodecahedronGeometry(rad, 1);
      const bMesh = new THREE.Mesh(bGeo, world.id === 'frozen_peak' ? mats.ice : mats.stone);
      bMesh.castShadow = true;
      bMesh.position.set(hz.x, hz.y, hz.z);
      group.add(bMesh);
      boulderMeshes.set(hz.id, bMesh);
      disposables.push(bGeo);
    } else if (hz.kind === 'wind_fan') {
      const fGrp = new THREE.Group();
      fGrp.position.set(hz.x, hz.y, hz.z);
      const housingGeo = new THREE.TorusGeometry(1.6, 0.22, 8, 18);
      const bladeGeo = new THREE.BoxGeometry(0.32, 2.8, 0.08);
      const housing = new THREE.Mesh(housingGeo, mats.metal);
      housing.rotation.y = Math.PI / 2;
      const b1 = new THREE.Mesh(bladeGeo, mats.gold);
      const b2 = new THREE.Mesh(bladeGeo, mats.gold);
      b2.rotation.x = Math.PI / 2;
      const spinner = new THREE.Group();
      spinner.rotation.y = Math.PI / 2;
      spinner.add(b1, b2);
      fGrp.add(housing, spinner);
      group.add(fGrp);
      hazardMeshes.set(hz.id, spinner);
      disposables.push(housingGeo, bladeGeo);
    } else if (hz.kind === 'steam_pipe') {
      const pipeGeo = new THREE.CylinderGeometry(0.95, 1.15, 0.7, 14);
      const pipe = new THREE.Mesh(pipeGeo, mats.metal);
      pipe.position.set(hz.x, hz.y, hz.z);
      const jetGeo = new THREE.CylinderGeometry(0.85, 0.55, hz.h ?? 4.2, 12);
      const jetMat = new THREE.MeshBasicMaterial({
        color: 0xf8fafc,
        transparent: true,
        opacity: 0.45,
      });
      const jet = new THREE.Mesh(jetGeo, jetMat);
      jet.position.set(hz.x, hz.y + (hz.h ?? 4.2) * 0.5, hz.z);
      group.add(pipe, jet);
      steamJets.set(hz.id, jet);
      disposables.push(pipeGeo, jetGeo, jetMat);
    } else if (hz.kind === 'laser_beam') {
      const hGrp = new THREE.Group();
      hGrp.position.set(hz.x, hz.y, hz.z);
      const beamGeo = new THREE.CylinderGeometry(0.14, 0.14, hz.length, 10);
      beamGeo.rotateZ(Math.PI / 2);
      const beam = new THREE.Mesh(beamGeo, mats.laser);
      hGrp.add(beam);
      group.add(hGrp);
      hazardMeshes.set(hz.id, hGrp);
      disposables.push(beamGeo);
    } else if (hz.kind === 'gravity_zone') {
      const ringGeo = new THREE.TorusGeometry(4.5, 0.12, 8, 28);
      ringGeo.rotateX(Math.PI / 2);
      const isHeavy = (hz.gravityScale ?? 0.6) > 1;
      const gzMat = new THREE.MeshBasicMaterial({
        color: isHeavy ? 0xf97316 : 0x38bdf8,
        transparent: true,
        opacity: 0.48,
      });
      const ring = new THREE.Mesh(ringGeo, gzMat);
      ring.position.set(hz.x, hz.y - 1.5, hz.z);
      group.add(ring);
      disposables.push(ringGeo, gzMat);
    } else if (hz.kind === 'piston_crusher') {
      const hGrp = new THREE.Group();
      hGrp.position.set(hz.x, hz.y, hz.z);
      const headGeo = new THREE.BoxGeometry(2.8, 2.0, 2.8);
      const head = new THREE.Mesh(headGeo, mats.metal);
      head.castShadow = true;
      hGrp.add(head);
      group.add(hGrp);
      hazardMeshes.set(hz.id, hGrp);
      disposables.push(headGeo);
    }
  }

  // Slim, Realistic Interlocking Forged-Steel Chain Links
  const MAX_CHAIN_LINKS = quality === 'low' ? 180 : 420;
  const LINK_STEP = quality === 'low' ? 0.21 : 0.145;
  const linkGeo = new THREE.TorusGeometry(0.102, 0.027, 8, 14);
  const linkMat = mats.chainMetal.clone();
  linkMat.color.setHex(0xffffff);
  linkMat.metalness = 0.88;
  linkMat.roughness = 0.25;
  linkMat.emissive.setHex(0x1e293b);
  linkMat.emissiveIntensity = 0.14;
  const chainInstanced = new THREE.InstancedMesh(linkGeo, linkMat, MAX_CHAIN_LINKS);
  chainInstanced.frustumCulled = false;
  chainInstanced.castShadow = quality !== 'low';
  chainInstanced.count = 0;
  group.add(chainInstanced);
  disposables.push(linkGeo, linkMat);
  const _linkSteelColor = new THREE.Color(0xcbd5e1);
  const _linkWarnColor = new THREE.Color(0xfbbf24);
  const _linkPullColor = new THREE.Color(0xfb7185);
  const _linkTmpColor = new THREE.Color();

  // Pooled particles (dust, sparks)
  const MAX_PARTICLES = quality === 'low' ? 35 : quality === 'medium' ? 75 : 110;
  const partGeo = new THREE.SphereGeometry(0.12, 6, 6);
  const partMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const partMesh = new THREE.InstancedMesh(partGeo, partMat, MAX_PARTICLES);
  partMesh.frustumCulled = false;
  group.add(partMesh);
  disposables.push(partGeo, partMat);

  const particles = Array.from({ length: MAX_PARTICLES }, () => ({
    x: 0,
    y: -999,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    life: 0,
    maxLife: 1,
    color: new THREE.Color(0xffffff),
  }));
  let partCursor = 0;

  // Pooled Ground Footprint Decals (disabled on low quality LOD)
  const MAX_FOOTPRINTS = quality === 'low' ? 0 : 48;
  const footGeo = new THREE.PlaneGeometry(0.24, 0.34);
  footGeo.rotateX(-Math.PI / 2);
  const footMat = new THREE.MeshBasicMaterial({
    color: 0x0f172a,
    transparent: true,
    opacity: 0.26,
    depthWrite: false,
  });
  const footMesh =
    MAX_FOOTPRINTS > 0 ? new THREE.InstancedMesh(footGeo, footMat, MAX_FOOTPRINTS) : null;
  if (footMesh) {
    footMesh.frustumCulled = false;
    group.add(footMesh);
  }
  disposables.push(footGeo, footMat);

  const footprints = Array.from({ length: MAX_FOOTPRINTS }, () => ({
    x: 0,
    y: -999,
    z: 0,
    yaw: 0,
    life: 0,
  }));
  let footCursor = 0;

  const spawnBurst = (x: number, y: number, z: number, colorHex: number, count = 8) => {
    const actualCount = quality === 'low' ? Math.max(2, Math.floor(count / 2)) : count;
    for (let i = 0; i < actualCount; i++) {
      const p = particles[partCursor];
      partCursor = (partCursor + 1) % MAX_PARTICLES;
      p.x = x + (Math.random() - 0.5) * 0.4;
      p.y = y + Math.random() * 0.25;
      p.z = z + (Math.random() - 0.5) * 0.4;
      p.vx = (Math.random() - 0.5) * 4.2;
      p.vy = 1.4 + Math.random() * 3.2;
      p.vz = (Math.random() - 0.5) * 4.2;
      p.maxLife = 0.42 + Math.random() * 0.32;
      p.life = p.maxLife;
      p.color.setHex(colorHex);
    }
  };

  const spawnFootprint = (x: number, y: number, z: number, yaw: number) => {
    if (MAX_FOOTPRINTS <= 0) return;
    const f = footprints[footCursor];
    footCursor = (footCursor + 1) % MAX_FOOTPRINTS;
    f.x = x;
    f.y = y + 0.03;
    f.z = z;
    f.yaw = yaw;
    f.life = 3.2;
  };

  const updateFromSnapshot = (snap: RoomStateSnapshot, dt: number, elapsed: number) => {
    for (const pState of snap.platforms) {
      const grp = platformGroups.get(pState.id);
      if (!grp) continue;
      grp.visible = pState.active;
      const shakeX = pState.crumbleProgress > 0 ? Math.sin(elapsed * 45) * 0.08 * pState.crumbleProgress : 0;
      grp.position.set(pState.x + shakeX, pState.y, pState.z);
      grp.rotation.set(pState.tiltX ?? 0, pState.rotY, pState.tiltZ ?? 0);
    }

    for (const wf of waterfallMeshes) {
      wf.scale.x = 0.94 + Math.sin(elapsed * 7) * 0.08;
    }

    for (const c of snap.crates) {
      const m = crateMeshes.get(c.id);
      if (m) m.position.set(c.x, c.y, c.z);
    }

    for (const [pid, m] of plateMeshes.entries()) {
      const active = snap.activePlates.includes(pid);
      const mat = m.material as THREE.MeshStandardMaterial;
      const isTrap = world.puzzles.some((pz) => pz.id === pid && pz.kind === 'trap_plate');
      if (isTrap) {
        mat.color.setHex(active ? 0xfbbf24 : 0xdc2626);
      } else {
        mat.color.setHex(active ? 0x22c55e : 0xf97316);
        mat.emissive.setHex(active ? 0x16a34a : 0x9a3412);
      }
      m.scale.y = active ? 0.55 : 1.0;
    }

    for (const [aid, ring] of anchorRings.entries()) {
      const pullProg = snap.chainPullProgress?.[aid] ?? 0;
      ring.rotation.y = elapsed * (1.8 + pullProg * 4);
      const locked = Boolean(snap.activeAnchors[aid]) || snap.activePlates.includes(aid);
      ring.scale.setScalar(locked ? 1.3 : 1.0 + pullProg * 0.35);
    }

    for (const [kid, kGrp] of keyMeshes.entries()) {
      kGrp.visible = !(snap.collectedKeys ?? []).includes(kid);
      if (kGrp.visible) {
        kGrp.rotation.y = elapsed * 2.4;
      }
    }

    for (const mir of snap.mirrors ?? []) {
      const entry = mirrorGroups.get(mir.id);
      if (!entry) continue;
      const targetRot = mir.angle * (Math.PI / 2);
      entry.frame.rotation.y += (targetRot - entry.frame.rotation.y) * Math.min(1, 10 * dt);
      (entry.beam.material as THREE.MeshBasicMaterial).color.setHex(mir.lit ? 0x4ade80 : 0xfef08a);
    }

    // Swing ropes track swinging player or gentle breeze
    for (const [rid, pivot] of ropePivots.entries()) {
      const pz = world.puzzles.find((x) => x.id === rid);
      const swinger = snap.players.find((p) => p.swingingRopeId === rid);
      if (swinger && pz) {
        const dx = swinger.x - pz.x;
        const dz = swinger.z - pz.z;
        const dy = swinger.y + 0.8 - pz.y;
        const angleX = Math.atan2(dz, -dy);
        const angleZ = Math.atan2(dx, -dy);
        pivot.rotation.set(angleX, 0, -angleZ);
      } else {
        pivot.rotation.set(Math.sin(elapsed * 1.4) * 0.08, 0, Math.cos(elapsed * 1.1) * 0.05);
      }
    }

    for (const [idx, m] of cpMeshes.entries()) {
      const reached = snap.checkpointIndex >= idx;
      m.rotation.y = elapsed * 2.2;
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.color.setHex(reached ? 0x22c55e : 0x94a3b8);
      mat.emissive.setHex(reached ? 0x10b981 : 0x0284c7);
      mat.emissiveIntensity = reached ? 1.1 : 0.25;
    }

    for (const [sid, m] of starMeshes.entries()) {
      m.visible = !snap.collectedStars.includes(sid);
      if (m.visible) {
        m.rotation.y = elapsed * 2.6;
        m.position.y += Math.sin(elapsed * 3.5) * 0.002;
      }
    }

    for (const b of snap.boulders ?? []) {
      const bMesh = boulderMeshes.get(b.id);
      if (bMesh) {
        bMesh.position.set(b.x, b.y, b.z);
        bMesh.rotation.set(b.rotX, 0, b.rotZ);
      }
    }

    for (const [hid, jet] of steamJets.entries()) {
      const active = (snap.activeHazards ?? []).includes(hid);
      jet.visible = active;
      if (active) {
        jet.scale.x = 0.9 + Math.sin(elapsed * 18) * 0.14;
        jet.scale.z = jet.scale.x;
      }
    }

    for (const hz of world.hazards) {
      const hGrp = hazardMeshes.get(hz.id);
      if (!hGrp) continue;
      if (hz.kind === 'pendulum_log' || hz.kind === 'pendulum_hammer') {
        hGrp.rotation.z = Math.sin(snap.elapsedSec * hz.speed + (hz.phase ?? 0)) * hz.amplitude;
      } else if (hz.kind === 'spinning_log') {
        hGrp.rotation.y = snap.elapsedSec * hz.speed + (hz.phase ?? 0);
      } else if (hz.kind === 'wind_fan') {
        hGrp.rotation.x += hz.speed * 7.5 * dt;
      } else if (hz.kind === 'laser_beam') {
        const offset = Math.sin(snap.elapsedSec * hz.speed + (hz.phase ?? 0)) * hz.amplitude;
        hGrp.position.z = hz.axis === 'z' ? hz.z + offset : hz.z;
        hGrp.position.x = hz.axis === 'x' ? hz.x + offset : hz.x;
      } else if (hz.kind === 'piston_crusher') {
        const drop = (Math.sin(snap.elapsedSec * hz.speed + (hz.phase ?? 0)) + 1) * 0.5;
        hGrp.position.y = hz.y - drop * hz.amplitude;
      }
    }

    swirl.rotation.z = elapsed * 1.5;

    if (snap.chains.length > 0) {
      updateCustomChains(
        snap.chains.map((ch) => ({
          nodes: ch.nodes,
          tension: ch.tension,
          pulling: ch.state === 'pulling',
        })),
      );
    } else if (snap.phase === 'lobby' && snap.players.length === 1) {
      const p0 = snap.players[0];
      const sinY = Math.sin(p0.yaw);
      const cosY = Math.cos(p0.yaw);
      const tailNodes = [
        { x: p0.x, y: p0.y + 0.72, z: p0.z },
        { x: p0.x - sinY * 0.22, y: p0.y + 0.48, z: p0.z - cosY * 0.22 },
        { x: p0.x - sinY * 0.48 + Math.sin(elapsed * 2.2) * 0.05, y: p0.y + 0.24, z: p0.z - cosY * 0.48 },
        { x: p0.x - sinY * 0.72 + Math.sin(elapsed * 2.2 + 0.6) * 0.07, y: p0.y + 0.14, z: p0.z - cosY * 0.72 },
      ];
      updateCustomChains([{ nodes: tailNodes, tension: 0, pulling: false }]);
    } else {
      updateCustomChains([]);
    }

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = particles[i];
      if (p.life > 0) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vy -= 9.5 * dt;
        const s = Math.max(0.01, p.life / p.maxLife);
        _mid.set(p.x, p.y, p.z);
        _quat.identity();
        _scale.set(s, s, s);
        _mat4.compose(_mid, _quat, _scale);
        partMesh.setMatrixAt(i, _mat4);
        partMesh.setColorAt(i, p.color);
      } else {
        _mid.set(0, -999, 0);
        _scale.set(0.001, 0.001, 0.001);
        _mat4.compose(_mid, _quat, _scale);
        partMesh.setMatrixAt(i, _mat4);
      }
    }
    partMesh.instanceMatrix.needsUpdate = true;
    if (partMesh.instanceColor) partMesh.instanceColor.needsUpdate = true;

    if (footMesh) {
      for (let i = 0; i < MAX_FOOTPRINTS; i++) {
        const f = footprints[i];
        if (f.life > 0) {
          f.life -= dt;
          const s = Math.min(1, f.life * 0.5);
          _mid.set(f.x, f.y, f.z);
          _quat.setFromAxisAngle(_up, f.yaw);
          _scale.set(s, 1, s);
          _mat4.compose(_mid, _quat, _scale);
          footMesh.setMatrixAt(i, _mat4);
        } else {
          _mid.set(0, -999, 0);
          _scale.set(0.001, 0.001, 0.001);
          _mat4.compose(_mid, _quat, _scale);
          footMesh.setMatrixAt(i, _mat4);
        }
      }
      footMesh.instanceMatrix.needsUpdate = true;
    }
  };

  const updateCustomChains = (
    chains: { nodes: { x: number; y: number; z: number }[]; tension?: number; pulling?: boolean }[],
  ) => {
    let linkIdx = 0;
    let maxTension = 0;
    let anyPulling = false;

    for (const ch of chains) {
      const segTension = Math.max(0, Math.min(1, ch.tension ?? 0));
      maxTension = Math.max(maxTension, segTension);
      if (ch.pulling) anyPulling = true;

      if (ch.pulling) {
        _linkTmpColor.copy(_linkWarnColor);
      } else if (segTension > 0.72) {
        _linkTmpColor.lerpColors(_linkWarnColor, _linkPullColor, (segTension - 0.72) / 0.28);
      } else if (segTension > 0.35) {
        _linkTmpColor.lerpColors(_linkSteelColor, _linkWarnColor, (segTension - 0.35) / 0.37);
      } else {
        _linkTmpColor.copy(_linkSteelColor);
      }

      const nodes = ch.nodes;
      for (let i = 0; i < nodes.length - 1; i++) {
        const a = nodes[i];
        const b = nodes[i + 1];
        _vA.set(a.x, a.y, a.z);
        _vB.set(b.x, b.y, b.z);
        _dir.subVectors(_vB, _vA);
        const segLen = _dir.length();
        if (segLen < 0.001) continue;
        _dir.divideScalar(segLen);

        const subCount = Math.max(1, Math.min(7, Math.ceil(segLen / LINK_STEP)));
        for (let sub = 0; sub < subCount && linkIdx < MAX_CHAIN_LINKS; sub++) {
          const t = (sub + 0.5) / subCount;
          _mid.lerpVectors(_vA, _vB, t);
          _quat.setFromUnitVectors(_up, _dir);
          _rollQuat.setFromAxisAngle(_up, linkIdx % 2 === 0 ? 0 : Math.PI / 2);
          _quat.multiply(_rollQuat);
          _scale.set(0.84, 1.3, 0.84);
          _mat4.compose(_mid, _quat, _scale);
          chainInstanced.setMatrixAt(linkIdx, _mat4);
          chainInstanced.setColorAt(linkIdx, _linkTmpColor);
          linkIdx += 1;
        }
      }
    }

    _scale.set(1, 1, 1);
    chainInstanced.count = linkIdx;
    chainInstanced.instanceMatrix.needsUpdate = true;
    if (chainInstanced.instanceColor) chainInstanced.instanceColor.needsUpdate = true;

    if (anyPulling) {
      linkMat.emissive.setHex(0xb45309);
      linkMat.emissiveIntensity = 0.42;
    } else if (maxTension > 0.62) {
      linkMat.emissive.setHex(0x9a3412);
      linkMat.emissiveIntensity = 0.2 + (maxTension - 0.62) * 0.9;
    } else {
      linkMat.emissive.setHex(0x1e293b);
      linkMat.emissiveIntensity = 0.14;
    }
  };

  return {
    group,
    updateFromSnapshot,
    updateCustomChains,
    spawnBurst,
    spawnFootprint,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
