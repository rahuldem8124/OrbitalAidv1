"use client";

import { Suspense, useRef, useState, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { CameraControls, Stars, Html, Line, Sphere } from "@react-three/drei";
import * as THREE from "three";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { ObjectPosition, ConjunctionWithDetails } from "@/lib/types";
import { X, Target } from "lucide-react";

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

// Tactical coordinate rings (Equator, Tropics, Prime Meridian)
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
      {/* Equator */}
      <Line points={equator} color="#06B6D4" lineWidth={1} transparent opacity={0.35} />
      {/* Tropics */}
      <Line points={tropicNorth} color="#0EA5E9" lineWidth={0.7} dashed dashSize={0.05} gapSize={0.03} transparent opacity={0.2} />
      <Line points={tropicSouth} color="#0EA5E9" lineWidth={0.7} dashed dashSize={0.05} gapSize={0.03} transparent opacity={0.2} />
    </group>
  );
}

// Glowing Monochrome Topological Earth
function TacticalEarth() {
  const groupRef = useRef<THREE.Group>(null);

  // Generate topological point-cloud representing Earth landmasses
  const { positions, colors } = useMemo(() => {
    const count = 18000;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const r = MODEL_EARTH_RADIUS * 1.002;

    const colorLand = new THREE.Color("#38BDF8");      // Luminous Cyan / Topo highlight
    const colorCoast = new THREE.Color("#0284C7");     // Deep tactical Cyan
    const colorOcean = new THREE.Color("#050B18");     // Deep obsidian ocean
    const tempCol = new THREE.Color();

    for (let i = 0; i < count; i++) {
      // Fibonacci spiral distribution on sphere
      const phi = Math.acos(1 - 2 * (i + 0.5) / count);
      const theta = Math.PI * (1 + 5 ** 0.5) * i;

      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.cos(phi);
      const z = Math.sin(phi) * Math.sin(theta);

      pos[i * 3] = x * r;
      pos[i * 3 + 1] = y * r;
      pos[i * 3 + 2] = z * r;

      // Spherical harmonic harmonics approximating Earth's major continental masses
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

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.04;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Deep Obsidian Core */}
      <mesh>
        <sphereGeometry args={[MODEL_EARTH_RADIUS, 64, 64]} />
        <meshStandardMaterial color="#020408" roughness={0.85} metalness={0.15} />
      </mesh>

      {/* Luminous Topological Point Cloud */}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.016} vertexColors transparent opacity={0.85} sizeAttenuation />
      </points>

      {/* Tactical Coordinate Grid Mesh */}
      <mesh scale={[1.001, 1.001, 1.001]}>
        <sphereGeometry args={[MODEL_EARTH_RADIUS, 36, 18]} />
        <meshBasicMaterial color="#0284C7" wireframe transparent opacity={0.08} />
      </mesh>

      {/* Tactical Coordinate Rings */}
      <TacticalRings radius={MODEL_EARTH_RADIUS * 1.004} />

      {/* Outer Atmosphere Glow */}
      <mesh scale={[1.07, 1.07, 1.07]}>
        <sphereGeometry args={[MODEL_EARTH_RADIUS, 48, 48]} />
        <meshBasicMaterial 
          color="#0284C7" 
          transparent 
          opacity={0.07} 
          side={THREE.BackSide} 
          blending={THREE.AdditiveBlending} 
        />
      </mesh>
    </group>
  );
}

