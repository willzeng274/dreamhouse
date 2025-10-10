"use client";

import { motion } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Box } from "@react-three/drei";
import * as THREE from "three";

interface AsciiLoaderProps {
	message?: string;
	subMessage?: string;
	isComplete?: boolean; // Signal when API call is done
}

function RotatingCube() {
	const meshRef = useRef<THREE.Mesh>(null);

	useFrame((state, delta) => {
		if (meshRef.current) {
			meshRef.current.rotation.x += delta * 0.5;
			meshRef.current.rotation.y += delta * 0.7;
		}
	});

	return (
		<Box ref={meshRef} args={[2, 2, 2]}>
			<meshStandardMaterial 
				color="#CC7A4A" 
				wireframe={true}
				wireframeLinewidth={2}
			/>
		</Box>
	);
}

export default function AsciiLoader({ message = "LOADING", subMessage, isComplete = false }: AsciiLoaderProps) {
	const [progress, setProgress] = useState(0);
	const [dots, setDots] = useState("");
	const startTimeRef = useRef(Date.now());

	// Matrix-style digital rain effect
	const [matrixLines, setMatrixLines] = useState<string[]>([]);

	useEffect(() => {
		// Reset start time when component mounts
		startTimeRef.current = Date.now();
	}, []);

	useEffect(() => {
		// Smart progress bar that matches API timing
		const progressInterval = setInterval(() => {
			setProgress((prev) => {
				const elapsed = Date.now() - startTimeRef.current;
				
				if (isComplete) {
					// API is done - quickly fill to 100%
					return Math.min(100, prev + 10);
				} else {
					// Slow logarithmic growth - takes longer to reach 90%
					// First 5 seconds: 0-60%
					// Next 10 seconds: 60-80%
					// After 15 seconds: 80-90%
					const targetProgress = Math.min(90, 
						20 * Math.log(elapsed / 1000 + 1) + // Log curve
						(elapsed / 300) // Slow linear component
					);
					
					// Smoothly approach target
					if (prev < targetProgress) {
						return Math.min(targetProgress, prev + 0.5);
					}
					return prev;
				}
			});
		}, 100);

		// Animate dots
		const dotsInterval = setInterval(() => {
			setDots((prev) => {
				if (prev === "...") return "";
				return prev + ".";
			});
		}, 400);

		// Matrix rain effect
		const chars = "10░▒▓█";
		const generateMatrixLine = () => {
			let line = "";
			for (let i = 0; i < 40; i++) {
				line += Math.random() > 0.5 ? chars[Math.floor(Math.random() * chars.length)] : " ";
			}
			return line;
		};

		const matrixInterval = setInterval(() => {
			setMatrixLines((prev) => {
				const newLines = [generateMatrixLine(), ...prev.slice(0, 5)];
				return newLines;
			});
		}, 100);

		return () => {
			clearInterval(progressInterval);
			clearInterval(dotsInterval);
			clearInterval(matrixInterval);
		};
	}, [isComplete]);

	const progressBar = "█".repeat(Math.floor(progress / 5)) + "░".repeat(20 - Math.floor(progress / 5));

	return (
		<div className="flex items-center justify-center w-full h-full relative overflow-hidden">
			{/* Matrix rain background effect */}
			<div className="absolute inset-0 opacity-5 pointer-events-none font-mono text-xs" style={{ color: '#CC7A4A' }}>
				{matrixLines.map((line, i) => (
					<motion.div
						key={i}
						initial={{ opacity: 1 }}
						animate={{ opacity: 0 }}
						transition={{ duration: 0.5 }}
						className="whitespace-pre"
					>
						{line}
					</motion.div>
				))}
			</div>

			{/* Main ASCII container */}
			<motion.div
				initial={{ opacity: 0, scale: 0.9 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ duration: 0.4 }}
				className="relative"
			>
				{/* Glowing border effect */}
				<div 
					className="absolute -inset-8 rounded-2xl opacity-20 blur-2xl"
					style={{ background: '#CC7A4A' }}
				/>

				{/* Main content card */}
				<div 
					className="relative rounded-2xl p-12 font-mono"
					style={{
						background: 'rgba(255, 255, 255, 0.95)',
						backdropFilter: 'blur(20px)',
						border: '2px solid rgba(140, 103, 66, 0.2)',
						boxShadow: '0 20px 60px rgba(90, 74, 61, 0.15)',
					}}
				>
					{/* Top border decoration */}
					<div className="text-center mb-6" style={{ color: '#8C6742' }}>
						╔═══════════════════════════════════════╗
					</div>

					{/* Three.js 3D Cube */}
					<div className="h-48 mb-6">
						<Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
							<ambientLight intensity={0.5} />
							<pointLight position={[10, 10, 10]} intensity={1} color="#CC7A4A" />
							<pointLight position={[-10, -10, -10]} intensity={0.5} color="#BF7248" />
							<RotatingCube />
						</Canvas>
					</div>

					{/* Message */}
					<motion.div 
						className="text-center mb-6"
						animate={{ opacity: [1, 0.6, 1] }}
						transition={{ duration: 1.5, repeat: Infinity }}
					>
						<div className="text-2xl font-bold tracking-widest mb-2" style={{ color: '#5A4A3D' }}>
							{message}{dots}
						</div>
						{subMessage && (
							<div className="text-sm tracking-wide" style={{ color: '#8C6742' }}>
								{subMessage}
							</div>
						)}
					</motion.div>

					{/* Progress bar */}
					<div className="mb-6">
						<div className="flex justify-between text-xs mb-2" style={{ color: '#8C6742' }}>
							<span>╠</span>
							<span>{progress}%</span>
							<span>╣</span>
						</div>
						<div className="text-center text-lg tracking-tighter" style={{ color: '#CC7A4A' }}>
							{progressBar}
						</div>
					</div>

					{/* Animated data streams */}
					<div className="space-y-1 text-xs mb-6 opacity-60" style={{ color: '#6B5D4F' }}>
						<motion.div
							animate={{ opacity: [0.4, 1, 0.4] }}
							transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
						>
							→ Processing neural networks...
						</motion.div>
						<motion.div
							animate={{ opacity: [0.4, 1, 0.4] }}
							transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
						>
							→ Analyzing spatial data...
						</motion.div>
						<motion.div
							animate={{ opacity: [0.4, 1, 0.4] }}
							transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
						>
							→ Rendering pipeline active...
						</motion.div>
						<motion.div
							animate={{ opacity: [0.4, 1, 0.4] }}
							transition={{ duration: 1.2, repeat: Infinity, delay: 0.6 }}
						>
							→ Computing transformations...
						</motion.div>
					</div>

					{/* Bottom border decoration */}
					<div className="text-center" style={{ color: '#8C6742' }}>
						╚═══════════════════════════════════════╝
					</div>

					{/* Corner decorations */}
					<div className="absolute top-4 left-4 text-lg" style={{ color: '#CC7A4A' }}>▲</div>
					<div className="absolute top-4 right-4 text-lg" style={{ color: '#CC7A4A' }}>▲</div>
					<div className="absolute bottom-4 left-4 text-lg" style={{ color: '#CC7A4A' }}>▼</div>
					<div className="absolute bottom-4 right-4 text-lg" style={{ color: '#CC7A4A' }}>▼</div>

					{/* Scanning line effect */}
					<motion.div
						className="absolute left-0 right-0 h-px"
						style={{ background: 'linear-gradient(90deg, transparent, #CC7A4A, transparent)' }}
						animate={{ top: ["0%", "100%"] }}
						transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
					/>
				</div>

				{/* Orbiting particles - centered around the card */}
				{[0, 1, 2, 3].map((i) => {
					const angle = (i * Math.PI) / 2;
					const radius = 200;
					return (
						<motion.div
							key={i}
							className="absolute w-2 h-2 rounded-full left-1/2 top-1/2"
							style={{ 
								background: '#CC7A4A',
								marginLeft: -4,
								marginTop: -4,
							}}
							animate={{
								x: [
									Math.cos(angle) * radius,
									Math.cos(angle + Math.PI / 2) * radius,
									Math.cos(angle + Math.PI) * radius,
									Math.cos(angle + (3 * Math.PI) / 2) * radius,
									Math.cos(angle) * radius,
								],
								y: [
									Math.sin(angle) * radius,
									Math.sin(angle + Math.PI / 2) * radius,
									Math.sin(angle + Math.PI) * radius,
									Math.sin(angle + (3 * Math.PI) / 2) * radius,
									Math.sin(angle) * radius,
								],
								opacity: [0.3, 0.8, 0.3, 0.8, 0.3],
							}}
							transition={{
								duration: 4,
								repeat: Infinity,
								ease: "linear",
								delay: i * 0.25,
							}}
						/>
					);
				})}
			</motion.div>
		</div>
	);
}

