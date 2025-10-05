"use client";

import { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import {
	useGenerateFloorplan,
	useReviseFloorplan,
} from "@/hooks/useApi";

interface RefineStepProps {
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

interface Annotation {
	id: string;
	x: number;
	y: number;
	text: string;
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

	const [showSelectArea, setShowSelectArea] = useState(false);
	const [isSelecting, setIsSelecting] = useState(false);
	const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
	const [annotations, setAnnotations] = useState<Annotation[]>([]);
	const [showAnnotationInput, setShowAnnotationInput] = useState(false);
	const [annotationText, setAnnotationText] = useState("");
	const [tempAnnotationPos, setTempAnnotationPos] = useState<{
		x: number;
		y: number;
	} | null>(null);
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

	// Generate floorplan from sketch on mount
	useEffect(() => {
		if (sketchDataUrl && !floorplanDataUrl) {
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
	}, [sketchDataUrl]);

	const handleRegenerate = () => {
		if (!floorplanBlob) return;

		// Collect all annotations into a single instruction
		const instruction =
			annotations.length > 0
				? annotations.map((a) => a.text).join("; ")
				: "improve the floorplan";

		const file = new File([floorplanBlob], "floorplan.png", {
			type: "image/png",
		});

		reviseFloorplan.mutate({ floorplanFile: file, instruction });
		setAnnotations([]); // Clear annotations after regenerating
	};

	const isGenerating =
		generateFloorplan.isPending || reviseFloorplan.isPending;

	const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
		if (!showSelectArea) {
			// Start panning
			setIsPanning(true);
			setLastMousePos({ x: e.clientX, y: e.clientY });
			return;
		}

		const rect = containerRef.current?.getBoundingClientRect();
		if (!rect) return;

		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		// Start selection
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

	const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
		if (isSelecting && selectionBox) {
			setIsSelecting(false);

			const width = Math.abs(selectionBox.endX - selectionBox.startX);
			const height = Math.abs(selectionBox.endY - selectionBox.startY);

			// Only show input if there's an actual selection (not just a click)
			if (width > 5 && height > 5) {
				setTempAnnotationPos({ x: e.clientX, y: e.clientY });
				setShowAnnotationInput(true);
			}

			setSelectionBox(null);
		}

		setIsPanning(false);
	};

	const handleAddAnnotation = () => {
		if (annotationText.trim() && tempAnnotationPos) {
			const newAnnotation: Annotation = {
				id: Date.now().toString(),
				x: tempAnnotationPos.x,
				y: tempAnnotationPos.y,
				text: annotationText,
			};
			setAnnotations([...annotations, newAnnotation]);
			setAnnotationText("");
			setShowAnnotationInput(false);
			setTempAnnotationPos(null);
		}
	};

	const handleDeleteAnnotation = (id: string) => {
		setAnnotations(annotations.filter((a) => a.id !== id));
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
			<div className='flex-1 p-4 flex flex-col min-w-0'>
				<div className='bg-white rounded-2xl shadow-lg flex-1 flex flex-col overflow-hidden'>
					<div className='px-6 py-4 border-b border-[#E5E2DA] flex items-center justify-between'>
						<div className='flex items-center gap-4'>
							<h3 className='text-lg font-medium text-[#1A1815]'>
								{isGenerating
									? "Generating Floorplan..."
									: "Refine & Annotate"}
							</h3>
							{!isGenerating && floorplanDataUrl && (
								<div className='flex items-center gap-1 bg-[#F5F3EF] rounded-lg p-1'>
									<button
										onClick={handleZoomOut}
										className='px-3 py-1 rounded text-sm font-medium text-[#6B6862] hover:bg-white transition-colors'
									>
										−
									</button>
									<span className='px-2 text-sm text-[#6B6862] min-w-[60px] text-center'>
										{Math.round(transform.scale * 100)}%
									</span>
									<button
										onClick={handleZoomIn}
										className='px-3 py-1 rounded text-sm font-medium text-[#6B6862] hover:bg-white transition-colors'
									>
										+
									</button>
									<button
										onClick={handleResetZoom}
										className='px-3 py-1 rounded text-xs font-medium text-[#6B6862] hover:bg-white transition-colors ml-1'
									>
										Reset
									</button>
								</div>
							)}
						</div>
						{!isGenerating && floorplanDataUrl && (
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
										? "Cancel Annotation"
										: "Add Annotation"}
								</button>
								<button
									onClick={handleRegenerate}
									disabled={reviseFloorplan.isPending}
									className='px-4 py-2 rounded-lg text-sm font-medium bg-[#F5F3EF] text-[#6B6862] hover:bg-[#E5E2DA] transition-colors disabled:opacity-50'
								>
									{reviseFloorplan.isPending
										? "Regenerating..."
										: "Regenerate"}
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

					<div className='flex-1 flex items-center justify-center bg-[#F5F3EF] overflow-hidden'>
						{isGenerating ? (
							<div className='text-center space-y-4'>
								<div className='w-16 h-16 border-4 border-[#E5E2DA] border-t-[#E07B47] rounded-full animate-spin mx-auto'></div>
								<p className='text-[#6B6862] text-sm'>
									Generating floorplan from your sketch...
								</p>
							</div>
						) : floorplanDataUrl ? (
							<div
								ref={containerRef}
								className='relative w-full h-full bg-white overflow-hidden'
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

								{showSelectArea && (
									<div className='absolute inset-0 pointer-events-none'>
										{!isSelecting && !selectionBox && (
											<div className='absolute inset-0 flex items-center justify-center bg-[#1A1815]/20 backdrop-blur-[1px]'>
												<div className='text-white text-sm bg-[#1A1815] px-4 py-2 rounded-lg'>
													Click and drag to select an
													area to annotate
												</div>
											</div>
										)}

										{selectionBox && (
											<>
												<div className='absolute inset-0 bg-[#1A1815]/20 backdrop-blur-[1px]' />
												<div
													className='absolute border-2 border-[#E07B47] bg-[#E07B47]/20'
													style={getSelectionStyle()}
												/>
											</>
										)}
									</div>
								)}

								{annotations.map((annotation) => (
									<div
										key={annotation.id}
										className='absolute pointer-events-auto'
										style={{
											left: annotation.x,
											top: annotation.y,
										}}
									>
										<div className='relative bg-[#E07B47] text-white px-3 py-2 rounded-lg text-sm shadow-lg min-w-[120px]'>
											<button
												onClick={() =>
													handleDeleteAnnotation(
														annotation.id
													)
												}
												className='absolute -top-2 -right-2 w-5 h-5 bg-[#EF4444] rounded-full text-white text-xs hover:bg-[#DC2626] transition-colors'
											>
												×
											</button>
											{annotation.text}
										</div>
									</div>
								))}

								{showAnnotationInput && tempAnnotationPos && (
									<div
										className='absolute bg-white border-2 border-[#E07B47] rounded-lg p-3 shadow-xl z-50'
										style={{
											left: tempAnnotationPos.x,
											top: tempAnnotationPos.y,
										}}
									>
										<textarea
											value={annotationText}
											onChange={(e) =>
												setAnnotationText(e.target.value)
											}
											placeholder='Enter annotation...'
											className='w-64 h-20 border border-[#E5E2DA] rounded px-2 py-1 text-sm resize-none focus:outline-none focus:border-[#E07B47]'
											autoFocus
										/>
										<div className='flex gap-2 mt-2'>
											<button
												onClick={handleAddAnnotation}
												className='px-3 py-1 bg-[#E07B47] text-white text-sm rounded hover:bg-[#D06A36] transition-colors'
											>
												Add
											</button>
											<button
												onClick={() => {
													setShowAnnotationInput(
														false
													);
													setAnnotationText("");
													setTempAnnotationPos(null);
												}}
												className='px-3 py-1 bg-[#F5F3EF] text-[#6B6862] text-sm rounded hover:bg-[#E5E2DA] transition-colors'
											>
												Cancel
											</button>
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
