"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

interface Step {
	number: number;
	title: string;
}

interface StepIndicatorProps {
	steps: Step[];
	currentStep: number;
	onStepClick: (step: number) => void;
}

export default function StepIndicator({
	steps,
	currentStep,
	onStepClick,
}: StepIndicatorProps) {
	return (
		<div className='flex items-center gap-3'>
			{steps.map((step, index) => (
				<div key={step.number} className='flex items-center gap-3'>
					<div className='flex items-center gap-2.5 flex-col'>
						<motion.button
							onClick={() => onStepClick(step.number)}
							className='relative flex items-center justify-center w-11 h-11 rounded-xl'
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							transition={{ type: "spring", stiffness: 400, damping: 25 }}
						>
							<div
								className='absolute inset-0 rounded-xl transition-all duration-300'
								style={{
									background: currentStep === step.number
										? '#CC7A4A'
										: currentStep > step.number
										? '#BF7248'
										: '#FFFFFF',
									border: currentStep === step.number || currentStep > step.number
										? 'none'
										: '2px solid #E5DDD0',
									boxShadow: currentStep === step.number
										? '0 4px 12px rgba(204, 122, 74, 0.3)'
										: currentStep > step.number
										? '0 2px 8px rgba(191, 114, 72, 0.2)'
										: 'none'
								}}
							/>
							
							<div className='relative z-10 flex items-center justify-center'>
								{currentStep > step.number ? (
									<motion.div
										initial={{ scale: 0, rotate: -90 }}
										animate={{ scale: 1, rotate: 0 }}
										transition={{ type: "spring", stiffness: 300, damping: 20 }}
									>
										<Check size={18} strokeWidth={2.5} className='text-white' />
									</motion.div>
								) : (
									<span 
										className='text-sm font-semibold'
										style={{ 
											color: currentStep === step.number ? '#FFFFFF' : '#A89580'
										}}
									>
										{step.number}
									</span>
								)}
							</div>
						</motion.button>
						
						<span 
							className='text-xs font-medium transition-colors duration-200'
							style={{
								color: currentStep === step.number
									? '#5A4A3D'
									: currentStep > step.number
									? '#6B5D4F'
									: '#A89580'
							}}
						>
							{step.title}
						</span>
					</div>
					
					{index < steps.length - 1 && (
						<div 
							className='relative w-12 h-0.5 rounded-full overflow-hidden mt-[-20px]'
							style={{ background: '#E5DDD0' }}
						>
							<motion.div
								className='absolute inset-0 rounded-full'
								style={{ background: '#BF7248' }}
								initial={{ x: "-100%" }}
								animate={{
									x: currentStep > step.number ? "0%" : "-100%",
								}}
								transition={{
									duration: 0.4,
									ease: [0.22, 1, 0.36, 1],
								}}
							/>
						</div>
					)}
				</div>
			))}
		</div>
	);
}
