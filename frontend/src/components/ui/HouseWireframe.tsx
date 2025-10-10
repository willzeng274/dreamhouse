"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

function House() {
	const groupRef = useRef<THREE.Group>(null);

	useFrame((state) => {
		if (groupRef.current) {
			groupRef.current.rotation.y = state.clock.elapsedTime * 0.2;
		}
	});

	return (
		<group ref={groupRef}>
			{/* Base/Floor */}
			<mesh position={[0, 0, 0]}>
				<boxGeometry args={[4, 0.2, 4]} />
				<meshStandardMaterial color="#CC7A4A" wireframe />
			</mesh>

			{/* Walls */}
			<mesh position={[0, 1.5, 0]}>
				<boxGeometry args={[4, 3, 4]} />
				<meshStandardMaterial color="#CC7A4A" wireframe />
			</mesh>

			{/* Roof */}
			<mesh position={[0, 3.5, 0]} rotation={[0, Math.PI / 4, 0]}>
				<coneGeometry args={[3, 1.5, 4]} />
				<meshStandardMaterial color="#BF7248" wireframe />
			</mesh>

			{/* Door */}
			<mesh position={[0, 1, 2.01]}>
				<boxGeometry args={[0.8, 1.6, 0.05]} />
				<meshStandardMaterial color="#8C6742" wireframe />
			</mesh>

			{/* Windows */}
			<mesh position={[-1.2, 1.8, 2.01]}>
				<boxGeometry args={[0.6, 0.6, 0.05]} />
				<meshStandardMaterial color="#8C6742" wireframe />
			</mesh>
			<mesh position={[1.2, 1.8, 2.01]}>
				<boxGeometry args={[0.6, 0.6, 0.05]} />
				<meshStandardMaterial color="#8C6742" wireframe />
			</mesh>
		</group>
	);
}

export default function HouseWireframe() {
	return (
		<div className="w-full h-64 rounded-xl overflow-hidden" style={{
			background: 'rgba(255, 255, 255, 0.5)',
			border: '1px solid rgba(140, 103, 66, 0.15)',
		}}>
			<Canvas camera={{ position: [6, 4, 6], fov: 50 }}>
				<ambientLight intensity={0.5} />
				<pointLight position={[10, 10, 10]} intensity={1} color="#CC7A4A" />
				<pointLight position={[-10, -10, -10]} intensity={0.5} color="#BF7248" />
				<House />
				<OrbitControls 
					enableZoom={false} 
					autoRotate 
					autoRotateSpeed={1}
					enablePan={false}
				/>
			</Canvas>
		</div>
	);
}

