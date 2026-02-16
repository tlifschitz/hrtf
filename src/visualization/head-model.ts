import * as THREE from 'three';

export function buildHeadGroup(): THREE.Group {
  const head = new THREE.Group();

  // Head ellipsoid
  const headGeo = new THREE.SphereGeometry(0.5, 32, 32);
  const headMat = new THREE.MeshStandardMaterial({
    color: 0x4a6fa5,
    transparent: true,
    opacity: 0.7,
  });
  const headMesh = new THREE.Mesh(headGeo, headMat);
  headMesh.scale.set(0.8, 1.0, 0.85);
  head.add(headMesh);

  // Nose cone — shows facing direction (+Z)
  const noseGeo = new THREE.ConeGeometry(0.08, 0.2, 8);
  const noseMat = new THREE.MeshStandardMaterial({ color: 0x6a8fc5 });
  const noseMesh = new THREE.Mesh(noseGeo, noseMat);
  noseMesh.rotation.x = -Math.PI / 2;
  noseMesh.position.set(0, 0, 0.5);
  head.add(noseMesh);

  // Ear spheres
  const earGeo = new THREE.SphereGeometry(0.08, 12, 12);
  const earMat = new THREE.MeshStandardMaterial({ color: 0x00d4ff });

  const leftEar = new THREE.Mesh(earGeo, earMat);
  leftEar.position.set(-0.42, 0, 0);
  head.add(leftEar);

  const rightEar = new THREE.Mesh(earGeo, earMat);
  rightEar.position.set(0.42, 0, 0);
  head.add(rightEar);

  return head;
}
