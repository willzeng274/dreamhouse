"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import StepIndicator from "@/components/StepIndicator";
import SketchStep from "@/components/steps/SketchStep";
import RenderStep from "@/components/steps/RenderStep";
import ViewStep from "@/components/steps/ViewStep";
import AnimatedBackground from "@/components/ui/AnimatedBackground";

export default function Home() {
	const [currentStep, setCurrentStep] = useState(1);
	const [sketchData, setSketchData] = useState<string | null>(null);

	const steps = [
		{ number: 1, title: "Sketch", component: SketchStep },
		{ number: 2, title: "Render", component: RenderStep },
		{ number: 3, title: "3D View", component: ViewStep },
	];

	const handleNext = () => {
		if (currentStep < 3) {
			setCurrentStep(currentStep + 1);
		}
	};

	const handlePrevious = () => {
		if (currentStep > 1) {
			setCurrentStep(currentStep - 1);
		}
	};

	const handleStepClick = (step: number) => {
		setCurrentStep(step);
	};

	const CurrentStepComponent = steps[currentStep - 1].component;

	return (
		<div className='h-screen flex flex-col overflow-hidden relative'>
			{/* Animated Background */}
			<AnimatedBackground />

			{/* Header */}
			<motion.header 
				className='relative z-10 px-8 py-5'
				style={{ 
					background: 'rgba(255, 255, 255, 0.7)',
					backdropFilter: 'blur(20px)',
					borderBottom: '1px solid rgba(140, 103, 66, 0.15)'
				}}
				initial={{ y: -100, opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
			>
				<div className='flex items-center justify-between max-w-7xl mx-auto'>
					{/* Logo */}
					<motion.div 
						className='flex items-center gap-3 cursor-pointer'
						whileHover={{ x: 2 }}
						transition={{ type: "spring", stiffness: 300, damping: 20 }}
					>
						<div className='relative w-10 h-10 rounded-xl flex items-center justify-center shadow-lg' style={{ 
							background: 'linear-gradient(135deg, #CC7A4A 0%, #BF7248 100%)',
							boxShadow: '0 4px 12px rgba(191, 114, 72, 0.25)'
						}}>
							<div className='absolute inset-0 rounded-xl bg-gradient-to-br from-white/15 to-transparent' />
							<svg className='w-5 h-5 text-white relative z-10' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
								<path d='M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' />
								<polyline points='9 22 9 12 15 12 15 22' />
							</svg>
						</div>
						<div>
							<h1 className='text-xl font-semibold tracking-tight' style={{ color: '#5A4A3D' }}>
								Dream House
							</h1>
							<p className='text-[11px] font-medium tracking-wide' style={{ color: '#8C6742' }}>
								ARCHITECTURAL AI
							</p>
						</div>
					</motion.div>

					{/* Step Indicator */}
					<StepIndicator
						steps={steps}
						currentStep={currentStep}
						onStepClick={handleStepClick}
					/>
				</div>
			</motion.header>

			{/* Main Content */}
			<div className='flex-1 overflow-hidden relative z-0'>
				<AnimatePresence mode='wait'>
					<motion.div
						key={currentStep}
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}
						transition={{ 
							duration: 0.3, 
							ease: [0.22, 1, 0.36, 1]
						}}
						className='h-full'
					>
						<CurrentStepComponent
							onNext={handleNext}
							onPrevious={handlePrevious}
							currentStep={currentStep}
							sketchData={sketchData}
							setSketchData={setSketchData}
						/>
					</motion.div>
				</AnimatePresence>
			</div>
		</div>
	);
}
