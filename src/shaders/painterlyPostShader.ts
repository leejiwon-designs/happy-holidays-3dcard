import * as THREE from 'three';

// Full-screen Painterly Gouache & Stipple Paper-Tooth Post-Process Shader
export const PainterlyPostShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1440, 900) },
    uTime: { value: 0 },
    uBioluminescent: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform float uBioluminescent;
    varying vec2 vUv;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise2D(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash21(i);
      float b = hash21(i + vec2(1.0, 0.0));
      float c = hash21(i + vec2(0.0, 1.0));
      float d = hash21(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    float fbm2D(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 3; i++) {
        v += a * noise2D(p);
        p = p * 2.04 + vec2(13.4, 7.8);
        a *= 0.5;
      }
      return v;
    }

    float luma(vec3 c) {
      return dot(c, vec3(0.299, 0.587, 0.114));
    }

    void main() {
      vec2 texel = 1.0 / max(uResolution, vec2(1.0));

      float strokeField = fbm2D(vUv * vec2(26.0, 22.0));
      float angle = strokeField * 6.28318 + 0.65;
      vec2 brushDir = vec2(cos(angle), sin(angle));
      vec2 perpDir = vec2(-brushDir.y, brushDir.x);

      float jitterAmt = (noise2D(vUv * uResolution * 0.22) - 0.5) * 1.35;
      vec2 baseUv = clamp(vUv + brushDir * texel * jitterAmt, 0.001, 0.999);

      vec3 c0 = texture2D(tDiffuse, baseUv).rgb;
      vec3 c1 = texture2D(tDiffuse, clamp(baseUv + brushDir * texel * 1.75, 0.001, 0.999)).rgb;
      vec3 c2 = texture2D(tDiffuse, clamp(baseUv - brushDir * texel * 1.75, 0.001, 0.999)).rgb;
      vec3 c3 = texture2D(tDiffuse, clamp(baseUv + perpDir * texel * 1.08, 0.001, 0.999)).rgb;
      vec3 c4 = texture2D(tDiffuse, clamp(baseUv - perpDir * texel * 1.08, 0.001, 0.999)).rgb;

      float l0 = luma(c0);
      float w1 = exp(-abs(luma(c1) - l0) * 12.0);
      float w2 = exp(-abs(luma(c2) - l0) * 12.0);
      float w3 = exp(-abs(luma(c3) - l0) * 15.0) * 0.55;
      float w4 = exp(-abs(luma(c4) - l0) * 15.0) * 0.55;

      vec3 painted = (c0 + c1 * w1 + c2 * w2 + c3 * w3 + c4 * w4) / (1.0 + w1 + w2 + w3 + w4);

      vec3 brightAvg = max(vec3(0.0), (c1 + c2 + c3 + c4) * 0.25 - 0.74);
      painted += brightAvg * mix(0.24, 0.46, uBioluminescent);

      // Tactile paper-tooth stipple grain, mineral granulation & cold-press cream-white speckles
      vec2 px = vUv * uResolution;
      float paperTooth = noise2D(px * 0.44) - 0.5;
      float fineStipple = hash21(floor(px)) - 0.5;
      float pigmentCluster = fbm2D(px * 0.14) - 0.5;
      float midtoneMask = 1.0 - abs(l0 - 0.52) * 0.85;
      float grainStrength = mix(0.068, 0.078, uBioluminescent);
      float grainSample = fineStipple * 0.52 + paperTooth * 0.34 + pigmentCluster * 0.14;

      painted += grainSample * grainStrength * clamp(midtoneMask + 0.52, 0.62, 1.12);

      float whiteSpeckFine = step(0.992, hash21(floor(px * 0.78) + vec2(37.1, 91.7)));
      float whiteSpeckSoft = smoothstep(0.994, 0.9995, hash21(floor(px * 0.38) + vec2(11.3, 53.9)));
      float speckVisibility = mix(0.55, 1.0, 1.0 - l0 * 0.35);
      float speckAmt = (whiteSpeckFine * 0.14 + whiteSpeckSoft * 0.22) * speckVisibility;
      painted = mix(painted, vec3(0.99, 0.988, 1.0), speckAmt);

      float vig = smoothstep(0.96, 0.38, length(vUv - 0.5));
      painted = mix(painted * 0.94, painted, vig);

      gl_FragColor = vec4(clamp(painted, 0.0, 1.0), 1.0);
    }
  `,
};
