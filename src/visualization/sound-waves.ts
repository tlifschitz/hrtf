import * as THREE from 'three';

const PERIOD = 3; // seconds for one ring to travel source → head
const N = 4;        // number of rings

export class SoundWaveAnimation {
  readonly group: THREE.Group;
  private rings: THREE.Mesh[];
  private playing = false;
  private startTime = 0;
  private draining = false;
  private drainTime = 0;
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
    if (playing) {
      this.playing = true;
      this.draining = false;
      this.startTime = performance.now() / 1000;
    } else if (this.playing) {
      // Enter drain mode: stop spawning new rings, let active ones finish
      this.playing = false;
      this.draining = true;
      this.drainTime = performance.now() / 1000;
    }
  }

  setSourcePosition(pos: THREE.Vector3): void {
    this.sourcePos.copy(pos);
  }

  update(): void {
    if (!this.playing && !this.draining) return;

    const now = performance.now() / 1000;
    const elapsed = now - this.startTime;
    const dir = new THREE.Vector3().subVectors(this.origin, this.sourcePos).normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      dir,
    );

    let allDrained = true;

    for (let i = 0; i < N; i++) {
      const ring = this.rings[i];

      // Staggered spawn: ring i departs from source after i/N of a period
      const spawnTime = (i / N) * PERIOD;
      if (elapsed < spawnTime) {
        ring.visible = false;
        (ring.material as THREE.MeshBasicMaterial).opacity = 0;
        // Unspawned rings count as drained — don't block drain completion
        continue;
      }

      // Phase measured from this ring's own spawn time so it always starts at 0
      const phase = ((elapsed - spawnTime) / PERIOD) % 1;

      // During drain: let each ring finish its current journey, then hide
      if (this.draining) {
        const drainElapsed = now - this.drainTime;
        const elapsedAtDrain = this.drainTime - this.startTime;
        const phaseAtDrain = ((elapsedAtDrain - spawnTime) / PERIOD) % 1;
        const timeToFinish = (1 - phaseAtDrain) * PERIOD;

        if (drainElapsed > timeToFinish) {
          ring.visible = false;
          (ring.material as THREE.MeshBasicMaterial).opacity = 0;
          continue;
        }
        allDrained = false;
      }

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

    // All rings have reached the head — drain complete
    if (this.draining && allDrained) {
      this.draining = false;
    }
  }
}
