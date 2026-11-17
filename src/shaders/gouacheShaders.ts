import * as THREE from 'three';

const GLSL_NOISE_COMMON = /* glsl */ `
float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float noise3D(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);

  return mix(
    mix(
      mix(hash31(i + vec3(0.0, 0.0, 0.0)), hash31(i + vec3(1.0, 0.0, 0.0)), f.x),
      mix(hash31(i + vec3(0.0, 1.0, 0.0)), hash31(i + vec3(1.0, 1.0, 0.0)), f.x),
      f.y
    ),
    mix(
      mix(hash31(i + vec3(0.0, 0.0, 1.0)), hash31(i + vec3(1.0, 0.0, 1.0)), f.x),
      mix(hash31(i + vec3(0.0, 1.0, 1.0)), hash31(i + vec3(1.0, 1.0, 1.0)), f.x),
      f.y
    ),
    f.z
  );
}

float brushFbm(vec3 p) {
  float v = 0.0;
  float a = 0.52;
  vec3 q = p;
  for (int i = 0; i < 3; i++) {
    v += a * noise3D(q);
    q = q * 2.07 + vec3(1.7, 9.2, 4.3);
    a *= 0.48;
  }
  return v;
}
`;

export interface GouacheMaterialOptions {
  color: string;
  shadowColor: string;
  rimColor?: string;
  accentColor?: string;
  brushScale?: number;
  rimStrength?: number;
  emissive?: number;
  opacity?: number;
  alphaTest?: number;
  swayAmp?: number;
  swayFreq?: number;
  patternType?: number; // 0: none, 1: candy stripes, 2: spots, 3: vertical gradient, 4: volleyball panels
  map?: THREE.Texture | null;
  side?: THREE.Side;
  transparent?: boolean;
  depthWrite?: boolean;
}

