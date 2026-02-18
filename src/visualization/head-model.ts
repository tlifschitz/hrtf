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

  function tick() {
    animId = requestAnimationFrame(tick);
    const now = performance.now();

    if (blinkPhase === 'idle' && now >= nextBlinkTime) {
      blinkPhase = 'closing';
      blinkStart = now;
    }

    if (blinkPhase === 'closing') {
      const t = Math.min((now - blinkStart) / CLOSE_DURATION, 1);
      setBlendShape(meshes, 'eyeBlinkLeft', t);
      setBlendShape(meshes, 'eyeBlinkRight', t);
      if (t >= 1) {
        blinkPhase = 'opening';
        blinkStart = now;
      }
    }

    if (blinkPhase === 'opening') {
      const t = Math.min((now - blinkStart) / OPEN_DURATION, 1);
      setBlendShape(meshes, 'eyeBlinkLeft', 1 - t);
      setBlendShape(meshes, 'eyeBlinkRight', 1 - t);
      if (t >= 1) {
        blinkPhase = 'idle';
        nextBlinkTime = now + 2000 + Math.random() * 4000;
      }
    }
  }

  tick();
  return () => cancelAnimationFrame(animId);
}

/** Set a single blend shape across all morph meshes */
function setBlendShape(meshes: THREE.SkinnedMesh[], name: string, value: number) {
  for (const mesh of meshes) {
    const idx = mesh.morphTargetDictionary![name];
    if (idx !== undefined && mesh.morphTargetInfluences) {
      mesh.morphTargetInfluences[idx] = value;
    }
  }
}

export interface HeadModelApi {
  stop: () => void;
  applyBlendShapes: (map: Record<string, number>) => void;
  resumeIdleBlink: () => void;
}

/**
 * Load a Ready Player Me avatar GLB into the given group.
 * Shows a wireframe placeholder while loading; replaces it once ready.
 * Returns an API object with stop() and applyBlendShapes().
 */
export function loadHeadModel(group: THREE.Group): HeadModelApi {
  const placeholder = buildPlaceholder();
  group.add(placeholder);

  let stopBlink: (() => void) | null = null;
  let morphMeshes: THREE.SkinnedMesh[] = [];
  let blinkSuppressed = false;

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

      // Rotate 180° so the face points toward the camera (which is on -Z)
      //model.rotation.y = Math.PI;
      group.add(model);

      // Start idle blink animation
      morphMeshes = findMorphMeshes(model);
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
    applyBlendShapes: (map: Record<string, number>) => {
      if (morphMeshes.length === 0) return;

      // Suppress idle blink while tracking provides blend shapes
      if (!blinkSuppressed && stopBlink) {
        stopBlink();
        stopBlink = null;
        blinkSuppressed = true;
      }

      for (const [name, value] of Object.entries(map)) {
        setBlendShape(morphMeshes, name, value);
      }
    },
    resumeIdleBlink: () => {
      if (blinkSuppressed && morphMeshes.length > 0) {
        stopBlink = startBlinkLoop(morphMeshes);
        blinkSuppressed = false;
      }
    },
  };
}
