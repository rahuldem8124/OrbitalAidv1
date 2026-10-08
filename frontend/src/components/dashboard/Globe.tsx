"use client";

import { Suspense, useRef, useState, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
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
const MODEL_EARTH_RADIUS = 2;
const KM_TO_SCENE = MODEL_EARTH_RADIUS / EARTH_RADIUS_KM;

function Earth() {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.05;
  });

  return (
    <group ref={groupRef}>
      {/* Dark core */}
      <mesh>
        <sphereGeometry args={[MODEL_EARTH_RADIUS, 64, 64]} />
        <meshStandardMaterial color="#050608" emissive="#0A0D14" emissiveIntensity={0.5} />
      </mesh>
      {/* Wireframe overlay */}
      <mesh scale={[1.002, 1.002, 1.002]}>
        <sphereGeometry args={[MODEL_EARTH_RADIUS, 32, 32]} />
        <meshBasicMaterial color="#1A2130" wireframe transparent opacity={0.3} />
      </mesh>
      {/* Atmosphere glow */}
      <mesh scale={[1.08, 1.08, 1.08]}>
        <sphereGeometry args={[MODEL_EARTH_RADIUS, 64, 64]} />
        <meshBasicMaterial color="#1A2130" transparent opacity={0.1} side={THREE.BackSide} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

function SpaceObjects({ positions, dim }: { positions: ObjectPosition[], dim: boolean }) {
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
        color.set("#F59E0B"); // Tactical Amber
      } else {
        color.set("#A1A1AA"); // Muted white/grey
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
        onPointerMove={(e) => { e.stopPropagation(); setHoveredId(e.instanceId ?? null); }}
        onPointerOut={(e) => { setHoveredId(null); }}
      >
        <octahedronGeometry args={[0.02, 0]} />
        <meshBasicMaterial transparent opacity={dim ? 0.1 : 0.9} />
      </instancedMesh>

      {hoveredObj && hoveredId !== null && !dim && (
        <Html 
          position={[
            hoveredObj.position_km[0] * KM_TO_SCENE, 
            hoveredObj.position_km[2] * KM_TO_SCENE, 
            -hoveredObj.position_km[1] * KM_TO_SCENE
          ]}
          center
          zIndexRange={[100, 0]}
        >
          <div className="hud-panel border border-[var(--accent-amber)] bg-[#050608]/90 backdrop-blur-sm p-2 text-[10px] font-mono whitespace-nowrap text-white relative animate-in fade-in zoom-in duration-100">
             <div className="absolute top-0 left-0 w-1 h-1 border-t border-l border-[var(--accent-amber)]"></div>
             <div className="absolute bottom-0 right-0 w-1 h-1 border-b border-r border-[var(--accent-amber)]"></div>
             <div className="text-[var(--accent-amber)] font-bold border-b border-[var(--accent-amber)]/30 pb-1 mb-1 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[var(--accent-amber)] animate-pulse rounded-full"></div>
                TARGET LOCK
             </div>
             <div className="text-[var(--text-muted)]">ID: {hoveredObj.id.slice(0,8).toUpperCase()}</div>
             <div>NAME: <span className="text-white font-bold">{hoveredObj.object_name}</span></div>
             <div className="text-[var(--text-dim)] mt-1">ALT: {(Math.random() * 500 + 300).toFixed(1)} km | VEL: 7.{(Math.random() * 9).toFixed(0)} km/s</div>
          </div>
        </Html>
      )}
    </group>
  );
}

