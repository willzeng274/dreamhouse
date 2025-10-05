"use client";

import { useRef, useState, useEffect } from "react";
import { Stage, Layer, Line, Rect, Circle } from "react-konva";
import Konva from "konva";

interface SketchStepProps {
	onNext: () => void;
	onPrevious: () => void;
	currentStep: number;
	sketchData: string | null;
	setSketchData: (data: string) => void;
}

interface LineData {
	tool: "pen" | "eraser";
	points: number[];
	strokeWidth: number;
}

interface ShapeData {
	type: "rectangle" | "circle";
	x: number;
	y: number;
	width: number;
	height: number;
	stroke: string;
	strokeWidth: number;
}

interface StraightLineData {
	type: "line";
	points: number[];
	stroke: string;
	strokeWidth: number;
}

type DrawingElement =
	| (LineData & { elementType: "freehand" })
	| (ShapeData & { elementType: "shape" })
	| (StraightLineData & { elementType: "straightLine" });

export default function SketchStep({
	onNext,
	sketchData,
	setSketchData,
}: SketchStepProps) {
	const stageRef = useRef<Konva.Stage>(null);
	const [tool, setTool] = useState<
		"pen" | "eraser" | "hand" | "rectangle" | "circle" | "line"
	>("pen");
	const [lines, setLines] = useState<LineData[]>([]);
	const [shapes, setShapes] = useState<ShapeData[]>([]);
	const [straightLines, setStraightLines] = useState<StraightLineData[]>([]);
	const [eraserSize, setEraserSize] = useState(20);
	const [showEraserPopover, setShowEraserPopover] = useState(false);
	const isDrawing = useRef(false);
	const [currentShape, setCurrentShape] = useState<ShapeData | null>(null);
	const [currentLine, setCurrentLine] = useState<StraightLineData | null>(
		null
	);

	// Stage position and scale
	const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
	const [stageScale, setStageScale] = useState(1);
	const [gridScale, setGridScale] = useState(1); // meters per square
	const gridSize = 40; // pixels per square at scale 1

	// Container size
	const [containerSize, setContainerSize] = useState({
		width: 800,
		height: 600,
	});

	// Update container size on mount and resize
	useEffect(() => {
		const updateSize = () => {
			const container = document.getElementById("konva-container");
			if (container) {
				setContainerSize({
					width: container.offsetWidth,
					height: container.offsetHeight,
				});
			}
		};

		updateSize();
		window.addEventListener("resize", updateSize);
		return () => window.removeEventListener("resize", updateSize);
	}, []);

	// Load sketch data if available
	useEffect(() => {
		if (sketchData && stageRef.current) {
			try {
				const parsedData = JSON.parse(sketchData);
				setLines(parsedData.lines || []);
				setShapes(parsedData.shapes || []);
				setStraightLines(parsedData.straightLines || []);
				setStagePos(parsedData.stagePos || { x: 0, y: 0 });
				setStageScale(parsedData.stageScale || 1);
			} catch (e) {
				console.error("Failed to load sketch data", e);
			}
		}
	}, [sketchData]);

	// Close eraser popover when switching tools
	useEffect(() => {
		if (tool !== "eraser") {
			setShowEraserPopover(false);
		}
	}, [tool]);

	// Generate grid lines based on current viewport
	const generateGridLines = () => {
		const lines = [];
		const padding = 1000; // Extra padding for smooth panning

		const startX =
			Math.floor((-stagePos.x - padding) / stageScale / gridSize) *
			gridSize;
		const endX =
			Math.ceil(
				(-stagePos.x + containerSize.width + padding) /
					stageScale /
					gridSize
			) * gridSize;
		const startY =
			Math.floor((-stagePos.y - padding) / stageScale / gridSize) *
			gridSize;
		const endY =
			Math.ceil(
				(-stagePos.y + containerSize.height + padding) /
					stageScale /
					gridSize
			) * gridSize;

		// Vertical lines
		for (let x = startX; x <= endX; x += gridSize) {
			lines.push(
				<Line
					key={`v-${x}`}
					points={[x, startY, x, endY]}
					stroke='#E5E2DA'
					strokeWidth={1 / stageScale}
				/>
			);
		}

		// Horizontal lines
		for (let y = startY; y <= endY; y += gridSize) {
			lines.push(
				<Line
					key={`h-${y}`}
					points={[startX, y, endX, y]}
					stroke='#E5E2DA'
					strokeWidth={1 / stageScale}
				/>
			);
		}

		return lines;
	};

	const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
		const stage = e.target.getStage();
		if (!stage) return;

		// Allow panning with middle mouse or hand tool
		if (e.evt.button === 1 || e.evt.button === 2 || tool === "hand") {
			stage.draggable(true);
			if (tool === "hand") {
				return; // Let default drag behavior handle it
			}
			return;
		}

		// Disable stage dragging when drawing
		stage.draggable(false);

		isDrawing.current = true;
		const pos = stage.getPointerPosition();
		if (!pos) return;

		// Convert to canvas coordinates
		const x = (pos.x - stagePos.x) / stageScale;
		const y = (pos.y - stagePos.y) / stageScale;

		if (tool === "pen" || tool === "eraser") {
			// Freehand drawing
			setLines([
				...lines,
				{
					tool,
					points: [x, y],
					strokeWidth: tool === "pen" ? 3 : eraserSize,
				},
			]);
		} else if (tool === "rectangle" || tool === "circle") {
			// Start drawing shape
			setCurrentShape({
				type: tool,
				x,
				y,
				width: 0,
				height: 0,
				stroke: "#1A1815",
				strokeWidth: 3,
			});
		} else if (tool === "line") {
			// Start drawing straight line
			setCurrentLine({
				type: "line",
				points: [x, y, x, y],
				stroke: "#1A1815",
				strokeWidth: 3,
			});
		}
	};

	const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
		if (!isDrawing.current) return;

		const stage = e.target.getStage();
		const point = stage?.getPointerPosition();
		if (!point) return;

		// Convert to canvas coordinates
		const x = (point.x - stagePos.x) / stageScale;
		const y = (point.y - stagePos.y) / stageScale;

		if (tool === "pen" || tool === "eraser") {
			// Continue freehand drawing
			const lastLine = lines[lines.length - 1];
			if (lastLine) {
				lastLine.points = lastLine.points.concat([x, y]);
				setLines([...lines.slice(0, -1), lastLine]);
			}
		} else if (currentShape) {
			// Update shape size
			const width = x - currentShape.x;
			const height = y - currentShape.y;
			setCurrentShape({ ...currentShape, width, height });
		} else if (currentLine) {
			// Update line endpoint
			const newLine = { ...currentLine };
			newLine.points = [newLine.points[0], newLine.points[1], x, y];
			setCurrentLine(newLine);
		}
	};

	const handleMouseUp = () => {
		isDrawing.current = false;

		// Finalize shapes or lines
		if (currentShape) {
			setShapes([...shapes, currentShape]);
			setCurrentShape(null);
		}
		if (currentLine) {
			setStraightLines([...straightLines, currentLine]);
			setCurrentLine(null);
		}

		// Re-enable stage dragging after drawing if using hand tool
		const stage = stageRef.current;
		if (stage && tool !== "hand") {
			stage.draggable(false);
		} else if (stage && tool === "hand") {
			stage.draggable(true);
		}

		saveSketchData();
	};

	const saveSketchData = () => {
		const data = {
			lines,
			shapes,
			straightLines,
			stagePos,
			stageScale,
		};
		setSketchData(JSON.stringify(data));
	};

	// Combine all elements with their order for proper eraser functionality
	const getAllElementsInOrder = () => {
		const elements: Array<{
			type: "line" | "shape" | "straightLine";
			data: any;
			index: number;
		}> = [];

		// Add lines with their indices
		lines.forEach((line, i) => {
			elements.push({ type: "line", data: line, index: i });
		});

		// Add shapes
		shapes.forEach((shape, i) => {
			elements.push({
				type: "shape",
				data: shape,
				index: lines.length + i,
			});
		});

		// Add straight lines
		straightLines.forEach((line, i) => {
			elements.push({
				type: "straightLine",
				data: line,
				index: lines.length + shapes.length + i,
			});
		});

		return elements;
	};

	const clearCanvas = () => {
		setLines([]);
		setShapes([]);
		setStraightLines([]);
		setCurrentShape(null);
		setCurrentLine(null);
		setStagePos({ x: 0, y: 0 });
		setStageScale(1);
		setSketchData("");
	};

	const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
		e.evt.preventDefault();

		const stage = stageRef.current;
		if (!stage) return;

		const oldScale = stageScale;
		const pointer = stage.getPointerPosition();
		if (!pointer) return;

		const mousePointTo = {
			x: (pointer.x - stagePos.x) / oldScale,
			y: (pointer.y - stagePos.y) / oldScale,
		};

		const newScale = e.evt.deltaY > 0 ? oldScale * 0.9 : oldScale * 1.1;
		const clampedScale = Math.max(0.1, Math.min(5, newScale));

		setStageScale(clampedScale);
		setStagePos({
			x: pointer.x - mousePointTo.x * clampedScale,
			y: pointer.y - mousePointTo.y * clampedScale,
		});
	};

	const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
		setStagePos({
			x: e.target.x(),
			y: e.target.y(),
		});
		saveSketchData();
	};

	return (
		<div className='h-full flex overflow-hidden'>
			{/* Main Panel - Canvas */}
			<div className='flex-1 p-4 flex flex-col min-w-0'>
				<div className='bg-white rounded-2xl shadow-lg flex-1 flex flex-col overflow-hidden'>
					{/* Canvas Header */}
					<div className='px-6 py-4 border-b border-[#E5E2DA] flex items-center justify-between flex-wrap gap-3'>
						<h3 className='text-lg font-medium text-[#1A1815]'>
							Sketch
						</h3>
						<div className='flex items-center gap-2 flex-wrap'>
							{/* Grid Scale */}
							<div className='flex items-center gap-2 bg-[#F5F3EF] rounded-lg px-3 py-2'>
								<label className='text-xs text-[#6B6862]'>
									Grid:
								</label>
								<input
									type='number'
									min='0.1'
									step='0.1'
									value={gridScale}
									onChange={(e) =>
										setGridScale(
											parseFloat(e.target.value) || 1
										)
									}
									className='w-12 px-1 py-1 border border-[#E5E2DA] rounded text-xs'
								/>
								<span className='text-xs text-[#6B6862]'>
									m
								</span>
							</div>

							{/* Drawing Tools */}
							<div className='flex items-center gap-1 bg-[#F5F3EF] rounded-lg p-1'>
								<button
									onClick={() => setTool("hand")}
									className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
										tool === "hand"
											? "bg-[#1A1815] text-white shadow-sm"
											: "text-[#6B6862] hover:bg-[#E5E2DA]"
									}`}
									title='Hand Tool (Pan)'
								>
									✋
								</button>
								<button
									onClick={() => setTool("pen")}
									className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
										tool === "pen"
											? "bg-[#1A1815] text-white shadow-sm"
											: "text-[#6B6862] hover:bg-[#E5E2DA]"
									}`}
									title='Pen Tool (Freehand)'
								>
									✏️
								</button>
								<button
									onClick={() => setTool("line")}
									className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
										tool === "line"
											? "bg-[#1A1815] text-white shadow-sm"
											: "text-[#6B6862] hover:bg-[#E5E2DA]"
									}`}
									title='Line Tool (Straight)'
								>
									📏
								</button>
								<button
									onClick={() => setTool("rectangle")}
									className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
										tool === "rectangle"
											? "bg-[#1A1815] text-white shadow-sm"
											: "text-[#6B6862] hover:bg-[#E5E2DA]"
									}`}
									title='Rectangle Tool'
								>
									▭
								</button>
								<button
									onClick={() => setTool("circle")}
									className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
										tool === "circle"
											? "bg-[#1A1815] text-white shadow-sm"
											: "text-[#6B6862] hover:bg-[#E5E2DA]"
									}`}
									title='Circle Tool'
								>
									◯
								</button>
								<div className='relative'>
									<button
										onClick={() => {
											setTool("eraser");
											setShowEraserPopover(true);
										}}
										className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
											tool === "eraser"
												? "bg-[#1A1815] text-white shadow-sm"
												: "text-[#6B6862] hover:bg-[#E5E2DA]"
										}`}
										title='Eraser Tool'
									>
										🧹
									</button>

									{/* Eraser Size Popover */}
									{tool === "eraser" && showEraserPopover && (
										<>
											{/* Backdrop to close popover */}
											<div
												className='fixed inset-0 z-10'
												onClick={() =>
													setShowEraserPopover(false)
												}
											/>
											{/* Popover */}
											<div className='absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-xl border border-[#E5E2DA] p-4 z-20 min-w-[200px]'>
												<p className='text-xs font-medium text-[#1A1815] mb-3'>
													Eraser Size
												</p>
												<div className='flex items-end justify-around gap-2 mb-3'>
													<button
														onClick={() => {
															setEraserSize(8);
															setShowEraserPopover(
																false
															);
														}}
														className='flex flex-col items-center gap-2 hover:bg-[#F5F3EF] rounded p-2 transition-colors'
														title='Extra Small (8px)'
													>
														<div className='w-12 h-12 flex items-center justify-center'>
															<div
																className={`rounded-full ${
																	eraserSize ===
																	8
																		? "bg-[#E07B47]"
																		: "bg-[#D5D2CA]"
																}`}
																style={{
																	width: "8px",
																	height: "8px",
																}}
															/>
														</div>
														<span className='text-xs text-[#6B6862]'>
															XS
														</span>
													</button>

													<button
														onClick={() => {
															setEraserSize(15);
															setShowEraserPopover(
																false
															);
														}}
														className='flex flex-col items-center gap-2 hover:bg-[#F5F3EF] rounded p-2 transition-colors'
														title='Small (15px)'
													>
														<div className='w-12 h-12 flex items-center justify-center'>
															<div
																className={`rounded-full ${
																	eraserSize ===
																	15
																		? "bg-[#E07B47]"
																		: "bg-[#D5D2CA]"
																}`}
																style={{
																	width: "15px",
																	height: "15px",
																}}
															/>
														</div>
														<span className='text-xs text-[#6B6862]'>
															S
														</span>
													</button>

													<button
														onClick={() => {
															setEraserSize(25);
															setShowEraserPopover(
																false
															);
														}}
														className='flex flex-col items-center gap-2 hover:bg-[#F5F3EF] rounded p-2 transition-colors'
														title='Medium (25px)'
													>
														<div className='w-12 h-12 flex items-center justify-center'>
															<div
																className={`rounded-full ${
																	eraserSize ===
																	25
																		? "bg-[#E07B47]"
																		: "bg-[#D5D2CA]"
																}`}
																style={{
																	width: "25px",
																	height: "25px",
																}}
															/>
														</div>
														<span className='text-xs text-[#6B6862]'>
															M
														</span>
													</button>

													<button
														onClick={() => {
															setEraserSize(40);
															setShowEraserPopover(
																false
															);
														}}
														className='flex flex-col items-center gap-2 hover:bg-[#F5F3EF] rounded p-2 transition-colors'
														title='Large (40px)'
													>
														<div className='w-12 h-12 flex items-center justify-center'>
															<div
																className={`rounded-full ${
																	eraserSize ===
																	40
																		? "bg-[#E07B47]"
																		: "bg-[#D5D2CA]"
																}`}
																style={{
																	width: "40px",
																	height: "40px",
																}}
															/>
														</div>
														<span className='text-xs text-[#6B6862]'>
															L
														</span>
													</button>
												</div>

												<div className='border-t border-[#E5E2DA] pt-3'>
													<div className='flex items-center justify-between mb-2'>
														<span className='text-xs text-[#6B6862]'>
															Custom
														</span>
														<span className='text-xs font-medium text-[#1A1815]'>
															{eraserSize}px
														</span>
													</div>
													<input
														type='range'
														min='5'
														max='50'
														value={eraserSize}
														onChange={(e) =>
															setEraserSize(
																parseInt(
																	e.target
																		.value
																)
															)
														}
														className='w-full'
													/>
												</div>
											</div>
										</>
									)}
								</div>
							</div>

							{/* Action Buttons */}
							<button
								onClick={clearCanvas}
								className='px-4 py-2 rounded-lg text-sm font-medium bg-[#F5F3EF] text-[#6B6862] hover:bg-[#E5E2DA] transition-colors'
							>
								Clear
							</button>
							<button
								onClick={() => {
									setStagePos({ x: 0, y: 0 });
									setStageScale(1);
								}}
								className='px-4 py-2 rounded-lg text-sm font-medium bg-[#F5F3EF] text-[#6B6862] hover:bg-[#E5E2DA] transition-colors'
							>
								Reset View
							</button>
							<button
								onClick={onNext}
								className='px-6 py-2 rounded-lg text-sm font-medium bg-[#E07B47] text-white hover:bg-[#D06A36] transition-colors'
							>
								Continue to Render →
							</button>
						</div>
					</div>

					{/* Canvas */}
					<div
						id='konva-container'
						className='flex-1 p-6 bg-white overflow-hidden'
					>
						<Stage
							ref={stageRef}
							width={containerSize.width}
							height={containerSize.height}
							draggable
							x={stagePos.x}
							y={stagePos.y}
							scaleX={stageScale}
							scaleY={stageScale}
							onWheel={handleWheel}
							onDragEnd={handleDragEnd}
							onMouseDown={handleMouseDown}
							onMousemove={handleMouseMove}
							onMouseup={handleMouseUp}
							className={`rounded-lg ${
								tool === "hand"
									? "cursor-grab active:cursor-grabbing"
									: tool === "eraser"
									? "cursor-not-allowed"
									: "cursor-crosshair"
							}`}
						>
							{/* Grid Layer */}
							<Layer listening={false}>
								<Rect
									x={(-stagePos.x - 2000) / stageScale}
									y={(-stagePos.y - 2000) / stageScale}
									width={10000 / stageScale}
									height={10000 / stageScale}
									fill='white'
								/>
								{generateGridLines()}
							</Layer>

							{/* Drawing Layer */}
							<Layer>
								{/* Render all elements in chronological order */}
								{getAllElementsInOrder().map((element) => {
									if (element.type === "line") {
										const line = element.data as LineData;
										const isEraser = line.tool === "eraser";
										return (
											<Line
												key={`line-${element.index}`}
												points={line.points}
												stroke={
													isEraser
														? "white"
														: "#1A1815"
												}
												strokeWidth={line.strokeWidth}
												tension={0.5}
												lineCap='round'
												lineJoin='round'
												listening={false}
												globalCompositeOperation={
													isEraser
														? "destination-out"
														: "source-over"
												}
											/>
										);
									} else if (
										element.type === "straightLine"
									) {
										const line =
											element.data as StraightLineData;
										return (
											<Line
												key={`straight-${element.index}`}
												points={line.points}
												stroke={line.stroke}
												strokeWidth={line.strokeWidth}
												lineCap='round'
												listening={false}
											/>
										);
									} else if (element.type === "shape") {
										const shape = element.data as ShapeData;
										if (shape.type === "rectangle") {
											return (
												<Rect
													key={`shape-${element.index}`}
													x={shape.x}
													y={shape.y}
													width={shape.width}
													height={shape.height}
													stroke={shape.stroke}
													strokeWidth={
														shape.strokeWidth
													}
													listening={false}
												/>
											);
										} else {
											return (
												<Circle
													key={`shape-${element.index}`}
													x={
														shape.x +
														shape.width / 2
													}
													y={
														shape.y +
														shape.height / 2
													}
													radius={Math.abs(
														Math.max(
															Math.abs(
																shape.width
															),
															Math.abs(
																shape.height
															)
														) / 2
													)}
													stroke={shape.stroke}
													strokeWidth={
														shape.strokeWidth
													}
													listening={false}
												/>
											);
										}
									}
									return null;
								})}

								{/* Render current line being drawn */}
								{currentLine && (
									<Line
										points={currentLine.points}
										stroke={currentLine.stroke}
										strokeWidth={currentLine.strokeWidth}
										lineCap='round'
										dash={[5, 5]}
										listening={false}
									/>
								)}

								{/* Render current shape being drawn */}
								{currentShape &&
									(currentShape.type === "rectangle" ? (
										<Rect
											x={currentShape.x}
											y={currentShape.y}
											width={currentShape.width}
											height={currentShape.height}
											stroke={currentShape.stroke}
											strokeWidth={
												currentShape.strokeWidth
											}
											dash={[5, 5]}
											listening={false}
										/>
									) : (
										<Circle
											x={
												currentShape.x +
												currentShape.width / 2
											}
											y={
												currentShape.y +
												currentShape.height / 2
											}
											radius={Math.abs(
												Math.max(
													Math.abs(
														currentShape.width
													),
													Math.abs(
														currentShape.height
													)
												) / 2
											)}
											stroke={currentShape.stroke}
											strokeWidth={
												currentShape.strokeWidth
											}
											dash={[5, 5]}
											listening={false}
										/>
									))}
							</Layer>
						</Stage>
					</div>
				</div>
			</div>
		</div>
	);
}
