"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "@/store/useAppStore";
import { useExportScene } from "@/hooks/useApi";
import AsciiLoader from "@/components/ui/AsciiLoader";
import HouseWireframe from "@/components/ui/HouseWireframe";
import { Download, Check } from "lucide-react";

interface ViewStepProps {
	onNext: () => void;
	onPrevious: () => void;
	currentStep: number;
}

export default function ViewStep({ onPrevious }: ViewStepProps) {
	const floorplanObjects = useAppStore((state) => state.floorplanObjects);
	const unityScene = useAppStore((state) => state.unityScene);
	const exportScene = useExportScene();
	const reset = useAppStore((state) => state.reset);

	const [downloaded, setDownloaded] = useState(false);

	// Export scene on mount
	useEffect(() => {
		if (floorplanObjects.length > 0 && !unityScene && !exportScene.isPending) {
			exportScene.mutate(floorplanObjects);
		}
	}, [floorplanObjects]);

	return (
		<div className='h-full flex overflow-hidden p-6'>
			{/* Main Panel - 3D View */}
			<div className='flex-1 flex flex-col min-w-0'>
				<div className='rounded-2xl shadow-2xl flex-1 flex flex-col overflow-hidden transition-all duration-300 hover:shadow-3xl' style={{
					background: 'rgba(255, 255, 255, 0.85)',
					backdropFilter: 'blur(20px)',
					border: '1px solid rgba(140, 103, 66, 0.15)',
					boxShadow: '0 8px 32px rgba(90, 74, 61, 0.12)'
				}}>
					{/* Header */}
					<div className='px-8 py-5 flex items-center justify-between' style={{
						borderBottom: '1px solid rgba(140, 103, 66, 0.12)'
					}}>
						<div className='flex items-center gap-3'>
							<div className='w-1.5 h-1.5 rounded-full' style={{ background: '#CC7A4A' }} />
							<h3 className='text-xl font-semibold' style={{ color: '#5A4A3D' }}>
								Unity Export
						</h3>
						</div>
						<div className='flex items-center gap-2'>
								<button
								onClick={() => {
									if (window.confirm('Start over? This will clear all your work.')) {
										reset();
										window.location.reload();
									}
								}}
								className='px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200'
								style={{
									background: '#FFFFFF',
									color: '#6B5D4F',
									border: '1px solid #E5DDD0'
								}}
								onMouseEnter={(e) => {
									e.currentTarget.style.background = '#FAF8F5';
									e.currentTarget.style.borderColor = '#D4C7B7';
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.background = '#FFFFFF';
									e.currentTarget.style.borderColor = '#E5DDD0';
								}}
							>
								Start Over
								</button>
							<button
								onClick={onPrevious}
								className='px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200'
								style={{
									background: '#FFFFFF',
									color: '#6B5D4F',
									border: '1px solid #E5DDD0'
								}}
								onMouseEnter={(e) => {
									e.currentTarget.style.background = '#FAF8F5';
									e.currentTarget.style.borderColor = '#D4C7B7';
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.background = '#FFFFFF';
									e.currentTarget.style.borderColor = '#E5DDD0';
								}}
							>
								← Back
							</button>
						</div>
					</div>

					{/* 3D View Content */}
					<div className='flex-1 flex items-center justify-center relative' style={{ 
						background: '#FAF8F5',
						backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(140, 103, 66, 0.03) 1px, transparent 0)',
						backgroundSize: '24px 24px'
					}}>
						{exportScene.isPending ? (
							<AsciiLoader 
								message="EXPORTING" 
								subMessage="Preparing Unity scene format..."
								isComplete={exportScene.isSuccess}
							/>
						) : unityScene ? (
							<div className='w-full h-full flex items-start justify-center py-12 px-6 overflow-auto'>
								<div className='max-w-5xl w-full space-y-8'>
									{/* Hero section */}
									<motion.div 
										className='text-center space-y-6'
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ duration: 0.5 }}
									>
										<motion.div
											className='inline-block'
											animate={{ 
												y: [0, -8, 0],
											}}
											transition={{
												duration: 2,
												repeat: Infinity,
												ease: "easeInOut"
											}}
										>
											<div className='relative'>
												<div className='text-8xl'>🏠</div>
												<div className='absolute inset-0 blur-3xl opacity-20' style={{ background: '#CC7A4A' }} />
											</div>
										</motion.div>

										<div className='space-y-3'>
											<h3 className='text-5xl font-bold tracking-tight' style={{ color: '#5A4A3D' }}>
												Ready for Unity
											</h3>
											<p className='text-lg max-w-2xl mx-auto' style={{ color: '#6B5D4F' }}>
												Your architectural vision has been transformed into a 3D scene.<br/>
												Download the Unity scene file and import it to explore in VR.
								</p>
							</div>
									</motion.div>

									{/* 3D Preview */}
									<motion.div
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: 0.2 }}
									>
										<HouseWireframe />
									</motion.div>

									{/* Stats cards */}
									<motion.div 
										className='grid grid-cols-4 gap-4'
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: 0.4 }}
									>
										{[
											{ icon: '📦', value: unityScene.objects?.length || 0, label: 'Objects Exported' },
											{ icon: '🏗️', value: '3D', label: 'Scene Type' },
											{ icon: '✓', value: 'Ready', label: 'Status', isStatus: true },
											{ icon: '🎮', value: 'Unity', label: 'Format' },
										].map((stat, index) => (
											<motion.div
												key={index}
												initial={{ opacity: 0, y: 20 }}
												animate={{ opacity: 1, y: 0 }}
												transition={{ delay: 0.5 + index * 0.1 }}
												className='px-6 py-6 bg-white rounded-xl transition-all duration-200 hover:scale-105 hover:shadow-lg cursor-default text-center' 
												style={{ 
													border: '1px solid #E5DDD0',
													boxShadow: '0 2px 8px rgba(90, 74, 61, 0.06)'
												}}
											>
												<div className='text-3xl mb-2'>{stat.icon}</div>
												{stat.isStatus ? (
													<div className='flex items-center justify-center gap-2 mb-1'>
														<span className='w-2 h-2 bg-emerald-500 rounded-full animate-pulse'></span>
														<span className='text-lg font-bold text-emerald-600'>
															{stat.value}
										</span>
									</div>
												) : (
													<div className='text-2xl font-bold mb-1' style={{ color: '#CC7A4A' }}>
														{stat.value}
													</div>
												)}
												<div className='text-xs font-medium' style={{ color: '#8C6742' }}>
													{stat.label}
												</div>
											</motion.div>
										))}
									</motion.div>

									{/* Unity integration guide */}
									<motion.div
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: 0.8 }}
										className='rounded-xl p-8'
										style={{
											background: 'rgba(255, 255, 255, 0.7)',
											border: '1px solid rgba(140, 103, 66, 0.15)',
										}}
									>
										<h4 className='text-xl font-semibold mb-6 flex items-center gap-3' style={{ color: '#5A4A3D' }}>
											<span className='text-2xl'>🎮</span>
											How to Open in Unity
										</h4>
										<div className='grid md:grid-cols-3 gap-6'>
											{[
												{
													step: 1,
													title: 'Download Scene',
													description: 'Click the button below to download your Unity scene file (.json)',
													icon: '💾'
												},
												{
													step: 2,
													title: 'Open Unity Editor',
													description: 'Launch Unity and navigate to your VR project workspace',
													icon: '🚀'
												},
												{
													step: 3,
													title: 'Import & Experience',
													description: 'Drag the scene file into Unity and explore your creation in immersive VR',
													icon: '🥽'
												}
											].map((item, idx) => (
												<motion.div
													key={idx}
													initial={{ opacity: 0, y: 20 }}
													animate={{ opacity: 1, y: 0 }}
													transition={{ delay: 0.9 + idx * 0.1 }}
													className='space-y-3'
												>
													<div className='flex items-center gap-3'>
														<div className='w-10 h-10 rounded-lg flex items-center justify-center text-xl font-bold text-white transition-transform duration-200 hover:scale-110' style={{ background: '#CC7A4A' }}>
															{item.step}
									</div>
														<div className='text-3xl'>{item.icon}</div>
									</div>
													<h5 className='font-semibold text-base' style={{ color: '#5A4A3D' }}>
														{item.title}
													</h5>
													<p className='text-sm leading-relaxed' style={{ color: '#8C6742' }}>
														{item.description}
													</p>
												</motion.div>
											))}
								</div>
									</motion.div>

									{/* Download button */}
									<motion.div
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: 1.2 }}
										className='flex justify-center'
									>
										<motion.button
									onClick={() => {
										const dataStr = JSON.stringify(unityScene, null, 2);
										const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
										const exportFileDefaultName = 'unity_scene.json';

										const linkElement = document.createElement('a');
										linkElement.setAttribute('href', dataUri);
										linkElement.setAttribute('download', exportFileDefaultName);
										linkElement.click();

												setDownloaded(true);
												setTimeout(() => setDownloaded(false), 2000);
											}}
											className='px-10 py-4 rounded-xl text-base font-semibold text-white transition-all duration-200 flex items-center gap-3'
											style={{
												background: downloaded ? '#10B981' : '#CC7A4A',
												boxShadow: downloaded 
													? '0 8px 24px rgba(16, 185, 129, 0.4)' 
													: '0 8px 24px rgba(204, 122, 74, 0.4)'
											}}
											whileHover={!downloaded ? { scale: 1.02 } : {}}
											whileTap={{ scale: 0.98 }}
											onMouseEnter={(e) => {
												if (!downloaded) {
													e.currentTarget.style.background = '#BF7248';
													e.currentTarget.style.boxShadow = '0 12px 32px rgba(191, 114, 72, 0.5)';
												}
											}}
											onMouseLeave={(e) => {
												if (!downloaded) {
													e.currentTarget.style.background = '#CC7A4A';
													e.currentTarget.style.boxShadow = '0 8px 24px rgba(204, 122, 74, 0.4)';
												}
											}}
										>
											{downloaded ? (
												<>
													<Check size={20} />
													<span>Downloaded Successfully!</span>
												</>
											) : (
												<>
													<Download size={20} />
													<span>Download Unity Scene File</span>
												</>
											)}
										</motion.button>
									</motion.div>

									{/* Additional info */}
									<motion.div
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										transition={{ delay: 1.4 }}
										className='flex items-center justify-center gap-8 pt-6'
									>
										<div className='flex items-center gap-2'>
											<div className='w-2 h-2 rounded-full bg-emerald-500'></div>
											<span className='text-xs font-medium' style={{ color: '#8C6742' }}>
												Scene Data Validated
											</span>
										</div>
										<div className='flex items-center gap-2'>
											<div className='w-2 h-2 rounded-full bg-emerald-500'></div>
											<span className='text-xs font-medium' style={{ color: '#8C6742' }}>
												Unity Compatible
											</span>
										</div>
										<div className='flex items-center gap-2'>
											<div className='w-2 h-2 rounded-full bg-emerald-500'></div>
											<span className='text-xs font-medium' style={{ color: '#8C6742' }}>
												VR Ready
											</span>
										</div>
									</motion.div>
								</div>
							</div>
						) : (
							<div className='text-center space-y-6'>
								<div className='text-6xl'>🏗️</div>
								<div className='space-y-2'>
									<p className='text-lg font-semibold' style={{ color: '#5A4A3D' }}>
										No scene objects available
									</p>
									<p className='text-sm' style={{ color: '#8C6742' }}>
										Objects are being extracted in the background.
									</p>
									<p className='text-xs' style={{ color: '#A89580' }}>
										Please wait a moment or go back to the previous step.
									</p>
								</div>
								<button
									onClick={onPrevious}
									className='px-8 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200'
									style={{
										background: '#CC7A4A',
										boxShadow: '0 4px 12px rgba(204, 122, 74, 0.3)'
									}}
									onMouseEnter={(e) => {
										e.currentTarget.style.background = '#BF7248';
										e.currentTarget.style.boxShadow = '0 6px 16px rgba(191, 114, 72, 0.35)';
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.background = '#CC7A4A';
										e.currentTarget.style.boxShadow = '0 4px 12px rgba(204, 122, 74, 0.3)';
									}}
								>
									← Back to Render
								</button>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
