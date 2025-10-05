"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Stage, Layer, Line, Rect, Circle, Text } from "react-konva";
import Konva from "konva";
import { Hand, Pencil, Minus, Square, CircleIcon, Eraser, Type, Undo, Redo } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

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

interface TextData {
	id: string;
	x: number;
	y: number;
	text: string;
	fontSize: number;
}

interface HistoryState {
	lines: LineData[];
	shapes: ShapeData[];
	straightLines: StraightLineData[];
	texts: TextData[];
}

export default function SketchStep({
	onNext,
	sketchData,
	setSketchData,
}: SketchStepProps) {
	const stageRef = useRef<Konva.Stage>(null);
	const setSketchDataUrl = useAppStore((state) => state.setSketchDataUrl);

	const [tool, setTool] = useState<
		"pen" | "eraser" | "hand" | "rectangle" | "circle" | "line" | "text"
	>("pen");

	const [lines, setLines] = useState<LineData[]>([]);
	const [shapes, setShapes] = useState<ShapeData[]>([]);
	const [straightLines, setStraightLines] = useState<StraightLineData[]>([]);
	const [texts, setTexts] = useState<TextData[]>([]);

	const eraserSize = 40; // Fixed medium size
	const [showTextInput, setShowTextInput] = useState(false);
	const [textInputValue, setTextInputValue] = useState("");
	const [textInputPos, setTextInputPos] = useState({ x: 0, y: 0 });

	const isDrawing = useRef(false);
	const currentShape = useRef<ShapeData | null>(null);
	const currentLine = useRef<StraightLineData | null>(null);
	const textInputRef = useRef<HTMLInputElement>(null);
	const stageContainerRef = useRef<HTMLDivElement>(null);
	const [, forceUpdate] = useState({});

	// Eraser cursor tracking
	const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
	const [showCursor, setShowCursor] = useState(false);

	// History for undo/redo
	const [history, setHistory] = useState<HistoryState[]>([]);
	const [historyIndex, setHistoryIndex] = useState(-1);

	// Stage position and scale
	const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
	const [stageScale, setStageScale] = useState(1);
	const gridSize = 40;

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

	// Load sketch data once on mount
	useEffect(() => {
		if (sketchData && stageRef.current) {
			try {
				const parsedData = JSON.parse(sketchData);
				setLines(parsedData.lines || []);
				setShapes(parsedData.shapes || []);
				setStraightLines(parsedData.straightLines || []);
				setTexts(parsedData.texts || []);
				setStagePos(parsedData.stagePos || { x: 0, y: 0 });
				setStageScale(parsedData.stageScale || 1);
			} catch (e) {
				console.error("Failed to load sketch data", e);
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []); // Only load once on mount, not when sketchData changes

	// Auto-focus text input when it appears
	useEffect(() => {
		if (showTextInput && textInputRef.current) {
			// Use setTimeout to ensure DOM is ready
			setTimeout(() => {
				textInputRef.current?.focus();
			}, 0);
		}
	}, [showTextInput]);


	// Save to history when state changes
	const saveToHistory = useCallback(
		(overrideState?: Partial<HistoryState>) => {
			const newState: HistoryState = {
				lines: overrideState?.lines ?? lines,
				shapes: overrideState?.shapes ?? shapes,
				straightLines: overrideState?.straightLines ?? straightLines,
				texts: overrideState?.texts ?? texts,
			};

			// Remove any states after current index (if we went back and made changes)
			const newHistory = history.slice(0, historyIndex + 1);
			newHistory.push(newState);

			// Limit history to 50 states
			if (newHistory.length > 50) {
				newHistory.shift();
			} else {
				setHistoryIndex(historyIndex + 1);
			}

			setHistory(newHistory);
		},
		[lines, shapes, straightLines, texts, history, historyIndex]
	);

	// Undo
	const handleUndo = useCallback(() => {
		if (historyIndex > 0) {
			const prevState = history[historyIndex - 1];
			setLines(prevState.lines);
			setShapes(prevState.shapes);
			setStraightLines(prevState.straightLines);
			setTexts(prevState.texts);
			setHistoryIndex(historyIndex - 1);
		}
	}, [history, historyIndex]);

	// Redo
	const handleRedo = useCallback(() => {
		if (historyIndex < history.length - 1) {
			const nextState = history[historyIndex + 1];
			setLines(nextState.lines);
			setShapes(nextState.shapes);
			setStraightLines(nextState.straightLines);
			setTexts(nextState.texts);
			setHistoryIndex(historyIndex + 1);
		}
	}, [history, historyIndex]);

	// Keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
				e.preventDefault();
				handleUndo();
			} else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "z"))) {
				e.preventDefault();
				handleRedo();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleUndo, handleRedo]);

	// Generate grid lines
	const generateGridLines = () => {
		const gridLines = [];
		const padding = 1000;

		const startX =
			Math.floor((-stagePos.x - padding) / stageScale / gridSize) * gridSize;
		const endX =
			Math.ceil(
				(-stagePos.x + containerSize.width + padding) / stageScale / gridSize
			) * gridSize;
		const startY =
			Math.floor((-stagePos.y - padding) / stageScale / gridSize) * gridSize;
		const endY =
			Math.ceil(
				(-stagePos.y + containerSize.height + padding) / stageScale / gridSize
			) * gridSize;

		for (let x = startX; x <= endX; x += gridSize) {
			gridLines.push(
				<Line
					key={`v-${x}`}
					points={[x, startY, x, endY]}
					stroke='#E5E2DA'
					strokeWidth={1 / stageScale}
				/>
			);
		}

		for (let y = startY; y <= endY; y += gridSize) {
			gridLines.push(
				<Line
					key={`h-${y}`}
					points={[startX, y, endX, y]}
					stroke='#E5E2DA'
					strokeWidth={1 / stageScale}
				/>
			);
		}

		return gridLines;
	};

	const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
		const stage = e.target.getStage();
		if (!stage) return;

		// Allow panning with middle mouse or hand tool
		if (e.evt.button === 1 || e.evt.button === 2 || tool === "hand") {
			stage.draggable(true);
			if (tool === "hand") {
				return;
			}
			return;
		}

		// Disable stage dragging when drawing
		stage.draggable(false);

		const pos = stage.getPointerPosition();
		if (!pos) return;

		// Convert to canvas coordinates
		const x = (pos.x - stagePos.x) / stageScale;
		const y = (pos.y - stagePos.y) / stageScale;

		if (tool === "text") {
			// Show text input
			setTextInputPos({ x: pos.x, y: pos.y });
			setShowTextInput(true);
			return;
		}

		isDrawing.current = true;

		if (tool === "pen" || tool === "eraser") {
			// Freehand drawing - IMMUTABLE update
			setLines((prevLines) => [
				...prevLines,
				{
					tool,
					points: [x, y],
					strokeWidth: tool === "pen" ? 3 : eraserSize,
				},
			]);
		} else if (tool === "rectangle" || tool === "circle") {
			// Start drawing shape
			currentShape.current = {
				type: tool,
				x,
				y,
				width: 0,
				height: 0,
				stroke: "#1A1815",
				strokeWidth: 3,
			};
		} else if (tool === "line") {
			// Start drawing straight line
			currentLine.current = {
				type: "line",
				points: [x, y, x, y],
				stroke: "#1A1815",
				strokeWidth: 3,
			};
		}
	};

	const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
		const stage = e.target.getStage();
		const point = stage?.getPointerPosition();
		if (!point) return;

		// Update cursor position for eraser (use raw event coordinates)
		if (tool === "eraser" && stageContainerRef.current) {
			const rect = stageContainerRef.current.getBoundingClientRect();
			setCursorPos({
				x: e.evt.clientX - rect.left,
				y: e.evt.clientY - rect.top,
			});
		}

		if (!isDrawing.current) return;

		// Convert to canvas coordinates
		const x = (point.x - stagePos.x) / stageScale;
		const y = (point.y - stagePos.y) / stageScale;

		if (tool === "pen" || tool === "eraser") {
			// Continue freehand drawing - IMMUTABLE update
			setLines((prevLines) => {
				const newLines = [...prevLines];
				const lastLine = newLines[newLines.length - 1];
				if (lastLine) {
					// Create new line object with updated points
					newLines[newLines.length - 1] = {
						...lastLine,
						points: [...lastLine.points, x, y],
					};
				}
				return newLines;
			});

			// Eraser collision detection
			if (tool === "eraser") {
				const eraserRadius = eraserSize / 2;

				// Check collision with shapes
				setShapes((prevShapes) => {
					return prevShapes.filter((shape) => {
						if (shape.type === "rectangle") {
							// Check if eraser overlaps rectangle
							const rectX = Math.min(shape.x, shape.x + shape.width);
							const rectY = Math.min(shape.y, shape.y + shape.height);
							const rectWidth = Math.abs(shape.width);
							const rectHeight = Math.abs(shape.height);

							const distX = Math.abs(x - (rectX + rectWidth / 2));
							const distY = Math.abs(y - (rectY + rectHeight / 2));

							if (distX > rectWidth / 2 + eraserRadius) return true;
							if (distY > rectHeight / 2 + eraserRadius) return true;
							if (distX <= rectWidth / 2) return false;
							if (distY <= rectHeight / 2) return false;

							const dx = distX - rectWidth / 2;
							const dy = distY - rectHeight / 2;
							return dx * dx + dy * dy > eraserRadius * eraserRadius;
						} else if (shape.type === "circle") {
							// Check if eraser overlaps circle
							const centerX = shape.x + shape.width / 2;
							const centerY = shape.y + shape.height / 2;
							const radiusX = Math.abs(shape.width) / 2;
							const radiusY = Math.abs(shape.height) / 2;
							const avgRadius = (radiusX + radiusY) / 2;

							const dist = Math.sqrt(
								(x - centerX) ** 2 + (y - centerY) ** 2
							);
							return dist > avgRadius + eraserRadius;
						}
						return true;
					});
				});

				// Check collision with straight lines
				setStraightLines((prevLines) => {
					return prevLines.filter((line) => {
						const x1 = line.points[0];
						const y1 = line.points[1];
						const x2 = line.points[2];
						const y2 = line.points[3];

						// Distance from point to line segment
						const A = x - x1;
						const B = y - y1;
						const C = x2 - x1;
						const D = y2 - y1;

						const dot = A * C + B * D;
						const lenSq = C * C + D * D;
						let param = -1;
						if (lenSq !== 0) param = dot / lenSq;

						let xx, yy;
						if (param < 0) {
							xx = x1;
							yy = y1;
						} else if (param > 1) {
							xx = x2;
							yy = y2;
						} else {
							xx = x1 + param * C;
							yy = y1 + param * D;
						}

						const dx = x - xx;
						const dy = y - yy;
						const distance = Math.sqrt(dx * dx + dy * dy);

						return distance > eraserRadius;
					});
				});

				// Check collision with texts
				setTexts((prevTexts) => {
					return prevTexts.filter((text) => {
						// Approximate text bounding box
						const textWidth = text.text.length * (text.fontSize || 16) * 0.6;
						const textHeight = text.fontSize || 16;

						const distX = Math.abs(x - (text.x + textWidth / 2));
						const distY = Math.abs(y - (text.y + textHeight / 2));

						if (distX > textWidth / 2 + eraserRadius) return true;
						if (distY > textHeight / 2 + eraserRadius) return true;
						return false;
					});
				});
			}
		} else if (currentShape.current) {
			// Update shape size
			const width = x - currentShape.current.x;
			const height = y - currentShape.current.y;
			currentShape.current = { ...currentShape.current, width, height };
			forceUpdate({});
		} else if (currentLine.current) {
			// Update line endpoint
			currentLine.current = {
				...currentLine.current,
				points: [currentLine.current.points[0], currentLine.current.points[1], x, y],
			};
			forceUpdate({});
		}
	};

	const handleMouseUp = () => {
		if (!isDrawing.current) return;

		isDrawing.current = false;

		// Finalize shapes or lines
		if (currentShape.current) {
			const newShapes = [...shapes, currentShape.current];
			setShapes(newShapes);
			currentShape.current = null;
			saveToHistory({ shapes: newShapes });
		} else if (currentLine.current) {
			const newStraightLines = [...straightLines, currentLine.current];
			setStraightLines(newStraightLines);
			currentLine.current = null;
			saveToHistory({ straightLines: newStraightLines });
		} else if (tool === "pen") {
			// For pen, save to history
			saveToHistory();
		} else if (tool === "eraser") {
			// Eraser will be handled separately with collision detection
			saveToHistory();
		}

		// Re-enable stage dragging after drawing if using hand tool
		const stage = stageRef.current;
		if (stage && tool !== "hand") {
			stage.draggable(false);
		} else if (stage && tool === "hand") {
			stage.draggable(true);
		}
	};

	const handleMouseEnter = () => {
		if (tool === "eraser") {
			setShowCursor(true);
		}
	};

	const handleMouseLeave = () => {
		setShowCursor(false);
	};

	const handleAddText = () => {
		if (textInputValue.trim()) {
			const stage = stageRef.current;
			if (!stage) return;

			// Convert screen position to canvas coordinates
			const x = (textInputPos.x - stagePos.x) / stageScale;
			const y = (textInputPos.y - stagePos.y) / stageScale;

			const newText: TextData = {
				id: Date.now().toString(),
				x,
				y,
				text: textInputValue,
				fontSize: 16,
			};

			const newTexts = [...texts, newText];
			setTexts(newTexts);
			setTextInputValue("");
			setShowTextInput(false);
			saveToHistory({ texts: newTexts });
		}
	};

	// Auto-save sketch data when state changes
	useEffect(() => {
		const data = {
			lines,
			shapes,
			straightLines,
			texts,
			stagePos,
			stageScale,
		};
		setSketchData(JSON.stringify(data));
	}, [lines, shapes, straightLines, texts, stagePos, stageScale]);

	const handleContinue = () => {
		// Save sketch as image to store
		const stage = stageRef.current;
		if (stage) {
			const dataUrl = stage.toDataURL({ pixelRatio: 2 });
			setSketchDataUrl(dataUrl);
		}
		onNext();
	};

	const getAllElementsInOrder = () => {
		const elements: Array<{
			type: "line" | "shape" | "straightLine" | "text";
			data: any;
			index: number;
		}> = [];

		lines.forEach((line, i) => {
			elements.push({ type: "line", data: line, index: i });
		});

		shapes.forEach((shape, i) => {
			elements.push({
				type: "shape",
				data: shape,
				index: lines.length + i,
			});
		});

		straightLines.forEach((line, i) => {
			elements.push({
				type: "straightLine",
				data: line,
				index: lines.length + shapes.length + i,
			});
		});

		texts.forEach((text, i) => {
			elements.push({
				type: "text",
				data: text,
				index: lines.length + shapes.length + straightLines.length + i,
			});
		});

		return elements;
	};

	const clearCanvas = () => {
		setLines([]);
		setShapes([]);
		setStraightLines([]);
		setTexts([]);
		setCurrentShape(null);
		setCurrentLine(null);
		setStagePos({ x: 0, y: 0 });
		setStageScale(1);
		setSketchData("");
		setHistory([]);
		setHistoryIndex(-1);
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
	};

	return (
		<div className='h-full flex overflow-hidden'>
			<div className='flex-1 p-4 flex flex-col min-w-0'>
				<div className='bg-white rounded-2xl shadow-lg flex-1 flex flex-col overflow-hidden'>
					<div className='px-6 py-4 border-b border-[#E5E2DA] flex items-center justify-between flex-wrap gap-3'>
						<h3 className='text-lg font-medium text-[#1A1815]'>
							Sketch
						</h3>
						<div className='flex items-center gap-2 flex-wrap'>
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
									<Hand size={16} />
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
									<Pencil size={16} />
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
									<Minus size={16} />
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
									<Square size={16} />
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
									<CircleIcon size={16} />
								</button>
								<button
									onClick={() => setTool("text")}
									className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
										tool === "text"
											? "bg-[#1A1815] text-white shadow-sm"
											: "text-[#6B6862] hover:bg-[#E5E2DA]"
									}`}
									title='Text Tool'
								>
									<Type size={16} />
								</button>
								<button
									onClick={() => setTool("eraser")}
									className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
										tool === "eraser"
											? "bg-[#1A1815] text-white shadow-sm"
											: "text-[#6B6862] hover:bg-[#E5E2DA]"
									}`}
									title='Eraser Tool'
								>
									<Eraser size={16} />
								</button>
							</div>

							{/* Undo/Redo */}
							<div className='flex items-center gap-1 bg-[#F5F3EF] rounded-lg p-1'>
								<button
									onClick={handleUndo}
									disabled={historyIndex <= 0}
									className='px-3 py-2 rounded text-sm font-medium text-[#6B6862] hover:bg-[#E5E2DA] transition-colors disabled:opacity-30 disabled:cursor-not-allowed'
									title='Undo (Ctrl+Z)'
								>
									<Undo size={16} />
								</button>
								<button
									onClick={handleRedo}
									disabled={historyIndex >= history.length - 1}
									className='px-3 py-2 rounded text-sm font-medium text-[#6B6862] hover:bg-[#E5E2DA] transition-colors disabled:opacity-30 disabled:cursor-not-allowed'
									title='Redo (Ctrl+Y)'
								>
									<Redo size={16} />
								</button>
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
								onClick={handleContinue}
								className='px-6 py-2 rounded-lg text-sm font-medium bg-[#E07B47] text-white hover:bg-[#D06A36] transition-colors'
							>
								Continue to Refine →
							</button>
						</div>
					</div>

					{/* Canvas */}
					<div
						ref={stageContainerRef}
						id='konva-container'
						className='flex-1 p-6 bg-white overflow-hidden relative'
						onMouseEnter={handleMouseEnter}
						onMouseLeave={handleMouseLeave}
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
									? "cursor-none"
									: tool === "text"
									? "cursor-text"
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
								{getAllElementsInOrder().map((element) => {
									if (element.type === "line") {
										const line = element.data as LineData;
										const isEraser = line.tool === "eraser";
										return (
											<Line
												key={`line-${element.index}`}
												points={line.points}
												stroke={isEraser ? "white" : "#1A1815"}
												strokeWidth={line.strokeWidth}
												tension={0.5}
												lineCap='round'
												lineJoin='round'
												listening={false}
												globalCompositeOperation={
													isEraser ? "destination-out" : "source-over"
												}
											/>
										);
									} else if (element.type === "straightLine") {
										const line = element.data as StraightLineData;
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
													strokeWidth={shape.strokeWidth}
													listening={false}
												/>
											);
										} else {
											return (
												<Circle
													key={`shape-${element.index}`}
													x={shape.x + shape.width / 2}
													y={shape.y + shape.height / 2}
													radius={Math.abs(
														Math.max(
															Math.abs(shape.width),
															Math.abs(shape.height)
														) / 2
													)}
													stroke={shape.stroke}
													strokeWidth={shape.strokeWidth}
													listening={false}
												/>
											);
										}
									} else if (element.type === "text") {
										const textData = element.data as TextData;
										return (
											<Text
												key={`text-${element.index}`}
												x={textData.x}
												y={textData.y}
												text={textData.text}
												fontSize={textData.fontSize}
												fill='#1A1815'
												listening={false}
											/>
										);
									}
									return null;
								})}

								{/* Render current line being drawn */}
								{currentLine.current && (
									<Line
										points={currentLine.current.points}
										stroke={currentLine.current.stroke}
										strokeWidth={currentLine.current.strokeWidth}
										lineCap='round'
										dash={[5, 5]}
										listening={false}
									/>
								)}

								{/* Render current shape being drawn */}
								{currentShape.current &&
									(currentShape.current.type === "rectangle" ? (
										<Rect
											x={currentShape.current.x}
											y={currentShape.current.y}
											width={currentShape.current.width}
											height={currentShape.current.height}
											stroke={currentShape.current.stroke}
											strokeWidth={currentShape.current.strokeWidth}
											dash={[5, 5]}
											listening={false}
										/>
									) : (
										<Circle
											x={currentShape.current.x + currentShape.current.width / 2}
											y={currentShape.current.y + currentShape.current.height / 2}
											radius={Math.abs(
												Math.max(
													Math.abs(currentShape.current.width),
													Math.abs(currentShape.current.height)
												) / 2
											)}
											stroke={currentShape.current.stroke}
											strokeWidth={currentShape.current.strokeWidth}
											dash={[5, 5]}
											listening={false}
										/>
									))}
							</Layer>
						</Stage>

						{/* Custom Eraser Cursor */}
						{tool === "eraser" && showCursor && (
							<div
								className='pointer-events-none absolute rounded-full border-2 border-[#E07B47] bg-[#E07B47]/20 z-50'
								style={{
									left: cursorPos.x - (eraserSize * stageScale) / 2,
									top: cursorPos.y - (eraserSize * stageScale) / 2,
									width: eraserSize * stageScale,
									height: eraserSize * stageScale,
								}}
							/>
						)}

						{/* Text Input Modal */}
						{showTextInput && (
							<div
								className='absolute bg-white rounded-xl p-4 shadow-2xl z-50 border border-[#E5E2DA]'
								style={{
									left: textInputPos.x,
									top: textInputPos.y,
								}}
							>
								<input
									ref={textInputRef}
									type='text'
									value={textInputValue}
									onChange={(e) => setTextInputValue(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											handleAddText();
										} else if (e.key === "Escape") {
											setShowTextInput(false);
											setTextInputValue("");
										}
									}}
									placeholder='Enter text...'
									className='w-64 bg-[#F5F3EF] border-0 rounded-lg px-3 py-2 text-sm text-[#1A1815] placeholder-[#6B6862] focus:outline-none focus:ring-0'
								/>
								<div className='flex gap-2 mt-3'>
									<button
										onClick={handleAddText}
										className='flex-1 px-4 py-2 bg-[#1A1815] text-white text-sm font-medium rounded-lg hover:bg-[#2A2825] transition-colors'
									>
										Add
									</button>
									<button
										onClick={() => {
											setShowTextInput(false);
											setTextInputValue("");
										}}
										className='px-4 py-2 bg-[#F5F3EF] text-[#6B6862] text-sm font-medium rounded-lg hover:bg-[#E5E2DA] transition-colors'
									>
										Cancel
									</button>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
