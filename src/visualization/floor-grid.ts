import * as THREE from 'three';

export function buildFloorGrid(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(200, 200);

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {},
    vertexShader: /* glsl */`
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vWorldPos;
      void main() {
        // Anti-aliased grid lines (1-unit spacing)
        vec2 coord = vWorldPos.xz;
        vec2 d = fwidth(coord);
        vec2 grid = abs(fract(coord - 0.5) - 0.5) / d;
        float line = min(grid.x, grid.y);
        float gridAlpha = 1.0 - clamp(line, 0.0, 1.0);

        // Radial fade — hides the hard edge of the plane
        float dist = length(vWorldPos.xz);
        float fade = 1.0 - smoothstep(5.0, 13.0, dist);

        vec3 lineColor = vec3(0.20, 0.22, 0.40);
        gl_FragColor = vec4(lineColor, gridAlpha * fade * 0.55);
      }
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;  // lay flat on XZ plane
  mesh.position.y = -1.0;          // below the head (origin) and source sphere
  return mesh;
}
