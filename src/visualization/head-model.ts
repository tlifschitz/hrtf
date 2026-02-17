import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const HEAD_COLOR = 0x4a6fa5;

/** Build a simple placeholder while the GLB loads */
function buildPlaceholder(): THREE.Group {
  const group = new THREE.Group();
  const geo = new THREE.SphereGeometry(0.5, 16, 16);
  const mat = new THREE.MeshStandardMaterial({
    color: HEAD_COLOR,
    wireframe: true,
    transparent: true,
    opacity: 0.3,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.set(0.8, 1.0, 0.85);
  group.add(mesh);
  return group;
}

/** Collect all SkinnedMeshes that have morph targets */
function findMorphMeshes(root: THREE.Object3D): THREE.SkinnedMesh[] {
  const meshes: THREE.SkinnedMesh[] = [];
  root.traverse((child) => {
    if (
      child instanceof THREE.SkinnedMesh &&
      child.morphTargetDictionary &&
      child.morphTargetInfluences
    ) {
      meshes.push(child);
    }
  });
  return meshes;
}

/** Start a subtle idle blink loop using ARKit blend shapes */
function startBlinkLoop(meshes: THREE.SkinnedMesh[]): () => void {
  let animId = 0;
  let nextBlinkTime = performance.now() + 2000 + Math.random() * 3000;
  let blinkPhase: 'idle' | 'closing' | 'opening' = 'idle';
  let blinkStart = 0;

  const CLOSE_DURATION = 80; // ms
  const OPEN_DURATION = 120; // ms

  function setBlendShape(name: string, value: number) {
    for (const mesh of meshes) {
      const idx = mesh.morphTargetDictionary![name];
      if (idx !== undefined && mesh.morphTargetInfluences) {
        mesh.morphTargetInfluences[idx] = value;
      }
    }
  }

  function tick() {
    animId = requestAnimationFrame(tick);
    const now = performance.now();

    if (blinkPhase === 'idle' && now >= nextBlinkTime) {
      blinkPhase = 'closing';
      blinkStart = now;
    }

    if (blinkPhase === 'closing') {
      const t = Math.min((now - blinkStart) / CLOSE_DURATION, 1);
      setBlendShape('eyeBlinkLeft', t);
      setBlendShape('eyeBlinkRight', t);
      if (t >= 1) {
        blinkPhase = 'opening';
        blinkStart = now;
      }
    }

    if (blinkPhase === 'opening') {
      const t = Math.min((now - blinkStart) / OPEN_DURATION, 1);
      setBlendShape('eyeBlinkLeft', 1 - t);
      setBlendShape('eyeBlinkRight', 1 - t);
      if (t >= 1) {
        blinkPhase = 'idle';
        nextBlinkTime = now + 2000 + Math.random() * 4000;
      }
    }
  }

  tick();
  return () => cancelAnimationFrame(animId);
}

/**
 * Load a Ready Player Me avatar GLB into the given group.
 * Shows a wireframe placeholder while loading; replaces it once ready.
 * Returns a dispose function to stop idle animations.
 */
export function loadHeadModel(group: THREE.Group): { stop: () => void } {
  const placeholder = buildPlaceholder();
  group.add(placeholder);

  let stopBlink: (() => void) | null = null;

  const loader = new GLTFLoader();
  loader.load(
    'models/head.glb',
    (gltf) => {
      // Remove placeholder
      group.remove(placeholder);
      placeholder.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });

      const model = gltf.scene;

      // Determine clip height from Neck bone to hide the body
      let clipModelY = 0;
      model.traverse((child) => {
        if (child instanceof THREE.Bone && child.name === 'Neck') {
          const wp = new THREE.Vector3();
          child.getWorldPosition(wp);
          clipModelY = wp.y*1.05;
        }
      });

      // Fallback: clip at 80% of model height if no Neck bone found
      const fullBox = new THREE.Box3().setFromObject(model);
      if (clipModelY === 0) {
        clipModelY = fullBox.min.y + (fullBox.max.y - fullBox.min.y) * 0.9;
      }

      // Scale and center based on head-only bounding box (above neck)
      const headBox = fullBox.clone();
      headBox.min.y = clipModelY;
      const headSize = headBox.getSize(new THREE.Vector3());
      const maxDim = Math.max(headSize.x, headSize.y, headSize.z);
      const scale = 5.0 / maxDim;
      model.scale.setScalar(scale);

      // Re-center on the head portion after scaling
      const scaledHeadBox = new THREE.Box3(
        headBox.min.clone().multiplyScalar(scale),
        headBox.max.clone().multiplyScalar(scale),
      );
      const center = scaledHeadBox.getCenter(new THREE.Vector3());
      model.position.sub(center);

      // Apply clipping plane in world space (after scale + center transforms)
      const worldClipY = clipModelY * scale - center.y;
      const clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -worldClipY);
      model.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh) {
          child.material.clippingPlanes = [clipPlane];
        }
      });

      // RPM avatars face +Z by default, which matches our convention
      group.add(model);

      // Start idle blink animation
      const morphMeshes = findMorphMeshes(model);
      if (morphMeshes.length > 0) {
        stopBlink = startBlinkLoop(morphMeshes);
      }
    },
    undefined,
    (error) => {
      console.warn('Failed to load head GLB, keeping placeholder:', error);
    },
  );

  return {
    stop: () => stopBlink?.(),
  };
}
