import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export interface TrackingResult {
  yawDeg: number;
  pitchDeg: number;
  blendShapes: Record<string, number>;
}

export type TrackingCallback = (result: TrackingResult) => void;

const SMOOTHING_ALPHA = 0.3;
const RAD2DEG = 180 / Math.PI;

export class FaceTracker {
  private video: HTMLVideoElement;
  private onResult: TrackingCallback;
  private landmarker: FaceLandmarker | null = null;
  private running = false;
  private rafId = 0;
  private smoothedYaw = 0;
  private smoothedPitch = 0;
  private lastTimestamp = -1;

  constructor(video: HTMLVideoElement, onResult: TrackingCallback) {
    this.video = video;
    this.onResult = onResult;
  }

  async init(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
    );
    this.landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      outputFacialTransformationMatrixes: true,
      outputFaceBlendshapes: true,
      numFaces: 1,
    });
  }

  async start(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } },
    });
    this.video.srcObject = stream;
    await this.video.play();
    this.running = true;
    this.smoothedYaw = 0;
    this.smoothedPitch = 0;
    this.lastTimestamp = -1;
    this.detect();
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    const stream = this.video.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    this.video.srcObject = null;
  }

  dispose(): void {
    this.stop();
    this.landmarker?.close();
    this.landmarker = null;
  }

  private detect = (): void => {
    if (!this.running || !this.landmarker) return;

    const now = performance.now();
    // Throttle to ~30fps
    if (now - this.lastTimestamp < 30) {
      this.rafId = requestAnimationFrame(this.detect);
      return;
    }

    if (this.video.readyState >= 2) {
      const result = this.landmarker.detectForVideo(this.video, now);
      this.lastTimestamp = now;

      if (result.facialTransformationMatrixes?.length) {
        const m = result.facialTransformationMatrixes[0].data;
        // Extract yaw and pitch from 4x4 row-major transformation matrix
        const rawYaw = Math.atan2(m[8], m[10]) * RAD2DEG;
        const rawPitch = Math.asin(Math.max(-1, Math.min(1, -m[9]))) * RAD2DEG;

        this.smoothedYaw = SMOOTHING_ALPHA * rawYaw + (1 - SMOOTHING_ALPHA) * this.smoothedYaw;
        this.smoothedPitch = SMOOTHING_ALPHA * rawPitch + (1 - SMOOTHING_ALPHA) * this.smoothedPitch;

        // Extract blend shapes into a name→value map
        const blendShapes: Record<string, number> = {};
        const categories = result.faceBlendshapes?.[0]?.categories;
        if (categories) {
          for (const cat of categories) {
            blendShapes[cat.categoryName] = cat.score;
          }
        }

        this.onResult({
          yawDeg: this.smoothedYaw,
          pitchDeg: this.smoothedPitch,
          blendShapes,
        });
      }
    }

    this.rafId = requestAnimationFrame(this.detect);
  };
}
