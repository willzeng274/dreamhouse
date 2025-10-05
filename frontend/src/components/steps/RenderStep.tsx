"use client";

import { useState, useRef, useEffect } from "react";

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
	const [isGenerating, setIsGenerating] = useState(true);
	const [showSelectArea, setShowSelectArea] = useState(false);
	const [isSelecting, setIsSelecting] = useState(false);
	const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	// Pan and zoom state
	const [transform, setTransform] = useState<Transform>({
		offsetX: 0,
		offsetY: 0,
		scale: 0.6,
	});
	const [isPanning, setIsPanning] = useState(false);
	const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

	// Simulate generation
	useState(() => {
		const timer = setTimeout(() => {
			setIsGenerating(false);
		}, 2000);
		return () => clearTimeout(timer);
	});

	// Draw the canvas content
	const drawCanvas = () => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// Clear canvas
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		// Save context state
		ctx.save();

		// Apply transform
		ctx.translate(transform.offsetX, transform.offsetY);
		ctx.scale(transform.scale, transform.scale);

		// Draw background gradient
		const gradient = ctx.createLinearGradient(
			0,
			0,
			canvas.width,
			canvas.height
		);
		gradient.addColorStop(0, "#D4C5B0");
		gradient.addColorStop(1, "#A89176");
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// Draw border frame
		ctx.strokeStyle = "#2D2A25";
		ctx.lineWidth = 8;
		ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);

		// Draw simulated room elements
		// Room 1
		ctx.fillStyle = "#8B7355";
		ctx.fillRect(80, 80, 250, 150);

		// Door
		ctx.fillStyle = "#6B4E32";
		ctx.fillRect(80, 80, 40, 60);

		// Living room furniture (circular table)
		ctx.fillStyle = "#A67B5B";
		ctx.beginPath();
		ctx.arc(180, 450, 80, 0, Math.PI * 2);
		ctx.fill();

		// Table center
		ctx.fillStyle = "#D4A574";
		ctx.beginPath();
		ctx.arc(180, 450, 40, 0, Math.PI * 2);
		ctx.fill();

		// Kitchen area
		ctx.fillStyle = "#4A4A4A";
		ctx.fillRect(canvas.width - 200, canvas.height / 2 - 80, 120, 160);

		// Bedroom
		ctx.fillStyle = "#C4B5A0";
		ctx.fillRect(canvas.width - 200, canvas.height - 250, 120, 180);

		// Windows
		ctx.fillStyle = "rgba(135, 206, 235, 0.5)";
		ctx.fillRect(canvas.width / 4, 50, 60, 60);
		ctx.fillRect((canvas.width * 3) / 4 - 60, 50, 60, 60);

		// Restore context state
		ctx.restore();
	};

	// Update canvas on transform change
	useEffect(() => {
		if (!isGenerating) {
			drawCanvas();
		}
	}, [transform, isGenerating]);

	// Initialize canvas size
	useEffect(() => {
		const updateCanvasSize = () => {
			const canvas = canvasRef.current;
			const container = containerRef.current;
			if (!canvas || !container) return;

			const rect = container.getBoundingClientRect();
			canvas.width = rect.width;
			canvas.height = rect.height;
			drawCanvas();
		};

		if (!isGenerating) {
			updateCanvasSize();
			window.addEventListener("resize", updateCanvasSize);
			return () => window.removeEventListener("resize", updateCanvasSize);
		}
	}, [isGenerating]);

	// Convert screen coordinates to canvas coordinates
	const screenToCanvas = (screenX: number, screenY: number) => {
		const canvasX = (screenX - transform.offsetX) / transform.scale;
		const canvasY = (screenY - transform.offsetY) / transform.scale;
		return { x: canvasX, y: canvasY };
	};

	const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		if (showSelectArea) {
			// Start selection
			setIsSelecting(true);
			setSelectionBox({
				startX: x,
				startY: y,
				endX: x,
				endY: y,
			});
		} else {
			// Start panning
			setIsPanning(true);
			setLastMousePos({ x: e.clientX, y: e.clientY });
		}
	};

	const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		if (isSelecting && selectionBox) {
			// Update selection
			setSelectionBox({
				...selectionBox,
				endX: x,
				endY: y,
			});
		} else if (isPanning) {
			// Update pan
			const dx = e.clientX - lastMousePos.x;
			const dy = e.clientY - lastMousePos.y;

			setTransform((prev) => ({
				...prev,
				offsetX: prev.offsetX + dx,
				offsetY: prev.offsetY + dy,
			}));

			setLastMousePos({ x: e.clientX, y: e.clientY });
		}
	};

	const handleMouseUp = () => {
		if (isSelecting && selectionBox) {
			setIsSelecting(false);

			// Calculate dimensions in screen space
			const x = Math.min(selectionBox.startX, selectionBox.endX);
			const y = Math.min(selectionBox.startY, selectionBox.endY);
			const width = Math.abs(selectionBox.endX - selectionBox.startX);
			const height = Math.abs(selectionBox.endY - selectionBox.startY);

			// Convert to canvas space (actual image coordinates)
			const canvasStart = screenToCanvas(x, y);
			const canvasEnd = screenToCanvas(x + width, y + height);
			const canvasWidth = Math.abs(canvasEnd.x - canvasStart.x);
			const canvasHeight = Math.abs(canvasEnd.y - canvasStart.y);

			// Only show alert if there's an actual selection (not just a click)
			if (width > 5 && height > 5) {
				alert(
					`Selection Details:\n\n` +
						`Screen Coordinates:\n` +
						`X: ${Math.round(x)}px, Y: ${Math.round(y)}px\n` +
						`Width: ${Math.round(width)}px, Height: ${Math.round(
							height
						)}px\n\n` +
						`Canvas Coordinates (for API):\n` +
						`X: ${Math.round(canvasStart.x)}px, Y: ${Math.round(
							canvasStart.y
						)}px\n` +
						`Width: ${Math.round(
							canvasWidth
						)}px, Height: ${Math.round(canvasHeight)}px\n\n` +
						`Zoom: ${Math.round(transform.scale * 100)}%\n\n` +
						`This is where the API call will be made.`
				);
			}

			// Reset selection
			setSelectionBox(null);
		}

		setIsPanning(false);
	};

	// Handle mouse wheel for zoom
	const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
		e.preventDefault();

		const canvas = canvasRef.current;
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;

		// Zoom factor
		const zoomIntensity = 0.1;
		const delta = e.deltaY > 0 ? -zoomIntensity : zoomIntensity;
		const newScale = Math.max(0.1, Math.min(5, transform.scale + delta));

		// Zoom toward mouse position
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
			scale: 0.6,
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
		<div className='h-full flex overflow-hidden'>
			{/* Main Panel - Render Display */}
			<div className='flex-1 p-4 flex flex-col min-w-0'>
				<div className='bg-white rounded-2xl shadow-lg flex-1 flex flex-col overflow-hidden'>
					{/* Header */}
					<div className='px-6 py-4 border-b border-[#E5E2DA] flex items-center justify-between'>
						<div className='flex items-center gap-4'>
							<h3 className='text-lg font-medium text-[#1A1815]'>
								{isGenerating
									? "Generating Your Render..."
									: "Your Photorealistic Render"}
							</h3>
							{!isGenerating && (
								<div className='flex items-center gap-1 bg-[#F5F3EF] rounded-lg p-1'>
									<button
										onClick={handleZoomOut}
										className='px-3 py-1 rounded text-sm font-medium text-[#6B6862] hover:bg-white transition-colors'
										title='Zoom Out'
									>
										−
									</button>
									<span className='px-2 text-sm text-[#6B6862] min-w-[60px] text-center'>
										{Math.round(transform.scale * 100)}%
									</span>
									<button
										onClick={handleZoomIn}
										className='px-3 py-1 rounded text-sm font-medium text-[#6B6862] hover:bg-white transition-colors'
										title='Zoom In'
									>
										+
									</button>
									<button
										onClick={handleResetZoom}
										className='px-3 py-1 rounded text-xs font-medium text-[#6B6862] hover:bg-white transition-colors ml-1'
										title='Reset Zoom'
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
									className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
										showSelectArea
											? "bg-[#1A1815] text-white"
											: "bg-[#F5F3EF] text-[#6B6862] hover:bg-[#E5E2DA]"
									}`}
								>
									{showSelectArea
										? "Cancel Selection"
										: "Select Area"}
								</button>
								<button className='px-4 py-2 rounded-lg text-sm font-medium bg-[#F5F3EF] text-[#6B6862] hover:bg-[#E5E2DA] transition-colors'>
									Regenerate
								</button>
								<button
									onClick={onPrevious}
									className='px-4 py-2 rounded-lg text-sm font-medium bg-[#F5F3EF] text-[#6B6862] hover:bg-[#E5E2DA] transition-colors'
								>
									← Back
								</button>
								<button
									onClick={onNext}
									className='px-6 py-2 rounded-lg text-sm font-medium bg-[#E07B47] text-white hover:bg-[#D06A36] transition-colors'
								>
									Continue to Floorplan →
								</button>
							</div>
						)}
					</div>

					{/* Render Content */}
					<div className='flex-1 flex items-center justify-center bg-[#F5F3EF]'>
						{isGenerating ? (
							<div className='text-center space-y-4'>
								<div className='w-16 h-16 border-4 border-[#E5E2DA] border-t-[#E07B47] rounded-full animate-spin mx-auto'></div>
								<p className='text-[#6B6862] text-sm'>
									Generating photorealistic render...
								</p>
							</div>
						) : (
							<div
								ref={containerRef}
								className='w-full h-full bg-white overflow-hidden relative'
							>
								<canvas
									ref={canvasRef}
									className='w-full h-full'
									onMouseDown={handleMouseDown}
									onMouseMove={handleMouseMove}
									onMouseUp={handleMouseUp}
									onMouseLeave={handleMouseUp}
									onWheel={handleWheel}
									style={{
										cursor: showSelectArea
											? "crosshair"
											: isPanning
											? "grabbing"
											: "grab",
									}}
								/>
								{showSelectArea && (
									<div className='absolute inset-0 pointer-events-none'>
										{/* Instruction text - only show when not selecting */}
										{!isSelecting && !selectionBox && (
											<div className='absolute inset-0 flex items-center justify-center bg-[#1A1815]/20 backdrop-blur-[1px]'>
												<div className='text-white text-sm bg-[#1A1815] px-4 py-2 rounded-lg'>
													Click and drag to select an
													area to regenerate
												</div>
											</div>
										)}

										{/* Selection rectangle */}
										{selectionBox && (
											<>
												<div className='absolute inset-0 bg-[#1A1815]/20 backdrop-blur-[1px]' />
												<div
													className='absolute border-2 border-[#E07B47] bg-[#E07B47]/20'
													style={getSelectionStyle()}
												>
													<div className='absolute -top-6 left-0 text-xs text-white bg-[#1A1815] px-2 py-1 rounded whitespace-nowrap'>
														{Math.round(
															Math.abs(
																selectionBox.endX -
																	selectionBox.startX
															)
														)}{" "}
														×{" "}
														{Math.round(
															Math.abs(
																selectionBox.endY -
																	selectionBox.startY
															)
														)}{" "}
														px
													</div>
												</div>
											</>
										)}
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
