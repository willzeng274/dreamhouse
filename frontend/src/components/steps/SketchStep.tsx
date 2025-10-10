"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Stage, Layer, Line, Rect, Circle, Text } from "react-konva";
import Konva from "konva";
import { Hand, Pencil, Minus, Square, CircleIcon, Eraser, Type, Undo, Redo, HelpCircle } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useGenerateFloorplan, useExtractObjects, useGeneratePhotorealistic, useExportScene } from "@/hooks/useApi";
import AsciiLoader from "@/components/ui/AsciiLoader";
import KeyboardShortcuts from "@/components/ui/KeyboardShortcuts";
import { Zap } from "lucide-react";

interface SketchStepProps {
	onNext: () => void;
	onPrevious: () => void;
	currentStep: number;
	sketchData: string | null;
	setSketchData: (data: string) => void;
	onQuickExport?: (step: number) => void;
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
	onQuickExport,
}: SketchStepProps) {
	const stageRef = useRef<Konva.Stage>(null);
	const setSketchDataUrl = useAppStore((state) => state.setSketchDataUrl);
	const setFloorplanBlob = useAppStore((state) => state.setFloorplanBlob);
	const setFloorplanDataUrl = useAppStore((state) => state.setFloorplanDataUrl);
	const blobToDataUrl = useAppStore((state) => state.blobToDataUrl);
	
	const generateFloorplan = useGenerateFloorplan();
	const extractObjects = useExtractObjects();
	const generatePhotorealistic = useGeneratePhotorealistic();
	const exportScene = useExportScene();
	
	const sketchDataUrl = useAppStore((state) => state.sketchDataUrl);
	const floorplanObjects = useAppStore((state) => state.floorplanObjects);
	
	const [isQuickExporting, setIsQuickExporting] = useState(false);

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
	const [showShortcuts, setShowShortcuts] = useState(false);

	// History for undo/redo - initialize with empty state
	const [history, setHistory] = useState<HistoryState[]>([
		{ lines: [], shapes: [], straightLines: [], texts: [] },
	]);
	const [historyIndex, setHistoryIndex] = useState(0);

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
			// Don't trigger shortcuts when typing in input
			if (showTextInput) return;

			if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
				e.preventDefault();
				handleUndo();
			} else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "z"))) {
				e.preventDefault();
				handleRedo();
			} else if (e.key === "h" || e.key === "H") {
				setTool("hand");
			} else if (e.key === "p" || e.key === "P") {
				setTool("pen");
			} else if (e.key === "l" || e.key === "L") {
				setTool("line");
			} else if (e.key === "r" || e.key === "R") {
				setTool("rectangle");
			} else if (e.key === "c" || e.key === "C") {
				setTool("circle");
			} else if (e.key === "t" || e.key === "T") {
				setTool("text");
			} else if (e.key === "e" || e.key === "E") {
				setTool("eraser");
			} else if (e.key === "?") {
				setShowShortcuts(true);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleUndo, handleRedo, showTextInput]);

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

	const handleContinue = async () => {
		// Save sketch as image to store
		const stage = stageRef.current;
		if (stage) {
			const dataUrl = stage.toDataURL({ pixelRatio: 2 });
			setSketchDataUrl(dataUrl);
			// Move to next step (Refine)
			onNext();
		}
	};

	const handleQuickExport = async () => {
		const stage = stageRef.current;
		if (!stage || !onQuickExport) return;

		setIsQuickExporting(true);

		try {
			// 1. Save sketch
			const dataUrl = stage.toDataURL({ pixelRatio: 2 });
			setSketchDataUrl(dataUrl);
			const blob = await fetch(dataUrl).then(res => res.blob());
			const sketchFile = new File([blob], "sketch.png", { type: "image/png" });

			// 2. Generate floorplan
			const floorplanBlob = await generateFloorplan.mutateAsync(sketchFile);
			const floorplanDataUrl = await blobToDataUrl(floorplanBlob);
			setFloorplanBlob(floorplanBlob);
			setFloorplanDataUrl(floorplanDataUrl);
			
			// 3. Extract objects in parallel with render generation
			const floorplanFile = new File([floorplanBlob], "floorplan.png", { type: "image/png" });
			const [extractResult] = await Promise.all([
				extractObjects.mutateAsync(floorplanFile),
				generatePhotorealistic.mutateAsync(floorplanFile),
			]);

			// 4. Export scene to Unity format
			await exportScene.mutateAsync(extractResult.objects);

			// 5. Jump to Unity view (step 5)
			onQuickExport(5);
		} catch (error) {
			console.error("Quick export failed:", error);
			setIsQuickExporting(false);
		}
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
		currentShape.current = null;
		currentLine.current = null;
		setStagePos({ x: 0, y: 0 });
		setStageScale(1);
		setSketchData("");
		setHistory([{ lines: [], shapes: [], straightLines: [], texts: [] }]);
		setHistoryIndex(0);
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
		<div className='h-full flex overflow-hidden p-6'>
			<div className='flex-1 flex flex-col min-w-0'>
				<div className='rounded-2xl shadow-2xl flex-1 flex flex-col overflow-hidden transition-all duration-300 hover:shadow-3xl' style={{
					background: 'rgba(255, 255, 255, 0.85)',
					backdropFilter: 'blur(20px)',
					border: '1px solid rgba(140, 103, 66, 0.15)',
					boxShadow: '0 8px 32px rgba(90, 74, 61, 0.12)'
				}}>
					<div className='px-8 py-5 flex items-center justify-between flex-wrap gap-3' style={{
						borderBottom: '1px solid rgba(140, 103, 66, 0.12)'
					}}>
						<div className='flex items-center gap-3'>
							<div className='w-1.5 h-1.5 rounded-full' style={{ background: '#CC7A4A' }} />
							<h3 className='text-xl font-semibold' style={{ color: '#5A4A3D' }}>
								Sketch Your Vision
						</h3>
						</div>
						<div className='flex items-center gap-2 flex-wrap'>
							{/* Drawing Tools */}
							<div className='flex items-center gap-0.5 p-0.5 rounded-lg' style={{ background: '#FFFFFF', border: '1px solid #E5DDD0' }}>
								{[
									{ id: "hand", icon: Hand, label: "Hand Tool (Pan)" },
									{ id: "pen", icon: Pencil, label: "Pen Tool (Freehand)" },
									{ id: "line", icon: Minus, label: "Line Tool (Straight)" },
									{ id: "rectangle", icon: Square, label: "Rectangle Tool" },
									{ id: "circle", icon: CircleIcon, label: "Circle Tool" },
									{ id: "text", icon: Type, label: "Text Tool" },
									{ id: "eraser", icon: Eraser, label: "Eraser Tool" },
								].map(({ id, icon: Icon, label }) => (
								<button
										key={id}
										onClick={() => setTool(id as any)}
										className='px-3 py-2 rounded-md text-sm font-medium transition-all duration-200'
										style={{
											background: tool === id ? '#CC7A4A' : 'transparent',
											color: tool === id ? '#FFFFFF' : '#6B5D4F',
										}}
										title={label}
										onMouseEnter={(e) => {
											if (tool !== id) {
												e.currentTarget.style.background = '#FAF8F5';
											}
										}}
										onMouseLeave={(e) => {
											if (tool !== id) {
												e.currentTarget.style.background = 'transparent';
											}
										}}
									>
										<Icon size={16} />
								</button>
								))}
							</div>

							{/* Undo/Redo */}
							<div className='flex items-center gap-0.5 p-0.5 rounded-lg' style={{ background: '#FFFFFF', border: '1px solid #E5DDD0' }}>
								<button
									onClick={handleUndo}
									disabled={historyIndex <= 0}
									className='px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed'
									style={{ color: '#6B5D4F' }}
									title='Undo (Ctrl+Z)'
									onMouseEnter={(e) => {
										if (historyIndex > 0) {
											e.currentTarget.style.background = '#FAF8F5';
										}
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.background = 'transparent';
									}}
								>
									<Undo size={16} />
								</button>
								<button
									onClick={handleRedo}
									disabled={historyIndex >= history.length - 1}
									className='px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed'
									style={{ color: '#6B5D4F' }}
									title='Redo (Ctrl+Y)'
									onMouseEnter={(e) => {
										if (historyIndex < history.length - 1) {
											e.currentTarget.style.background = '#FAF8F5';
										}
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.background = 'transparent';
									}}
								>
									<Redo size={16} />
								</button>
							</div>

							{/* Action Buttons */}
							<button
								onClick={() => setShowShortcuts(true)}
								className='p-2 rounded-lg transition-all duration-200'
								style={{
									background: '#FFFFFF',
									color: '#6B5D4F',
									border: '1px solid #E5DDD0'
								}}
								title='Keyboard Shortcuts'
								onMouseEnter={(e) => {
									e.currentTarget.style.background = '#FAF8F5';
									e.currentTarget.style.borderColor = '#D4C7B7';
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.background = '#FFFFFF';
									e.currentTarget.style.borderColor = '#E5DDD0';
								}}
							>
								<HelpCircle size={16} />
							</button>
							<button
								onClick={clearCanvas}
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
								Clear
							</button>
							<button
								onClick={() => {
									setStagePos({ x: 0, y: 0 });
									setStageScale(1);
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
								Reset View
							</button>
							
							<div className='w-px h-6' style={{ background: '#E5DDD0' }} />
							
							<div className='relative'>
								<button
									onClick={handleQuickExport}
									disabled={isQuickExporting}
									className='px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 relative overflow-hidden group'
									style={{
										background: 'rgba(204, 122, 74, 0.1)',
										color: '#CC7A4A',
										border: '1px solid rgba(204, 122, 74, 0.3)'
									}}
									title='Skip all intermediate steps and export directly to Unity'
									onMouseEnter={(e) => {
										if (!isQuickExporting) {
											e.currentTarget.style.background = 'rgba(204, 122, 74, 0.15)';
											e.currentTarget.style.borderColor = 'rgba(204, 122, 74, 0.5)';
										}
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.background = 'rgba(204, 122, 74, 0.1)';
										e.currentTarget.style.borderColor = 'rgba(204, 122, 74, 0.3)';
									}}
								>
									<Zap size={16} className='group-hover:animate-pulse' />
									<span>Quick Export</span>
								</button>
								<div className='absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-[10px] font-bold pointer-events-none' style={{
									background: '#CC7A4A',
									color: '#FFFFFF',
									boxShadow: '0 2px 4px rgba(204, 122, 74, 0.3)'
								}}>
									FAST
								</div>
							</div>
							<button
								onClick={handleContinue}
								disabled={isQuickExporting}
								className='px-8 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed'
								style={{
									background: '#CC7A4A',
									boxShadow: '0 4px 12px rgba(204, 122, 74, 0.3)'
								}}
								onMouseEnter={(e) => {
									if (!isQuickExporting) {
										e.currentTarget.style.background = '#BF7248';
										e.currentTarget.style.boxShadow = '0 6px 16px rgba(191, 114, 72, 0.35)';
									}
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.background = '#CC7A4A';
									e.currentTarget.style.boxShadow = '0 4px 12px rgba(204, 122, 74, 0.3)';
								}}
							>
								Continue to Refine →
							</button>
						</div>
					</div>

					{/* Canvas */}
					<div
						ref={stageContainerRef}
						id='konva-container'
						className='flex-1 overflow-hidden relative'
						style={{ 
							background: '#FAF8F5',
							backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(140, 103, 66, 0.03) 1px, transparent 0)',
							backgroundSize: '24px 24px'
						}}
						onMouseEnter={handleMouseEnter}
						onMouseLeave={handleMouseLeave}
					>
						{/* Floating tool indicator */}
						<div className='absolute top-6 left-6 px-4 py-2 rounded-lg backdrop-blur-md z-10 transition-all duration-200' style={{
							background: 'rgba(255, 255, 255, 0.9)',
							border: '1px solid rgba(140, 103, 66, 0.15)',
							boxShadow: '0 4px 12px rgba(90, 74, 61, 0.08)'
						}}>
							<div className='flex items-center gap-2'>
								<div className='w-1.5 h-1.5 rounded-full animate-pulse' style={{ background: '#CC7A4A' }} />
								<span className='text-xs font-medium' style={{ color: '#6B5D4F' }}>
									{tool === "hand" ? "Pan Mode" : 
									 tool === "pen" ? "Drawing" :
									 tool === "line" ? "Straight Line" :
									 tool === "rectangle" ? "Rectangle" :
									 tool === "circle" ? "Circle" :
									 tool === "text" ? "Add Text" :
									 "Erasing"}
								</span>
								<span className='text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold' style={{
									background: 'rgba(204, 122, 74, 0.1)',
									color: '#CC7A4A'
								}}>
									{tool === "hand" ? "H" : 
									 tool === "pen" ? "P" :
									 tool === "line" ? "L" :
									 tool === "rectangle" ? "R" :
									 tool === "circle" ? "C" :
									 tool === "text" ? "T" : "E"}
								</span>
							</div>
						</div>

						{/* Element counter */}
						{(lines.length > 0 || shapes.length > 0 || straightLines.length > 0 || texts.length > 0) && (
							<div className='absolute top-6 right-6 px-4 py-2 rounded-lg backdrop-blur-md z-10' style={{
								background: 'rgba(255, 255, 255, 0.9)',
								border: '1px solid rgba(140, 103, 66, 0.15)',
								boxShadow: '0 4px 12px rgba(90, 74, 61, 0.08)'
							}}>
								<span className='text-xs font-medium' style={{ color: '#6B5D4F' }}>
									{lines.length + shapes.length + straightLines.length + texts.length} elements
								</span>
							</div>
						)}

						{/* Empty state - helpful prompt */}
						{lines.length === 0 && shapes.length === 0 && straightLines.length === 0 && texts.length === 0 && (
							<div className='absolute inset-0 flex items-center justify-center pointer-events-none z-0'>
								<div className='text-center space-y-4 max-w-md'>
									<div className='text-6xl mb-4 opacity-20'>✏️</div>
									<h4 className='text-xl font-semibold opacity-40' style={{ color: '#5A4A3D' }}>
										Start Sketching
									</h4>
									<p className='text-sm opacity-30' style={{ color: '#8C6742' }}>
										Use the pen tool to draw your floorplan, or press <kbd className='px-2 py-1 rounded text-xs font-mono' style={{
											background: 'rgba(204, 122, 74, 0.1)',
											border: '1px solid rgba(204, 122, 74, 0.2)',
											color: '#CC7A4A'
										}}>?</kbd> for shortcuts
									</p>
								</div>
							</div>
						)}

						{isQuickExporting && (
							<div className='absolute inset-0 z-50 bg-white/95 backdrop-blur-sm'>
								<AsciiLoader 
									message="QUICK EXPORT" 
									subMessage="Processing all steps for Unity export..."
									isComplete={exportScene.isSuccess}
								/>
							</div>
						)}
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
								className='pointer-events-none absolute rounded-full z-50 transition-all duration-100'
								style={{
									left: cursorPos.x - (eraserSize * stageScale) / 2,
									top: cursorPos.y - (eraserSize * stageScale) / 2,
									width: eraserSize * stageScale,
									height: eraserSize * stageScale,
									border: '2px solid #CC7A4A',
									background: 'rgba(204, 122, 74, 0.15)',
									boxShadow: '0 0 0 1px rgba(204, 122, 74, 0.3)',
								}}
							>
								<div className='absolute inset-0 rounded-full' style={{
									background: 'radial-gradient(circle, rgba(204, 122, 74, 0.2) 0%, transparent 70%)'
								}} />
							</div>
						)}

						{/* Text Input Modal */}
						{showTextInput && (
							<div
								className='absolute rounded-xl p-5 shadow-2xl z-50'
								style={{
									left: textInputPos.x,
									top: textInputPos.y,
									background: 'rgba(255, 255, 255, 0.95)',
									backdropFilter: 'blur(20px)',
									border: '1px solid rgba(140, 103, 66, 0.15)',
									boxShadow: '0 8px 32px rgba(90, 74, 61, 0.2)'
								}}
							>
								<label className='block text-xs font-semibold mb-2' style={{ color: '#5A4A3D' }}>
									Add Text
								</label>
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
									className='w-72 px-4 py-2.5 text-sm rounded-lg border transition-all duration-200 focus:outline-none'
									style={{
										background: '#FAF8F5',
										color: '#5A4A3D',
										borderColor: '#E5DDD0'
									}}
									onFocus={(e) => {
										e.currentTarget.style.borderColor = '#CC7A4A';
										e.currentTarget.style.boxShadow = '0 0 0 3px rgba(204, 122, 74, 0.1)';
									}}
									onBlur={(e) => {
										e.currentTarget.style.borderColor = '#E5DDD0';
										e.currentTarget.style.boxShadow = 'none';
									}}
								/>
								<div className='flex gap-2 mt-4'>
									<button
										onClick={handleAddText}
										className='flex-1 px-4 py-2 text-white text-sm font-semibold rounded-lg transition-all duration-200'
										style={{
											background: '#CC7A4A',
											boxShadow: '0 2px 8px rgba(204, 122, 74, 0.3)'
										}}
										onMouseEnter={(e) => {
											e.currentTarget.style.background = '#BF7248';
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.background = '#CC7A4A';
										}}
									>
										Add <kbd className='ml-1 text-xs opacity-60'>↵</kbd>
									</button>
									<button
										onClick={() => {
											setShowTextInput(false);
											setTextInputValue("");
										}}
										className='px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200'
										style={{
											background: '#FFFFFF',
											color: '#6B5D4F',
											border: '1px solid #E5DDD0'
										}}
										onMouseEnter={(e) => {
											e.currentTarget.style.background = '#FAF8F5';
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.background = '#FFFFFF';
										}}
									>
										Cancel <kbd className='ml-1 text-xs opacity-60'>Esc</kbd>
									</button>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
			
			{/* Keyboard Shortcuts Modal */}
			<KeyboardShortcuts isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
		</div>
	);
}
