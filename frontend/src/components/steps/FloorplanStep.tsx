"use client";

import { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useExtractObjects, useUpdateFloorPlan } from "@/hooks/useApi";
import { FloorplanObject } from "@/lib/types";

interface FloorplanStepProps {
	onNext: () => void;
	onPrevious: () => void;
	currentStep: number;
}

interface Room {
	name: string;
	area: number;
	x: number;
	y: number;
	width: number;
	height: number;
}

interface FurnitureItem {
	id: string;
	type: string; // enum from massive repo of furniture
	image: string; // link to image
	position: [number, number]; // [x, y]
	dimensions: [number, number]; // [width, height]
}

interface Transform {
	offsetX: number;
	offsetY: number;
	scale: number;
}

export default function FloorplanStep({
	onNext,
	onPrevious,
}: FloorplanStepProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const floorplanImageRef = useRef<HTMLImageElement | null>(null);
	const extractionInitiatedRef = useRef<string | null>(null);

	const floorplanBlob = useAppStore((state) => state.floorplanBlob);
	const floorplanDataUrl = useAppStore((state) => state.floorplanDataUrl);
	const floorplanObjects = useAppStore((state) => state.floorplanObjects);
	const floorplanBoundaries = useAppStore(
		(state) => state.floorplanBoundaries
	);
	const extractObjects = useExtractObjects();
	const updateFloorPlan = useUpdateFloorPlan();

	// Load floorplan image
	useEffect(() => {
		if (floorplanDataUrl) {
			const img = new Image();
			img.onload = () => {
				floorplanImageRef.current = img;
				drawCanvas();
			};
			img.src = floorplanDataUrl;
		}
	}, [floorplanDataUrl]);

	// Load furniture icons
	useEffect(() => {
		const furnitureTypes = [
			"door",
			"window",
			"wall",
			"bed",
			"chair",
			"table",
			"couch",
			"toilet",
			"sink",
			"bathtub",
			"shower",
			"kitchen counter",
			"refrigerator",
			"oven",
			"dishwasher",
			"stairs",
			"closet",
			"cabinet",
			"desk",
			"dresser",
		];

		const loadIcons = async () => {
			const icons: Record<string, HTMLImageElement> = {};

			for (const type of furnitureTypes) {
				try {
					const img = new Image();
					img.crossOrigin = "anonymous";
					const imageUrl = `http://localhost:8000/static/floorplan_items/${encodeURIComponent(
						type
					)}/floorplan_icon.png`;
					img.src = imageUrl;

					const loaded = await new Promise<boolean>((resolve) => {
						img.onload = () => {
							console.log(`✅ Loaded icon for ${type}`);
							resolve(true);
						};
						img.onerror = (error) => {
							console.warn(
								`❌ Failed to load icon for ${type} from ${imageUrl}`,
								error
							);
							resolve(false);
						};

						// Timeout after 5 seconds
						setTimeout(() => {
							console.warn(`⏱️ Timeout loading icon for ${type}`);
							resolve(false);
						}, 5000);
					});

					// Only add successfully loaded images
					if (loaded && img.complete && img.naturalWidth > 0) {
						icons[type] = img;
					}
				} catch (error) {
					console.error(`Error loading icon for ${type}:`, error);
				}
			}

			console.log(
				`Loaded ${Object.keys(icons).length}/${
					furnitureTypes.length
				} furniture icons`
			);
			setFurnitureIcons(icons);
		};

		loadIcons();
	}, []);

	// Extract objects on mount if we have a floorplan but no objects
	useEffect(() => {
		// Only run if we have a blob and no objects yet
		if (!floorplanBlob || floorplanObjects.length > 0) {
			return;
		}

		// Create a unique identifier for this blob
		const blobId = `${floorplanBlob.size}-${floorplanBlob.type}`;

		// Only extract if we haven't already initiated extraction for this blob
		if (
			extractionInitiatedRef.current !== blobId &&
			!extractObjects.isPending
		) {
			console.log("Starting object extraction for blob:", blobId);
			extractionInitiatedRef.current = blobId;
			const file = new File([floorplanBlob], "floorplan.png", {
				type: "image/png",
			});
			extractObjects.mutate(file);
		}
	}, [floorplanBlob, floorplanObjects.length]);

	// Log JSON representation when floorplanObjects changes
	useEffect(() => {
		console.log(
			"📋 Floorplan Objects JSON:",
			JSON.stringify(floorplanObjects, null, 2)
		);
	}, [floorplanObjects]);

	const [showFurnitureModal, setShowFurnitureModal] = useState(false);
	const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
	const [selectedFurnitureId, setSelectedFurnitureId] = useState<
		string | null
	>(null);
	const [draggingId, setDraggingId] = useState<string | null>(null);
	const [dragOffset, setDragOffset] = useState<[number, number]>([0, 0]);
	const [hasDragged, setHasDragged] = useState(false);
	const [dragStartPos, setDragStartPos] = useState<[number, number]>([0, 0]);
	const [resizingId, setResizingId] = useState<string | null>(null);
	const [resizeHandle, setResizeHandle] = useState<string | null>(null);
	const [resizeStartBounds, setResizeStartBounds] = useState<any>(null);
	const [rotatingId, setRotatingId] = useState<string | null>(null);
	const [rotationStartAngle, setRotationStartAngle] = useState<number>(0);

	// Pan and zoom state
	const [transform, setTransform] = useState<Transform>({
		offsetX: 0,
		offsetY: 0,
		scale: 1,
	});
	const [isPanning, setIsPanning] = useState(false);
	const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
	const [furnitureItems, setFurnitureItems] = useState<FurnitureItem[]>([]);

	// Debug menu state
	const [showDebugMenu, setShowDebugMenu] = useState(false);
	const [showRectangles, setShowRectangles] = useState(false);

	// Store loaded furniture icons
	const [furnitureIcons, setFurnitureIcons] = useState<
		Record<string, HTMLImageElement>
	>({});

	// Color picker state
	const [showColorPicker, setShowColorPicker] = useState(false);
	const [objectColors, setObjectColors] = useState<Record<string, string>>(
		{}
	);
	const [objectModels, setObjectModels] = useState<Record<string, number>>(
		{}
	);
	const [modelImages, setModelImages] = useState<
		Record<string, HTMLImageElement[]>
	>({});

	// Rotation control state
	const [showRotationControl, setShowRotationControl] = useState(false);

	// Model number to color mapping
	const modelColorMap: Record<number, string> = {
		1: "#4A7CFF", // Blue
		2: "#EF4444", // Red
		3: "#10B981", // Green
		4: "#F59E0B", // Yellow
		5: "#8B5CF6", // Purple
	};

	const setFloorplanObjects = useAppStore(
		(state) => state.setFloorplanObjects
	);

	const handleAddFurniture = (furnitureName: string) => {
		if (selectedFurnitureId) {
			// Switch existing furniture type
			const detectedObj = floorplanObjects.find(
				(obj) => obj.id === selectedFurnitureId
			);

			if (detectedObj) {
				// Update detected object type
				setFloorplanObjects(
					floorplanObjects.map((obj) =>
						obj.id === selectedFurnitureId
							? {
									...obj,
									type: furnitureName.toLowerCase(),
									name: furnitureName.toLowerCase(),
							  }
							: obj
					)
				);
			} else {
				// Update manually added furniture
				setFurnitureItems(
					furnitureItems.map((item) =>
						item.id === selectedFurnitureId
							? {
									...item,
									type: furnitureName
										.toLowerCase()
										.replace(/\s+/g, "_"),
									image: `https://placehold.co/${
										item.dimensions[0]
									}x${
										item.dimensions[1]
									}/E07B47/white?text=${encodeURIComponent(
										furnitureName
									)}`,
							  }
							: item
					)
				);
			}
			setSelectedFurnitureId(null);
		} else {
			// Add new furniture as detected object
			const img = floorplanImageRef.current;
			if (!img) return;

			const newId = `manual-${Date.now()}`;
			const furnitureType = furnitureName.toLowerCase();

			// Add to center of viewport with default size
			const newObject: FloorplanObject = {
				id: newId,
				type: furnitureType,
				name: furnitureType,
				model: 1, // Default to model 1
				position: {
					x: 0.5,
					y: 0.5,
				},
				dimensions: {
					width: 0.2,
					height: 0.2,
				},
				rotation: 0,
				bbox_normalized: {
					x1: 0.4,
					y1: 0.4,
					x2: 0.6,
					y2: 0.6,
				},
				confidence: "high",
			};

			setFloorplanObjects([...floorplanObjects, newObject]);
		}
		setShowFurnitureModal(false);
	};

	const handleDeleteFurniture = () => {
		if (selectedFurnitureId) {
			// Check if it's a detected object
			const isDetected = floorplanObjects.some(
				(obj) => obj.id === selectedFurnitureId
			);

			if (isDetected) {
				// Remove from detected objects
				setFloorplanObjects(
					floorplanObjects.filter(
						(obj) => obj.id !== selectedFurnitureId
					)
				);
			} else {
				// Remove from manually added items
				setFurnitureItems(
					furnitureItems.filter(
						(item) => item.id !== selectedFurnitureId
					)
				);
			}
			setSelectedFurnitureId(null);
		}
	};

	// Convert screen coordinates to canvas coordinates
	const screenToCanvas = (screenX: number, screenY: number) => {
		const canvasX = (screenX - transform.offsetX) / transform.scale;
		const canvasY = (screenY - transform.offsetY) / transform.scale;
		return { x: canvasX, y: canvasY };
	};

	// Convert normalized coordinates to canvas coordinates
	const normalizedToCanvas = (x: number, y: number) => {
		const canvas = canvasRef.current;
		const img = floorplanImageRef.current;
		if (!canvas || !img) return { x: 0, y: 0 };

		const offsetX = (canvas.width / transform.scale - img.width) / 2;
		const offsetY = (canvas.height / transform.scale - img.height) / 2;

		return {
			x: offsetX + x * img.width,
			y: offsetY + y * img.height,
		};
	};

	// Draw the floorplan on canvas
	const drawCanvas = () => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const img = floorplanImageRef.current;

		// Clear canvas
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		// Save context state
		ctx.save();

		// Apply transform
		ctx.translate(transform.offsetX, transform.offsetY);
		ctx.scale(transform.scale, transform.scale);

		// Draw background
		ctx.fillStyle = "#F5F3EF";
		ctx.fillRect(
			0,
			0,
			canvas.width / transform.scale,
			canvas.height / transform.scale
		);

		if (!img) {
			ctx.restore();
			return;
		}

		// Center the floorplan image
		const offsetX = (canvas.width / transform.scale - img.width) / 2;
		const offsetY = (canvas.height / transform.scale - img.height) / 2;

		ctx.save();
		ctx.translate(offsetX, offsetY);

		// Draw the floorplan image (hidden - only showing detected objects)
		// ctx.drawImage(img, 0, 0, img.width, img.height);

		// Draw detected furniture from floorplan objects
		floorplanObjects.forEach((obj) => {
			// Skip if object doesn't have required properties
			if (!obj.bbox_normalized || !img) return;

			const isSelected = selectedFurnitureId === obj.id;
			const isDragging = draggingId === obj.id;

			// Convert normalized bbox to canvas coordinates
			const x1 = obj.bbox_normalized.x1 * img.width;
			const y1 = obj.bbox_normalized.y1 * img.height;
			const x2 = obj.bbox_normalized.x2 * img.width;
			const y2 = obj.bbox_normalized.y2 * img.height;
			const width = x2 - x1;
			const height = y2 - y1;

			if (showRectangles) {
				// Debug view: Draw rectangles with custom colors
				const modelNum = objectModels[obj.id] || 1;
				const customColor = objectColors[obj.id] || modelColorMap[1];
				const hexToRgba = (hex: string, alpha: number) => {
					const r = parseInt(hex.slice(1, 3), 16);
					const g = parseInt(hex.slice(3, 5), 16);
					const b = parseInt(hex.slice(5, 7), 16);
					return `rgba(${r}, ${g}, ${b}, ${alpha})`;
				};

				ctx.fillStyle = hexToRgba(customColor, 0.15);
				ctx.fillRect(x1, y1, width, height);

				ctx.strokeStyle = isSelected
					? "#E07B47"
					: isDragging
					? customColor
					: customColor;
				ctx.lineWidth = isSelected || isDragging ? 2.5 : 2;
				ctx.setLineDash([]);
				ctx.strokeRect(x1, y1, width, height);

				// Draw furniture label
				ctx.fillStyle = "#1A1815";
				ctx.font = "bold 11px sans-serif";
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				const label = obj.name || obj.type || "Unknown";
				ctx.fillText(
					label.toUpperCase(),
					x1 + width / 2,
					y1 + height / 2 - 8
				);

				// Draw model number
				ctx.fillStyle = customColor;
				ctx.font = "bold 10px sans-serif";
				ctx.fillText(
					`Model #${modelNum}`,
					x1 + width / 2,
					y1 + height / 2 + 8
				);

				// Draw model indicator in top-left corner
				ctx.fillStyle = customColor;
				ctx.beginPath();
				ctx.arc(x1 + 10, y1 + 10, 6, 0, Math.PI * 2);
				ctx.fill();

				ctx.fillStyle = "white";
				ctx.font = "bold 9px sans-serif";
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				ctx.fillText(modelNum.toString(), x1 + 10, y1 + 10);
			} else {
				// Normal view: Draw furniture icon
				const furnitureType = obj.type || obj.name;
				const icon = furnitureIcons[furnitureType];

				// Check if icon exists, is complete, and loaded successfully (not broken)
				if (
					icon &&
					icon.complete &&
					icon.naturalWidth > 0 &&
					icon.naturalHeight > 0
				) {
					try {
						// Save context for rotation
						ctx.save();

						// Move to center of furniture
						const centerX = x1 + width / 2;
						const centerY = y1 + height / 2;
						ctx.translate(centerX, centerY);

						// Apply rotation (convert degrees to radians)
						const rotation = obj.rotation || 0;
						ctx.rotate((rotation * Math.PI) / 180);

						// Draw icon centered and scaled to fit bbox
						ctx.drawImage(
							icon,
							-width / 2,
							-height / 2,
							width,
							height
						);

						ctx.restore();

						// Draw selection highlight if selected
						if (isSelected) {
							ctx.strokeStyle = "#E07B47";
							ctx.lineWidth = 3;
							ctx.setLineDash([]);
							ctx.strokeRect(x1, y1, width, height);
						}
					} catch (error) {
						console.error(
							`Failed to draw icon for ${furnitureType}:`,
							error
						);
						// Fallback on error
						ctx.fillStyle = "rgba(74, 124, 255, 0.5)";
						ctx.fillRect(x1, y1, width, height);
					}
				} else {
					// Fallback: draw colored rectangle if icon not loaded or broken
					ctx.fillStyle = "rgba(74, 124, 255, 0.5)";
					ctx.fillRect(x1, y1, width, height);

					// Draw label for debugging
					ctx.fillStyle = "#1A1815";
					ctx.font = "bold 10px sans-serif";
					ctx.textAlign = "center";
					ctx.textBaseline = "middle";
					ctx.fillText(
						furnitureType,
						x1 + width / 2,
						y1 + height / 2
					);
				}
			}

			// Draw resize handles, rotation handle, and delete button when selected
			if (isSelected) {
				const centerX = x1 + width / 2;
				const centerY = y1 + height / 2;
				const rotation = obj.rotation || 0;
				const rotationRad = (rotation * Math.PI) / 180;

				// Helper function to rotate a point around the center
				const rotatePoint = (px: number, py: number) => {
					const dx = px - centerX;
					const dy = py - centerY;
					return {
						x:
							centerX +
							dx * Math.cos(rotationRad) -
							dy * Math.sin(rotationRad),
						y:
							centerY +
							dx * Math.sin(rotationRad) +
							dy * Math.cos(rotationRad),
					};
				};

				// Draw rotated border
				ctx.save();
				ctx.translate(centerX, centerY);
				ctx.rotate(rotationRad);
				ctx.translate(-centerX, -centerY);

				ctx.strokeStyle = "#E07B47";
				ctx.lineWidth = 2;
				ctx.setLineDash([]);
				ctx.strokeRect(x1, y1, width, height);

				ctx.restore();

				// Draw resize handles (8 handles: 4 corners + 4 edges)
				const handleSize = 8;
				const handlePositions = [
					{ x: x1, y: y1, id: "nw" }, // Top-left
					{ x: x1 + width / 2, y: y1, id: "n" }, // Top-center
					{ x: x2, y: y1, id: "ne" }, // Top-right (will be delete button)
					{ x: x2, y: y1 + height / 2, id: "e" }, // Right-center
					{ x: x2, y: y2, id: "se" }, // Bottom-right
					{ x: x1 + width / 2, y: y2, id: "s" }, // Bottom-center
					{ x: x1, y: y2, id: "sw" }, // Bottom-left
					{ x: x1, y: y1 + height / 2, id: "w" }, // Left-center
				];

				handlePositions.forEach((handle) => {
					if (handle.id !== "ne") {
						// Skip top-right corner (reserved for delete button)
						const rotated = rotatePoint(handle.x, handle.y);

						ctx.save();
						ctx.translate(rotated.x, rotated.y);
						ctx.rotate(rotationRad);

						ctx.fillStyle = "#E07B47";
						ctx.fillRect(
							-handleSize / 2,
							-handleSize / 2,
							handleSize,
							handleSize
						);
						ctx.strokeStyle = "white";
						ctx.lineWidth = 2;
						ctx.strokeRect(
							-handleSize / 2,
							-handleSize / 2,
							handleSize,
							handleSize
						);

						ctx.restore();
					}
				});

				// Draw rotation handle above the object
				const rotationHandleDistance = 30;
				const topCenterY = y1;
				const rotationHandleY = topCenterY - rotationHandleDistance;
				const rotatedHandle = rotatePoint(centerX, rotationHandleY);
				const rotatedTopCenter = rotatePoint(centerX, y1);
				const rotationHandleRadius = 10;

				// Draw line connecting to object
				ctx.strokeStyle = "#4A7CFF";
				ctx.lineWidth = 2;
				ctx.setLineDash([4, 4]);
				ctx.beginPath();
				ctx.moveTo(rotatedTopCenter.x, rotatedTopCenter.y);
				ctx.lineTo(rotatedHandle.x, rotatedHandle.y);
				ctx.stroke();
				ctx.setLineDash([]);

				// Draw rotation handle circle
				ctx.fillStyle = "#4A7CFF";
				ctx.beginPath();
				ctx.arc(
					rotatedHandle.x,
					rotatedHandle.y,
					rotationHandleRadius,
					0,
					Math.PI * 2
				);
				ctx.fill();

				ctx.strokeStyle = "white";
				ctx.lineWidth = 2;
				ctx.stroke();

				// Draw rotation icon (circular arrow)
				ctx.save();
				ctx.translate(rotatedHandle.x, rotatedHandle.y);
				ctx.strokeStyle = "white";
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.arc(0, 0, 5, 0.2 * Math.PI, 1.8 * Math.PI);
				ctx.stroke();
				// Arrow head
				ctx.beginPath();
				ctx.moveTo(4, -3);
				ctx.lineTo(6, -1);
				ctx.lineTo(4, 1);
				ctx.stroke();
				ctx.restore();

				// Draw delete button at top-right corner
				const deletePos = rotatePoint(x2, y1);

				ctx.fillStyle = "#EF4444";
				ctx.beginPath();
				ctx.arc(deletePos.x, deletePos.y, 12, 0, Math.PI * 2);
				ctx.fill();

				ctx.strokeStyle = "white";
				ctx.lineWidth = 2;
				ctx.stroke();

				ctx.fillStyle = "white";
				ctx.font = "bold 14px sans-serif";
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				ctx.fillText("×", deletePos.x, deletePos.y);
			}
		});

		// Draw manually added furniture items (kept for backward compatibility)
		furnitureItems.forEach((item) => {
			const isSelected = selectedFurnitureId === item.id;
			const isDragging = draggingId === item.id;

			// Draw furniture background
			ctx.fillStyle = "rgba(224, 123, 71, 0.1)";
			ctx.fillRect(
				item.position[0],
				item.position[1],
				item.dimensions[0],
				item.dimensions[1]
			);

			// Draw furniture outline
			ctx.strokeStyle = isSelected
				? "#E07B47"
				: isDragging
				? "#E07B47"
				: "#E07B47";
			ctx.lineWidth = isSelected || isDragging ? 2.5 : 1.5;
			ctx.setLineDash([4, 4]);
			ctx.strokeRect(
				item.position[0],
				item.position[1],
				item.dimensions[0],
				item.dimensions[1]
			);
			ctx.setLineDash([]);

			// Draw furniture label
			ctx.fillStyle = "#1A1815";
			ctx.font = "bold 10px sans-serif";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText(
				item.type.toUpperCase(),
				item.position[0] + item.dimensions[0] / 2,
				item.position[1] + item.dimensions[1] / 2
			);

			// Draw delete button when selected
			if (isSelected) {
				const deleteX = item.position[0] + item.dimensions[0];
				const deleteY = item.position[1];

				ctx.fillStyle = "#EF4444";
				ctx.beginPath();
				ctx.arc(deleteX, deleteY, 12, 0, Math.PI * 2);
				ctx.fill();

				ctx.strokeStyle = "white";
				ctx.lineWidth = 2;
				ctx.stroke();

				ctx.fillStyle = "white";
				ctx.font = "bold 14px sans-serif";
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				ctx.fillText("×", deleteX, deleteY);
			}
		});

		// Draw boundary elements (walls, doors, windows) - non-draggable
		// Render in order: walls first, then doors, then windows (for proper z-ordering)

		// First pass: Draw walls
		floorplanBoundaries.forEach((boundary) => {
			if (!boundary.bbox_normalized || !img || boundary.class !== "wall")
				return;

			// Convert normalized bbox to canvas coordinates
			const x1 = boundary.bbox_normalized.x1 * img.width;
			const y1 = boundary.bbox_normalized.y1 * img.height;
			const x2 = boundary.bbox_normalized.x2 * img.width;
			const y2 = boundary.bbox_normalized.y2 * img.height;
			const width = x2 - x1;
			const height = y2 - y1;

			// Dark brown for walls - fully filled
			ctx.fillStyle = "rgba(61, 43, 31, 0.8)"; // dark brown
			ctx.fillRect(x1, y1, width, height);

			// Draw boundary outline
			ctx.strokeStyle = "#3D2B1F"; // dark brown
			ctx.lineWidth = 1;
			ctx.setLineDash([]); // solid line
			ctx.strokeRect(x1, y1, width, height);
		});

		// Second pass: Draw doors
		floorplanBoundaries.forEach((boundary) => {
			if (!boundary.bbox_normalized || !img || boundary.class !== "door")
				return;

			// Convert normalized bbox to canvas coordinates
			const x1 = boundary.bbox_normalized.x1 * img.width;
			const y1 = boundary.bbox_normalized.y1 * img.height;
			const x2 = boundary.bbox_normalized.x2 * img.width;
			const y2 = boundary.bbox_normalized.y2 * img.height;
			const width = x2 - x1;
			const height = y2 - y1;

			// Tan/brown for doors - fully filled
			ctx.fillStyle = "rgba(139, 90, 43, 0.7)"; // tan
			ctx.fillRect(x1, y1, width, height);

			// Draw boundary outline
			ctx.strokeStyle = "#8B5A2B"; // darker tan
			ctx.lineWidth = 2;
			ctx.setLineDash([]); // solid line
			ctx.strokeRect(x1, y1, width, height);
		});

		// Third pass: Draw windows (on top of everything)
		floorplanBoundaries.forEach((boundary) => {
			if (
				!boundary.bbox_normalized ||
				!img ||
				boundary.class !== "window"
			)
				return;

			// Convert normalized bbox to canvas coordinates
			const x1 = boundary.bbox_normalized.x1 * img.width;
			const y1 = boundary.bbox_normalized.y1 * img.height;
			const x2 = boundary.bbox_normalized.x2 * img.width;
			const y2 = boundary.bbox_normalized.y2 * img.height;
			const width = x2 - x1;
			const height = y2 - y1;

			// Light blue for windows - fully filled
			ctx.fillStyle = "rgba(135, 206, 235, 0.7)"; // light blue
			ctx.fillRect(x1, y1, width, height);

			// Draw boundary outline
			ctx.strokeStyle = "#87CEEB"; // sky blue
			ctx.lineWidth = 2;
			ctx.setLineDash([]); // solid line
			ctx.strokeRect(x1, y1, width, height);
		});

		ctx.restore();
		ctx.restore();
	};

	// Update canvas on transform or furniture change
	useEffect(() => {
		drawCanvas();
	}, [
		transform,
		furnitureItems,
		selectedFurnitureId,
		draggingId,
		resizingId,
		rotatingId,
		floorplanObjects,
		floorplanBoundaries,
		showRectangles,
		furnitureIcons,
		objectColors,
		objectModels,
	]);

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

		updateCanvasSize();
		window.addEventListener("resize", updateCanvasSize);
		return () => window.removeEventListener("resize", updateCanvasSize);
	}, []);

	// Check if click is on rotation handle
	const getRotationHandleAtPosition = (
		canvasX: number,
		canvasY: number,
		objId: string
	): boolean => {
		const canvas = canvasRef.current;
		const img = floorplanImageRef.current;
		if (!canvas || !img) return false;

		const obj = floorplanObjects.find((o) => o.id === objId);
		if (!obj || !obj.bbox_normalized) return false;

		const offsetX = (canvas.width / transform.scale - img.width) / 2;
		const offsetY = (canvas.height / transform.scale - img.height) / 2;

		const x1 = offsetX + obj.bbox_normalized.x1 * img.width;
		const y1 = offsetY + obj.bbox_normalized.y1 * img.height;
		const x2 = offsetX + obj.bbox_normalized.x2 * img.width;
		const y2 = offsetY + obj.bbox_normalized.y2 * img.height;
		const width = x2 - x1;
		const height = y2 - y1;

		const centerX = x1 + width / 2;
		const centerY = y1 + height / 2;
		const rotation = obj.rotation || 0;
		const rotationRad = (rotation * Math.PI) / 180;

		// Rotate the rotation handle position
		const rotationHandleDistance = 30;
		const localX = 0;
		const localY = -height / 2 - rotationHandleDistance;

		const rotatedX =
			centerX +
			localX * Math.cos(rotationRad) -
			localY * Math.sin(rotationRad);
		const rotatedY =
			centerY +
			localX * Math.sin(rotationRad) +
			localY * Math.cos(rotationRad);

		const rotationHandleRadius = 10;
		const hitMargin = 5;

		const dist = Math.sqrt(
			Math.pow(canvasX - rotatedX, 2) + Math.pow(canvasY - rotatedY, 2)
		);

		return dist <= rotationHandleRadius + hitMargin;
	};

	// Check if click is on a resize handle
	const getResizeHandleAtPosition = (
		canvasX: number,
		canvasY: number,
		objId: string
	): string | null => {
		const canvas = canvasRef.current;
		const img = floorplanImageRef.current;
		if (!canvas || !img) return null;

		const obj = floorplanObjects.find((o) => o.id === objId);
		if (!obj || !obj.bbox_normalized) return null;

		const offsetX = (canvas.width / transform.scale - img.width) / 2;
		const offsetY = (canvas.height / transform.scale - img.height) / 2;

		const x1 = offsetX + obj.bbox_normalized.x1 * img.width;
		const y1 = offsetY + obj.bbox_normalized.y1 * img.height;
		const x2 = offsetX + obj.bbox_normalized.x2 * img.width;
		const y2 = offsetY + obj.bbox_normalized.y2 * img.height;
		const width = x2 - x1;
		const height = y2 - y1;

		const centerX = x1 + width / 2;
		const centerY = y1 + height / 2;
		const rotation = obj.rotation || 0;
		const rotationRad = (rotation * Math.PI) / 180;

		// Helper function to rotate a point around the center
		const rotatePoint = (px: number, py: number) => {
			const dx = px - centerX;
			const dy = py - centerY;
			return {
				x:
					centerX +
					dx * Math.cos(rotationRad) -
					dy * Math.sin(rotationRad),
				y:
					centerY +
					dx * Math.sin(rotationRad) +
					dy * Math.cos(rotationRad),
			};
		};

		const handleSize = 8;
		const hitMargin = 4; // Extra margin for easier clicking

		const handles = [
			{ x: x1, y: y1, id: "nw" },
			{ x: x1 + width / 2, y: y1, id: "n" },
			{ x: x2, y: y2, id: "se" },
			{ x: x1 + width / 2, y: y2, id: "s" },
			{ x: x1, y: y2, id: "sw" },
			{ x: x1, y: y1 + height / 2, id: "w" },
			{ x: x2, y: y1 + height / 2, id: "e" },
		];

		for (const handle of handles) {
			const rotated = rotatePoint(handle.x, handle.y);
			const dist = Math.sqrt(
				Math.pow(canvasX - rotated.x, 2) +
					Math.pow(canvasY - rotated.y, 2)
			);
			if (dist <= handleSize / 2 + hitMargin) {
				return handle.id;
			}
		}

		return null;
	};

	// Check if click is on furniture
	const getFurnitureAtPosition = (
		canvasX: number,
		canvasY: number
	): string | null => {
		const canvas = canvasRef.current;
		const img = floorplanImageRef.current;
		if (!canvas) return null;

		const offsetX = img
			? (canvas.width / transform.scale - img.width) / 2
			: (canvas.width / transform.scale - 720) / 2;
		const offsetY = img
			? (canvas.height / transform.scale - img.height) / 2
			: (canvas.height / transform.scale - 560) / 2;

		// Check detected furniture objects first
		for (let i = floorplanObjects.length - 1; i >= 0; i--) {
			const obj = floorplanObjects[i];
			// Skip if object doesn't have required properties
			if (!img || !obj.bbox_normalized) continue;

			const x1 = offsetX + obj.bbox_normalized.x1 * img.width;
			const y1 = offsetY + obj.bbox_normalized.y1 * img.height;
			const x2 = offsetX + obj.bbox_normalized.x2 * img.width;
			const y2 = offsetY + obj.bbox_normalized.y2 * img.height;

			if (
				canvasX >= x1 &&
				canvasX <= x2 &&
				canvasY >= y1 &&
				canvasY <= y2
			) {
				return obj.id;
			}

			// Check delete button (rotated)
			if (selectedFurnitureId === obj.id) {
				const width = x2 - x1;
				const height = y2 - y1;
				const centerX = x1 + width / 2;
				const centerY = y1 + height / 2;
				const rotation = obj.rotation || 0;
				const rotationRad = (rotation * Math.PI) / 180;

				// Calculate rotated delete button position (top-right corner)
				const dx = x2 - centerX;
				const dy = y1 - centerY;
				const deleteX =
					centerX +
					dx * Math.cos(rotationRad) -
					dy * Math.sin(rotationRad);
				const deleteY =
					centerY +
					dx * Math.sin(rotationRad) +
					dy * Math.cos(rotationRad);

				const dist = Math.sqrt(
					Math.pow(canvasX - deleteX, 2) +
						Math.pow(canvasY - deleteY, 2)
				);
				if (dist <= 12) {
					return "delete:" + obj.id;
				}
			}
		}

		// Check manually added furniture items
		for (let i = furnitureItems.length - 1; i >= 0; i--) {
			const item = furnitureItems[i];
			const x = item.position[0] + offsetX;
			const y = item.position[1] + offsetY;

			if (
				canvasX >= x &&
				canvasX <= x + item.dimensions[0] &&
				canvasY >= y &&
				canvasY <= y + item.dimensions[1]
			) {
				return item.id;
			}

			// Check delete button
			if (selectedFurnitureId === item.id) {
				const deleteX = x + item.dimensions[0];
				const deleteY = y;
				const dist = Math.sqrt(
					Math.pow(canvasX - deleteX, 2) +
						Math.pow(canvasY - deleteY, 2)
				);
				if (dist <= 12) {
					return "delete:" + item.id;
				}
			}
		}
		return null;
	};

	const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		const screenX = e.clientX - rect.left;
		const screenY = e.clientY - rect.top;
		const canvasCoords = screenToCanvas(screenX, screenY);

		// Check if clicking on rotation handle of the selected object
		if (selectedFurnitureId) {
			const isRotationHandle = getRotationHandleAtPosition(
				canvasCoords.x,
				canvasCoords.y,
				selectedFurnitureId
			);

			if (isRotationHandle) {
				const obj = floorplanObjects.find(
					(o) => o.id === selectedFurnitureId
				);
				if (obj && obj.bbox_normalized) {
					const img = floorplanImageRef.current;
					if (!img) return;

					const offsetX =
						(canvas.width / transform.scale - img.width) / 2;
					const offsetY =
						(canvas.height / transform.scale - img.height) / 2;

					const x1 = offsetX + obj.bbox_normalized.x1 * img.width;
					const y1 = offsetY + obj.bbox_normalized.y1 * img.height;
					const x2 = offsetX + obj.bbox_normalized.x2 * img.width;
					const y2 = offsetY + obj.bbox_normalized.y2 * img.height;

					const centerX = x1 + (x2 - x1) / 2;
					const centerY = y1 + (y2 - y1) / 2;

					// Calculate initial angle from center to mouse
					const angle =
						Math.atan2(
							canvasCoords.y - centerY,
							canvasCoords.x - centerX
						) *
						(180 / Math.PI);

					setRotatingId(selectedFurnitureId);
					setRotationStartAngle(angle - (obj.rotation || 0));
					setHasDragged(false);
					setDragStartPos([e.clientX, e.clientY]);
				}
				return;
			}

			// Check if clicking on a resize handle of the selected object
			const handle = getResizeHandleAtPosition(
				canvasCoords.x,
				canvasCoords.y,
				selectedFurnitureId
			);

			if (handle) {
				const obj = floorplanObjects.find(
					(o) => o.id === selectedFurnitureId
				);
				if (obj && obj.bbox_normalized) {
					setResizingId(selectedFurnitureId);
					setResizeHandle(handle);
					setResizeStartBounds({
						...obj.bbox_normalized,
						startX: canvasCoords.x,
						startY: canvasCoords.y,
					});
					setHasDragged(false);
					setDragStartPos([e.clientX, e.clientY]);
				}
				return;
			}
		}

		const furnitureId = getFurnitureAtPosition(
			canvasCoords.x,
			canvasCoords.y
		);

		if (furnitureId) {
			if (furnitureId.startsWith("delete:")) {
				const id = furnitureId.replace("delete:", "");
				// Check if it's a detected object
				const isDetected = floorplanObjects.some(
					(obj) => obj.id === id
				);

				if (isDetected) {
					setFloorplanObjects(
						floorplanObjects.filter((obj) => obj.id !== id)
					);
				} else {
					setFurnitureItems(
						furnitureItems.filter((item) => item.id !== id)
					);
				}
				setSelectedFurnitureId(null);
				return;
			}

			// Start dragging furniture
			const item = furnitureItems.find((f) => f.id === furnitureId);
			const detectedObj = floorplanObjects.find(
				(obj) => obj.id === furnitureId
			);

			if (item) {
				const offsetX = (canvas.width / transform.scale - 720) / 2;
				const offsetY = (canvas.height / transform.scale - 560) / 2;

				setDraggingId(furnitureId);
				setHasDragged(false);
				setDragStartPos([e.clientX, e.clientY]);
				setDragOffset([
					canvasCoords.x - (item.position[0] + offsetX),
					canvasCoords.y - (item.position[1] + offsetY),
				]);
			} else if (detectedObj && detectedObj.bbox_normalized) {
				// Dragging detected object
				const img = floorplanImageRef.current;
				if (!img) return;

				const offsetX =
					(canvas.width / transform.scale - img.width) / 2;
				const offsetY =
					(canvas.height / transform.scale - img.height) / 2;

				const x1 = offsetX + detectedObj.bbox_normalized.x1 * img.width;
				const y1 =
					offsetY + detectedObj.bbox_normalized.y1 * img.height;

				setDraggingId(furnitureId);
				setHasDragged(false);
				setDragStartPos([e.clientX, e.clientY]);
				setDragOffset([canvasCoords.x - x1, canvasCoords.y - y1]);
			}
		} else {
			// Start panning
			setIsPanning(true);
			setLastMousePos({ x: e.clientX, y: e.clientY });
		}
	};

	const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		if (rotatingId) {
			// Handle rotation
			const dx = e.clientX - dragStartPos[0];
			const dy = e.clientY - dragStartPos[1];
			const distance = Math.sqrt(dx * dx + dy * dy);

			if (distance > 5) {
				setHasDragged(true);
			}

			const rect = canvas.getBoundingClientRect();
			const screenX = e.clientX - rect.left;
			const screenY = e.clientY - rect.top;
			const canvasCoords = screenToCanvas(screenX, screenY);

			const obj = floorplanObjects.find((o) => o.id === rotatingId);
			if (!obj || !obj.bbox_normalized) return;

			const img = floorplanImageRef.current;
			if (!img) return;

			const offsetX = (canvas.width / transform.scale - img.width) / 2;
			const offsetY = (canvas.height / transform.scale - img.height) / 2;

			const x1 = offsetX + obj.bbox_normalized.x1 * img.width;
			const y1 = offsetY + obj.bbox_normalized.y1 * img.height;
			const x2 = offsetX + obj.bbox_normalized.x2 * img.width;
			const y2 = offsetY + obj.bbox_normalized.y2 * img.height;

			const centerX = x1 + (x2 - x1) / 2;
			const centerY = y1 + (y2 - y1) / 2;

			// Calculate current angle from center to mouse
			const currentAngle =
				Math.atan2(canvasCoords.y - centerY, canvasCoords.x - centerX) *
				(180 / Math.PI);

			// Calculate new rotation
			let newRotation = currentAngle - rotationStartAngle;

			// Normalize to 0-360 range
			while (newRotation < 0) newRotation += 360;
			while (newRotation >= 360) newRotation -= 360;

			// Snap to 15-degree increments if shift key is held
			if (e.shiftKey) {
				newRotation = Math.round(newRotation / 15) * 15;
			}

			setFloorplanObjects(
				floorplanObjects.map((o) =>
					o.id === rotatingId
						? { ...o, rotation: Math.round(newRotation) }
						: o
				)
			);
		} else if (resizingId && resizeHandle && resizeStartBounds) {
			// Handle resizing
			const dx = e.clientX - dragStartPos[0];
			const dy = e.clientY - dragStartPos[1];
			const distance = Math.sqrt(dx * dx + dy * dy);

			if (distance > 5) {
				setHasDragged(true);
			}

			const rect = canvas.getBoundingClientRect();
			const screenX = e.clientX - rect.left;
			const screenY = e.clientY - rect.top;
			const canvasCoords = screenToCanvas(screenX, screenY);

			const img = floorplanImageRef.current;
			if (!img) return;

			const offsetX = (canvas.width / transform.scale - img.width) / 2;
			const offsetY = (canvas.height / transform.scale - img.height) / 2;

			// Convert to normalized coordinates
			const normalizedX = (canvasCoords.x - offsetX) / img.width;
			const normalizedY = (canvasCoords.y - offsetY) / img.height;

			setFloorplanObjects(
				floorplanObjects.map((obj) => {
					if (obj.id !== resizingId || !obj.bbox_normalized) {
						return obj;
					}

					let newBounds = { ...obj.bbox_normalized };

					// Handle different resize directions
					switch (resizeHandle) {
						case "nw":
							newBounds.x1 = Math.min(
								normalizedX,
								newBounds.x2 - 0.05
							);
							newBounds.y1 = Math.min(
								normalizedY,
								newBounds.y2 - 0.05
							);
							break;
						case "n":
							newBounds.y1 = Math.min(
								normalizedY,
								newBounds.y2 - 0.05
							);
							break;
						case "ne":
							newBounds.x2 = Math.max(
								normalizedX,
								newBounds.x1 + 0.05
							);
							newBounds.y1 = Math.min(
								normalizedY,
								newBounds.y2 - 0.05
							);
							break;
						case "e":
							newBounds.x2 = Math.max(
								normalizedX,
								newBounds.x1 + 0.05
							);
							break;
						case "se":
							newBounds.x2 = Math.max(
								normalizedX,
								newBounds.x1 + 0.05
							);
							newBounds.y2 = Math.max(
								normalizedY,
								newBounds.y1 + 0.05
							);
							break;
						case "s":
							newBounds.y2 = Math.max(
								normalizedY,
								newBounds.y1 + 0.05
							);
							break;
						case "sw":
							newBounds.x1 = Math.min(
								normalizedX,
								newBounds.x2 - 0.05
							);
							newBounds.y2 = Math.max(
								normalizedY,
								newBounds.y1 + 0.05
							);
							break;
						case "w":
							newBounds.x1 = Math.min(
								normalizedX,
								newBounds.x2 - 0.05
							);
							break;
					}

					// Update dimensions based on new bounds
					const width = (newBounds.x2 - newBounds.x1) * img.width;
					const height = (newBounds.y2 - newBounds.y1) * img.height;

					return {
						...obj,
						bbox_normalized: newBounds,
						dimensions: {
							width: newBounds.x2 - newBounds.x1,
							height: newBounds.y2 - newBounds.y1,
						},
						position: {
							x: (newBounds.x1 + newBounds.x2) / 2,
							y: (newBounds.y1 + newBounds.y2) / 2,
						},
					};
				})
			);
		} else if (draggingId) {
			// Check if we've moved more than 5 pixels to distinguish drag from click
			const dx = e.clientX - dragStartPos[0];
			const dy = e.clientY - dragStartPos[1];
			const distance = Math.sqrt(dx * dx + dy * dy);

			if (distance > 5) {
				setHasDragged(true);
			}

			const rect = canvas.getBoundingClientRect();
			const screenX = e.clientX - rect.left;
			const screenY = e.clientY - rect.top;
			const canvasCoords = screenToCanvas(screenX, screenY);

			// Check if dragging a manually added item
			const item = furnitureItems.find((f) => f.id === draggingId);
			if (item) {
				const offsetX = (canvas.width / transform.scale - 720) / 2;
				const offsetY = (canvas.height / transform.scale - 560) / 2;

				setFurnitureItems(
					furnitureItems.map((f) =>
						f.id === draggingId
							? {
									...f,
									position: [
										canvasCoords.x -
											dragOffset[0] -
											offsetX,
										canvasCoords.y -
											dragOffset[1] -
											offsetY,
									],
							  }
							: f
					)
				);
			} else {
				// Dragging a detected object
				const img = floorplanImageRef.current;
				if (!img) return;

				const offsetX =
					(canvas.width / transform.scale - img.width) / 2;
				const offsetY =
					(canvas.height / transform.scale - img.height) / 2;

				const newX1 = canvasCoords.x - dragOffset[0] - offsetX;
				const newY1 = canvasCoords.y - dragOffset[1] - offsetY;

				setFloorplanObjects(
					floorplanObjects.map((obj) => {
						if (obj.id === draggingId && obj.bbox_normalized) {
							const width =
								(obj.bbox_normalized.x2 -
									obj.bbox_normalized.x1) *
								img.width;
							const height =
								(obj.bbox_normalized.y2 -
									obj.bbox_normalized.y1) *
								img.height;

							return {
								...obj,
								bbox_normalized: {
									x1: newX1 / img.width,
									y1: newY1 / img.height,
									x2: (newX1 + width) / img.width,
									y2: (newY1 + height) / img.height,
								},
							};
						}
						return obj;
					})
				);
			}
		} else if (isPanning) {
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

	const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
		if (rotatingId && !hasDragged) {
			// Quick click on rotation handle - don't do anything special
			setRotatingId(null);
			setRotationStartAngle(0);
			return;
		}

		if (resizingId && !hasDragged) {
			// Quick click on resize handle - don't do anything special
			setResizingId(null);
			setResizeHandle(null);
			setResizeStartBounds(null);
			return;
		}

		if (draggingId && !hasDragged) {
			// It was a click, not a drag
			const isDetectedObj = floorplanObjects.some(
				(obj) => obj.id === draggingId
			);

			setSelectedFurnitureId(draggingId);

			if (isDetectedObj) {
				// Open color picker for detected objects
				setShowColorPicker(true);
			} else {
				// Open furniture modal for manually added items
				setShowFurnitureModal(true);
			}
		}

		setDraggingId(null);
		setIsPanning(false);
		setResizingId(null);
		setResizeHandle(null);
		setResizeStartBounds(null);
		setRotatingId(null);
		setRotationStartAngle(0);
	};

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
		const newScale = Math.max(0.1, Math.min(3, transform.scale + delta));

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
			scale: Math.min(3, prev.scale + 0.2),
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

	const handleModelChange = (modelNumber: number) => {
		if (selectedFurnitureId) {
			const color = modelColorMap[modelNumber];
			setObjectColors({
				...objectColors,
				[selectedFurnitureId]: color,
			});
			setObjectModels({
				...objectModels,
				[selectedFurnitureId]: modelNumber,
			});
		}
		setShowColorPicker(false);
		setSelectedFurnitureId(null);
	};

	const handleRotateObject = (degrees: number) => {
		if (selectedFurnitureId) {
			setFloorplanObjects(
				floorplanObjects.map((obj) =>
					obj.id === selectedFurnitureId
						? {
								...obj,
								rotation: ((obj.rotation || 0) + degrees) % 360,
						  }
						: obj
				)
			);
		}
	};

	const handleSetRotation = (rotation: number) => {
		if (selectedFurnitureId) {
			setFloorplanObjects(
				floorplanObjects.map((obj) =>
					obj.id === selectedFurnitureId
						? {
								...obj,
								rotation: rotation,
						  }
						: obj
				)
			);
		}
	};

	const handleContinueToRender = async () => {
		console.log(
			"🚀 Continue to Render clicked - Sending floor plan data to backend"
		);

		try {
			// Send the current floor plan data to the backend
			await updateFloorPlan.mutateAsync({
				objects: floorplanObjects,
				boundaries: floorplanBoundaries,
			});

			// Proceed to next step after successful update
			onNext();
		} catch (error) {
			console.error("Failed to update floor plan:", error);
			// You could show an error toast/notification here
		}
	};

	const rotationControlModal =
		showRotationControl &&
		selectedFurnitureId &&
		(() => {
			const selectedObj = floorplanObjects.find(
				(obj) => obj.id === selectedFurnitureId
			);
			const currentRotation = selectedObj?.rotation || 0;

			return (
				<div className='fixed inset-y-0 right-0 w-96 bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right'>
					{/* Rotation Control Header */}
					<div className='px-6 py-4 border-b border-[#E5E2DA] flex items-center justify-between'>
						<div>
							<h3 className='text-lg font-medium text-[#1A1815]'>
								Rotate Object
							</h3>
							<p className='text-xs text-[#6B6862] mt-1'>
								Current rotation: {currentRotation}°
							</p>
						</div>
						<button
							onClick={() => {
								setShowRotationControl(false);
								setSelectedFurnitureId(null);
							}}
							className='w-8 h-8 rounded-full hover:bg-[#F5F3EF] flex items-center justify-center text-[#6B6862] hover:text-[#1A1815] transition-colors'
						>
							×
						</button>
					</div>

					{/* Rotation Control Content */}
					<div className='flex-1 overflow-y-auto p-6 space-y-6'>
						<div>
							<h4 className='text-sm font-medium text-[#1A1815] mb-3'>
								Quick Rotate
							</h4>
							<div className='grid grid-cols-2 gap-3'>
								<button
									onClick={() => handleRotateObject(-90)}
									className='px-4 py-3 bg-[#F5F3EF] hover:bg-[#E5E2DA] rounded-lg text-sm font-medium transition-colors'
								>
									↺ 90° Left
								</button>
								<button
									onClick={() => handleRotateObject(90)}
									className='px-4 py-3 bg-[#F5F3EF] hover:bg-[#E5E2DA] rounded-lg text-sm font-medium transition-colors'
								>
									↻ 90° Right
								</button>
								<button
									onClick={() => handleRotateObject(-45)}
									className='px-4 py-3 bg-[#F5F3EF] hover:bg-[#E5E2DA] rounded-lg text-sm font-medium transition-colors'
								>
									↺ 45° Left
								</button>
								<button
									onClick={() => handleRotateObject(45)}
									className='px-4 py-3 bg-[#F5F3EF] hover:bg-[#E5E2DA] rounded-lg text-sm font-medium transition-colors'
								>
									↻ 45° Right
								</button>
							</div>
						</div>

						<div>
							<h4 className='text-sm font-medium text-[#1A1815] mb-3'>
								Precise Rotation
							</h4>
							<div className='space-y-3'>
								<input
									type='range'
									min='0'
									max='360'
									value={currentRotation}
									onChange={(e) =>
										handleSetRotation(
											Number(e.target.value)
										)
									}
									className='w-full h-2 bg-[#E5E2DA] rounded-lg appearance-none cursor-pointer'
									style={{
										background: `linear-gradient(to right, #E07B47 0%, #E07B47 ${
											(currentRotation / 360) * 100
										}%, #E5E2DA ${
											(currentRotation / 360) * 100
										}%, #E5E2DA 100%)`,
									}}
								/>
								<div className='flex justify-between text-xs text-[#6B6862]'>
									<span>0°</span>
									<span>{currentRotation}°</span>
									<span>360°</span>
								</div>
								<button
									onClick={() => handleSetRotation(0)}
									className='w-full px-4 py-2 bg-[#F5F3EF] hover:bg-[#E5E2DA] rounded-lg text-sm font-medium transition-colors'
								>
									Reset to 0°
								</button>
							</div>
						</div>

						<div>
							<h4 className='text-sm font-medium text-[#1A1815] mb-3'>
								Common Angles
							</h4>
							<div className='grid grid-cols-4 gap-2'>
								{[0, 45, 90, 135, 180, 225, 270, 315].map(
									(angle) => (
										<button
											key={angle}
											onClick={() =>
												handleSetRotation(angle)
											}
											className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
												currentRotation === angle
													? "bg-[#E07B47] text-white"
													: "bg-[#F5F3EF] hover:bg-[#E5E2DA] text-[#1A1815]"
											}`}
										>
											{angle}°
										</button>
									)
								)}
							</div>
						</div>
					</div>
				</div>
			);
		})();

	const colorPickerModal =
		showColorPicker &&
		selectedFurnitureId &&
		(() => {
			// Get the furniture type of the selected object
			const selectedObj = floorplanObjects.find(
				(obj) => obj.id === selectedFurnitureId
			);
			const furnitureType =
				selectedObj?.type || selectedObj?.name || "bed";
			const currentModel = objectModels[selectedFurnitureId] || 1;

			return (
				<div className='fixed inset-y-0 right-0 w-96 bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right'>
					{/* Color Picker Header */}
					<div className='px-6 py-4 border-b border-[#E5E2DA] flex items-center justify-between'>
						<div>
							<h3 className='text-lg font-medium text-[#1A1815]'>
								Choose Model
							</h3>
							<p className='text-xs text-[#6B6862] mt-1'>
								{furnitureType} - Currently Model #
								{currentModel}
							</p>
						</div>
						<button
							onClick={() => {
								setShowColorPicker(false);
								setSelectedFurnitureId(null);
							}}
							className='w-8 h-8 rounded-full hover:bg-[#F5F3EF] flex items-center justify-center text-[#6B6862] hover:text-[#1A1815] transition-colors'
						>
							×
						</button>
					</div>

					{/* Model Picker Content */}
					<div className='flex-1 overflow-y-auto p-6 space-y-4'>
						<div>
							<h4 className='text-sm font-medium text-[#1A1815] mb-3'>
								Available Models
							</h4>
							<div className='grid grid-cols-2 gap-4'>
								{[1, 2, 3, 4, 5].map((modelNum) => {
									const color = modelColorMap[modelNum];
									const imageUrl = `http://localhost:8000/static/floorplan_items/${encodeURIComponent(
										furnitureType
									)}/variation_${String(
										modelNum - 1
									).padStart(3, "0")}/product_image.png`;

									return (
										<button
											key={modelNum}
											onClick={() =>
												handleModelChange(modelNum)
											}
											className={`flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-[#F5F3EF] transition-colors border-2 ${
												currentModel === modelNum
													? "border-[#E07B47] bg-[#FFF5F0]"
													: "border-[#E5E2DA]"
											}`}
											title={`Model ${modelNum}`}
										>
											<div
												className='w-full aspect-square rounded-lg border-2 overflow-hidden bg-white'
												style={{ borderColor: color }}
											>
												<img
													src={imageUrl}
													alt={`Model ${modelNum}`}
													className='w-full h-full object-cover'
													onError={(e) => {
														// Fallback to color block if image fails
														const target =
															e.target as HTMLImageElement;
														target.style.display =
															"none";
														if (
															target.parentElement
														) {
															target.parentElement.style.backgroundColor =
																color;
														}
													}}
												/>
											</div>
											<div className='flex items-center gap-2'>
												<div
													className='w-3 h-3 rounded-full'
													style={{
														backgroundColor: color,
													}}
												/>
												<span className='text-xs text-[#6B6862] font-medium'>
													Model #{modelNum}
												</span>
											</div>
										</button>
									);
								})}
							</div>
						</div>
					</div>
				</div>
			);
		})();

	const furnitureSidebar =
		showFurnitureModal &&
		(() => {
			// Get current furniture type
			let currentType = "";
			if (selectedFurnitureId) {
				const detectedObj = floorplanObjects.find(
					(obj) => obj.id === selectedFurnitureId
				);
				const manualItem = furnitureItems.find(
					(f) => f.id === selectedFurnitureId
				);

				if (detectedObj) {
					currentType = (
						detectedObj.type ||
						detectedObj.name ||
						""
					).replace(/_/g, " ");
				} else if (manualItem) {
					currentType = manualItem.type.replace(/_/g, " ");
				}
			}

			return (
				<div className='fixed inset-y-0 right-0 w-96 bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right'>
					{/* Sidebar Header */}
					<div className='px-6 py-4 border-b border-[#E5E2DA] flex items-center justify-between'>
						<div>
							<h3 className='text-lg font-medium text-[#1A1815]'>
								{selectedFurnitureId
									? "Change Furniture Type"
									: "Add New Furniture"}
							</h3>
							{selectedFurnitureId && currentType && (
								<p className='text-xs text-[#6B6862] mt-1'>
									Currently: {currentType.toUpperCase()}
								</p>
							)}
						</div>
						<button
							onClick={() => {
								setShowFurnitureModal(false);
								setSelectedFurnitureId(null);
							}}
							className='w-8 h-8 rounded-full hover:bg-[#F5F3EF] flex items-center justify-center text-[#6B6862] hover:text-[#1A1815] transition-colors'
						>
							×
						</button>
					</div>

					{/* Sidebar Content */}
					<div className='flex-1 overflow-y-auto p-6 space-y-4'>
						{[
							{
								name: "Seating",
								items: [
									{ name: "couch", icon: "🛋️" },
									{ name: "chair", icon: "🪑" },
								],
							},
							{
								name: "Tables & Desks",
								items: [
									{ name: "table", icon: "🍽️" },
									{ name: "desk", icon: "🖥️" },
								],
							},
							{
								name: "Bedroom",
								items: [
									{ name: "bed", icon: "🛏️" },
									{ name: "dresser", icon: "🗄️" },
								],
							},
							{
								name: "Storage",
								items: [
									{ name: "closet", icon: "🚪" },
									{ name: "cabinet", icon: "📚" },
								],
							},
							{
								name: "Kitchen",
								items: [
									{ name: "refrigerator", icon: "🧊" },
									{ name: "oven", icon: "🔥" },
									{ name: "dishwasher", icon: "🍽️" },
									{ name: "kitchen counter", icon: "🪑" },
								],
							},
							{
								name: "Bathroom",
								items: [
									{ name: "toilet", icon: "🚽" },
									{ name: "sink", icon: "🚰" },
									{ name: "bathtub", icon: "🛁" },
									{ name: "shower", icon: "🚿" },
								],
							},
							{
								name: "Structural",
								items: [
									{ name: "stairs", icon: "🪜" },
									{ name: "door", icon: "🚪" },
									{ name: "window", icon: "🪟" },
									{ name: "wall", icon: "🧱" },
								],
							},
						].map((category) => (
							<div key={category.name}>
								<h4 className='text-sm font-medium text-[#1A1815] mb-3'>
									{category.name}
								</h4>
								<div className='grid grid-cols-2 gap-3'>
									{category.items.map((item) => (
										<button
											key={item.name}
											onClick={() =>
												handleAddFurniture(item.name)
											}
											className='bg-[#F5F3EF] hover:bg-[#E5E2DA] rounded-lg p-3 text-left transition-colors group'
										>
											<div className='flex flex-col items-center gap-2 text-center'>
												<span className='text-3xl'>
													{item.icon}
												</span>
												<span className='text-xs text-[#1A1815] font-medium group-hover:text-[#E07B47] transition-colors'>
													{item.name}
												</span>
											</div>
										</button>
									))}
								</div>
							</div>
						))}
					</div>
				</div>
			);
		})();

	return (
		<>
			<div className='h-full flex overflow-hidden relative'>
				{/* Main Panel - Floorplan */}
				<div className='flex-1 p-12 flex flex-col min-w-0'>
					<div className='bg-white rounded-2xl shadow-lg flex-1 flex flex-col overflow-hidden'>
						{/* Header */}
						<div className='px-6 py-4 border-b border-[#E5E2DA] flex items-center justify-between'>
							<div className='flex items-center gap-4'>
								<h3 className='text-lg font-medium text-[#1A1815]'>
									Floorplan
								</h3>
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
							</div>
							<div className='flex items-center gap-2'>
								<button className='px-4 py-2 rounded-lg text-sm font-medium bg-[#F5F3EF] text-[#6B6862] hover:bg-[#E5E2DA] transition-colors'>
									Export PDF
								</button>
								<button
									onClick={onPrevious}
									className='px-4 py-2 rounded-lg text-sm font-medium bg-[#F5F3EF] text-[#6B6862] hover:bg-[#E5E2DA] transition-colors'
								>
									← Back
								</button>
								<button
									onClick={handleContinueToRender}
									disabled={updateFloorPlan.isPending}
									className='px-6 py-2 rounded-lg text-sm font-medium bg-[#E07B47] text-white hover:bg-[#D06A36] transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
								>
									{updateFloorPlan.isPending
										? "Saving..."
										: "Continue to Render →"}
								</button>
							</div>
						</div>

						{/* Floorplan Content */}
						<div className='flex-1 flex items-center justify-center bg-[#F5F3EF]'>
							{extractObjects.isPending &&
							floorplanObjects.length === 0 ? (
								<div className='text-center space-y-4'>
									<div className='w-16 h-16 border-4 border-[#E5E2DA] border-t-[#E07B47] rounded-full animate-spin mx-auto'></div>
									<p className='text-[#6B6862] text-sm'>
										Detecting and classifying furniture...
									</p>
									<p className='text-[#6B6862] text-xs'>
										Check browser console (F12) if this
										takes more than 2 minutes
									</p>
									<button
										onClick={() => {
											console.log("Manual status check:");
											console.log(
												"isPending:",
												extractObjects.isPending
											);
											console.log(
												"isError:",
												extractObjects.isError
											);
											console.log(
												"isSuccess:",
												extractObjects.isSuccess
											);
											console.log(
												"Objects:",
												floorplanObjects.length
											);
										}}
										className='mt-4 px-4 py-2 bg-[#6B6862] text-white rounded-lg text-xs hover:bg-[#1A1815]'
									>
										Debug: Check Status
									</button>
								</div>
							) : extractObjects.isError ? (
								<div className='text-center space-y-4'>
									<p className='text-red-600 font-medium'>
										Error extracting objects
									</p>
									<p className='text-[#6B6862] text-sm'>
										{extractObjects.error?.message ||
											"Unknown error"}
									</p>
									<button
										onClick={() => extractObjects.reset()}
										className='px-4 py-2 bg-[#E07B47] text-white rounded-lg hover:bg-[#D06A36]'
									>
										Try Again
									</button>
								</div>
							) : (
								<div
									ref={containerRef}
									className='w-full h-full bg-white overflow-hidden relative'
								>
									<canvas
										ref={canvasRef}
										className='w-full h-full'
										onMouseDown={handleCanvasMouseDown}
										onMouseMove={handleCanvasMouseMove}
										onMouseUp={handleCanvasMouseUp}
										onMouseLeave={handleCanvasMouseUp}
										onWheel={handleWheel}
										style={{
											cursor: rotatingId
												? "grabbing"
												: resizingId
												? resizeHandle?.includes("n") &&
												  resizeHandle?.includes("w")
													? "nw-resize"
													: resizeHandle?.includes(
															"n"
													  ) &&
													  resizeHandle?.includes(
															"e"
													  )
													? "ne-resize"
													: resizeHandle?.includes(
															"s"
													  ) &&
													  resizeHandle?.includes(
															"w"
													  )
													? "sw-resize"
													: resizeHandle?.includes(
															"s"
													  ) &&
													  resizeHandle?.includes(
															"e"
													  )
													? "se-resize"
													: resizeHandle === "n" ||
													  resizeHandle === "s"
													? "ns-resize"
													: resizeHandle === "e" ||
													  resizeHandle === "w"
													? "ew-resize"
													: "grabbing"
												: draggingId
												? "grabbing"
												: isPanning
												? "grabbing"
												: "grab",
										}}
									/>
									{(floorplanObjects.length > 0 ||
										floorplanBoundaries.length > 0) && (
										<div className='absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg'>
											<p className='text-sm text-[#1A1815] font-medium'>
												{floorplanObjects.length}{" "}
												furniture item
												{floorplanObjects.length !== 1
													? "s"
													: ""}
												{floorplanBoundaries.length >
													0 && (
													<>
														<br />
														{
															floorplanBoundaries.length
														}{" "}
														boundary element
														{floorplanBoundaries.length !==
														1
															? "s"
															: ""}
													</>
												)}
											</p>
										</div>
									)}
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Debug Menu - Top Right */}
				<div className='absolute top-24 right-8 z-10'>
					<button
						onClick={() => setShowDebugMenu(!showDebugMenu)}
						className='px-4 py-2 bg-white/90 backdrop-blur-sm text-[#6B6862] rounded-lg shadow-lg hover:bg-white transition-colors text-sm font-medium'
					>
						🐛 Debug
					</button>

					{showDebugMenu && (
						<div className='mt-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-4 space-y-2'>
							<label className='flex items-center gap-2 cursor-pointer'>
								<input
									type='checkbox'
									checked={showRectangles}
									onChange={(e) =>
										setShowRectangles(e.target.checked)
									}
									className='w-4 h-4 rounded border-gray-300 text-[#E07B47] focus:ring-[#E07B47]'
								/>
								<span className='text-sm text-[#1A1815]'>
									Show Rectangles
								</span>
							</label>
							<p className='text-xs text-[#6B6862] mt-2'>
								Toggle to switch between icon view and debug
								rectangle view
							</p>
						</div>
					)}
				</div>

				{/* Add Furniture Button - Bottom Right */}
				<div className='absolute bottom-8 right-8 flex flex-col gap-3 z-10'>
					<button
						onClick={() => {
							setSelectedFurnitureId(null);
							setShowFurnitureModal(true);
						}}
						className='px-6 py-3 bg-[#E07B47] text-white rounded-full font-medium hover:bg-[#D06A36] transition-colors duration-200 shadow-lg'
					>
						+ Add Furniture
					</button>
					{selectedFurnitureId && (
						<>
							<button
								onClick={() => setShowRotationControl(true)}
								className='px-6 py-3 bg-[#4A7CFF] text-white rounded-full font-medium hover:bg-[#3A6CEF] transition-colors duration-200 shadow-lg'
							>
								🔄 Rotate
							</button>
							<button
								onClick={() => setShowFurnitureModal(true)}
								className='px-6 py-3 bg-[#10B981] text-white rounded-full font-medium hover:bg-[#059669] transition-colors duration-200 shadow-lg'
							>
								🔧 Change Type
							</button>
							<button
								onClick={handleDeleteFurniture}
								className='px-6 py-3 bg-[#EF4444] text-white rounded-full font-medium hover:bg-[#DC2626] transition-colors duration-200 shadow-lg'
							>
								🗑️ Delete
							</button>
						</>
					)}
				</div>
			</div>

			{/* Rotation Control Modal */}
			{rotationControlModal}

			{/* Color Picker Modal */}
			{colorPickerModal}

			{/* Furniture Sidebar */}
			{furnitureSidebar}
		</>
	);
}
