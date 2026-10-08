"use client";

import { Suspense, useRef, useState, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { CameraControls, Stars, Html, Line, Sphere } from "@react-three/drei";
import * as THREE from "three";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { ObjectPosition, ConjunctionWithDetails } from "@/lib/types";
import { X } from "lucide-react";

interface GlobeProps {
  positions: ObjectPosition[];
  selectedConjunction?: ConjunctionWithDetails | null;
  onCloseConjunction?: () => void;
}

const EARTH_RADIUS_KM = 6378.137;
const MODEL_EARTH_RADIUS = 2.2;
const KM_TO_SCENE = MODEL_EARTH_RADIUS / EARTH_RADIUS_KM;

// Helper to create circle points for tactical coordinate rings
function getCirclePoints(radius: number, segments = 64): [number, number, number][] {
  const points: [number, number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    points.push([Math.cos(theta) * radius, 0, Math.sin(theta) * radius]);
  }
  return points;
}

// Tactical coordinate rings (Equator, Tropics) - Monochromatic & Tactical Amber
function TacticalRings({ radius }: { radius: number }) {
  const equator = useMemo(() => getCirclePoints(radius), [radius]);
  const tropicNorth = useMemo(() => {
    const r = radius * Math.cos((23.5 * Math.PI) / 180);
    const y = radius * Math.sin((23.5 * Math.PI) / 180);
    return getCirclePoints(r).map(([x, , z]) => [x, y, z] as [number, number, number]);
  }, [radius]);
  const tropicSouth = useMemo(() => {
    const r = radius * Math.cos((23.5 * Math.PI) / 180);
    const y = -radius * Math.sin((23.5 * Math.PI) / 180);
    return getCirclePoints(r).map(([x, , z]) => [x, y, z] as [number, number, number]);
  }, [radius]);

  return (
    <group>
      {/* Equator - Tactical Amber */}
      <Line points={equator} color="#F59E0B" lineWidth={1} transparent opacity={0.4} />
      {/* Tropics - Monochromatic Dim Gray */}
      <Line points={tropicNorth} color="#71717A" lineWidth={0.7} dashed dashSize={0.05} gapSize={0.03} transparent opacity={0.25} />
      <Line points={tropicSouth} color="#71717A" lineWidth={0.7} dashed dashSize={0.05} gapSize={0.03} transparent opacity={0.25} />
    </group>
  );
}

// Monochromatic / Tactical Amber Topological Earth (ZERO BLUE)
function TacticalEarth() {
  const groupRef = useRef<THREE.Group>(null);

  const earthGeometry = useMemo(() => new THREE.SphereGeometry(MODEL_EARTH_RADIUS, 48, 48), []);
  const earthMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#050505", roughness: 0.9, metalness: 0.1 }), []);

  const wireframeGeometry = useMemo(() => new THREE.SphereGeometry(MODEL_EARTH_RADIUS, 36, 18), []);
  const wireframeMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: "#262626", wireframe: true, transparent: true, opacity: 0.15 }), []);

  const glowGeometry = useMemo(() => new THREE.SphereGeometry(MODEL_EARTH_RADIUS, 48, 48), []);
  const glowMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: "#52525B",
    transparent: true,
    opacity: 0.05,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
  }), []);

  // Generate topological point-cloud representing Earth landmasses
  const { positions, colors } = useMemo(() => {
    const count = 18000;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const r = MODEL_EARTH_RADIUS * 1.002;

    const colorLand = new THREE.Color("#E4E4E7");      // Crisp Monochromatic Light Gray/White
    const colorCoast = new THREE.Color("#71717A");     // Dim Tactical Gray
    const colorOcean = new THREE.Color("#0A0A0A");     // Pitch Black Ocean
    const tempCol = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const phi = Math.acos(1 - 2 * (i + 0.5) / count);
      const theta = Math.PI * (1 + 5 ** 0.5) * i;

      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.cos(phi);
      const z = Math.sin(phi) * Math.sin(theta);

      pos[i * 3] = x * r;
      pos[i * 3 + 1] = y * r;
      pos[i * 3 + 2] = z * r;

      const lat = Math.asin(y);
      const lon = Math.atan2(z, x);

      const n1 = Math.sin(lat * 2.5) * Math.cos(lon * 2.0);
      const n2 = Math.sin(lat * 5.0 + 1.2) * Math.cos(lon * 4.0 - 0.5);
      const n3 = Math.sin(lat * 9.0) * Math.sin(lon * 8.0);
      const landVal = n1 * 0.55 + n2 * 0.35 + n3 * 0.1;

      const isLand = landVal > 0.06 || (lat > 1.25 && landVal > -0.25) || (lat < -1.15);

      if (isLand) {
        tempCol.lerpColors(colorCoast, colorLand, Math.min(1, Math.max(0, (landVal - 0.06) * 3)));
      } else {
        tempCol.copy(colorOcean);
      }

      col[i * 3] = tempCol.r;
      col[i * 3 + 1] = tempCol.g;
      col[i * 3 + 2] = tempCol.b;
    }

    return { positions: pos, colors: col };
  }, []);

  const pointCloudGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [positions, colors]);

  const pointsMaterial = useMemo(() => new THREE.PointsMaterial({
    size: 0.016,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    sizeAttenuation: true,
  }), []);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.035;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh geometry={earthGeometry} material={earthMaterial} />
      <points geometry={pointCloudGeometry} material={pointsMaterial} />
      <mesh geometry={wireframeGeometry} material={wireframeMaterial} scale={[1.001, 1.001, 1.001]} />
      <TacticalRings radius={MODEL_EARTH_RADIUS * 1.004} />
      <mesh geometry={glowGeometry} material={glowMaterial} scale={[1.06, 1.06, 1.06]} />
    </group>
  );
}

