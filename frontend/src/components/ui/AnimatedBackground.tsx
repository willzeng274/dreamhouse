"use client";

import { motion } from "framer-motion";

export default function AnimatedBackground() {
	return (
		<div className="fixed inset-0 -z-10 overflow-hidden" style={{ background: '#F5F1EB' }}>
			{/* Subtle grid pattern */}
			<div className="absolute inset-0 bg-[linear-gradient(to_right,#e5ddd0_1px,transparent_1px),linear-gradient(to_bottom,#e5ddd0_1px,transparent_1px)] bg-[size:32px_32px] opacity-40" />
			
			{/* Elegant ambient orbs - very subtle warm tones */}
			<motion.div
				className="absolute top-1/4 -left-1/4 w-[600px] h-[600px] rounded-full filter blur-3xl"
				style={{ background: 'rgba(205, 153, 113, 0.08)' }}
				animate={{
					x: [0, 50, 0],
					y: [0, -30, 0],
				}}
				transition={{
					duration: 25,
					repeat: Infinity,
					ease: "easeInOut",
				}}
			/>
			<motion.div
				className="absolute bottom-1/4 -right-1/4 w-[600px] h-[600px] rounded-full filter blur-3xl"
				style={{ background: 'rgba(191, 114, 72, 0.06)' }}
				animate={{
					x: [0, -50, 0],
					y: [0, 30, 0],
				}}
				transition={{
					duration: 20,
					repeat: Infinity,
					ease: "easeInOut",
				}}
			/>
			
			{/* Subtle noise texture overlay */}
			<div 
				className="absolute inset-0 opacity-[0.012]"
				style={{
					backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
				}}
			/>
		</div>
	);
}

