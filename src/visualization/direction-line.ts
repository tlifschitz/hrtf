import * as THREE from 'three';

export function buildDirectionLine(): THREE.Line {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array([0, 0, 0, 0, 0, 1]);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.LineBasicMaterial({
    color: 0x00d4ff,
    transparent: true,
    opacity: 0.6,
  });

  return new THREE.Line(geometry, material);
}

export function updateDirectionLine(line: THREE.Line, target: THREE.Vector3): void {
  const pos = line.geometry.attributes.position as THREE.BufferAttribute;
  pos.setXYZ(1, target.x, target.y, target.z);
  pos.needsUpdate = true;
}