// Satellite Swarm with optimized InstancedMesh raycasting & memoized telemetry tooltip
function SpaceObjects({ positions, dim }: { positions: ObjectPosition[]; dim: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const [hoveredData, setHoveredData] = useState<{
    satellite: ObjectPosition;
    position: [number, number, number];
  } | null>(null);
  const hoveredIdRef = useRef<number | null>(null);

  // Directive 3: Memoize geometry and material
  const satelliteGeometry = useMemo(() => {
    const geo = new THREE.TetrahedronGeometry(0.032, 0);
    // Crucial for Three.js InstancedMesh raycasting:
    // Expand bounding sphere & box to cover full orbital volume so raycast doesn't bail out at Earth origin!
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 20);
    geo.boundingBox = new THREE.Box3(new THREE.Vector3(-20, -20, -20), new THREE.Vector3(20, 20, 20));
    return geo;
  }, []);

  const satelliteMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: "#FFFFFF",
      roughness: 0.35,
      metalness: 0.15,
      transparent: true,
      opacity: dim ? 0.08 : 0.85,
    });
  }, [dim]);

  // Initial population of matrices & colors - runs only when positions change
  useEffect(() => {
    if (!meshRef.current || positions.length === 0) return;
    const dummy = new THREE.Object3D();
    const baseColor = new THREE.Color("#E4E4E7");
    const stationColor = new THREE.Color("#EAB308");

    for (let i = 0; i < positions.length; i++) {
      const obj = positions[i];
      const [xKm, yKm, zKm] = obj.position_km;
      dummy.position.set(xKm * KM_TO_SCENE, zKm * KM_TO_SCENE, -yKm * KM_TO_SCENE);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      meshRef.current.setColorAt(i, obj.type === "station" ? stationColor : baseColor);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [positions]);

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[satelliteGeometry, satelliteMaterial, positions.length]}
        onPointerMove={(e) => {
          e.stopPropagation();
          if (dim) return;
          const id = e.instanceId;
          if (id !== undefined && id !== null && positions[id]) {
            if (hoveredIdRef.current !== id) {
              const amberColor = new THREE.Color("#F59E0B");
              const baseColor = new THREE.Color("#E4E4E7");
              const stationColor = new THREE.Color("#EAB308");

              // Reset previous instance color
              if (hoveredIdRef.current !== null && positions[hoveredIdRef.current] && meshRef.current) {
                const prevObj = positions[hoveredIdRef.current];
                meshRef.current.setColorAt(hoveredIdRef.current, prevObj.type === "station" ? stationColor : baseColor);
              }
              // Set current instance color
              if (meshRef.current) {
                meshRef.current.setColorAt(id, amberColor);
                if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
              }

              hoveredIdRef.current = id;
              const obj = positions[id];
              const [xKm, yKm, zKm] = obj.position_km;
              setHoveredData({
                satellite: obj,
                position: [xKm * KM_TO_SCENE, zKm * KM_TO_SCENE, -yKm * KM_TO_SCENE],
              });
            }
          }
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          if (hoveredIdRef.current !== null && positions[hoveredIdRef.current] && meshRef.current) {
            const prevObj = positions[hoveredIdRef.current];
            const baseColor = new THREE.Color("#E4E4E7");
            const stationColor = new THREE.Color("#EAB308");
            meshRef.current.setColorAt(hoveredIdRef.current, prevObj.type === "station" ? stationColor : baseColor);
            if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
          }
          hoveredIdRef.current = null;
          setHoveredData(null);
        }}
      />

      {/* Interactive Satellite Hover HUD Tooltip */}
      {hoveredData && !dim && (
        <Html
          position={hoveredData.position}
          center
          zIndexRange={[100, 0]}
        >
          <div className="relative pointer-events-none select-none">
            {/* Target reticle directly on the satellite */}
            <div className="absolute -top-3 -left-3 w-6 h-6 rounded-full border border-amber-400/80 animate-ping"></div>
            <div className="absolute -top-3 -left-3 w-6 h-6 rounded-full border border-amber-400/60 flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-amber-400 rounded-full"></div>
            </div>

            {/* Connecting leader line */}
            <svg className="absolute -top-6 left-3 w-14 h-8 overflow-visible">
              <polyline points="0,18 14,4 42,4" fill="none" stroke="#F59E0B" strokeWidth="1" strokeDasharray="2,2" />
            </svg>

            {/* Floating HUD Tooltip */}
            <div className="absolute -top-16 left-14 bg-[#050505]/95 backdrop-blur-md border border-amber-400/80 p-2.5 rounded shadow-2xl text-[9px] font-mono whitespace-nowrap min-w-[190px]">
              <div className="flex items-center justify-between gap-3 text-amber-400 font-bold border-b border-amber-400/30 pb-1 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                  TARGET ACQUIRED
                </span>
                <span className="text-[8px] text-zinc-400 font-normal">#{hoveredData.satellite.id.slice(0, 6).toUpperCase()}</span>
              </div>
              <div className="text-white font-bold text-[10px] mb-1 truncate">{hoveredData.satellite.object_name}</div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-zinc-400 text-[8px]">
                <span>TYPE: <span className="text-zinc-200 uppercase">{hoveredData.satellite.type}</span></span>
                <span>STATUS: <span className="text-emerald-400 font-medium">TRACKED</span></span>
                <span>ALT: <span className="text-amber-300">{(Math.hypot(...hoveredData.satellite.position_km) - EARTH_RADIUS_KM).toFixed(1)} km</span></span>
                <span>VEL: <span className="text-amber-300">7.68 km/s</span></span>
              </div>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

// Conjunction 3D Close-up Local Simulation
function ConjunctionDeepDive({ conj, onClose }: { conj: ConjunctionWithDetails; onClose: () => void }) {
  const pos = useMemo(() => {
    let h = 0;
    for (let i = 0; i < conj.id.length; i++) h = Math.imul(31, h) + conj.id.charCodeAt(i) | 0;
    const phi = (Math.abs(h % 100) / 100) * Math.PI;
    const theta = (Math.abs((h >> 4) % 100) / 100) * Math.PI * 2;
    const r = MODEL_EARTH_RADIUS + 0.6;
    return new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
  }, [conj.id]);

  const p1 = useMemo(() => pos.clone().add(new THREE.Vector3(0.04, 0.04, 0.04)), [pos]);
  const p2 = useMemo(() => pos.clone().add(new THREE.Vector3(-0.04, -0.04, -0.04)), [pos]);

  const t1Curve = useMemo(() => {
    const pts = [
      pos.clone().add(new THREE.Vector3(1.2, 1.2, -1.2)),
      p1,
      pos.clone().add(new THREE.Vector3(-1.2, -1.2, 1.2))
    ];
    return new THREE.CatmullRomCurve3(pts);
  }, [pos, p1]);

  const t2Curve = useMemo(() => {
    const pts = [
      pos.clone().add(new THREE.Vector3(-1.2, 1.2, 1.2)),
      p2,
      pos.clone().add(new THREE.Vector3(1.2, -1.2, -1.2))
    ];
    return new THREE.CatmullRomCurve3(pts);
  }, [pos, p2]);

  // Directive 3: Memoize the points array to prevent memory leaks during re-renders
  const t1Points = useMemo(() => {
    return t1Curve.getPoints(64).map((p) => [p.x, p.y, p.z] as [number, number, number]);
  }, [t1Curve]);

  const t2Points = useMemo(() => {
    return t2Curve.getPoints(64).map((p) => [p.x, p.y, p.z] as [number, number, number]);
  }, [t2Curve]);

  const missPoints = useMemo<[number, number, number][]>(() => {
    return [
      [p1.x, p1.y, p1.z],
      [p2.x, p2.y, p2.z],
    ];
  }, [p1, p2]);

  const midPoint = useMemo(() => p1.clone().add(p2).multiplyScalar(0.5), [p1, p2]);

  const isCritical = conj.risk_tier === "critical";
  const threatColor = isCritical ? "#EF4444" : "#F97316";

  const markerGeometry = useMemo(() => new THREE.TetrahedronGeometry(0.032, 0), []);
  const whiteMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 0.3 }), []);
  const threatMat = useMemo(() => new THREE.MeshStandardMaterial({ color: threatColor, roughness: 0.3 }), [threatColor]);

  return (
    <group>
      {/* Primary Object Trajectory: Crisp White using drei Line (Directive 3) */}
      <Line points={t1Points} color="#FFFFFF" lineWidth={2} />
      <mesh position={p1} geometry={markerGeometry} material={whiteMat} />

      {/* Secondary Object Trajectory: Incident Red / Tactical Orange using drei Line (Directive 3) */}
      <Line points={t2Points} color={threatColor} lineWidth={2} />
      <mesh position={p2} geometry={markerGeometry} material={threatMat} />

      {/* Pulsing Dashed Miss Distance Vector Line */}
      <Line points={missPoints} color="#F59E0B" lineWidth={2} dashed dashSize={0.015} gapSize={0.01} />

      {/* Pulsing Distance Callout Badge */}
      <Html position={midPoint} center zIndexRange={[100, 0]}>
        <div className="bg-[#000000]/95 border border-amber-400 px-2 py-0.5 rounded shadow-2xl text-[8.5px] font-mono text-amber-300 font-bold whitespace-nowrap animate-pulse pointer-events-none select-none">
          MISS: {conj.miss_distance_km.toFixed(3)} km
        </div>
      </Html>

      {/* Risk Volume Covariance Ellipsoid */}
      <Sphere args={[0.14, 32, 32]} position={pos}>
        <meshBasicMaterial color={threatColor} transparent opacity={0.15} depthWrite={false} blending={THREE.AdditiveBlending} />
      </Sphere>
      <Sphere args={[0.14, 16, 16]} position={pos}>
        <meshBasicMaterial color={threatColor} wireframe transparent opacity={0.25} />
      </Sphere>

      {/* Floating Conjunction HUD Card */}
      <Html position={pos} center zIndexRange={[100, 0]}>
        <div 
          className="hud-panel bg-[#050505]/95 backdrop-blur-md border border-white/20 p-3 rounded shadow-2xl text-[10px] font-mono text-white relative min-w-[210px] animate-in zoom-in-95 duration-200 mt-16 pointer-events-auto select-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`text-[9px] tracking-widest font-bold mb-2 pb-1.5 border-b ${isCritical ? 'text-red-400 border-red-500/30' : 'text-amber-400 border-amber-500/30'} flex justify-between items-center gap-3`}>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping"></span>
              INTERCEPT VECTOR
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onClose();
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
              }}
              className="text-zinc-400 hover:text-white transition-colors pointer-events-auto p-1 cursor-pointer bg-white/5 hover:bg-white/10 rounded-xs"
              title="Exit Encounter View"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 items-center text-[9px]">
            <span className="text-zinc-400">ASSET:</span>
            <span className="text-white font-bold truncate max-w-[130px]">{conj.object_a_name || conj.object_a?.object_name}</span>
            <span className="text-zinc-400">THREAT:</span>
            <span className={`${isCritical ? 'text-red-400' : 'text-orange-400'} font-bold truncate max-w-[130px]`}>{conj.object_b_name || conj.object_b?.object_name}</span>
            <div className="col-span-2 my-1 border-t border-white/10"></div>
            <span className="text-zinc-400">MISS:</span>
            <span className="font-bold font-mono text-amber-300">{conj.miss_distance_km.toFixed(3)} km</span>
            <span className="text-zinc-400">TCA:</span>
            <span className="font-mono text-zinc-300 text-[8.5px] truncate">{new Date(conj.tca).toUTCString().slice(17, 25)} UTC</span>
          </div>
        </div>
      </Html>
    </group>
  );
}

