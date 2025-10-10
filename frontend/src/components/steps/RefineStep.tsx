"use client";

import { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { Highlighter } from "lucide-react";
import {
	useGenerateFloorplan,
	useReviseFloorplan,
} from "@/hooks/useApi";

interface RefineStepProps {
	onNext: () => void;
	onPrevious: () => void;
	currentStep: number;
}

interface HighlighterStroke {
	id: string;
	points: number[]; // [x1, y1, x2, y2, ...]
}

interface Transform {
	offsetX: number;
	offsetY: number;
	scale: number;
}

export default function RefineStep({ onNext, onPrevious }: RefineStepProps) {
	const sketchDataUrl = useAppStore((state) => state.sketchDataUrl);
	const floorplanDataUrl = useAppStore((state) => state.floorplanDataUrl);
	const floorplanBlob = useAppStore((state) => state.floorplanBlob);

	const [isHighlighting, setIsHighlighting] = useState(false);
	const [highlighterStrokes, setHighlighterStrokes] = useState<HighlighterStroke[]>([]);
	const [currentStroke, setCurrentStroke] = useState<number[]>([]);
	const [instructionText, setInstructionText] = useState("");
	const containerRef = useRef<HTMLDivElement>(null);
	const imgRef = useRef<HTMLImageElement>(null);

	// Pan and zoom state
	const [transform, setTransform] = useState<Transform>({
		offsetX: 0,
		offsetY: 0,
		scale: 1,
	});
	const [isPanning, setIsPanning] = useState(false);
	const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

	const generateFloorplan = useGenerateFloorplan();
	const reviseFloorplan = useReviseFloorplan();
	const hasRequestedGenerateRef = useRef(false);

	// Generate floorplan from sketch on mount (guard against dev double-invocation)
	useEffect(() => {
		if (hasRequestedGenerateRef.current) return;
		if (sketchDataUrl && !floorplanDataUrl) {
			hasRequestedGenerateRef.current = true;
			// Convert data URL to file
			fetch(sketchDataUrl)
				.then((res) => res.blob())
				.then((blob) => {
					const file = new File([blob], "sketch.png", {
						type: "image/png",
					});
					generateFloorplan.mutate(file);
				});
		}
	}, [sketchDataUrl, floorplanDataUrl]);

	const createAnnotatedImage = async (): Promise<Blob | null> => {
		if (!floorplanDataUrl || highlighterStrokes.length === 0) return null;

		console.log("=== Creating Annotated Image ===");
		console.log("Number of highlighter strokes:", highlighterStrokes.length);

		// Create a canvas to draw the annotated image
		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d");
		if (!ctx) return null;

		// Load image from data URL
		const img = new Image();
		img.src = floorplanDataUrl;

		// Wait for image to load
		await new Promise<void>((resolve, reject) => {
			img.onload = () => resolve();
			img.onerror = () => reject(new Error("Failed to load image"));
		});

		console.log("Image loaded. Dimensions:", img.width, "x", img.height);

		canvas.width = img.width;
		canvas.height = img.height;

		// Draw the original image
		ctx.drawImage(img, 0, 0);

		// Draw green highlighter strokes
		ctx.strokeStyle = "rgba(34, 197, 94, 0.6)"; // Green with transparency
		ctx.lineWidth = 20;
		ctx.lineCap = "round";
		ctx.lineJoin = "round";

		console.log("Drawing highlighter strokes:");
		highlighterStrokes.forEach((stroke, index) => {
			console.log(`  Stroke ${index}: ${stroke.points.length / 2} points`);

			if (stroke.points.length < 4) return; // Need at least 2 points

			ctx.beginPath();
			ctx.moveTo(stroke.points[0], stroke.points[1]);

			for (let i = 2; i < stroke.points.length; i += 2) {
				ctx.lineTo(stroke.points[i], stroke.points[i + 1]);
			}

			ctx.stroke();
		});

		console.log("Finished drawing highlighter strokes on canvas");

		// Convert canvas to blob
		return new Promise((resolve) => {
			canvas.toBlob((blob) => {
				console.log("Canvas converted to blob:", blob?.size, "bytes");
				resolve(blob);
			}, "image/png");
		});
	};

	const handleRegenerate = async () => {
		if (!floorplanBlob) return;

		const instruction = instructionText.trim() || "improve the floorplan";
		let fileToSend: File;

		// If we have highlighter strokes, create annotated image
		if (highlighterStrokes.length > 0) {
			const annotatedBlob = await createAnnotatedImage();
			if (annotatedBlob) {
				fileToSend = new File([annotatedBlob], "floorplan_annotated.png", {
					type: "image/png",
				});

				// Verbose logging for debugging
				console.log("=== REFINE STAGE: Sending to Backend ===");
				console.log("Image file:", fileToSend.name, fileToSend.size, "bytes");



				// Also log base64 for completeness
				const reader = new FileReader();
				reader.onload = (e) => {
					const base64DataUrl = e.target?.result as string;
					console.log("Image data URL (base64):", base64DataUrl);
				};
				reader.readAsDataURL(fileToSend);

				if (imgRef.current) {
					console.log("Image dimensions:", {
						width: imgRef.current.naturalWidth,
						height: imgRef.current.naturalHeight,
					});
				}

				console.log("Highlighter strokes:", highlighterStrokes.length);
				console.log("Instruction text:", instruction);
				console.log("=========================================");
			} else {
				// Fallback to original image
				fileToSend = new File([floorplanBlob], "floorplan.png", {
					type: "image/png",
				});
			}
		} else {
			// No annotations, use original image
			fileToSend = new File([floorplanBlob], "floorplan.png", {
				type: "image/png",
			});
		}

		reviseFloorplan.mutate({ floorplanFile: fileToSend, instruction });
		setHighlighterStrokes([]); // Clear highlighter strokes after regenerating
	};

    const isGenerating = generateFloorplan.isPending;
    const isRefining = reviseFloorplan.isPending;

	const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
		if (!isHighlighting) {
			// Start panning
			setIsPanning(true);
			setLastMousePos({ x: e.clientX, y: e.clientY });
			return;
		}

		const rect = containerRef.current?.getBoundingClientRect();
		if (!rect) return;

		// Convert to image coordinates
		const x = (e.clientX - rect.left - transform.offsetX) / transform.scale;
		const y = (e.clientY - rect.top - transform.offsetY) / transform.scale;

		// Start new stroke
		setCurrentStroke([x, y]);
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

		if (!isHighlighting || currentStroke.length === 0 || !containerRef.current) return;

		const rect = containerRef.current.getBoundingClientRect();

		// Convert to image coordinates
		const x = (e.clientX - rect.left - transform.offsetX) / transform.scale;
		const y = (e.clientY - rect.top - transform.offsetY) / transform.scale;

		setCurrentStroke((prev) => [...prev, x, y]);
	};

	const handleMouseUp = () => {
		if (currentStroke.length >= 4) {
			// Save the stroke
			setHighlighterStrokes((prev) => [
				...prev,
				{
					id: Date.now().toString(),
					points: currentStroke,
				},
			]);
		}
		setCurrentStroke([]);
		setIsPanning(false);
	};

	const handleClearHighlighter = () => {
		setHighlighterStrokes([]);
	};

	// Wheel handler for zoom (using native event to prevent passive warning)
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const handleWheel = (e: WheelEvent) => {
			e.preventDefault();

			const rect = container.getBoundingClientRect();
			const mouseX = e.clientX - rect.left;
			const mouseY = e.clientY - rect.top;

			const zoomIntensity = 0.03; // Reduced from 0.1 for less sensitivity
			const delta = e.deltaY > 0 ? -zoomIntensity : zoomIntensity;
			const newScale = Math.max(0.1, Math.min(5, transform.scale + delta));

			const scaleChange = newScale / transform.scale;

			setTransform({
				scale: newScale,
				offsetX: mouseX - (mouseX - transform.offsetX) * scaleChange,
				offsetY: mouseY - (mouseY - transform.offsetY) * scaleChange,
			});
		};

		container.addEventListener("wheel", handleWheel, { passive: false });

		return () => {
			container.removeEventListener("wheel", handleWheel);
		};
	}, [transform]);

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

	return (
		<div className='h-full flex overflow-hidden p-6'>
			<div className='flex-1 flex flex-col min-w-0'>
				<div className='rounded-2xl shadow-2xl flex-1 flex flex-col overflow-hidden transition-all duration-300 hover:shadow-3xl' style={{
					background: 'rgba(255, 255, 255, 0.85)',
					backdropFilter: 'blur(20px)',
					border: '1px solid rgba(140, 103, 66, 0.15)',
					boxShadow: '0 8px 32px rgba(90, 74, 61, 0.12)'
				}}>
					<div className='px-8 py-5 border-b flex items-center justify-between' style={{
						borderBottom: '1px solid rgba(140, 103, 66, 0.12)'
					}}>
						<div className='flex items-center gap-4'>
							<div className='flex items-center gap-3'>
								<div className='w-1.5 h-1.5 rounded-full' style={{ background: '#CC7A4A' }} />
								<h3 className='text-xl font-semibold' style={{ color: '#5A4A3D' }}>
									{isGenerating
										? "Generating Floorplan..."
										: "Refine & Annotate"}
								</h3>
							</div>
							{!isGenerating && floorplanDataUrl && (
								<div className='flex items-center gap-0.5 p-0.5 rounded-lg' style={{ background: '#FFFFFF', border: '1px solid #E5DDD0' }}>
									<button
										onClick={handleZoomOut}
										className='px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200'
										style={{ color: '#6B5D4F' }}
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
						{!isGenerating && floorplanDataUrl && (
							<div className='flex items-center gap-2'>
                                <button
                                    onClick={() => setIsHighlighting(!isHighlighting)}
                                    title='Highlighter'
                                    aria-label='Highlighter'
                                    className='px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2'
									style={{
										background: isHighlighting ? '#10B981' : '#FFFFFF',
										color: isHighlighting ? '#FFFFFF' : '#6B5D4F',
										border: isHighlighting ? 'none' : '1px solid #E5DDD0',
										boxShadow: isHighlighting ? '0 2px 8px rgba(16, 185, 129, 0.3)' : 'none'
									}}
                                >
                                    <Highlighter size={16} />
									{isHighlighting && <span>Highlighting</span>}
                                </button>
								{highlighterStrokes.length > 0 && (
									<button
										onClick={handleClearHighlighter}
										className='px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200'
										style={{
											background: '#FFFFFF',
											color: '#6B5D4F',
											border: '1px solid #E5DDD0'
										}}
									>
										Clear Highlights
									</button>
								)}
								<button
									onClick={handleRegenerate}
									disabled={reviseFloorplan.isPending}
									className='px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50'
									style={{
										background: '#FFFFFF',
										color: '#6B5D4F',
										border: '1px solid #E5DDD0'
									}}
								>
									{reviseFloorplan.isPending ? "Applying..." : "Apply Changes"}
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
									Continue to Floorplan →
								</button>
							</div>
						)}
					</div>

					<div className='flex-1 flex items-center justify-center overflow-hidden' style={{
						background: '#FAF8F5',
						backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(140, 103, 66, 0.03) 1px, transparent 0)',
						backgroundSize: '24px 24px'
					}}>
                        {isGenerating ? (
							<div className='text-center space-y-6'>
								<div className='relative w-16 h-16 mx-auto'>
									<div className='absolute inset-0 border-3 rounded-full' style={{ borderColor: '#E5DDD0' }}></div>
									<div className='absolute inset-0 border-3 border-transparent rounded-full animate-spin' style={{ borderTopColor: '#CC7A4A' }}></div>
								</div>
								<div className='space-y-2'>
									<p className='text-lg font-semibold' style={{ color: '#5A4A3D' }}>
										Generating floorplan from your sketch...
									</p>
								</div>
							</div>
						) : floorplanDataUrl ? (
							<div
								ref={containerRef}
								className='relative w-full h-full bg-white overflow-hidden'
								onMouseDown={handleMouseDown}
								onMouseMove={handleMouseMove}
								onMouseUp={handleMouseUp}
								onMouseLeave={handleMouseUp}
								style={{
									cursor: isHighlighting
										? "crosshair"
										: isPanning
										? "grabbing"
										: "grab",
								}}
							>
								<img
									ref={imgRef}
									src={floorplanDataUrl}
									alt='Floorplan'
									className='absolute'
									style={{
										transform: `translate(${transform.offsetX}px, ${transform.offsetY}px) scale(${transform.scale})`,
										transformOrigin: "0 0",
										maxWidth: "none",
										pointerEvents: "none",
									}}
								/>

								{/* Green highlighter strokes overlay */}
								<svg
									className='absolute inset-0 pointer-events-none'
									style={{
										width: '100%',
										height: '100%',
									}}
								>
									{/* Render saved strokes */}
									{highlighterStrokes.map((stroke) => {
										if (stroke.points.length < 4) return null;

										// Convert image coords to screen coords
										const screenPoints = [];
										for (let i = 0; i < stroke.points.length; i += 2) {
											const screenX = stroke.points[i] * transform.scale + transform.offsetX;
											const screenY = stroke.points[i + 1] * transform.scale + transform.offsetY;
											screenPoints.push(`${screenX},${screenY}`);
										}

										return (
											<polyline
												key={stroke.id}
												points={screenPoints.join(' ')}
												stroke="rgba(34, 197, 94, 0.6)"
												strokeWidth={20 * transform.scale}
												strokeLinecap="round"
												strokeLinejoin="round"
												fill="none"
											/>
										);
									})}

									{/* Render current stroke being drawn */}
									{currentStroke.length >= 4 && (() => {
										const screenPoints = [];
										for (let i = 0; i < currentStroke.length; i += 2) {
											const screenX = currentStroke[i] * transform.scale + transform.offsetX;
											const screenY = currentStroke[i + 1] * transform.scale + transform.offsetY;
											screenPoints.push(`${screenX},${screenY}`);
										}

										return (
											<polyline
												points={screenPoints.join(' ')}
												stroke="rgba(34, 197, 94, 0.6)"
												strokeWidth={20 * transform.scale}
												strokeLinecap="round"
												strokeLinejoin="round"
												fill="none"
											/>
										);
									})()}
								</svg>

                                {isRefining && (
                                    <div className='absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-20'>
                                        <div className='text-center space-y-3'>
                                            <div className='w-12 h-12 border-4 border-[#E5E2DA] border-t-[#E07B47] rounded-full animate-spin mx-auto'></div>
                                            <p className='text-[#6B6862] text-sm'>Applying refinement...</p>
                                        </div>
                                    </div>
                                )}

								{/* Instruction text input - positioned at bottom */}
								{!isGenerating && (
									<div className='absolute bottom-4 left-1/2 -translate-x-1/2 z-10'>
										<div className='bg-white rounded-xl shadow-2xl p-4 border border-[#E5E2DA] min-w-[500px]'>
											<label className='block text-sm font-medium text-[#1A1815] mb-2'>
												Instructions (optional)
											</label>
											<textarea
												value={instructionText}
												onChange={(e) => setInstructionText(e.target.value)}
												placeholder='Describe what changes you want to make...'
												className='w-full bg-[#F5F3EF] border-0 rounded-lg px-3 py-2 text-sm text-[#1A1815] placeholder-[#6B6862] resize-none focus:outline-none focus:ring-0'
												rows={2}
											/>
										</div>
									</div>
								)}
							</div>
						) : (
							<div className='text-center space-y-4'>
								<p className='text-[#6B6862] text-sm'>
									No sketch data available. Please go back and
									create a sketch.
								</p>
								<button
									onClick={onPrevious}
									className='px-4 py-2 rounded-lg text-sm font-medium bg-[#E07B47] text-white hover:bg-[#D06A36] transition-colors'
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
