"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

interface PorousLatticeSphereProps {
  className?: string;
  scrollY?: number;
  accentColor?: string; // e.g. '#C7F36B'
}

export function PorousLatticeSphere({
  className = "",
  scrollY = 0,
}: PorousLatticeSphereProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check WebGL support
    try {
      const testCanvas = document.createElement("canvas");
      const gl =
        testCanvas.getContext("webgl") ||
        testCanvas.getContext("experimental-webgl");
      if (!gl) {
        return;
      }
    } catch {
      return;
    }

    const width = container.clientWidth || 640;
    const height = container.clientHeight || 640;

    // Scene
    const scene = new THREE.Scene();

    // Perspective Camera: Calibrated for prominent hero presence with zero text occlusion
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
    camera.position.set(0, 0.02, 7.2);
    camera.lookAt(0, -0.04, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // ----------------------------------------------------
    // Lighting Setup: Soft Photographic Studio Lighting with DEVOS Lime Glow
    // ----------------------------------------------------
    const ambientLight = new THREE.AmbientLight(0xecfaee, 1.1);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
    keyLight.position.set(-3.5, 4.5, 3.8);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xdcf5de, 1.5);
    fillLight.position.set(3.8, 1.5, 3.2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xc7f36b, 2.6); // DEVOS Acid Lime rim
    rimLight.position.set(-0.8, -2.5, -4.5);
    scene.add(rimLight);

    const topRimLight = new THREE.DirectionalLight(0x79d69a, 1.4);
    topRimLight.position.set(2.0, 3.5, -3.0);
    scene.add(topRimLight);

    // ----------------------------------------------------
    // Diffuse Contact Shadow on Dark Floor
    // ----------------------------------------------------
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = 512;
    shadowCanvas.height = 512;
    const sCtx = shadowCanvas.getContext("2d");
    if (sCtx) {
      const grad = sCtx.createRadialGradient(256, 256, 8, 256, 256, 256);
      grad.addColorStop(0, "rgba(10, 16, 12, 0.45)");
      grad.addColorStop(0.3, "rgba(199, 243, 107, 0.08)");
      grad.addColorStop(0.65, "rgba(15, 24, 18, 0.03)");
      grad.addColorStop(1, "rgba(9, 10, 10, 0)");
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 512, 512);
    }
    const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
    const shadowGeo = new THREE.PlaneGeometry(4.2, 4.2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -1.78;
    scene.add(shadowMesh);

    // ----------------------------------------------------
    // Generate Spherical Voronoi Trabecular Lattice (from nssanjeev/ciirc)
    // ----------------------------------------------------
    const N = 360;
    const R = 1.48; // Base mathematical radius
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const seedPoints: THREE.Vector3[] = [];

    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = goldenAngle * i + Math.sin(i * 2.3) * 0.12;
      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;

      seedPoints.push(new THREE.Vector3(x * R, y * R, z * R));
    }

    const convex = new ConvexGeometry(seedPoints);
    const posAttr = convex.attributes.position;
    const faceCount = posAttr.count / 3;

    const roundKey = (v: THREE.Vector3) =>
      `${Math.round(v.x * 600) / 600}_${Math.round(v.y * 600) / 600}_${Math.round(v.z * 600)}`;

    const vertMap = new Map<string, number>();
    const uniqueVerts: THREE.Vector3[] = [];

    const getVertId = (v: THREE.Vector3) => {
      const k = roundKey(v);
      if (vertMap.has(k)) return vertMap.get(k)!;
      const id = uniqueVerts.length;
      uniqueVerts.push(v.clone());
      vertMap.set(k, id);
      return id;
    };

    const faceVertIds: [number, number, number][] = [];
    const voronoiVertices: THREE.Vector3[] = [];

    for (let f = 0; f < faceCount; f++) {
      const pA = new THREE.Vector3().fromBufferAttribute(posAttr, f * 3 + 0);
      const pB = new THREE.Vector3().fromBufferAttribute(posAttr, f * 3 + 1);
      const pC = new THREE.Vector3().fromBufferAttribute(posAttr, f * 3 + 2);

      faceVertIds.push([getVertId(pA), getVertId(pB), getVertId(pC)]);

      const cb = new THREE.Vector3().subVectors(pC, pB);
      const ab = new THREE.Vector3().subVectors(pA, pB);
      const norm = new THREE.Vector3().crossVectors(cb, ab).normalize();
      const center = new THREE.Vector3().add(pA).add(pB).add(pC).divideScalar(3);
      if (norm.dot(center) < 0) norm.negate();

      voronoiVertices.push(norm.clone().multiplyScalar(R));
    }

    const edgeMap = new Map<string, number[]>();
    for (let f = 0; f < faceCount; f++) {
      const ids = faceVertIds[f];
      const triangleEdges = [
        [Math.min(ids[0], ids[1]), Math.max(ids[0], ids[1])],
        [Math.min(ids[1], ids[2]), Math.max(ids[1], ids[2])],
        [Math.min(ids[2], ids[0]), Math.max(ids[2], ids[0])],
      ];
      triangleEdges.forEach(([v1, v2]) => {
        const key = `${v1}_${v2}`;
        if (!edgeMap.has(key)) edgeMap.set(key, []);
        edgeMap.get(key)!.push(f);
      });
    }

    function createFlaredTube(
      curve: THREE.Curve<THREE.Vector3>,
      tubularSegments: number,
      radialSegments: number,
      rMid: number,
      rJunction: number
    ): THREE.BufferGeometry {
      const points = curve.getPoints(tubularSegments);
      const frames = curve.computeFrenetFrames(tubularSegments, false);
      const vertices: number[] = [];
      const normals: number[] = [];
      const indices: number[] = [];

      for (let i = 0; i <= tubularSegments; i++) {
        const t = i / tubularSegments;
        const r =
          rMid + (rJunction - rMid) * Math.pow(2 * Math.abs(t - 0.5), 1.6);
        const p = points[i].clone().normalize().multiplyScalar(R);
        const N = frames.normals[i];
        const B = frames.binormals[i];

        for (let j = 0; j <= radialSegments; j++) {
          const v = (j / radialSegments) * Math.PI * 2;
          const cx = -Math.cos(v);
          const cy = Math.sin(v);
          const normal = new THREE.Vector3()
            .addScaledVector(N, cx)
            .addScaledVector(B, cy)
            .normalize();

          normals.push(normal.x, normal.y, normal.z);
          vertices.push(
            p.x + normal.x * r,
            p.y + normal.y * r,
            p.z + normal.z * r
          );
        }
      }

      for (let i = 0; i < tubularSegments; i++) {
        for (let j = 0; j < radialSegments; j++) {
          const a = i * (radialSegments + 1) + j;
          const b = (i + 1) * (radialSegments + 1) + j;
          const c = (i + 1) * (radialSegments + 1) + (j + 1);
          const d = i * (radialSegments + 1) + (j + 1);
          indices.push(a, b, d);
          indices.push(b, c, d);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(vertices, 3)
      );
      geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
      geo.setIndex(indices);
      return geo;
    }

    const rMid = 0.015;
    const rJunction = 0.033;
    const subGeometries: THREE.BufferGeometry[] = [];

    const sphereProto = new THREE.SphereGeometry(rJunction * 0.95, 6, 6);
    sphereProto.deleteAttribute("uv");

    for (let i = 0; i < voronoiVertices.length; i++) {
      const g = sphereProto.clone();
      g.translate(
        voronoiVertices[i].x,
        voronoiVertices[i].y,
        voronoiVertices[i].z
      );
      subGeometries.push(g);
    }

    edgeMap.forEach((faces) => {
      if (faces.length === 2) {
        const v1 = voronoiVertices[faces[0]];
        const v2 = voronoiVertices[faces[1]];
        if (!v1 || !v2) return;

        const mid = new THREE.Vector3()
          .addVectors(v1, v2)
          .normalize()
          .multiplyScalar(R);
        const curve = new THREE.CatmullRomCurve3([v1, mid, v2]);
        const tube = createFlaredTube(curve, 3, 6, rMid, rJunction);
        subGeometries.push(tube);
      }
    });

    const mergedGeometry = mergeGeometries(subGeometries);
    mergedGeometry.computeVertexNormals();

    sphereProto.dispose();
    subGeometries.forEach((g) => g.dispose());
    convex.dispose();

    // ----------------------------------------------------
    // Physically Based Translucent Glass/Resin Material
    // ----------------------------------------------------
    const customUniforms = {
      uTime: { value: 0 },
      uMousePos: { value: new THREE.Vector3(0, 0, 5) },
      uMouseActive: { value: 0 },
    };

    const material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xd7edd9),
      emissive: new THREE.Color(0x0e1b11),
      emissiveIntensity: 0.18,
      roughness: 0.12,
      metalness: 0.05,
      transmission: 0.82,
      thickness: 0.95,
      ior: 1.48,
      clearcoat: 1.0,
      clearcoatRoughness: 0.07,
      specularIntensity: 1.35,
      specularColor: new THREE.Color(0xffffff),
      attenuationColor: new THREE.Color(0xb6f483),
      attenuationDistance: 2.2,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.97,
    });

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uMousePos = customUniforms.uMousePos;
      shader.uniforms.uMouseActive = customUniforms.uMouseActive;

      shader.fragmentShader = `
        uniform vec3 uMousePos;
        uniform float uMouseActive;
        ${shader.fragmentShader}
      `;

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <dithering_fragment>",
        `
        #include <dithering_fragment>

        if (uMouseActive > 0.01) {
          vec3 limeBoost = vec3(0.78, 0.95, 0.42); // DEVOS #C7F36B
          gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * 0.88 + limeBoost * 0.22, uMouseActive * 0.28);
        }
        `
      );
    };

    const mesh = new THREE.Mesh(mergedGeometry, material);
    scene.add(mesh);

    // ----------------------------------------------------
    // Continuous Damped Window Mouse Interaction (ZERO JERK)
    // ----------------------------------------------------
    const targetTilt = new THREE.Vector2(0, 0);
    const currentTilt = new THREE.Vector2(0, 0);

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = (e.clientX - centerX) / (window.innerWidth * 0.5);
      const dy = -(e.clientY - centerY) / (window.innerHeight * 0.5);

      targetTilt.x = dy * 0.12;
      targetTilt.y = dx * 0.16;

      const dist = Math.hypot(e.clientX - centerX, e.clientY - centerY);
      const maxDist = Math.max(rect.width, rect.height) * 0.9;
      const prox = Math.max(0, 1 - dist / maxDist);
      customUniforms.uMouseActive.value = prox;
      customUniforms.uMousePos.value.set(dx * 2.0, dy * 2.0, 1.8);
    };

    window.addEventListener("mousemove", handleWindowMouseMove, {
      passive: true,
    });

    // ----------------------------------------------------
    // Resize Handler
    // ----------------------------------------------------
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 560;
      const h = container.clientHeight || 560;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // ----------------------------------------------------
    // Animation Loop with Continuous Exponential Damping
    // ----------------------------------------------------
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      customUniforms.uTime.value = elapsedTime;

      const ease = 0.045;
      currentTilt.x += (targetTilt.x - currentTilt.x) * ease;
      currentTilt.y += (targetTilt.y - currentTilt.y) * ease;

      mesh.rotation.y += 0.0022;
      mesh.rotation.x = Math.sin(elapsedTime * 0.22) * 0.05 + currentTilt.x;
      mesh.rotation.z =
        Math.cos(elapsedTime * 0.16) * 0.03 + currentTilt.y * 0.35;

      const floatY = Math.sin(elapsedTime * 0.75) * 0.035;
      mesh.position.y = floatY;

      shadowMesh.scale.setScalar(1.0 - floatY * 0.3);

      renderer.render(scene, camera);
    };

    animate();

    // ----------------------------------------------------
    // Cleanup
    // ----------------------------------------------------
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleWindowMouseMove);

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      mergedGeometry.dispose();
      material.dispose();
      shadowGeo.dispose();
      shadowMat.dispose();
      shadowTexture.dispose();
      renderer.dispose();
    };
  }, []);


  const scrollRatio = Math.min(Math.max(scrollY / 700, 0), 1);
  const scrollRotate = scrollRatio * 20;
  const scrollTranslateX = scrollRatio * 24;
  const scrollScale = 1 - scrollRatio * 0.1;

  return (
    <div
      ref={containerRef}
      className={`porous-lattice-container w-full h-[380px] sm:h-[480px] lg:h-[580px] xl:h-[620px] flex items-center justify-center relative select-none ${className}`}
      style={{
        transform: `translate3d(${scrollTranslateX}px, 0, 0) rotate(${scrollRotate * 0.3}deg) scale(${scrollScale})`,
        transition: "transform 120ms ease-out",
      }}
      aria-label="DEVOS 3D Porous Organic Trabecular Lattice Hero Sphere"
    />
  );
}