function ConjunctionDeepDive({ conj, onClose }: { conj: ConjunctionWithDetails, onClose: () => void }) {
  // Generate a deterministic fake intersection position based on event ID
  const pos = useMemo(() => {
    let h = 0;
    for (let i = 0; i < conj.id.length; i++) h = Math.imul(31, h) + conj.id.charCodeAt(i) | 0;
    const phi = (Math.abs(h % 100) / 100) * Math.PI;
    const theta = (Math.abs((h >> 4) % 100) / 100) * Math.PI * 2;
    const r = MODEL_EARTH_RADIUS + 0.5;
    return new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
  }, [conj.id]);

  const p1 = useMemo(() => pos.clone().add(new THREE.Vector3(0.04, 0.04, 0.04)), [pos]);
  const p2 = useMemo(() => pos.clone().add(new THREE.Vector3(-0.04, -0.04, -0.04)), [pos]);

  const t1Points = useMemo(() => [pos.clone().add(new THREE.Vector3(1, 1, -1)), p1, pos.clone().add(new THREE.Vector3(-1, -1, 1))], [pos]);
  const t2Points = useMemo(() => [pos.clone().add(new THREE.Vector3(-1, 1, 1)), p2, pos.clone().add(new THREE.Vector3(1, -1, -1))], [pos]);

  const isCritical = conj.risk_tier === "critical";
  const objBColor = isCritical ? "#EF4444" : "#F97316";

  const t1Curve = useMemo(() => new THREE.CatmullRomCurve3(t1Points), [t1Points]);
  const t2Curve = useMemo(() => new THREE.CatmullRomCurve3(t2Points), [t2Points]);

  return (
    <group>
      {/* Object A Path */}
      <mesh>
        <tubeGeometry args={[t1Curve, 64, 0.002, 8, false]} />
        <meshBasicMaterial color="#06B6D4" />
      </mesh>
      <mesh position={p1}>
        <octahedronGeometry args={[0.02, 0]} />
        <meshBasicMaterial color="#06B6D4" />
      </mesh>

      {/* Object B Path */}
      <mesh>
        <tubeGeometry args={[t2Curve, 64, 0.002, 8, false]} />
        <meshBasicMaterial color={objBColor} />
      </mesh>
      <mesh position={p2}>
        <octahedronGeometry args={[0.02, 0]} />
        <meshBasicMaterial color={objBColor} />
      </mesh>

      {/* Miss Distance Line */}
      <Line points={[p1, p2]} color="#ffffff" lineWidth={1.5} dashed dashSize={0.01} dashScale={1} gapSize={0.01} />
      
      {/* Risk Volume Covariance Matrix */}
      <Sphere args={[0.12, 32, 32]} position={pos}>
        <meshBasicMaterial color={objBColor} transparent opacity={0.1} depthWrite={false} blending={THREE.AdditiveBlending} />
      </Sphere>
      <Sphere args={[0.12, 16, 16]} position={pos}>
        <meshBasicMaterial color={objBColor} wireframe transparent opacity={0.15} />
      </Sphere>

      {/* Info Panel */}
      <Html position={pos} center zIndexRange={[100, 0]}>
         <div className="hud-panel border border-[var(--space-border-bright)] bg-[#050608]/90 backdrop-blur-md p-3 text-[10px] font-mono text-white relative animate-in zoom-in-95 duration-200">
           <div className={`text-[10px] tracking-widest font-bold mb-3 pb-1 border-b ${isCritical ? 'text-[var(--tier-critical)] border-[var(--tier-critical)]/30' : 'text-[var(--tier-high)] border-[var(--tier-high)]/30'} flex justify-between items-center gap-4`}>
             <span className="flex items-center gap-2">
               <span className="w-1.5 h-1.5 bg-current animate-ping rounded-full"></span>
               INTERCEPT ANALYSIS
             </span>
             <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="text-[var(--text-muted)] hover:text-white transition-colors">
               <X className="w-3 h-3" />
             </button>
           </div>
           <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 items-center">
             <span className="text-[var(--text-muted)]">ASSET</span>
             <span className="text-cyan-400 font-bold truncate max-w-[120px]">{conj.object_a_name || conj.object_a?.object_name}</span>
             <span className="text-[var(--text-muted)]">THREAT</span>
             <span className={`${isCritical ? 'text-red-400' : 'text-orange-400'} font-bold truncate max-w-[120px]`}>{conj.object_b_name || conj.object_b?.object_name}</span>
             <div className="col-span-2 my-1 border-t border-[var(--space-border)]/50"></div>
             <span className="text-[var(--text-muted)] tracking-widest">MISS VECTOR</span>
             <span className={`font-bold font-mono text-[11px] ${isCritical ? 'text-red-400' : 'text-white'}`}>{conj.miss_distance_km.toFixed(3)} km</span>
           </div>
         </div>
      </Html>
    </group>
  );
}

function CameraManager({ selectedConjunction }: { selectedConjunction: ConjunctionWithDetails | null }) {
  const controlsRef = useRef<CameraControls>(null);

  useEffect(() => {
    if (!controlsRef.current) return;
    if (selectedConjunction) {
      let h = 0;
      for (let i = 0; i < selectedConjunction.id.length; i++) h = Math.imul(31, h) + selectedConjunction.id.charCodeAt(i) | 0;
      const phi = (Math.abs(h % 100) / 100) * Math.PI;
      const theta = (Math.abs((h >> 4) % 100) / 100) * Math.PI * 2;
      const r = MODEL_EARTH_RADIUS + 0.5;
      const target = new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
      );
      
      const camPos = target.clone().add(new THREE.Vector3(0.4, 0.4, 0.4));
      controlsRef.current.setLookAt(camPos.x, camPos.y, camPos.z, target.x, target.y, target.z, true);
    } else {
      controlsRef.current.setLookAt(0, 0.5, 3.5, 0, 0, 0, true);
    }
  }, [selectedConjunction]);

  return <CameraControls ref={controlsRef} makeDefault minDistance={1} maxDistance={20} />;
}

export default function Globe({ positions, selectedConjunction, onCloseConjunction }: GlobeProps) {
  return (
    <div className="w-full h-full bg-[#000000] rounded-md overflow-hidden relative">
      <Canvas camera={{ position: [0, 0.5, 3.5], fov: 45 }}>
        <color attach="background" args={["#000000"]} />
        <ambientLight intensity={0.5} />
        
        <Stars radius={100} depth={50} count={3000} factor={3} saturation={0} fade speed={0.5} />
        <Earth />
        <SpaceObjects positions={positions} dim={!!selectedConjunction} />
        
        {selectedConjunction && (
          <ConjunctionDeepDive conj={selectedConjunction} onClose={() => onCloseConjunction?.()} />
        )}
        
        <CameraManager selectedConjunction={selectedConjunction || null} />

        <EffectComposer>
          <Bloom luminanceThreshold={0.7} intensity={1.5} mipmapBlur />
          <Vignette eskil={false} offset={0.1} darkness={1.1} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}