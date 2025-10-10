"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Keyboard } from "lucide-react";

interface KeyboardShortcutsProps {
	isOpen: boolean;
	onClose: () => void;
}

export default function KeyboardShortcuts({ isOpen, onClose }: KeyboardShortcutsProps) {
	const shortcuts = [
		{ key: "H", description: "Hand tool (Pan)" },
		{ key: "P", description: "Pen tool" },
		{ key: "L", description: "Line tool" },
		{ key: "R", description: "Rectangle tool" },
		{ key: "C", description: "Circle tool" },
		{ key: "T", description: "Text tool" },
		{ key: "E", description: "Eraser tool" },
		{ key: "Ctrl+Z", description: "Undo" },
		{ key: "Ctrl+Y", description: "Redo" },
		{ key: "Space+Drag", description: "Pan canvas" },
		{ key: "Scroll", description: "Zoom in/out" },
	];

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Backdrop */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className='fixed inset-0 bg-black/20 backdrop-blur-sm z-50'
						onClick={onClose}
					/>

					{/* Modal */}
					<motion.div
						initial={{ opacity: 0, scale: 0.95, y: 20 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.95, y: 20 }}
						transition={{ type: "spring", stiffness: 300, damping: 30 }}
						className='fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-2xl p-6 z-50'
						style={{
							background: 'rgba(255, 255, 255, 0.95)',
							backdropFilter: 'blur(20px)',
							border: '1px solid rgba(140, 103, 66, 0.15)',
							boxShadow: '0 20px 60px rgba(90, 74, 61, 0.2)',
						}}
					>
						{/* Header */}
						<div className='flex items-center justify-between mb-6'>
							<div className='flex items-center gap-3'>
								<div className='w-10 h-10 rounded-lg flex items-center justify-center' style={{
									background: 'rgba(204, 122, 74, 0.1)',
								}}>
									<Keyboard size={20} style={{ color: '#CC7A4A' }} />
								</div>
								<div>
									<h3 className='text-lg font-semibold' style={{ color: '#5A4A3D' }}>
										Keyboard Shortcuts
									</h3>
									<p className='text-xs' style={{ color: '#8C6742' }}>
										Speed up your workflow
									</p>
								</div>
							</div>
							<button
								onClick={onClose}
								className='w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200'
								style={{ color: '#6B5D4F' }}
								onMouseEnter={(e) => {
									e.currentTarget.style.background = '#FAF8F5';
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.background = 'transparent';
								}}
							>
								<X size={18} />
							</button>
						</div>

						{/* Shortcuts list */}
						<div className='space-y-2'>
							{shortcuts.map((shortcut, index) => (
								<motion.div
									key={shortcut.key}
									initial={{ opacity: 0, x: -20 }}
									animate={{ opacity: 1, x: 0 }}
									transition={{ delay: index * 0.03 }}
									className='flex items-center justify-between py-2.5 px-3 rounded-lg transition-all duration-200'
									style={{ background: 'rgba(250, 248, 245, 0.5)' }}
								>
									<span className='text-sm' style={{ color: '#6B5D4F' }}>
										{shortcut.description}
									</span>
									<kbd 
										className='px-2.5 py-1 rounded text-xs font-semibold font-mono'
										style={{
											background: '#FFFFFF',
											color: '#5A4A3D',
											border: '1px solid #E5DDD0',
											boxShadow: '0 1px 2px rgba(90, 74, 61, 0.1)'
										}}
									>
										{shortcut.key}
									</kbd>
								</motion.div>
							))}
						</div>

						{/* Footer tip */}
						<div className='mt-6 pt-4' style={{ borderTop: '1px solid rgba(140, 103, 66, 0.1)' }}>
							<p className='text-xs text-center' style={{ color: '#8C6742' }}>
								Press <kbd className='px-1.5 py-0.5 rounded text-xs font-mono' style={{ 
									background: '#FAF8F5',
									border: '1px solid #E5DDD0' 
								}}>?</kbd> anytime to view this panel
							</p>
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}

