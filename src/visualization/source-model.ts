import * as THREE from 'three';

export function buildSourceSphere(): THREE.Group {
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

  return group;
}
