/*
  GLSL shaders for the particle wave. They run on the GPU, so animating ~10,000 points
  costs almost no JavaScript time: each frame only the `uTime` uniform changes.
*/

/** Height of the wave crests above the grid; used to normalise height into a 0–1 colour mix. */
export const WAVE_AMPLITUDE = 0.95

export const waveVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;

  varying float vHeight;
  varying float vAlpha;

  void main() {
    vec3 p = position;

    // Two sine waves travelling across the grid. 0.63 rad/s ≈ one full cycle every 10 s.
    float t = uTime * 0.63;
    float height = sin(p.x * 0.35 + t) * 0.6
                 + sin(p.z * 0.55 + p.x * 0.12 + t * 0.7) * 0.35;
    p.y = height;

    vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * viewPosition;

    // Perspective: points further away are drawn smaller.
    gl_PointSize = uSize * uPixelRatio / -viewPosition.z;

    vHeight = height / ${WAVE_AMPLITUDE.toFixed(2)} * 0.5 + 0.5;
    // Fade points out with distance so the wave dissolves toward the horizon.
    vAlpha = 1.0 - smoothstep(5.0, 16.0, -viewPosition.z);
  }
`

export const waveFragmentShader = /* glsl */ `
  uniform vec3 uCrest;
  uniform vec3 uTrough;

  varying float vHeight;
  varying float vAlpha;

  void main() {
    // Turn the square point into a soft round dot.
    float distanceToCenter = length(gl_PointCoord - 0.5);
    if (distanceToCenter > 0.5) discard;
    float softEdge = smoothstep(0.5, 0.05, distanceToCenter);

    // smoothstep pushes mid heights apart, so crests read clearly cyan and troughs deep blue.
    vec3 color = mix(uTrough, uCrest, smoothstep(0.25, 0.85, vHeight));
    gl_FragColor = vec4(color, softEdge * vAlpha * 0.9);

    #include <colorspace_fragment>
  }
`