// Camera transitions manager
function CameraManager({ selectedConjunction }: { selectedConjunction: ConjunctionWithDetails | null }) {
  const controlsRef = useRef<CameraControls>(null);

  useEffect(() => {
    if (!controlsRef.current) return;
    if (selectedConjunction) {
      let h = 0;
      for (let i = 0; i < selectedConjunction.id.length; i++) h = Math.imul(31, h) + selectedConjunction.id.charCodeAt(i) | 0;
      const phi = (Math.abs(h % 100) / 100) * Math.PI;
      const theta = (Math.abs((h >> 4) % 100) / 100) * Math.PI * 2;
      const r = MODEL_EARTH_RADIUS + 0.6;
      const target = new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
      );

      const camPos = target.clone().add(new THREE.Vector3(0.35, 0.35, 0.35));
      controlsRef.current.setLookAt(camPos.x, camPos.y, camPos.z, target.x, target.y, target.z, true);
    } else {
      // Global overview: positioned slightly left-of-center so the right sidebar doesn't occlude Earth
      controlsRef.current.setLookAt(-0.25, 0.1, 5.2, -0.25, 0, 0, true);
    }
  }, [selectedConjunction]);

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      smoothTime={0.8}
      minDistance={1.2}
      maxDistance={25}
    />
  );
}

export default function Globe({ positions, selectedConjunction, onCloseConjunction }: GlobeProps) {
  return (
    <div className="w-full h-full bg-[#000000] relative overflow-hidden">
      <Canvas
        dpr={[1, 1.5]}
        gl={{
          powerPreference: "high-performance",
          antialias: true,
          alpha: false,
          stencil: false,
          depth: true,
        }}
        camera={{ position: [-0.25, 0.1, 5.2], fov: 45 }}
      >
        <color attach="background" args={["#000000"]} />
        <ambientLight intensity={0.6} />

        <Stars radius={120} depth={60} count={3500} factor={3.5} saturation={0} fade speed={0.4} />

        <Suspense fallback={null}>
          <TacticalEarth />
        </Suspense>

        <SpaceObjects positions={positions} dim={!!selectedConjunction} />

        {selectedConjunction && (
          <ConjunctionDeepDive conj={selectedConjunction} onClose={() => onCloseConjunction?.()} />
        )}

        <CameraManager selectedConjunction={selectedConjunction || null} />

        <EffectComposer>
          <Bloom luminanceThreshold={0.7} intensity={1.2} mipmapBlur />
          <Vignette eskil={false} offset={0.12} darkness={1.1} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}