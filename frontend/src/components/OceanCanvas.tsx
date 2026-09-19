import { useEffect, useRef } from "react";
import * as THREE from "three";

/** 3D animated ocean surface for ORCA landing page.
 *  A vertex-displaced sine-wave mesh with a sonar sweep overlay.
 *  Rendered to a fixed full-screen canvas behind all page content.
 */
export default function OceanCanvas({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // --- Renderer ---
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setClearColor(0x000000, 0);

    // --- Scene & Camera ---
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
    camera.position.set(0, 4.5, 8);
    camera.lookAt(0, 0, 0);

    // --- Ocean mesh ---
    const SEGS = 80;
    const geo = new THREE.PlaneGeometry(20, 20, SEGS, SEGS);
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x003D52),
      wireframe: false,
      transparent: true,
      opacity: 0.55,
      roughness: 0.9,
      metalness: 0.1,
    });

    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);

    // Wireframe overlay
    const wireMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x00A8CC),
      wireframe: true,
      transparent: true,
      opacity: 0.06,
    });
    const wireMesh = new THREE.Mesh(geo.clone(), wireMat);
    scene.add(wireMesh);

    // --- Sonar rings ---
    const RINGS = 4;
    const rings: THREE.Mesh[] = [];
    for (let i = 0; i < RINGS; i++) {
      const ringGeo = new THREE.RingGeometry(0, 0.1, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0x00E5FF),
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      ring.userData.phase = (i / RINGS) * Math.PI * 2;
      scene.add(ring);
      rings.push(ring);
    }

    // --- Floating particles (ocean debris / plankton) ---
    const particleCount = 120;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 18;
      positions[i * 3 + 1] = Math.random() * 0.3;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 18;
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x00C3E8,
      size: 0.05,
      transparent: true,
      opacity: 0.45,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // --- Wooden Boat ---
    const boatGroup = new THREE.Group();

    // Hull — dark worn wood colour matching ocean palette
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x4A2F1A, roughness: 0.95, metalness: 0.0 });
    const hullGeo = new THREE.CylinderGeometry(0.18, 0.28, 0.65, 8, 1, false);
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.scale.set(1, 0.45, 2.2);        // flatten & elongate into boat shape
    hull.position.y = 0.0;
    boatGroup.add(hull);

    // Deck — slightly lighter plank colour
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x5C3A1E, roughness: 0.9, metalness: 0.0 });
    const deckGeo = new THREE.BoxGeometry(0.34, 0.06, 1.3);
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.y = 0.1;
    boatGroup.add(deck);

    // Cabin — small box amidships
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x3B2210, roughness: 0.85, metalness: 0.0 });
    const cabinGeo = new THREE.BoxGeometry(0.22, 0.16, 0.38);
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, 0.21, 0.1);
    boatGroup.add(cabin);

    // Mast
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x2A1A0A, roughness: 0.9 });
    const mastGeo = new THREE.CylinderGeometry(0.018, 0.022, 0.75, 6);
    const mast = new THREE.Mesh(mastGeo, mastMat);
    mast.position.set(0, 0.49, 0.1);
    boatGroup.add(mast);

    // Sail — thin translucent plane, teal tint to match the ocean
    const sailMat = new THREE.MeshStandardMaterial({
      color: 0x00A8CC,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      roughness: 0.7,
    });
    const sailGeo = new THREE.PlaneGeometry(0.32, 0.52);
    const sail = new THREE.Mesh(sailGeo, sailMat);
    sail.position.set(0.16, 0.62, 0.1);
    sail.rotation.y = Math.PI / 2;
    boatGroup.add(sail);

    // Wake — flat ellipse behind the boat
    const wakeMat = new THREE.MeshBasicMaterial({
      color: 0x00C3E8,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
    });
    const wakeGeo = new THREE.PlaneGeometry(0.28, 1.6);
    const wake = new THREE.Mesh(wakeGeo, wakeMat);
    wake.rotation.x = -Math.PI / 2;
    wake.position.set(0, 0.02, -0.9);
    boatGroup.add(wake);

    // Orient boat to sail along the X axis
    boatGroup.rotation.y = Math.PI / 2;
    boatGroup.scale.setScalar(0.9);

    // Start off-screen to the left
    const BOAT_Z = -1.0;   // row in the scene (slightly toward camera)
    const BOAT_START_X = -14;
    const BOAT_END_X   =  14;
    const BOAT_SPEED   =  1.6;  // world-units per second
    boatGroup.position.set(BOAT_START_X, 0, BOAT_Z);
    scene.add(boatGroup);

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0x001A2E, 0.8);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0x00A8CC, 1.5, 30);
    pointLight.position.set(0, 6, 2);
    scene.add(pointLight);

    // Warm fill for the boat
    const boatLight = new THREE.PointLight(0xFFAA44, 0.6, 8);
    scene.add(boatLight);

    // Helper: sample wave height at (x, z, t) — must match animate loop formula
    function waveY(x: number, z: number, t: number) {
      return (
        Math.sin(x * 0.5 + t * 0.8) * 0.22 +
        Math.sin(z * 0.6 + t * 0.6) * 0.18 +
        Math.sin((x + z) * 0.3 + t * 1.1) * 0.12
      );
    }

    // --- Animation ---
    let animId = 0;
    const clock = new THREE.Clock();
    const posArr = geo.attributes.position;
    const origY = new Float32Array(posArr.count);
    for (let i = 0; i < posArr.count; i++) {
      origY[i] = 0; // flat start
    }

    function animate() {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Wave displacement
      for (let i = 0; i < posArr.count; i++) {
        const x = posArr.getX(i);
        const z = posArr.getZ(i);
        const y =
          Math.sin(x * 0.5 + t * 0.8) * 0.22 +
          Math.sin(z * 0.6 + t * 0.6) * 0.18 +
          Math.sin((x + z) * 0.3 + t * 1.1) * 0.12;
        posArr.setY(i, y);
      }
      posArr.needsUpdate = true;
      geo.computeVertexNormals();

      // Sync wireframe
      const wirePos = wireMesh.geometry.attributes.position;
      for (let i = 0; i < posArr.count; i++) {
        wirePos.setY(i, posArr.getY(i));
      }
      wirePos.needsUpdate = true;

      // Sonar rings expand
      rings.forEach((ring) => {
        const phase = ring.userData.phase;
        const cycleT = ((t * 0.4 + phase / (Math.PI * 2)) % 1);
        const scale = cycleT * 12;
        ring.scale.set(scale, scale, scale);
        (ring.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.35 * (1 - cycleT));
      });

      // Drift particles
      const pPos = particles.geometry.attributes.position;
      for (let i = 0; i < particleCount; i++) {
        let px = pPos.getX(i) + 0.005;
        if (px > 9) px = -9;
        pPos.setX(i, px);
      }
      pPos.needsUpdate = true;

      // --- Boat movement ---
      const duration = (BOAT_END_X - BOAT_START_X) / BOAT_SPEED;
      const progress = (t % duration) / duration;
      const boatX = BOAT_START_X + (BOAT_END_X - BOAT_START_X) * progress;
      const boatY = waveY(boatX, BOAT_Z, t);

      // Pitch (fore-aft tilt) based on wave slope
      const slopeX = waveY(boatX + 0.3, BOAT_Z, t) - waveY(boatX - 0.3, BOAT_Z, t);
      const pitch  = Math.atan2(slopeX, 0.6) * 0.5;
      // Roll (side-to-side) based on cross-slope
      const slopeZ = waveY(boatX, BOAT_Z + 0.3, t) - waveY(boatX, BOAT_Z - 0.3, t);
      const roll   = Math.atan2(slopeZ, 0.6) * 0.4;

      boatGroup.position.set(boatX, boatY + 0.12, BOAT_Z);
      boatGroup.rotation.set(pitch, Math.PI / 2, roll);

      // Keep the warm point light near the boat
      boatLight.position.set(boatX, boatY + 1.0, BOAT_Z);

      renderer.render(scene, camera);
    }
    animate();

    // --- Resize ---
    function onResize() {
      if (!canvas) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      renderer.dispose();
      geo.dispose();
      mat.dispose();
      wireMat.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
