import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { ORNAMENT_CATALOG } from '../scene/ornamentCatalog';
import { createOrnamentMesh } from '../scene/ornaments3d';
import { buildHolidayTree } from '../scene/treeBuilder';
import { createBackdropMaterial, createGouacheMaterial } from '../shaders/gouacheShaders';
import { PainterlyPostShader } from '../shaders/painterlyPostShader';

interface LoadingOverlayProps {
  fontsLoaded: boolean;
  sceneRendered: boolean;
  onComplete: () => void;
}

function renderGouacheTreeStudyDataUrl(): string | null {
  try {
    const size = 520;
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setSize(size, size, false);
    renderer.setPixelRatio(1);
    renderer.toneMapping = THREE.NoToneMapping;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 30);
    camera.position.set(0.32, 1.92, 5.15);
    camera.lookAt(0, 1.24, 0);

    // Clip-space gouache winter sky backdrop (must use PlaneGeometry(2, 2), matching CardEngine!)
    const backdropMat = createBackdropMaterial();
    backdropMat.uniforms.uTopColor.value.set('#4c7ec2');
    backdropMat.uniforms.uMidColor.value.set('#8db8e5');
    backdropMat.uniforms.uBottomColor.value.set('#dcebf8');
    const bgQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), backdropMat);
    bgQuad.frustumCulled = false;
    bgQuad.renderOrder = -1000;
    scene.add(bgQuad);

    const snowGroundMat = createGouacheMaterial({
      color: '#ffffff',
      shadowColor: '#d4e2f0',
      rimColor: '#ffffff',
      emissive: 0.22,
    });
    const snowMound = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 0.25, 28), snowGroundMat);
    snowMound.position.set(0, -0.05, 0);
    scene.add(snowMound);

    const ambient = new THREE.AmbientLight('#f0f5fc', 1.32);
    scene.add(ambient);
    const keyLight = new THREE.DirectionalLight('#fff2da', 1.45);
    keyLight.position.set(4, 7, 5);
    scene.add(keyLight);

    // Real 3D stepped 7-tier sliceform paper tree
    const tree = buildHolidayTree();
    // Hide perch rings cleanly in the loading portrait
    tree.slotMarkers.forEach((m) => {
      m.visible = false;
    });
    scene.add(tree.group);

    // Randomly pick 11 ornaments from all 24 in ORNAMENT_CATALOG onto visible front perches
    const frontPerches = [3, 4, 5, 12, 13, 19, 20, 21, 26, 27, 31, 32, 34];
    const shuffled = [...ORNAMENT_CATALOG];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    frontPerches.slice(0, 11).forEach((slotIdx, i) => {
      const slot = tree.slots[slotIdx];
      if (!slot) return;
      const mesh = createOrnamentMesh(shuffled[i].id);
      mesh.position.set(...slot.position);
      mesh.rotation.y = slot.outwardAngle;
      mesh.scale.setScalar(1.06);
      tree.group.add(mesh);
    });

    // Crisp floating snowy gouache flakes around the tree
    const flakeMat = createGouacheMaterial({ color: '#ffffff', shadowColor: '#e2eef8', emissive: 0.42 });
    [
      [-1.35, 2.35, 0.4],
      [-1.05, 1.15, 0.7],
      [1.22, 2.25, 0.3],
      [1.38, 1.35, 0.6],
      [-0.78, 2.75, -0.2],
      [0.85, 2.65, 0.1],
      [-1.52, 0.45, 0.5],
      [1.48, 0.55, 0.8],
    ].forEach(([fx, fy, fz], idx) => {
      const flake = new THREE.Mesh(
        new THREE.SphereGeometry(0.042 + (idx % 3) * 0.012, 8, 8),
        flakeMat
      );
      flake.position.set(fx, fy, fz);
      scene.add(flake);
    });

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const postPass = new ShaderPass(PainterlyPostShader);
    postPass.uniforms.uResolution.value.set(size, size);
    postPass.uniforms.uTime.value = 0.6;
    composer.addPass(postPass);

    composer.render();
    const dataUrl = renderer.domElement.toDataURL('image/png');

    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
    composer.dispose();
    renderer.dispose();
    return dataUrl;
  } catch (err) {
    console.error('Failed to render 3D loading tree study:', err);
    return null;
  }
}

export function LoadingOverlay({
  fontsLoaded,
  sceneRendered,
  onComplete,
}: LoadingOverlayProps) {
  const [studyUrl, setStudyUrl] = useState<string | null>(null);
  const [reveal, setReveal] = useState(0.04);
  const [leaving, setLeaving] = useState(false);

  const revealRef = useRef(0.04);
  const targetRef = useRef(0.34);
  const startTimeRef = useRef(performance.now());
  const finishedRef = useRef(false);

  useEffect(() => {
    const url = renderGouacheTreeStudyDataUrl();
    setStudyUrl(url);
  }, []);

  useEffect(() => {
    let target = 0.36;
    if (fontsLoaded) target = Math.max(target, 0.68);
    if (fontsLoaded && sceneRendered) target = 1.0;
    targetRef.current = target;
  }, [fontsLoaded, sceneRendered]);

  useEffect(() => {
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      revealRef.current = 1;
      setReveal(1);
    }

    let rafId = 0;
    let lastMs = performance.now();

    const tick = (nowMs: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (nowMs - lastMs) * 0.001));
      lastMs = nowMs;

      const elapsedMs = nowMs - startTimeRef.current;
      // Mandatory smooth ~2.3s watercolor sweep + brief full-image hold so every visitor enjoys the reveal
      const showcaseDurationMs = 2300;
      const elapsedFrac = Math.min(1.0, elapsedMs / showcaseDurationMs);
      const easedShowcase =
        elapsedFrac < 0.5
          ? 2 * elapsedFrac * elapsedFrac
          : 1 - Math.pow(-2 * elapsedFrac + 2, 2) / 2;

      const effectiveTarget = prefersReduced ? 1.0 : Math.min(targetRef.current, easedShowcase);

      revealRef.current += (effectiveTarget - revealRef.current) * (1 - Math.exp(-dt * 12));
      setReveal(revealRef.current);

      if (
        !finishedRef.current &&
        targetRef.current >= 0.999 &&
        revealRef.current >= 0.992 &&
        (prefersReduced || elapsedMs >= 2600)
      ) {
        finishedRef.current = true;
        setReveal(1.0);
        setLeaving(true);
        window.setTimeout(onComplete, prefersReduced ? 180 : 440);
        return;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [onComplete]);

  return (
    <div
      className={`loader-overlay ${leaving ? 'is-leaving' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Painting holiday card"
    >
      <div
        className="loader-study"
        style={{ '--reveal': reveal.toFixed(4) } as React.CSSProperties}
      >
        {studyUrl ? (
          <>
            <img
              src={studyUrl}
              alt=""
              className="loader-layer loader-ghost loader-study-img"
              draggable={false}
            />
            <img
              src={studyUrl}
              alt=""
              className="loader-layer loader-fill loader-study-img"
              draggable={false}
            />
          </>
        ) : (
          <div className="loader-layer loader-fill loader-fallback" />
        )}
        <div className="loader-paper-coat" aria-hidden="true" />
      </div>
    </div>
  );
}
