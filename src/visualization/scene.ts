import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadHeadModel, type HeadModelApi } from './head-model.ts';
import { buildSourceSphere, type SourceSphereApi } from './source-model.ts';
import { SoundWaveAnimation } from './sound-waves.ts';
import { buildFloorGrid } from './floor-grid.ts';

const ORBIT_RADIUS = 2.0;
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

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
  private sourceApi: SourceSphereApi;
  private soundWaves: SoundWaveAnimation;
  private head: THREE.Group;
  private animationId: number = 0;
  private resizeObserver: ResizeObserver;
  private headAnim: HeadModelApi;
  private controls: OrbitControls;

  private raycaster = new THREE.Raycaster();
  private constraintSphere = new THREE.Sphere(new THREE.Vector3(), ORBIT_RADIUS);
  private isDragging = false;
  private isHovered = false;
  private onSourceDrag: ((az: number, el: number) => void) | null = null;
  private _ndcPoint = new THREE.Vector2();
  private _intersectTarget = new THREE.Vector3();

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

    // Orbit controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 0, 0);
    this.controls.minDistance = 2;
    this.controls.maxDistance = 20;
    this.controls.maxPolarAngle = Math.PI * 0.72;

    // Lights
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 5, -5);
    this.scene.add(dirLight);

    // Objects
    this.head = new THREE.Group();
    this.headAnim = loadHeadModel(this.head);
    this.scene.add(this.head);

    this.sourceApi = buildSourceSphere();
    this.scene.add(this.sourceApi.group);

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
      this.controls.update();
      this.soundWaves.update();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  setSourcePosition(azimuthDeg: number, elevationDeg: number): void {
    const pos = sphericalToCartesian(azimuthDeg, elevationDeg, ORBIT_RADIUS);
    this.sourceApi.group.position.copy(pos);
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

  setOnSourceDrag(cb: (az: number, el: number) => void): void {
    this.onSourceDrag = cb;
    this.attachPointerListeners();
  }

  private pointerToNDC(e: PointerEvent): THREE.Vector2 {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this._ndcPoint.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    return this._ndcPoint;
  }

  private raycastSource(e: PointerEvent): boolean {
    this.raycaster.setFromCamera(this.pointerToNDC(e), this.camera);
    const coreMesh = this.sourceApi.group.children[0] as THREE.Mesh;
    return this.raycaster.intersectObject(coreMesh).length > 0;
  }

  private dragPositionFromEvent(e: PointerEvent): { az: number; el: number } | null {
    this.raycaster.setFromCamera(this.pointerToNDC(e), this.camera);
    const ray = this.raycaster.ray;
    const hit = ray.intersectSphere(this.constraintSphere, this._intersectTarget);
    if (!hit) return null;
    const { x, y, z } = this._intersectTarget;
    const el = Math.asin(y / ORBIT_RADIUS) * RAD2DEG;
    const az = Math.atan2(-x, z) * RAD2DEG;
    return { az, el };
  }

  private onPointerDown = (e: PointerEvent) => {
    if (!this.raycastSource(e)) return;
    e.stopPropagation();
    this.renderer.domElement.setPointerCapture(e.pointerId);
    this.isDragging = true;
    this.controls.enabled = false;
    this.renderer.domElement.style.cursor = 'grabbing';
    this.sourceApi.setHovered(false);
    this.sourceApi.setDragging(true);
    const pos = this.dragPositionFromEvent(e);
    if (pos) this.onSourceDrag?.(pos.az, pos.el);
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.isDragging) {
      const pos = this.dragPositionFromEvent(e);
      if (pos) this.onSourceDrag?.(pos.az, pos.el);
      return;
    }
    const hovered = this.raycastSource(e);
    if (hovered !== this.isHovered) {
      this.isHovered = hovered;
      this.sourceApi.setHovered(hovered);
      this.renderer.domElement.style.cursor = hovered ? 'grab' : '';
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    if (!this.isDragging) return;
    if (this.renderer.domElement.hasPointerCapture(e.pointerId))
      this.renderer.domElement.releasePointerCapture(e.pointerId);
    this.isDragging = false;
    this.controls.enabled = true;
    this.renderer.domElement.style.cursor = '';
    this.sourceApi.setDragging(false);
    this.isHovered = false;
    this.sourceApi.setHovered(false);
  };

  private attachPointerListeners(): void {
    const el = this.renderer.domElement;
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
  }

  dispose(): void {
    this.headAnim.stop();
    cancelAnimationFrame(this.animationId);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    const el = this.renderer.domElement;
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    this.renderer.dispose();
  }
}
