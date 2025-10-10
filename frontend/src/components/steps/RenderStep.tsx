"use client";

import { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useGeneratePhotorealistic, useExtractObjects } from "@/hooks/useApi";
import AsciiLoader from "@/components/ui/AsciiLoader";

interface RenderStepProps {
	onNext: () => void;
	onPrevious: () => void;
	currentStep: number;
}

interface SelectionBox {
	startX: number;
	startY: number;
	endX: number;
	endY: number;
}

interface Transform {
	offsetX: number;
	offsetY: number;
	scale: number;
}

export default function RenderStep({ onNext, onPrevious }: RenderStepProps) {
	const floorplanBlob = useAppStore((state) => state.floorplanBlob);
	const renderDataUrl = useAppStore((state) => state.renderDataUrl);
	const floorplanObjects = useAppStore((state) => state.floorplanObjects);
	const generatePhotorealistic = useGeneratePhotorealistic();
	const extractObjects = useExtractObjects();

	const [showSelectArea, setShowSelectArea] = useState(false);
	const [isSelecting, setIsSelecting] = useState(false);
	const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	// Generate photorealistic image on mount
	useEffect(() => {
		if (floorplanBlob && !renderDataUrl && !generatePhotorealistic.isPending) {
			const file = new File([floorplanBlob], "floorplan.png", {
				type: "image/png",
			});
			generatePhotorealistic.mutate(file);
		}
	}, [floorplanBlob]);

	// Extract objects from floorplan in the background for ViewStep
	useEffect(() => {
		if (floorplanBlob && floorplanObjects.length === 0 && !extractObjects.isPending) {
			const file = new File([floorplanBlob], "floorplan.png", {
				type: "image/png",
			});
			extractObjects.mutate(file);
		}
	}, [floorplanBlob, floorplanObjects.length]);

	const isGenerating = generatePhotorealistic.isPending;

	// Pan and zoom state
	const [transform, setTransform] = useState<Transform>({
		offsetX: 0,
		offsetY: 0,
		scale: 0.6,
	});
	const [isPanning, setIsPanning] = useState(false);
	const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });


	const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
		if (!showSelectArea) {
			setIsPanning(true);
			setLastMousePos({ x: e.clientX, y: e.clientY });
			return;
		}

		const rect = containerRef.current?.getBoundingClientRect();
		if (!rect) return;

		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		setIsSelecting(true);
		setSelectionBox({
			startX: x,
			startY: y,
			endX: x,
			endY: y,
		});
	};

	const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
		if (isPanning) {
			const dx = e.clientX - lastMousePos.x;
			const dy = e.clientY - lastMousePos.y;

			setTransform((prev) => ({
				...prev,
				offsetX: prev.offsetX + dx,
				offsetY: prev.offsetY + dy,
			}));

			setLastMousePos({ x: e.clientX, y: e.clientY });
			return;
		}

		if (!isSelecting || !selectionBox || !containerRef.current) return;

		const rect = containerRef.current.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		setSelectionBox({
			...selectionBox,
			endX: x,
			endY: y,
		});
	};

	const handleMouseUp = () => {
		setIsSelecting(false);
		setIsPanning(false);
		setSelectionBox(null);
	};

	const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
		e.preventDefault();

		const container = containerRef.current;
		if (!container) return;

		const rect = container.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;

		const zoomIntensity = 0.1;
		const delta = e.deltaY > 0 ? -zoomIntensity : zoomIntensity;
		const newScale = Math.max(0.1, Math.min(5, transform.scale + delta));

		const scaleChange = newScale / transform.scale;

		setTransform({
			scale: newScale,
			offsetX: mouseX - (mouseX - transform.offsetX) * scaleChange,
			offsetY: mouseY - (mouseY - transform.offsetY) * scaleChange,
		});
	};

	// Zoom controls
	const handleZoomIn = () => {
		setTransform((prev) => ({
			...prev,
			scale: Math.min(5, prev.scale + 0.2),
		}));
	};

	const handleZoomOut = () => {
		setTransform((prev) => ({
			...prev,
			scale: Math.max(0.1, prev.scale - 0.2),
		}));
	};

	const handleResetZoom = () => {
		setTransform({
			offsetX: 0,
			offsetY: 0,
			scale: 1,
		});
	};

	// Get selection rectangle styles
	const getSelectionStyle = () => {
		if (!selectionBox) return {};

		const x = Math.min(selectionBox.startX, selectionBox.endX);
		const y = Math.min(selectionBox.startY, selectionBox.endY);
		const width = Math.abs(selectionBox.endX - selectionBox.startX);
		const height = Math.abs(selectionBox.endY - selectionBox.startY);

		return {
			left: `${x}px`,
			top: `${y}px`,
			width: `${width}px`,
			height: `${height}px`,
		};
	};

	return (
		<div className='h-full flex overflow-hidden p-6'>
			{/* Main Panel - Render Display */}
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
						<div className='flex items-center gap-4'>
							<div className='flex items-center gap-3'>
								<div className='w-1.5 h-1.5 rounded-full' style={{ background: '#CC7A4A' }} />
								<h3 className='text-xl font-semibold' style={{ color: '#5A4A3D' }}>
									{isGenerating
										? "Generating Your Render..."
										: "Your Photorealistic Render"}
								</h3>
							</div>
							{!isGenerating && (
								<div className='flex items-center gap-0.5 p-0.5 rounded-lg' style={{ background: '#FFFFFF', border: '1px solid #E5DDD0' }}>
									<button
										onClick={handleZoomOut}
										className='px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200'
										style={{ color: '#6B5D4F' }}
										title='Zoom Out'
										onMouseEnter={(e) => {
											e.currentTarget.style.background = '#FAF8F5';
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.background = 'transparent';
										}}
									>
										−
									</button>
									<span className='px-3 text-sm font-medium min-w-[60px] text-center' style={{ color: '#5A4A3D' }}>
										{Math.round(transform.scale * 100)}%
									</span>
									<button
										onClick={handleZoomIn}
										className='px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200'
										style={{ color: '#6B5D4F' }}
										title='Zoom In'
										onMouseEnter={(e) => {
											e.currentTarget.style.background = '#FAF8F5';
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.background = 'transparent';
										}}
									>
										+
									</button>
									<div className='w-px h-4 mx-1' style={{ background: '#E5DDD0' }} />
									<button
										onClick={handleResetZoom}
										className='px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200'
										style={{ color: '#6B5D4F' }}
										title='Reset Zoom'
										onMouseEnter={(e) => {
											e.currentTarget.style.background = '#FAF8F5';
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.background = 'transparent';
										}}
									>
										Reset
									</button>
								</div>
							)}
						</div>
						{!isGenerating && (
							<div className='flex items-center gap-2'>
								<button
									onClick={() =>
										setShowSelectArea(!showSelectArea)
									}
									className='px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2'
									style={{
										background: showSelectArea ? '#CC7A4A' : '#FFFFFF',
										color: showSelectArea ? '#FFFFFF' : '#6B5D4F',
										border: showSelectArea ? 'none' : '1px solid #E5DDD0',
										boxShadow: showSelectArea ? '0 4px 12px rgba(204, 122, 74, 0.3)' : 'none'
									}}
								>
									{showSelectArea ? (
										<>
											<span>✕</span>
											<span>Cancel</span>
										</>
									) : (
										<>
											<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
												<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4' />
											</svg>
											<span>Select Area</span>
										</>
									)}
								</button>
								<button
									onClick={onPrevious}
									className='px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200'
									style={{
										background: '#FFFFFF',
										color: '#6B5D4F',
										border: '1px solid #E5DDD0'
									}}
								>
									← Back
								</button>
								<button
									onClick={onNext}
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
									Generate 3D View →
								</button>
							</div>
						)}
					</div>

					{/* Render Content */}
					<div className='flex-1 flex items-center justify-center overflow-hidden relative' style={{ 
						background: '#FAF8F5',
						backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(140, 103, 66, 0.03) 1px, transparent 0)',
						backgroundSize: '24px 24px'
					}}>
						{isGenerating ? (
							<AsciiLoader 
								message="RENDERING" 
								subMessage="Transforming your sketch with AI..."
								isComplete={generatePhotorealistic.isSuccess}
							/>
						) : renderDataUrl ? (
							<div
								ref={containerRef}
								className='relative w-full h-full overflow-hidden rounded-xl'
								style={{ 
									background: '#FFFFFF',
									cursor: showSelectArea ? 'crosshair' : isPanning ? 'grabbing' : 'grab'
								}}
								onMouseDown={handleMouseDown}
								onMouseMove={handleMouseMove}
								onMouseUp={handleMouseUp}
								onMouseLeave={handleMouseUp}
								onWheel={handleWheel}
							>
								{/* Render mode indicator */}
								<div className='absolute top-4 left-4 px-4 py-2 rounded-lg backdrop-blur-md z-10 transition-all duration-200' style={{
									background: 'rgba(255, 255, 255, 0.95)',
									border: '1px solid rgba(140, 103, 66, 0.15)',
									boxShadow: '0 4px 12px rgba(90, 74, 61, 0.08)'
								}}>
									<div className='flex items-center gap-2'>
										<div className={`w-1.5 h-1.5 rounded-full ${showSelectArea ? 'animate-pulse' : ''}`} style={{ background: '#CC7A4A' }} />
										<span className='text-xs font-medium' style={{ color: '#6B5D4F' }}>
											{showSelectArea ? "Selection Mode" : "Pan & Zoom"}
										</span>
										{!showSelectArea && (
											<span className='text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold' style={{
												background: 'rgba(204, 122, 74, 0.1)',
												color: '#CC7A4A'
											}}>
												Scroll
											</span>
										)}
									</div>
								</div>

								<img
									src={renderDataUrl}
									alt='Photorealistic Render'
									className='absolute transition-transform duration-100 ease-out select-none'
									style={{
										transform: `translate(${transform.offsetX}px, ${transform.offsetY}px) scale(${transform.scale})`,
										transformOrigin: "0 0",
										maxWidth: "none",
										pointerEvents: "none",
									}}
									draggable={false}
								/>

								{showSelectArea && (
									<div className='absolute inset-0 pointer-events-none'>
										{!isSelecting && !selectionBox && (
											<div className='absolute inset-0 flex items-center justify-center backdrop-blur-sm' style={{
												background: 'rgba(90, 74, 61, 0.15)'
											}}>
												<div className='px-6 py-3 rounded-xl font-medium text-sm' style={{
													background: 'rgba(255, 255, 255, 0.95)',
													backdropFilter: 'blur(20px)',
													color: '#5A4A3D',
													border: '1px solid rgba(140, 103, 66, 0.15)',
													boxShadow: '0 8px 24px rgba(90, 74, 61, 0.2)'
												}}>
													Click and drag to select an area to regenerate
												</div>
											</div>
										)}

										{selectionBox && (
											<>
												<div className='absolute inset-0 backdrop-blur-sm' style={{
													background: 'rgba(90, 74, 61, 0.2)'
												}} />
												<div
													className='absolute border-2 rounded-lg transition-all duration-100'
													style={{
														...getSelectionStyle(),
														borderColor: '#CC7A4A',
														background: 'rgba(204, 122, 74, 0.15)',
														boxShadow: '0 0 0 1px rgba(204, 122, 74, 0.3), inset 0 0 20px rgba(204, 122, 74, 0.1)'
													}}
												/>
											</>
										)}
									</div>
								)}
							</div>
						) : (
							<div className='text-center space-y-6'>
								<div className='text-6xl'>🎨</div>
								<div className='space-y-2'>
									<p className='text-lg font-semibold' style={{ color: '#5A4A3D' }}>
										No sketch data available
									</p>
									<p className='text-sm' style={{ color: '#8C6742' }}>
										Please go back and create a sketch first.
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
									← Back to Sketch
								</button>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
