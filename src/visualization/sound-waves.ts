import * as THREE from 'three';

const PERIOD = 1.5; // seconds for one ring to travel source → head
const N = 4;        // number of rings

export class SoundWaveAnimation {
  readonly group: THREE.Group;
  private rings: THREE.Mesh[];
  private playing = false;
  private startTime = 0;
  private sourcePos = new THREE.Vector3(0, 0, 2);
  private readonly origin = new THREE.Vector3(0, 0, 0);

  constructor() {
    this.group = new THREE.Group();
    this.rings = [];

    const geometry = new THREE.RingGeometry(0.08, 0.14, 40);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < N; i++) {
      const mesh = new THREE.Mesh(geometry, material.clone());
      mesh.visible = false;
      this.group.add(mesh);
      this.rings.push(mesh);
    }
  }

  setPlaying(playing: boolean): void {
    this.playing = playing;
    if (playing) {
      this.startTime = performance.now() / 1000;
    } else {
      for (const ring of this.rings) {
        ring.visible = false;
        (ring.material as THREE.MeshBasicMaterial).opacity = 0;
      }
    }
  }

  setSourcePosition(pos: THREE.Vector3): void {
    this.sourcePos.copy(pos);
  }

  update(): void {
    if (!this.playing) return;

    const elapsed = performance.now() / 1000 - this.startTime;
    const dir = new THREE.Vector3().subVectors(this.origin, this.sourcePos).normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      dir,
    );

    for (let i = 0; i < N; i++) {
      const ring = this.rings[i];
      const phase = ((elapsed / PERIOD + i / N) % 1 + 1) % 1; // [0, 1)

      ring.visible = true;
      ring.position.lerpVectors(this.sourcePos, this.origin, phase);
      ring.quaternion.copy(quaternion);

      // Scale: 0.4 at birth → 1.4 at death
      const scale = 0.4 + phase * 1.0;
      ring.scale.setScalar(scale);

      // Opacity: sine envelope, peak ~0.65 mid-journey
      const opacity = 0.65 * Math.sin(phase * Math.PI);
      (ring.material as THREE.MeshBasicMaterial).opacity = opacity;
    }
  }
}
