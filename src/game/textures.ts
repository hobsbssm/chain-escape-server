import * as THREE from 'three';

function createCanvasTexture(
  size: number,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
  repeatX = 1,
  repeatY = 1,
  maxAnisotropy = 4,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export interface WorldMaterialLibrary {
  stone: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  jungle: THREE.MeshStandardMaterial;
  cracked: THREE.MeshStandardMaterial;
  ice: THREE.MeshPhysicalMaterial;
  metal: THREE.MeshStandardMaterial;
  temple: THREE.MeshStandardMaterial;
  voidCrystal: THREE.MeshStandardMaterial;
  bouncePad: THREE.MeshStandardMaterial;
  crumble: THREE.MeshStandardMaterial;
  phasing: THREE.MeshStandardMaterial;
  chainMetal: THREE.MeshStandardMaterial;
  chainHot: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
  laser: THREE.MeshStandardMaterial;
  contactShadow: THREE.MeshBasicMaterial;
  dispose: () => void;
}

export function createWorldMaterialLibrary(
  maxAnisotropy: number,
  isSoftwareGl: boolean,
): WorldMaterialLibrary {
  const textures: THREE.Texture[] = [];

  const stoneTex = createCanvasTexture(
    256,
    (ctx, s) => {
      ctx.fillStyle = '#8b7e74';
      ctx.fillRect(0, 0, s, s);
      for (let y = 0; y < s; y += 32) {
        const offset = (y / 32) % 2 === 0 ? 0 : 32;
        for (let x = -32; x < s + 32; x += 64) {
          const shade = 115 + Math.floor(Math.random() * 35);
          ctx.fillStyle = `rgb(${shade + 8}, ${shade}, ${shade - 8})`;
          ctx.fillRect(x + offset + 2, y + 2, 60, 28);
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.fillRect(x + offset + 2, y + 2, 60, 4);
        }
      }
      for (let i = 0; i < 65; i++) {
        ctx.fillStyle = `rgba(92, 148, 66, ${0.15 + Math.random() * 0.2})`;
        ctx.beginPath();
        ctx.arc(Math.random() * s, Math.random() * s, 2 + Math.random() * 5, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    2,
    2,
    maxAnisotropy,
  );
  textures.push(stoneTex);

  const woodTex = createCanvasTexture(
    256,
    (ctx, s) => {
      ctx.fillStyle = '#7c4a26';
      ctx.fillRect(0, 0, s, s);
      for (let y = 0; y < s; y += 32) {
        ctx.fillStyle = y % 64 === 0 ? '#8c552c' : '#734220';
        ctx.fillRect(0, y + 1, s, 30);
        ctx.fillStyle = '#47250e';
        ctx.fillRect(0, y, s, 2);
        for (let g = 0; g < 8; g++) {
          ctx.fillStyle = 'rgba(55, 25, 8, 0.25)';
          ctx.fillRect(Math.random() * s, y + 4 + Math.random() * 20, 25 + Math.random() * 40, 2);
        }
      }
    },
    2,
    2,
    maxAnisotropy,
  );
  textures.push(woodTex);

  const jungleTex = createCanvasTexture(
    256,
    (ctx, s) => {
      ctx.fillStyle = '#4d5c3a';
      ctx.fillRect(0, 0, s, s);
      for (let y = 0; y < s; y += 42) {
        for (let x = 0; x < s; x += 42) {
          const g = 88 + Math.floor(Math.random() * 35);
          ctx.fillStyle = `rgb(${g - 18}, ${g + 12}, ${g - 28})`;
          ctx.fillRect(x + 2, y + 2, 38, 38);
        }
      }
      for (let i = 0; i < 85; i++) {
        ctx.fillStyle = `rgba(74, 222, 128, ${0.14 + Math.random() * 0.22})`;
        ctx.beginPath();
        ctx.arc(Math.random() * s, Math.random() * s, 3 + Math.random() * 6, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    2,
    2,
    maxAnisotropy,
  );
  textures.push(jungleTex);

  const crackedTex = createCanvasTexture(
    256,
    (ctx, s) => {
      ctx.fillStyle = '#64748b';
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 4;
      for (let i = 0; i < 14; i++) {
        ctx.beginPath();
        let px = Math.random() * s;
        let py = Math.random() * s;
        ctx.moveTo(px, py);
        for (let k = 0; k < 4; k++) {
          px += (Math.random() - 0.5) * 65;
          py += (Math.random() - 0.5) * 65;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(6, 6, s - 12, s - 12);
    },
    1,
    1,
    maxAnisotropy,
  );
  textures.push(crackedTex);

  const iceTex = createCanvasTexture(
    256,
    (ctx, s) => {
      const grad = ctx.createLinearGradient(0, 0, s, s);
      grad.addColorStop(0, '#bae6fd');
      grad.addColorStop(0.5, '#7dd3fc');
      grad.addColorStop(1, '#e0f2fe');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 16; i++) {
        ctx.beginPath();
        const sx = Math.random() * s;
        const sy = Math.random() * s;
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + (Math.random() - 0.5) * 70, sy + (Math.random() - 0.5) * 70);
        ctx.stroke();
      }
    },
    2,
    2,
    maxAnisotropy,
  );
  textures.push(iceTex);

  const metalTex = createCanvasTexture(
    256,
    (ctx, s) => {
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, s - 8, s - 8);
      ctx.strokeRect(s / 2, 0, 1, s);
      ctx.strokeRect(0, s / 2, s, 1);
      ctx.fillStyle = '#f59e0b';
      for (let i = 0; i < s; i += 32) {
        ctx.fillRect(i, 0, 16, 10);
        ctx.fillRect(i + 16, s - 10, 16, 10);
      }
      ctx.fillStyle = '#94a3b8';
      for (const rx of [18, s / 2 - 14, s / 2 + 14, s - 18]) {
        for (const ry of [18, s / 2 - 14, s / 2 + 14, s - 18]) {
          ctx.beginPath();
          ctx.arc(rx, ry, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
    2,
    2,
    maxAnisotropy,
  );
  textures.push(metalTex);

  const templeTex = createCanvasTexture(
    256,
    (ctx, s) => {
      ctx.fillStyle = '#78716c';
      ctx.fillRect(0, 0, s, s);
      for (let y = 0; y < s; y += 64) {
        for (let x = 0; x < s; x += 64) {
          ctx.fillStyle = '#8b8378';
          ctx.fillRect(x + 3, y + 3, 58, 58);
          ctx.strokeStyle = '#d97706';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 12, y + 12, 40, 40);
        }
      }
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = 'rgba(74, 124, 68, 0.35)';
        ctx.beginPath();
        ctx.arc(Math.random() * s, Math.random() * s, 3 + Math.random() * 6, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    2,
    2,
    maxAnisotropy,
  );
  textures.push(templeTex);

  const voidTex = createCanvasTexture(
    256,
    (ctx, s) => {
      const grad = ctx.createRadialGradient(s / 2, s / 2, 10, s / 2, s / 2, s * 0.7);
      grad.addColorStop(0, '#4c1d95');
      grad.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = 'rgba(167, 139, 250, 0.45)';
      ctx.lineWidth = 2;
      ctx.strokeRect(10, 10, s - 20, s - 20);
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, s * 0.25, 0, Math.PI * 2);
      ctx.stroke();
    },
    2,
    2,
    maxAnisotropy,
  );
  textures.push(voidTex);

  const shadowTex = createCanvasTexture(
    128,
    (ctx, s) => {
      const grad = ctx.createRadialGradient(s / 2, s / 2, 4, s / 2, s / 2, s / 2);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
      grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.2)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, s, s);
    },
    1,
    1,
    1,
  );
  textures.push(shadowTex);

  const materials: THREE.Material[] = [];

  const stone = new THREE.MeshStandardMaterial({
    map: stoneTex,
    roughness: 0.85,
    metalness: 0.05,
  });
  const wood = new THREE.MeshStandardMaterial({
    map: woodTex,
    roughness: 0.82,
    metalness: 0.04,
  });
  const jungle = new THREE.MeshStandardMaterial({
    map: jungleTex,
    roughness: 0.84,
    metalness: 0.04,
  });
  const cracked = new THREE.MeshStandardMaterial({
    map: crackedTex,
    roughness: 0.9,
    metalness: 0.06,
  });
  const ice = new THREE.MeshPhysicalMaterial({
    map: iceTex,
    roughness: 0.16,
    metalness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.12,
    transmission: isSoftwareGl ? 0 : 0.18,
    transparent: true,
    opacity: 0.94,
  });
  const metal = new THREE.MeshStandardMaterial({
    map: metalTex,
    roughness: 0.36,
    metalness: 0.72,
  });
  const temple = new THREE.MeshStandardMaterial({
    map: templeTex,
    roughness: 0.88,
    metalness: 0.08,
  });
  const voidCrystal = new THREE.MeshStandardMaterial({
    map: voidTex,
    roughness: 0.28,
    metalness: 0.45,
    emissive: new THREE.Color('#3b0764'),
    emissiveIntensity: 0.45,
  });
  const bouncePad = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: new THREE.Color('#059669'),
    emissiveIntensity: 0.55,
    roughness: 0.25,
    metalness: 0.3,
  });
  const crumble = new THREE.MeshStandardMaterial({
    map: woodTex,
    color: 0xd97706,
    roughness: 0.65,
    metalness: 0.08,
  });
  const phasing = new THREE.MeshStandardMaterial({
    color: 0xc084fc,
    emissive: new THREE.Color('#7e22ce'),
    emissiveIntensity: 0.5,
    roughness: 0.2,
    metalness: 0.4,
    transparent: true,
    opacity: 0.88,
  });
  const chainMetal = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.26,
    metalness: 0.88,
  });
  const chainHot = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: new THREE.Color('#d97706'),
    emissiveIntensity: 0.75,
    roughness: 0.24,
    metalness: 0.8,
  });
  const gold = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: new THREE.Color('#ca8a04'),
    emissiveIntensity: 0.45,
    roughness: 0.2,
    metalness: 0.88,
  });
  const laser = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: new THREE.Color('#dc2626'),
    emissiveIntensity: 1.6,
    roughness: 0.15,
  });
  const contactShadow = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.65,
  });

  materials.push(
    stone,
    wood,
    jungle,
    cracked,
    ice,
    metal,
    temple,
    voidCrystal,
    bouncePad,
    crumble,
    phasing,
    chainMetal,
    chainHot,
    gold,
    laser,
    contactShadow,
  );

  return {
    stone,
    wood,
    jungle,
    cracked,
    ice,
    metal,
    temple,
    voidCrystal,
    bouncePad,
    crumble,
    phasing,
    chainMetal,
    chainHot,
    gold,
    laser,
    contactShadow,
    dispose: () => {
      textures.forEach((t) => t.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