export function createGouacheMaterial(opts: GouacheMaterialOptions): THREE.ShaderMaterial {
  const {
    color,
    shadowColor,
    rimColor = '#fffdf8',
    accentColor = '#ffffff',
    brushScale = 3.1,
    rimStrength = 0.34,
    emissive = 0.06,
    opacity = 1.0,
    alphaTest = 0.0,
    swayAmp = 0.0,
    swayFreq = 1.4,
    patternType = 0,
    map = null,
    side = THREE.FrontSide,
    transparent = opacity < 0.999,
    depthWrite = opacity >= 0.98,
  } = opts;

  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uShadowColor: { value: new THREE.Color(shadowColor) },
      uRimColor: { value: new THREE.Color(rimColor) },
      uAccentColor: { value: new THREE.Color(accentColor) },
      uLightDir: { value: new THREE.Vector3(0.48, 0.86, 0.46).normalize() },
      uTime: { value: 0 },
      uBrushScale: { value: brushScale },
      uRimStrength: { value: rimStrength },
      uEmissive: { value: emissive },
      uOpacity: { value: opacity },
      uAlphaTest: { value: alphaTest },
      uSwayAmp: { value: swayAmp },
      uSwayFreq: { value: swayFreq },
      uPatternType: { value: patternType },
      uMap: { value: map },
      uHasMap: { value: map ? 1.0 : 0.0 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uSwayAmp;
      uniform float uSwayFreq;

      varying vec3 vNormalWorld;
      varying vec3 vWorldPos;
      varying vec3 vLocalPos;
      varying vec2 vUv;

      void main() {
        vUv = uv;
        vLocalPos = position;
        vec3 pos = position;

        if (uSwayAmp > 0.0001) {
          float h = clamp(position.y * 0.55 + 0.5, 0.0, 1.5);
          pos.x += sin(uTime * uSwayFreq + position.y * 2.4 + position.z * 1.1) * uSwayAmp * h;
          pos.z += cos(uTime * uSwayFreq * 0.8 + position.y * 2.1) * uSwayAmp * 0.65 * h;
        }

        vec4 worldPos = modelMatrix * vec4(pos, 1.0);
        vWorldPos = worldPos.xyz;
        vNormalWorld = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform vec3 uShadowColor;
      uniform vec3 uRimColor;
      uniform vec3 uAccentColor;
      uniform vec3 uLightDir;
      uniform float uTime;
      uniform float uBrushScale;
      uniform float uRimStrength;
      uniform float uEmissive;
      uniform float uOpacity;
      uniform float uAlphaTest;
      uniform float uPatternType;
      uniform sampler2D uMap;
      uniform float uHasMap;

      varying vec3 vNormalWorld;
      varying vec3 vWorldPos;
      varying vec3 vLocalPos;
      varying vec2 vUv;

      ${GLSL_NOISE_COMMON}

      void main() {
        vec3 N = normalize(vNormalWorld);
        if (!gl_FrontFacing) N = -N;
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uLightDir);

        vec3 brushCoord = vWorldPos * uBrushScale * vec3(1.0, 1.28, 1.0);
        float brush = brushFbm(brushCoord + vec3(0.0, 0.0, 0.15));
        float fineTooth = noise3D(vWorldPos * uBrushScale * 6.8);

        float ndotl = dot(N, L);
        float wrap = clamp(ndotl * 0.48 + 0.60 + (brush - 0.5) * 0.2, 0.0, 1.0);
        float paintedTone = smoothstep(0.06, 0.92, wrap);

        vec3 baseCol = uColor;
        vec3 shadowCol = uShadowColor;
        float texAlpha = 1.0;

        if (uHasMap > 0.5) {
          vec4 texel = texture2D(uMap, vUv);
          if (texel.a < uAlphaTest) discard;
          baseCol = texel.rgb * uColor;
          shadowCol = mix(uShadowColor * texel.rgb, texel.rgb * 0.86, 0.52);
          texAlpha = texel.a;
        } else if (uPatternType > 0.5 && uPatternType < 1.5) {
          float band = smoothstep(0.42, 0.58, abs(sin((vLocalPos.x + vLocalPos.y) * 14.0 + brush * 0.9)));
          baseCol = mix(uColor, uAccentColor, band * 0.88);
        } else if (uPatternType >= 1.5 && uPatternType < 2.5) {
          float spot = smoothstep(0.62, 0.74, noise3D(vLocalPos * 8.0 + 2.1));
          baseCol = mix(uColor, uAccentColor, spot * 0.85);
        } else if (uPatternType >= 2.5 && uPatternType < 3.5) {
          float grad = smoothstep(-0.3, 0.4, vLocalPos.y + (brush - 0.5) * 0.15);
          baseCol = mix(uAccentColor, uColor, grad);
        } else if (uPatternType >= 3.5) {
          // Festive 18-panel volleyball weave in red, green, gold & snowy white
          float a = atan(vLocalPos.z, vLocalPos.x);
          float panel = floor(mod((a / 3.1415926) * 3.0 + 3.0, 3.0));
          float stripe = abs(sin(vLocalPos.y * 9.5 + panel * 1.05));
          vec3 pCol = panel < 0.5 ? vec3(0.84, 0.18, 0.23)
            : (panel < 1.5 ? vec3(0.16, 0.52, 0.34) : vec3(0.94, 0.76, 0.26));
          float seam = smoothstep(0.08, 0.16, abs(sin(vLocalPos.y * 9.5 + panel * 1.05)));
          baseCol = mix(vec3(0.98, 0.97, 0.94), mix(uColor, pCol, step(0.45, stripe)), seam);
        }

        vec3 shaded = mix(shadowCol, baseCol, paintedTone);
        float lightSpeck = smoothstep(0.84, 0.96, noise3D(vWorldPos * uBrushScale * 15.0 + vec3(4.2, 9.1, 2.7)));
        shaded += (brush - 0.5) * 0.055 + (fineTooth - 0.5) * 0.045 + vec3(0.05) * lightSpeck;

        float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.35);
        float rimBrush = smoothstep(0.28, 0.88, brush + 0.25);
        shaded = mix(shaded, uRimColor, clamp(fresnel * uRimStrength * (0.7 + 0.5 * rimBrush), 0.0, 0.85));

        float spec = pow(max(dot(reflect(-L, N), V), 0.0), 10.0);
        shaded += uRimColor * spec * 0.14 * (0.65 + 0.5 * brush);

        shaded += baseCol * uEmissive * (0.45 + 0.55 * (1.0 - paintedTone * 0.3));

        gl_FragColor = vec4(shaded, uOpacity * texAlpha);
      }
    `,
    side,
    transparent,
    depthWrite,
  });
}

export function createBackdropMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTopColor: { value: new THREE.Color('#9ec4ea') },
      uMidColor: { value: new THREE.Color('#cbe3fa') },
      uBottomColor: { value: new THREE.Color('#f2f7fd') },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.9999, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTopColor;
      uniform vec3 uMidColor;
      uniform vec3 uBottomColor;
      uniform float uTime;
      varying vec2 vUv;

      ${GLSL_NOISE_COMMON}

      void main() {
        float diag = clamp(vUv.y * 0.74 + vUv.x * 0.26, 0.0, 1.0);
        float cloud = brushFbm(vec3(vUv * 3.6 + vec2(uTime * 0.012, -uTime * 0.008), 0.5));
        float t = clamp(diag + (cloud - 0.5) * 0.22, 0.0, 1.0);

        vec3 col = t < 0.5
          ? mix(uBottomColor, uMidColor, smoothstep(0.0, 0.5, t))
          : mix(uMidColor, uTopColor, smoothstep(0.5, 1.0, t));

        float centerDist = length((vUv - vec2(0.5, 0.5)) * vec2(1.18, 1.0));
        col += (1.0 - smoothstep(0.0, 0.7, centerDist)) * 0.055;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
  });
}
