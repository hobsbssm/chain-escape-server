import * as THREE from 'three';
import type { CharacterAnimState, CharacterCustomization } from '../shared/types.ts';

export interface CharacterAnimationOpts {
  pullLeanX?: number;
  pullLeanZ?: number;
  yaw?: number;
  ragdollPitch?: number;
  ragdollRoll?: number;
}

export interface CharacterRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  torso: THREE.Group;
  headPivot: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftEye: THREE.Mesh;
  rightEye: THREE.Mesh;
  capeMesh: THREE.Mesh | null;
  wingsGroup: THREE.Group | null;
  shadowDisc: THREE.Mesh;
  animTime: number;
  blinkTimer: number;
  updateCustomization: (c: CharacterCustomization) => void;
  updateAnimation: (
    dt: number,
    anim: CharacterAnimState,
    speed: number,
    hanging: boolean,
    grounded: boolean,
    opts?: CharacterAnimationOpts,
  ) => void;
  dispose: () => void;
}

export function createStylizedCharacter(
  customization: CharacterCustomization,
  contactShadowMat: THREE.MeshBasicMaterial,
): CharacterRig {
  const disposables: { dispose: () => void }[] = [];

  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const shadowGeo = new THREE.PlaneGeometry(1.15, 1.15);
  shadowGeo.rotateX(-Math.PI / 2);
  disposables.push(shadowGeo);
  const shadowDisc = new THREE.Mesh(shadowGeo, contactShadowMat);
  shadowDisc.position.y = 0.025;
  root.add(shadowDisc);

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xffcfb3, roughness: 0.52, metalness: 0.02 });
  const jacketMat = new THREE.MeshStandardMaterial({ color: customization.colorHex, roughness: 0.84, metalness: 0.05 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.88, metalness: 0.04 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x3f2718, roughness: 0.62, metalness: 0.08 });
  const packMat = new THREE.MeshStandardMaterial({ color: 0x6b4f35, roughness: 0.78, metalness: 0.06 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.22, metalness: 0.88 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x3b2314, roughness: 0.72, metalness: 0.04 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.35, metalness: 0.1 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.05 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.5, metalness: 0.15 });
  disposables.push(skinMat, jacketMat, pantsMat, bootMat, packMat, brassMat, hairMat, darkMat, whiteMat, accentMat);

  const makeLeg = (side: -1 | 1): THREE.Group => {
    const legPivot = new THREE.Group();
    legPivot.position.set(side * 0.17, 0.56, 0);

    const thighGeo = new THREE.CapsuleGeometry(0.115, 0.22, 6, 12);
    const bootGeo = new THREE.BoxGeometry(0.22, 0.18, 0.32);
    const cuffGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.08, 12);
    disposables.push(thighGeo, bootGeo, cuffGeo);

    const thigh = new THREE.Mesh(thighGeo, pantsMat);
    thigh.position.y = -0.18;
    thigh.castShadow = true;
    legPivot.add(thigh);

    const cuff = new THREE.Mesh(cuffGeo, packMat);
    cuff.position.y = -0.35;
    legPivot.add(cuff);

    const boot = new THREE.Mesh(bootGeo, bootMat);
    boot.position.set(0, -0.47, 0.04);
    boot.castShadow = true;
    legPivot.add(boot);

    return legPivot;
  };

  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);
  bodyPivot.add(leftLeg, rightLeg);

  const torso = new THREE.Group();
  torso.position.y = 0.58;
  bodyPivot.add(torso);

  const jacketGeo = new THREE.CapsuleGeometry(0.27, 0.34, 8, 16);
  const beltGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.08, 16);
  const claspGeo = new THREE.TorusGeometry(0.082, 0.022, 8, 14);
  const collarGeo = new THREE.TorusGeometry(0.22, 0.065, 8, 16);
  disposables.push(jacketGeo, beltGeo, claspGeo, collarGeo);

  const jacket = new THREE.Mesh(jacketGeo, jacketMat);
  jacket.position.y = 0.28;
  jacket.scale.set(1.05, 1, 0.88);
  jacket.castShadow = true;
  torso.add(jacket);

  const belt = new THREE.Mesh(beltGeo, bootMat);
  belt.position.y = 0.1;
  belt.scale.set(1.04, 1, 0.9);
  torso.add(belt);

  const waistClasp = new THREE.Mesh(claspGeo, brassMat);
  waistClasp.position.set(0, 0.12, 0.26);
  torso.add(waistClasp);

  const backClasp = new THREE.Mesh(claspGeo, brassMat);
  backClasp.position.set(0, 0.12, -0.26);
  torso.add(backClasp);

  const collar = new THREE.Mesh(collarGeo, accentMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.54;
  torso.add(collar);

  const makeArm = (side: -1 | 1): THREE.Group => {
    const armPivot = new THREE.Group();
    armPivot.position.set(side * 0.34, 0.48, 0);

    const sleeveGeo = new THREE.CapsuleGeometry(0.09, 0.26, 6, 10);
    const gloveGeo = new THREE.SphereGeometry(0.1, 10, 10);
    disposables.push(sleeveGeo, gloveGeo);

    const sleeve = new THREE.Mesh(sleeveGeo, jacketMat);
    sleeve.position.y = -0.15;
    sleeve.castShadow = true;
    armPivot.add(sleeve);

    const glove = new THREE.Mesh(gloveGeo, darkMat);
    glove.position.y = -0.34;
    glove.castShadow = true;
    armPivot.add(glove);

    return armPivot;
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);
  torso.add(leftArm, rightArm);

  const headPivot = new THREE.Group();
  headPivot.position.y = 0.62;
  torso.add(headPivot);

  const headGeo = new THREE.SphereGeometry(0.28, 18, 16);
  const earGeo = new THREE.SphereGeometry(0.06, 8, 8);
  const eyeGeo = new THREE.SphereGeometry(0.048, 10, 10);
  const pupilGeo = new THREE.SphereGeometry(0.025, 8, 8);
  const hairCapGeo = new THREE.SphereGeometry(0.295, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58);
  const tuftGeo = new THREE.ConeGeometry(0.09, 0.18, 8);
  disposables.push(headGeo, earGeo, eyeGeo, pupilGeo, hairCapGeo, tuftGeo);

  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.position.y = 0.24;
  headMesh.scale.set(1.04, 0.98, 1.0);
  headMesh.castShadow = true;
  headPivot.add(headMesh);

  const leftEar = new THREE.Mesh(earGeo, skinMat);
  leftEar.position.set(-0.27, 0.22, 0);
  const rightEar = new THREE.Mesh(earGeo, skinMat);
  rightEar.position.set(0.27, 0.22, 0);
  headPivot.add(leftEar, rightEar);

  const leftEye = new THREE.Mesh(eyeGeo, whiteMat);
  leftEye.position.set(-0.1, 0.25, 0.24);
  const rightEye = new THREE.Mesh(eyeGeo, whiteMat);
  rightEye.position.set(0.1, 0.25, 0.24);
  const leftPupil = new THREE.Mesh(pupilGeo, darkMat);
  leftPupil.position.set(0, 0, 0.032);
  leftEye.add(leftPupil);
  const rightPupil = new THREE.Mesh(pupilGeo, darkMat);
  rightPupil.position.set(0, 0, 0.032);
  rightEye.add(rightPupil);
  headPivot.add(leftEye, rightEye);

  const hairCap = new THREE.Mesh(hairCapGeo, hairMat);
  hairCap.position.set(0, 0.26, -0.02);
  hairCap.rotation.x = -0.18;
  headPivot.add(hairCap);

  const tuft1 = new THREE.Mesh(tuftGeo, hairMat);
  tuft1.position.set(-0.04, 0.53, 0.08);
  tuft1.rotation.set(0.4, 0, 0.2);
  const tuft2 = new THREE.Mesh(tuftGeo, hairMat);
  tuft2.position.set(0.06, 0.51, 0.06);
  tuft2.rotation.set(0.5, 0, -0.25);
  headPivot.add(tuft1, tuft2);

  const hatSlot = new THREE.Group();
  hatSlot.position.y = 0.42;
  headPivot.add(hatSlot);

  const accessorySlot = new THREE.Group();
  accessorySlot.position.set(0, 0.3, -0.24);
  torso.add(accessorySlot);

  const faceMaskGeo = new THREE.BoxGeometry(0.32, 0.14, 0.12);
  disposables.push(faceMaskGeo);
  const faceMask = new THREE.Mesh(faceMaskGeo, darkMat);
  faceMask.position.set(0, 0.14, 0.23);
  headPivot.add(faceMask);

  let capeMesh: THREE.Mesh | null = null;
  let wingsGroup: THREE.Group | null = null;

  const clearGroup = (grp: THREE.Group) => {
    while (grp.children.length > 0) {
      grp.remove(grp.children[0]);
    }
  };

  const updateCustomization = (c: CharacterCustomization) => {
    jacketMat.color.set(c.colorHex);

    if (c.outfit === 'parka') {
      pantsMat.color.set(0x1e3a8a);
      accentMat.color.set(0xbae6fd);
    } else if (c.outfit === 'forge') {
      pantsMat.color.set(0x27272a);
      accentMat.color.set(0xf59e0b);
    } else if (c.outfit === 'temple') {
      pantsMat.color.set(0x365314);
      accentMat.color.set(0xfde047);
    } else if (c.outfit === 'void_suit') {
      pantsMat.color.set(0x1e1b4b);
      accentMat.color.set(0xc084fc);
    } else {
      pantsMat.color.set(0x334155);
      accentMat.color.set(0xf97316);
    }

    faceMask.visible = c.face === 'masked';

    clearGroup(hatSlot);
    if (c.hat === 'goggles') {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 6, 18), bootMat);
      band.rotation.x = Math.PI / 2;
      const lensL = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 12), brassMat);
      lensL.rotation.x = Math.PI / 2;
      lensL.position.set(-0.1, 0.02, 0.27);
      const lensR = lensL.clone();
      lensR.position.x = 0.1;
      const glassL = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.07, 12), whiteMat);
      glassL.rotation.x = Math.PI / 2;
      glassL.position.set(-0.1, 0.02, 0.275);
      const glassR = glassL.clone();
      glassR.position.x = 0.1;
      hatSlot.add(band, lensL, lensR, glassL, glassR);
    } else if (c.hat === 'cap') {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), jacketMat);
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.04, 0.24), whiteMat);
      brim.position.set(0, 0.01, 0.24);
      hatSlot.add(dome, brim);
    } else if (c.hat === 'beanie') {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), accentMat);
      const pom = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), whiteMat);
      pom.position.y = 0.31;
      hatSlot.add(dome, pom);
    } else if (c.hat === 'horns') {
      const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.16, 14), darkMat);
      const hornGeo = new THREE.ConeGeometry(0.07, 0.26, 8);
      const hL = new THREE.Mesh(hornGeo, whiteMat);
      hL.position.set(-0.28, 0.12, 0);
      hL.rotation.z = 0.7;
      const hR = new THREE.Mesh(hornGeo, whiteMat);
      hR.position.set(0.28, 0.12, 0);
      hR.rotation.z = -0.7;
      hatSlot.add(helm, hL, hR);
    } else if (c.hat === 'crown') {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.21, 0.14, 8), brassMat);
      ring.position.y = 0.12;
      hatSlot.add(ring);
    } else if (c.hat === 'ninja') {
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.305, 14, 12), darkMat);
      hood.position.y = -0.15;
      hatSlot.add(hood);
    }

    clearGroup(accessorySlot);
    capeMesh = null;
    wingsGroup = null;
    if (c.accessory === 'bedroll') {
      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.38, 0.2), packMat);
      pack.castShadow = true;
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.38, 10), accentMat);
      roll.rotation.z = Math.PI / 2;
      roll.position.y = 0.22;
      accessorySlot.add(pack, roll);
    } else if (c.accessory === 'lantern') {
      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.18), packMat);
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xf59e0b, emissiveIntensity: 1.3 }),
      );
      bulb.position.set(0, 0.26, -0.08);
      accessorySlot.add(pack, bulb);
    } else if (c.accessory === 'cape') {
      const cGeo = new THREE.BoxGeometry(0.46, 0.65, 0.04);
      capeMesh = new THREE.Mesh(cGeo, accentMat);
      capeMesh.position.set(0, -0.12, -0.02);
      capeMesh.rotation.x = 0.15;
      accessorySlot.add(capeMesh);
    } else if (c.accessory === 'wings') {
      wingsGroup = new THREE.Group();
      const wGeo = new THREE.BoxGeometry(0.42, 0.22, 0.04);
      const wL = new THREE.Mesh(wGeo, whiteMat);
      wL.position.set(-0.28, 0.08, 0);
      wL.rotation.z = 0.35;
      const wR = new THREE.Mesh(wGeo, whiteMat);
      wR.position.set(0.28, 0.08, 0);
      wR.rotation.z = -0.35;
      wingsGroup.add(wL, wR);
      accessorySlot.add(wingsGroup);
    }
  };

  updateCustomization(customization);

  const rig: CharacterRig = {
    root,
    bodyPivot,
    torso,
    headPivot,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    leftEye,
    rightEye,
    capeMesh,
    wingsGroup,
    shadowDisc,
    animTime: Math.random() * 4,
    blinkTimer: 2 + Math.random() * 3,
    updateCustomization,
    updateAnimation(dt, anim, speed, hanging, grounded, opts) {
      this.animTime += dt;
      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) {
        this.blinkTimer = 2.8 + Math.random() * 3.0;
      }
      const blinking = this.blinkTimer < 0.11;
      const wideEyes =
        anim === 'falling' || anim === 'hanging' || anim === 'stumbling' || anim === 'knocked_down';
      const eyeScaleY = blinking ? 0.12 : wideEyes ? 1.32 : 1.0;
      leftEye.scale.y = THREE.MathUtils.damp(leftEye.scale.y, eyeScaleY, 18, dt);
      rightEye.scale.y = leftEye.scale.y;

      shadowDisc.visible = grounded;

      let bodyY = 0;
      let bodyRotX = 0;
      let bodyRotZ = 0;
      let scaleY = 1;
      let lLegX = 0;
      let rLegX = 0;
      let lArmX = 0;
      let rArmX = 0;
      let lArmZ = 0.12;
      let rArmZ = -0.12;
      let headX = 0;

      const t = this.animTime;

      switch (anim) {
        case 'idle': {
          bodyY = Math.sin(t * 2.4) * 0.025;
          lArmX = Math.sin(t * 2.4) * 0.05;
          rArmX = -Math.sin(t * 2.4) * 0.05;
          break;
        }
        case 'walking': {
          const cycle = t * 8.5;
          bodyY = Math.abs(Math.sin(cycle)) * 0.06;
          bodyRotX = 0.08;
          lLegX = Math.sin(cycle) * 0.65;
          rLegX = -Math.sin(cycle) * 0.65;
          lArmX = -Math.sin(cycle) * 0.55;
          rArmX = Math.sin(cycle) * 0.55;
          break;
        }
        case 'running': {
          const cycle = t * 14.0;
          bodyY = Math.abs(Math.sin(cycle)) * 0.11;
          bodyRotX = 0.24;
          lLegX = Math.sin(cycle) * 0.98;
          rLegX = -Math.sin(cycle) * 0.98;
          lArmX = -Math.sin(cycle) * 0.92;
          rArmX = Math.sin(cycle) * 0.92;
          break;
        }
        case 'jumping': {
          scaleY = 1.14;
          bodyRotX = -0.08;
          lLegX = -0.45;
          rLegX = 0.35;
          lArmX = -2.3;
          rArmX = -2.3;
          lArmZ = 0.35;
          rArmZ = -0.35;
          break;
        }
        case 'falling': {
          const flail = t * 18;
          lArmX = -2.4 + Math.sin(flail) * 0.45;
          rArmX = -2.4 - Math.sin(flail) * 0.45;
          lArmZ = 0.65;
          rArmZ = -0.65;
          lLegX = Math.sin(flail) * 0.45;
          rLegX = -Math.sin(flail) * 0.45;
          headX = -0.2;
          break;
        }
        case 'landing': {
          scaleY = 0.78;
          bodyY = -0.14;
          bodyRotX = 0.22;
          lLegX = -0.5;
          rLegX = -0.5;
          lArmX = 0.4;
          rArmX = 0.4;
          break;
        }
        case 'climbing': {
          const cl = t * 12;
          lArmX = -1.9 + Math.sin(cl) * 0.7;
          rArmX = -1.9 - Math.sin(cl) * 0.7;
          lLegX = -0.6 - Math.sin(cl) * 0.5;
          rLegX = -0.6 + Math.sin(cl) * 0.5;
          bodyRotX = 0.25;
          break;
        }
        case 'hanging': {
          const swing = t * 9;
          bodyRotX = 0.15 + Math.sin(t * 3) * 0.08;
          lArmX = -2.6;
          rArmX = -2.6;
          lLegX = Math.sin(swing) * 0.55;
          rLegX = -Math.sin(swing) * 0.55;
          headX = -0.35;
          break;
        }
        case 'swinging': {
          bodyRotX = 0.18 + Math.sin(t * 4.5) * 0.12;
          lArmX = -2.85;
          rArmX = -2.85;
          lLegX = 0.45 + Math.sin(t * 4.5) * 0.25;
          rLegX = 0.25 + Math.sin(t * 4.5) * 0.25;
          headX = -0.25;
          break;
        }
        case 'pulling': {
          const tug = t * 7;
          bodyRotX = -0.35;
          lLegX = -0.45 + Math.sin(tug) * 0.3;
          rLegX = 0.35 - Math.sin(tug) * 0.3;
          lArmX = -1.35 + Math.sin(tug) * 0.2;
          rArmX = -1.35 + Math.sin(tug) * 0.2;
          break;
        }
        case 'sliding': {
          bodyY = -0.22;
          bodyRotX = -0.38;
          lLegX = -0.9;
          rLegX = 0.3;
          lArmZ = 0.8;
          rArmZ = -0.8;
          break;
        }
        case 'stumbling': {
          bodyRotZ = Math.sin(t * 22) * 0.28;
          bodyRotX = 0.25;
          lArmZ = 0.95;
          rArmZ = -0.95;
          break;
        }
        case 'knocked_down': {
          bodyY = -0.36;
          bodyRotX = opts?.ragdollPitch ?? 1.32;
          bodyRotZ = (opts?.ragdollRoll ?? 0.3) + Math.sin(t * 3.5) * 0.08;
          lArmX = -0.8 + Math.sin(t * 6) * 0.22;
          rArmX = -1.2 - Math.sin(t * 6) * 0.22;
          lArmZ = 0.85;
          rArmZ = -0.85;
          lLegX = 0.55;
          rLegX = -0.25;
          headX = -0.45;
          break;
        }
        case 'celebrating': {
          const hop = Math.abs(Math.sin(t * 7.5));
          bodyY = hop * 0.48;
          lArmX = -2.7 + Math.sin(t * 14) * 0.3;
          rArmX = -2.7 - Math.sin(t * 14) * 0.3;
          lLegX = -hop * 0.35;
          rLegX = -hop * 0.35;
          break;
        }
        case 'dragged': {
          bodyRotX = 0.65;
          lArmX = -1.8;
          rArmX = -1.8;
          lLegX = 0.6;
          rLegX = 0.4;
          break;
        }
      }

      if (hanging && anim !== 'hanging') {
        bodyRotX = 0.2;
      }

      // Apply chain pull vector lean in local character coordinates
      if (opts && (opts.pullLeanX || opts.pullLeanZ) && anim !== 'knocked_down') {
        const yAngle = opts.yaw ?? 0;
        const sinY = Math.sin(yAngle);
        const cosY = Math.cos(yAngle);
        const localFwd = (opts.pullLeanX ?? 0) * sinY + (opts.pullLeanZ ?? 0) * cosY;
        const localSide = (opts.pullLeanX ?? 0) * cosY - (opts.pullLeanZ ?? 0) * sinY;
        bodyRotX += localFwd * 0.45;
        bodyRotZ -= localSide * 0.45;
      }

      const dampK = 16;
      bodyPivot.position.y = THREE.MathUtils.damp(bodyPivot.position.y, bodyY, dampK, dt);
      bodyPivot.rotation.x = THREE.MathUtils.damp(bodyPivot.rotation.x, bodyRotX, dampK, dt);
      bodyPivot.rotation.z = THREE.MathUtils.damp(bodyPivot.rotation.z, bodyRotZ, dampK, dt);
      bodyPivot.scale.y = THREE.MathUtils.damp(bodyPivot.scale.y, scaleY, dampK, dt);
      bodyPivot.scale.x = 1 / Math.sqrt(Math.max(0.6, bodyPivot.scale.y));
      bodyPivot.scale.z = bodyPivot.scale.x;

      leftLeg.rotation.x = THREE.MathUtils.damp(leftLeg.rotation.x, lLegX, dampK, dt);
      rightLeg.rotation.x = THREE.MathUtils.damp(rightLeg.rotation.x, rLegX, dampK, dt);
      leftArm.rotation.x = THREE.MathUtils.damp(leftArm.rotation.x, lArmX, dampK, dt);
      rightArm.rotation.x = THREE.MathUtils.damp(rightArm.rotation.x, rArmX, dampK, dt);
      leftArm.rotation.z = THREE.MathUtils.damp(leftArm.rotation.z, lArmZ, dampK, dt);
      rightArm.rotation.z = THREE.MathUtils.damp(rightArm.rotation.z, rArmZ, dampK, dt);
      headPivot.rotation.x = THREE.MathUtils.damp(headPivot.rotation.x, headX, dampK, dt);

      accessorySlot.position.y =
        0.3 + (speed > 0.4 ? Math.abs(Math.sin(t * 11)) * Math.min(0.04, speed * 0.004) : 0);
      accessorySlot.rotation.x =
        0.04 + (anim === 'jumping' || anim === 'falling' ? 0.16 : Math.min(0.14, speed * 0.015));
      accessorySlot.rotation.z = speed > 0.6 ? Math.sin(t * 7) * 0.045 : 0;

      if (capeMesh) {
        capeMesh.rotation.x = 0.18 + Math.min(0.9, speed * 0.08) + Math.sin(t * 7) * 0.08;
      }
      if (wingsGroup) {
        wingsGroup.rotation.y = Math.sin(t * 6) * 0.12;
      }
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
    },
  };

  return rig;
}
