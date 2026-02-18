import * as THREE from 'three';
import { loadHeadModel, type HeadModelApi } from './head-model.ts';
import { buildSourceSphere } from './source-model.ts';
import { SoundWaveAnimation } from './sound-waves.ts';
import { buildFloorGrid } from './floor-grid.ts';

const ORBIT_RADIUS = 2.0;
const DEG2RAD = Math.PI / 180;

function sphericalToCartesian(azimuthDeg: number, elevationDeg: number, radius: number): THREE.Vector3 {
  const az = azimuthDeg * DEG2RAD;
  const el = elevationDeg * DEG2RAD;
  return new THREE.Vector3(
    -radius * Math.sin(az) * Math.cos(el),
    radius * Math.sin(el),
    radius * Math.cos(az) * Math.cos(el),
  );
}

export class SceneManager {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private source: THREE.Group;
  private soundWaves: SoundWaveAnimation;
  private head: THREE.Group;
  private animationId: number = 0;
  private resizeObserver: ResizeObserver;
  private headAnim: HeadModelApi;

  constructor(container: HTMLElement) {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    // Camera — 3/4 elevated view
    this.camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
    this.camera.position.set(0, 3, -5);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.localClippingEnabled = true;
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    // Lights
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 5, -5);
    this.scene.add(dirLight);

    // Objects
    this.head = new THREE.Group();
    this.headAnim = loadHeadModel(this.head);
    this.scene.add(this.head);

    this.source = buildSourceSphere();
    this.scene.add(this.source);

    this.soundWaves = new SoundWaveAnimation();
    this.scene.add(this.soundWaves.group);

    this.scene.add(buildFloorGrid());

    // Resize
    this.resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
    this.resizeObserver.observe(container);

    // Render loop
    const animate = () => {
      this.animationId = requestAnimationFrame(animate);
      this.soundWaves.update();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  setSourcePosition(azimuthDeg: number, elevationDeg: number): void {
    const pos = sphericalToCartesian(azimuthDeg, elevationDeg, ORBIT_RADIUS);
    this.source.position.copy(pos);
    this.soundWaves.setSourcePosition(pos);
  }

  setPlaying(playing: boolean): void {
    this.soundWaves.setPlaying(playing);
  }

  setHeadRotation(yawDeg: number, pitchDeg: number = 0): void {
    this.head.rotation.y = yawDeg * DEG2RAD;
    this.head.rotation.x = pitchDeg * DEG2RAD;
  }

  setBlendShapes(map: Record<string, number>): void {
    this.headAnim.applyBlendShapes(map);
  }

  resumeIdleBlink(): void {
    this.headAnim.resumeIdleBlink();
  }

  dispose(): void {
    this.headAnim.stop();
    cancelAnimationFrame(this.animationId);
    this.resizeObserver.disconnect();
    this.renderer.dispose();
  }
}
