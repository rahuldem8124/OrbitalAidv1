
"use client";

import { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Float } from "@react-three/drei";
import * as THREE from "three";
import { SpaceObject } from "@/lib/types";

interface GlobeProps {
  objects: SpaceObject[];
}

interface EarthProps {
  sunDirection: THREE.Vector3;
}

function Earth({ sunDirection }: EarthProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const earthGroupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (earthGroupRef.current) {
      earthGroupRef.current.rotation.y += delta * 0.1;
    }
  });

  return (
    <group ref={earthGroupRef}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[2, 64, 64]} />
        <meshStandardMaterial
          color="#1a4d8e"
          roughness={0.7}
          metalness={0.2}
        />
      </mesh>
      {/* Atmosphere glow */}
      <mesh scale={[2.1, 2.1, 2.1]}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color="#00e5ff"
          transparent
          opacity={0.1}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

function SpaceObjects({ objects }: { objects: SpaceObject[] }) {
  return (
    <group>
      {objects.map((obj, idx) => {
        // Simple position based on index for now (real orbit propagation would use orbital elements)
        const angle = (idx / objects.length) * Math.PI * 2;
        const radius = 3 + Math.random() * 2;
        const x = Math.cos(angle) * radius;
        const y = (Math.random() - 0.5) * 1.5;
        const z = Math.sin(angle) * radius;

        let color: string;
        if (obj.type === "satellite") color = "#00e5ff";
        else if (obj.type === "station") color = "#7c5cff";
        else color = "#f97316";

        return (
          <Float key={obj.id} speed={1 + idx * 0.01} rotationIntensity={0.2} floatIntensity={0.2}>
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

export default function Globe({ objects }: GlobeProps) {
  const sunDirection = new THREE.Vector3(1, 0.5, 0.5).normalize();

  return (
    <div className="w-full h-full bg-[#020308] rounded-2xl overflow-hidden">
      <Canvas camera={{ position: [0, 2, 6], fov: 45 }}>
        <ambientLight intensity={0.1} />
        <directionalLight
          position={[sunDirection.x * 10, sunDirection.y * 10, sunDirection.z * 10]}
          intensity={1.5}
          castShadow
        />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <Earth sunDirection={sunDirection} />
        <SpaceObjects objects={objects} />
        <OrbitControls
          enablePan={false}
          minDistance={4}
          maxDistance={12}
          autoRotate
          autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
}
