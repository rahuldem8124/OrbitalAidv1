"use client";

import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Float, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { ObjectPosition } from "@/lib/types";

interface GlobeProps {
  positions: ObjectPosition[];
}

// Public texture set from the official three.js example gallery — day map,
// normal map (surface relief), specular map (ocean shine), plus a separate
// cloud layer rotated slightly faster than the surface for a living-planet feel.
const TEXTURE_URLS = {
  map: "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg",
  normalMap: "https://threejs.org/examples/textures/planets/earth_normal_2048.jpg",
  specularMap: "https://threejs.org/examples/textures/planets/earth_specular_2048.jpg",
  clouds: "https://threejs.org/examples/textures/planets/earth_clouds_1024.png",
};

// Real Earth radius (km) and the render-space radius the Earth mesh uses
// below — this pair defines the scale factor that converts real orbital
// positions (km) into scene units.
const EARTH_RADIUS_KM = 6378.137;
const MODEL_EARTH_RADIUS = 2;
const KM_TO_SCENE = MODEL_EARTH_RADIUS / EARTH_RADIUS_KM;

function Earth() {
  const earthGroupRef = useRef<THREE.Group>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);

  const [dayMap, normalMap, specularMap, cloudsMap] = useTexture([
    TEXTURE_URLS.map,
    TEXTURE_URLS.normalMap,
    TEXTURE_URLS.specularMap,
    TEXTURE_URLS.clouds,
  ]);

  useFrame((_, delta) => {
    if (earthGroupRef.current) {
      earthGroupRef.current.rotation.y += delta * 0.1;
    }
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += delta * 0.13; // clouds drift slightly faster than the surface
    }
  });

  return (
    <group ref={earthGroupRef}>
      {/* Surface */}
      <mesh>
        <sphereGeometry args={[MODEL_EARTH_RADIUS, 64, 64]} />
        <meshPhongMaterial
          map={dayMap}
          normalMap={normalMap}
          specularMap={specularMap}
          specular={new THREE.Color("#333333")}
          shininess={8}
        />
      </mesh>

      {/* Cloud layer, slightly larger radius so it floats just above the surface */}
      <mesh ref={cloudsRef} scale={[1.01, 1.01, 1.01]}>
        <sphereGeometry args={[MODEL_EARTH_RADIUS, 64, 64]} />
        <meshStandardMaterial map={cloudsMap} transparent opacity={0.4} depthWrite={false} />
      </mesh>

      {/* Atmosphere glow */}
      <mesh scale={[1.08, 1.08, 1.08]}>
        <sphereGeometry args={[MODEL_EARTH_RADIUS, 32, 32]} />
        <meshBasicMaterial color="#00e5ff" transparent opacity={0.12} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

function EarthFallback() {
  // Shown instantly while textures stream in, so the globe never appears
  // blank during the (usually brief) network load.
  return (
    <mesh>
      <sphereGeometry args={[MODEL_EARTH_RADIUS, 32, 32]} />
      <meshStandardMaterial color="#1a4d8e" roughness={0.7} metalness={0.2} />
    </mesh>
  );
}

// NOTE ON REALISM: positions below are real SGP4-propagated coordinates
// from the backend (Earth-centered inertial/TEME frame) — no more
// index+random placeholder. They are NOT nested inside Earth's rotating
// group, which is physically correct: satellites hold their position in
// inertial space while Earth spins beneath them.
//
// KNOWN SIMPLIFICATION: Earth's mesh rotation above is a decorative spin
// (fixed speed) rather than synced to real sidereal time, so the visible
// continents won't necessarily be facing the "correct" direction relative
// to a satellite's true real-world position at this exact moment — the
// satellites' positions RELATIVE TO EACH OTHER and to Earth's center are
// physically accurate; the terminator/continent alignment is not.
function SpaceObjects({ positions }: { positions: ObjectPosition[] }) {
  return (
    <group>
      {positions.map((obj) => {
        const [xKm, yKm, zKm] = obj.position_km;

        // TEME frame: Z axis points along Earth's rotation axis. Mapped
        // here to three.js's Y-up convention. Sign choices below are an
        // arbitrary but self-consistent orientation, not tied to any
        // particular "correct" on-screen direction.
        const x = xKm * KM_TO_SCENE;
        const y = zKm * KM_TO_SCENE;
        const z = -yKm * KM_TO_SCENE;

        let color: string;
        if (obj.type === "satellite") color = "#00e5ff";
        else if (obj.type === "station") color = "#7c5cff";
        else color = "#f97316";

        return (
          <Float key={obj.id} speed={1} rotationIntensity={0.1} floatIntensity={0.1}>
            <mesh position={[x, y, z]}>
              <sphereGeometry args={[obj.type === "station" ? 0.08 : 0.04, 8, 8]} />
              <meshBasicMaterial color={color} transparent opacity={0.9} />
            </mesh>
          </Float>
        );
      })}
    </group>
  );
}

export default function Globe({ positions }: GlobeProps) {
  const sunDirection = new THREE.Vector3(1, 0.5, 0.5).normalize();

  return (
    <div className="w-full h-full bg-[#020308] rounded-md overflow-hidden">
      <Canvas camera={{ position: [0, 2, 6], fov: 45 }}>
        <ambientLight intensity={0.15} />
        <directionalLight
          position={[sunDirection.x * 10, sunDirection.y * 10, sunDirection.z * 10]}
          intensity={2}
        />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <Suspense fallback={<EarthFallback />}>
          <Earth />
        </Suspense>
        <SpaceObjects positions={positions} />
        <OrbitControls
          enablePan={false}
          minDistance={4}
          maxDistance={20}
          autoRotate
          autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
}