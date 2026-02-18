import * as THREE from 'three';

export interface SourceSphereApi {
  group: THREE.Group;
  setHovered(active: boolean): void;
  setDragging(active: boolean): void;
}

export function buildSourceSphere(): SourceSphereApi {
  const group = new THREE.Group();

  // Core sphere
  const coreGeo = new THREE.SphereGeometry(0.15, 16, 16);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x00d4ff,
    emissive: 0x00d4ff,
    emissiveIntensity: 0.5,
  });
  group.add(new THREE.Mesh(coreGeo, coreMat));

  // Glow sphere
  const glowGeo = new THREE.SphereGeometry(0.22, 16, 16);
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0x00d4ff,
    transparent: true,
    opacity: 0.15,
  });
  group.add(new THREE.Mesh(glowGeo, glowMat));

  return {
    group,
    setHovered(active: boolean): void {
      coreMat.emissiveIntensity = active ? 1.2 : 0.5;
    },
    setDragging(active: boolean): void {
      coreMat.emissiveIntensity = active ? 0.8 : 0.5;
      glowMat.opacity = active ? 0 : 0.15;
    },
  };
}