// Satellite Swarm with interactive raycasting & leader-line tooltip
function SpaceObjects({ positions, dim }: { positions: ObjectPosition[]; dim: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    if (!meshRef.current) return;
    positions.forEach((obj, i) => {
      const [xKm, yKm, zKm] = obj.position_km;
      dummy.position.set(xKm * KM_TO_SCENE, zKm * KM_TO_SCENE, -yKm * KM_TO_SCENE);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);

      if (hoveredId === i) {
        color.set("#F59E0B"); // Tactical Amber on hover
      } else {
        color.set(obj.type === "station" ? "#38BDF8" : "#E2E8F0");
      }
      meshRef.current!.setColorAt(i, color);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [positions, hoveredId, dim, dummy, color]);

  const hoveredObj = hoveredId !== null ? positions[hoveredId] : null;

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, positions.length]}
        onPointerMove={(e) => {
          e.stopPropagation();
          setHoveredId(e.instanceId ?? null);
        }}
        onPointerOut={() => {
          setHoveredId(null);
        }}
      >
        <octahedronGeometry args={[0.022, 0]} />
        <meshBasicMaterial transparent opacity={dim ? 0.1 : 0.85} />
      </instancedMesh>

      {/* Interactive Satellite Hover HUD Tooltip */}
      {hoveredObj && hoveredId !== null && !dim && (
        <Html
          position={[
            hoveredObj.position_km[0] * KM_TO_SCENE,
            hoveredObj.position_km[2] * KM_TO_SCENE,
            -hoveredObj.position_km[1] * KM_TO_SCENE,
          ]}
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
            <div className="absolute -top-16 left-14 bg-[#05070A]/90 backdrop-blur-md border border-amber-400/80 p-2.5 rounded shadow-2xl text-[9px] font-mono whitespace-nowrap min-w-[190px]">
              <div className="flex items-center justify-between gap-3 text-amber-400 font-bold border-b border-amber-400/30 pb-1 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                  TARGET ACQUIRED
                </span>
                <span className="text-[8px] text-zinc-400 font-normal">#{hoveredObj.id.slice(0, 6).toUpperCase()}</span>
              </div>
              <div className="text-white font-bold text-[10px] mb-1 truncate">{hoveredObj.object_name}</div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-zinc-400 text-[8px]">
                <span>TYPE: <span className="text-zinc-200 uppercase">{hoveredObj.type}</span></span>
                <span>STATUS: <span className="text-emerald-400 font-medium">TRACKED</span></span>
                <span>ALT: <span className="text-cyan-400">{(Math.hypot(...hoveredObj.position_km) - EARTH_RADIUS_KM).toFixed(1)} km</span></span>
                <span>VEL: <span className="text-cyan-400">7.68 km/s</span></span>
              </div>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

// Conjunction 3D Close-up Deep Dive
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

  const t1Points = useMemo(() => [pos.clone().add(new THREE.Vector3(1.2, 1.2, -1.2)), p1, pos.clone().add(new THREE.Vector3(-1.2, -1.2, 1.2))], [pos]);
  const t2Points = useMemo(() => [pos.clone().add(new THREE.Vector3(-1.2, 1.2, 1.2)), p2, pos.clone().add(new THREE.Vector3(1.2, -1.2, -1.2))], [pos]);

  const isCritical = conj.risk_tier === "critical";
  const threatColor = isCritical ? "#EF4444" : "#F97316";

  const t1Curve = useMemo(() => new THREE.CatmullRomCurve3(t1Points), [t1Points]);
  const t2Curve = useMemo(() => new THREE.CatmullRomCurve3(t2Points), [t2Points]);

  const midPoint = useMemo(() => p1.clone().add(p2).multiplyScalar(0.5), [p1, p2]);

  return (
    <group>
      {/* Object A Path (Cyan) */}
      <mesh>
        <tubeGeometry args={[t1Curve, 64, 0.003, 8, false]} />
        <meshBasicMaterial color="#06B6D4" />
      </mesh>
      <mesh position={p1}>
        <octahedronGeometry args={[0.025, 0]} />
        <meshBasicMaterial color="#06B6D4" />
      </mesh>

      {/* Object B Path (Threat Red/Orange) */}
      <mesh>
        <tubeGeometry args={[t2Curve, 64, 0.003, 8, false]} />
        <meshBasicMaterial color={threatColor} />
      </mesh>
      <mesh position={p2}>
        <octahedronGeometry args={[0.025, 0]} />
        <meshBasicMaterial color={threatColor} />
      </mesh>

      {/* Miss Distance Dashed Vector Line */}
      <Line points={[p1, p2]} color="#ffffff" lineWidth={1.5} dashed dashSize={0.015} gapSize={0.01} />

      {/* Distance Callout Tag on Vector Line */}
      <Html position={midPoint} center zIndexRange={[100, 0]}>
        <div className="bg-[#05070A]/90 border border-white/20 px-2 py-0.5 rounded shadow-lg text-[8px] font-mono text-zinc-100 font-bold whitespace-nowrap">
          MISS: {conj.miss_distance_km.toFixed(3)} km
        </div>
      </Html>

      {/* Risk Volume Covariance Matrix */}
      <Sphere args={[0.14, 32, 32]} position={pos}>
        <meshBasicMaterial color={threatColor} transparent opacity={0.12} depthWrite={false} blending={THREE.AdditiveBlending} />
      </Sphere>
      <Sphere args={[0.14, 16, 16]} position={pos}>
        <meshBasicMaterial color={threatColor} wireframe transparent opacity={0.2} />
      </Sphere>

      {/* Floating Conjunction HUD */}
      <Html position={pos} center zIndexRange={[100, 0]}>
        <div className="hud-panel bg-[#05070A]/90 backdrop-blur-md border border-white/20 p-3 rounded shadow-2xl text-[10px] font-mono text-white relative min-w-[210px] animate-in zoom-in-95 duration-200 mt-16">
          <div className={`text-[9px] tracking-widest font-bold mb-2 pb-1.5 border-b ${isCritical ? 'text-red-400 border-red-500/30' : 'text-amber-400 border-amber-500/30'} flex justify-between items-center gap-3`}>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping"></span>
              INTERCEPT VECTOR
            </span>
            <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="text-zinc-400 hover:text-white transition-colors pointer-events-auto p-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 items-center text-[9px]">
            <span className="text-zinc-400">ASSET:</span>
            <span className="text-cyan-400 font-bold truncate max-w-[130px]">{conj.object_a_name || conj.object_a?.object_name}</span>
            <span className="text-zinc-400">THREAT:</span>
            <span className={`${isCritical ? 'text-red-400' : 'text-orange-400'} font-bold truncate max-w-[130px]`}>{conj.object_b_name || conj.object_b?.object_name}</span>
            <div className="col-span-2 my-1 border-t border-white/10"></div>
            <span className="text-zinc-400">MISS:</span>
            <span className="font-bold font-mono text-white">{conj.miss_distance_km.toFixed(3)} km</span>
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

  return <CameraControls ref={controlsRef} makeDefault minDistance={1.2} maxDistance={25} />;
}

export default function Globe({ positions, selectedConjunction, onCloseConjunction }: GlobeProps) {
  return (
    <div className="w-full h-full bg-[#030508] relative overflow-hidden">
      <Canvas camera={{ position: [-0.25, 0.1, 5.2], fov: 45 }}>
        <color attach="background" args={["#030508"]} />
        <ambientLight intensity={0.4} />

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