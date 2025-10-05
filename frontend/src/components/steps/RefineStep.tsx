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
	// Screen coordinates for display (absolute positioning)
	screenX: number;
	screenY: number;
	// Image coordinates for backend (normalized or pixel coords)
	bbox: {
		x: number;
		y: number;
		width: number;
		height: number;
	};
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
		bbox: { x: number; y: number; width: number; height: number };
	} | null>(null);
	const [downloadNotification, setDownloadNotification] = useState(false);
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

	// Coordinate transformation helpers
	const screenToImageCoords = (
		screenX: number,
		screenY: number
	): { x: number; y: number } => {
		if (!imgRef.current || !containerRef.current) {
			return { x: 0, y: 0 };
		}

		const rect = containerRef.current.getBoundingClientRect();
		const relativeX = screenX - rect.left;
		const relativeY = screenY - rect.top;

		// Account for transform (pan and zoom)
		const imageX = (relativeX - transform.offsetX) / transform.scale;
		const imageY = (relativeY - transform.offsetY) / transform.scale;

		return { x: imageX, y: imageY };
	};

	const imageToScreenCoords = (
		imageX: number,
		imageY: number
	): { x: number; y: number } => {
		if (!containerRef.current) {
			return { x: 0, y: 0 };
		}

		const rect = containerRef.current.getBoundingClientRect();

		// Apply transform (zoom and pan)
		const screenX = imageX * transform.scale + transform.offsetX + rect.left;
		const screenY = imageY * transform.scale + transform.offsetY + rect.top;

		return { x: screenX, y: screenY };
	};

	const createAnnotatedImage = async (): Promise<Blob | null> => {
		if (!floorplanDataUrl || annotations.length === 0) return null;

		console.log("=== Creating Annotated Image ===");
		console.log("Number of annotations:", annotations.length);
		console.log("Annotations:", annotations);

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

		// Draw bounding boxes
		ctx.strokeStyle = "#E07B47";
		ctx.lineWidth = 5;
		ctx.fillStyle = "rgba(224, 123, 71, 0.3)";

		console.log("Drawing bounding boxes:");
		annotations.forEach((annotation, index) => {
			const { bbox } = annotation;
			console.log(`  Box ${index}:`, bbox, "Text:", annotation.text);

			// Draw filled rectangle
			ctx.fillRect(bbox.x, bbox.y, bbox.width, bbox.height);
			// Draw border
			ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);

			// Draw text label
			ctx.fillStyle = "#E07B47";
			ctx.font = "bold 24px sans-serif";
			const textY = bbox.y > 30 ? bbox.y - 10 : bbox.y + bbox.height + 25;
			ctx.fillText(annotation.text, bbox.x + 5, textY);
			ctx.fillStyle = "rgba(224, 123, 71, 0.3)";
		});

		console.log("Finished drawing boxes on canvas");

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

		// Collect all annotations into a single instruction
		const instruction =
			annotations.length > 0
				? annotations.map((a) => a.text).join("; ")
				: "improve the floorplan";

		let fileToSend: File;

		// If we have annotations, create annotated image with bounding boxes
		if (annotations.length > 0) {
			const annotatedBlob = await createAnnotatedImage();
			if (annotatedBlob) {
				fileToSend = new File([annotatedBlob], "floorplan_annotated.png", {
					type: "image/png",
				});

				// Verbose logging for debugging
				console.log("=== REFINE STAGE: Sending to Backend ===");
				console.log("Image file:", fileToSend.name, fileToSend.size, "bytes");

				// AUTO-DOWNLOAD the annotated image for debugging
				const dataUrl = URL.createObjectURL(annotatedBlob);
				const downloadLink = document.createElement('a');
				downloadLink.href = dataUrl;
				downloadLink.download = `annotated_floorplan_${Date.now()}.png`;
				document.body.appendChild(downloadLink);
				downloadLink.click();
				document.body.removeChild(downloadLink);
				URL.revokeObjectURL(dataUrl);

				console.log("✅ Downloaded annotated image to your Downloads folder");
				console.log("Check the downloaded image to verify bounding boxes are visible");

				// Show notification
				setDownloadNotification(true);
				setTimeout(() => setDownloadNotification(false), 5000);

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

				console.log("Bounding boxes:");
				console.table(
					annotations.map((a) => ({
						id: a.id,
						text: a.text,
						x: Math.round(a.bbox.x),
						y: Math.round(a.bbox.y),
						width: Math.round(a.bbox.width),
						height: Math.round(a.bbox.height),
					}))
				);

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
				// Store the selection box for later conversion to annotation
				const rect = containerRef.current?.getBoundingClientRect();
				if (rect) {
					// Convert selection box to image coordinates
					// selectionBox coords are container-relative, convert to screen coords
					const minX = Math.min(selectionBox.startX, selectionBox.endX);
					const minY = Math.min(selectionBox.startY, selectionBox.endY);

					// Convert container-relative coords to screen coords for screenToImageCoords
					const screenMinX = minX + rect.left;
					const screenMinY = minY + rect.top;
					const screenMaxX = screenMinX + width;
					const screenMaxY = screenMinY + height;

					const topLeftImage = screenToImageCoords(screenMinX, screenMinY);
					const bottomRightImage = screenToImageCoords(screenMaxX, screenMaxY);

					console.log("Selection:", {
						container: { minX, minY, width, height },
						screen: { screenMinX, screenMinY, screenMaxX, screenMaxY },
						image: { topLeftImage, bottomRightImage },
					});

					setTempAnnotationPos({
						x: e.clientX,
						y: e.clientY,
						bbox: {
							x: topLeftImage.x,
							y: topLeftImage.y,
							width: bottomRightImage.x - topLeftImage.x,
							height: bottomRightImage.y - topLeftImage.y,
						},
					});
					setShowAnnotationInput(true);
				}
			}

			setSelectionBox(null);
		}

		setIsPanning(false);
	};

	const handleAddAnnotation = () => {
		if (annotationText.trim() && tempAnnotationPos) {
			const newAnnotation: Annotation = {
				id: Date.now().toString(),
				screenX: tempAnnotationPos.x,
				screenY: tempAnnotationPos.y,
				bbox: tempAnnotationPos.bbox,
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
									className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${showSelectArea
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
										? "Applying..."
										: "Apply Changes"}
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

								{/* Persistent bounding boxes with text labels */}
								{annotations.map((annotation) => {
									const topLeft = imageToScreenCoords(
										annotation.bbox.x,
										annotation.bbox.y
									);
									const bottomRight = imageToScreenCoords(
										annotation.bbox.x + annotation.bbox.width,
										annotation.bbox.y + annotation.bbox.height
									);

									const screenWidth = bottomRight.x - topLeft.x;
									const screenHeight = bottomRight.y - topLeft.y;

									return (
										<div key={`bbox-${annotation.id}`}>
											{/* Bounding box rectangle */}
											<div
												className='absolute pointer-events-none border-2 border-[#E07B47] bg-[#E07B47]/10'
												style={{
													left: topLeft.x - containerRef.current!.getBoundingClientRect().left,
													top: topLeft.y - containerRef.current!.getBoundingClientRect().top,
													width: screenWidth,
													height: screenHeight,
												}}
											/>
											{/* Annotation text bubble */}
											<div
												className='absolute pointer-events-auto z-10'
												style={{
													left: annotation.screenX,
													top: annotation.screenY,
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
										</div>
									);
								})}

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

			{/* Download Notification */}
			{downloadNotification && (
				<div className='fixed top-4 right-4 z-50 bg-[#1A1815] text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 animate-fade-in'>
					<div className='w-3 h-3 bg-green-500 rounded-full animate-pulse'></div>
					<div>
						<p className='font-medium'>Annotated Image Downloaded</p>
						<p className='text-sm text-gray-300'>Check your Downloads folder to verify bounding boxes</p>
					</div>
				</div>
			)}
		</div>
	);
}
