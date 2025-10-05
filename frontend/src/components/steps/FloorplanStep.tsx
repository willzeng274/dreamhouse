"use client";

import { useState, useRef, useEffect } from "react";

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

	const [showFurnitureModal, setShowFurnitureModal] = useState(false);
	const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
	const [selectedFurnitureId, setSelectedFurnitureId] = useState<
		string | null
	>(null);
	const [draggingId, setDraggingId] = useState<string | null>(null);
	const [dragOffset, setDragOffset] = useState<[number, number]>([0, 0]);
	const [hasDragged, setHasDragged] = useState(false);
	const [dragStartPos, setDragStartPos] = useState<[number, number]>([0, 0]);

	// Pan and zoom state
	const [transform, setTransform] = useState<Transform>({
		offsetX: 0,
		offsetY: 0,
		scale: 1,
	});
	const [isPanning, setIsPanning] = useState(false);
	const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
	const [furnitureItems, setFurnitureItems] = useState<FurnitureItem[]>([
		{
			id: "1",
			type: "sofa",
			image: "https://placehold.co/80x40/E07B47/white?text=Sofa",
			position: [80, 150],
			dimensions: [80, 40],
		},
		{
			id: "2",
			type: "dining_table",
			image: "https://placehold.co/160x100/4A7CFF/white?text=Table",
			position: [120, 350],
			dimensions: [160, 100],
		},
		{
			id: "3",
			type: "bed",
			image: "https://placehold.co/120x80/6B6862/white?text=Bed",
			position: [540, 380],
			dimensions: [120, 80],
		},
	]);

	const rooms: Room[] = [
		{
			name: "Living Room",
			area: 48.4,
			x: 40,
			y: 80,
			width: 320,
			height: 240,
		},
		{ name: "Dining", area: 24.2, x: 40, y: 320, width: 320, height: 160 },
		{ name: "Hallway", area: 12.1, x: 360, y: 80, width: 200, height: 280 },
		{
			name: "Kitchen",
			area: 18.0,
			x: 360,
			y: 360,
			width: 160,
			height: 120,
		},
		{
			name: "Bedroom",
			area: 24.2,
			x: 520,
			y: 360,
			width: 160,
			height: 120,
		},
	];

	const handleAddFurniture = (furnitureName: string) => {
		if (selectedFurnitureId) {
			// Switch existing furniture
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
			setSelectedFurnitureId(null);
		} else {
			// Add new furniture
			const newItem: FurnitureItem = {
				id: Date.now().toString(),
				type: furnitureName.toLowerCase().replace(/\s+/g, "_"),
				image: `https://placehold.co/100x100/E07B47/white?text=${encodeURIComponent(
					furnitureName
				)}`,
				position: [300, 200],
				dimensions: [100, 100],
			};
			setFurnitureItems([...furnitureItems, newItem]);
		}
		setShowFurnitureModal(false);
	};

	const handleDeleteFurniture = () => {
		if (selectedFurnitureId) {
			setFurnitureItems(
				furnitureItems.filter((item) => item.id !== selectedFurnitureId)
			);
			setSelectedFurnitureId(null);
		}
	};

	// Convert screen coordinates to canvas coordinates
	const screenToCanvas = (screenX: number, screenY: number) => {
		const canvasX = (screenX - transform.offsetX) / transform.scale;
		const canvasY = (screenY - transform.offsetY) / transform.scale;
		return { x: canvasX, y: canvasY };
	};

	// Draw the floorplan on canvas
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

		// Draw background
		ctx.fillStyle = "#FFFFFF";
		ctx.fillRect(
			0,
			0,
			canvas.width / transform.scale,
			canvas.height / transform.scale
		);

		// Center the floorplan
		const offsetX = (canvas.width / transform.scale - 720) / 2;
		const offsetY = (canvas.height / transform.scale - 560) / 2;

		ctx.save();
		ctx.translate(offsetX, offsetY);

		// Draw dimension lines
		ctx.strokeStyle = "#4A7CFF";
		ctx.lineWidth = 1.5;
		ctx.fillStyle = "#4A7CFF";
		ctx.font = "12px sans-serif";
		ctx.textAlign = "center";

		// Top dimension
		ctx.beginPath();
		ctx.moveTo(40, 30);
		ctx.lineTo(360, 30);
		ctx.stroke();
		ctx.fillText("8.2m", 200, 25);

		// Draw rooms
		rooms.forEach((room) => {
			ctx.strokeStyle = "#1A1815";
			ctx.lineWidth = 3;
			ctx.strokeRect(room.x, room.y, room.width, room.height);

			ctx.fillStyle = "#1A1815";
			ctx.font = "16px sans-serif";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText(
				room.name.toUpperCase(),
				room.x + room.width / 2,
				room.y + room.height / 2 - 10
			);

			ctx.fillStyle = "#6B6862";
			ctx.font = "12px sans-serif";
			ctx.fillText(
				`${room.area} m²`,
				room.x + room.width / 2,
				room.y + room.height / 2 + 10
			);
		});

		// Draw furniture items
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
				? "#4A7CFF"
				: "#6B6862";
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

		// Draw scale indicator
		ctx.fillStyle = "#6B6862";
		ctx.font = "bold 12px sans-serif";
		ctx.textAlign = "end";
		ctx.textBaseline = "alphabetic";
		ctx.fillText("SCALE 1:50", 650, 530);

		ctx.fillStyle = "#9B9892";
		ctx.font = "10px sans-serif";
		ctx.fillText("Total Area: 126.9 m²", 650, 545);

		ctx.restore();
		ctx.restore();
	};

	// Update canvas on transform or furniture change
	useEffect(() => {
		drawCanvas();
	}, [transform, furnitureItems, selectedFurnitureId, draggingId]);

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

	// Check if click is on furniture
	const getFurnitureAtPosition = (
		canvasX: number,
		canvasY: number
	): string | null => {
		const canvas = canvasRef.current;
		if (!canvas) return null;

		const offsetX = (canvas.width / transform.scale - 720) / 2;
		const offsetY = (canvas.height / transform.scale - 560) / 2;

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

		const furnitureId = getFurnitureAtPosition(
			canvasCoords.x,
			canvasCoords.y
		);

		if (furnitureId) {
			if (furnitureId.startsWith("delete:")) {
				const id = furnitureId.replace("delete:", "");
				setFurnitureItems(
					furnitureItems.filter((item) => item.id !== id)
				);
				setSelectedFurnitureId(null);
				return;
			}

			// Start dragging furniture
			const item = furnitureItems.find((f) => f.id === furnitureId);
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

		if (draggingId) {
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

			const offsetX = (canvas.width / transform.scale - 720) / 2;
			const offsetY = (canvas.height / transform.scale - 560) / 2;

			setFurnitureItems(
				furnitureItems.map((item) =>
					item.id === draggingId
						? {
								...item,
								position: [
									canvasCoords.x - dragOffset[0] - offsetX,
									canvasCoords.y - dragOffset[1] - offsetY,
								],
						  }
						: item
				)
			);
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
		if (draggingId && !hasDragged) {
			// It was a click, not a drag - open furniture modal
			setSelectedFurnitureId(draggingId);
			setShowFurnitureModal(true);
		}

		setDraggingId(null);
		setIsPanning(false);
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

	const furnitureSidebar = showFurnitureModal && (
		<div className='fixed inset-y-0 right-0 w-96 bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right'>
			{/* Sidebar Header */}
			<div className='px-6 py-4 border-b border-[#E5E2DA] flex items-center justify-between'>
				<div>
					<h3 className='text-lg font-medium text-[#1A1815]'>
						{selectedFurnitureId
							? "Switch Furniture"
							: "Choose Furniture"}
					</h3>
					{selectedFurnitureId && (
						<p className='text-xs text-[#6B6862] mt-1'>
							Currently:{" "}
							{furnitureItems
								.find((f) => f.id === selectedFurnitureId)
								?.type.replace(/_/g, " ")
								.toUpperCase()}
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
							{ name: "Modern Sofa", icon: "🛋️" },
							{ name: "Armchair", icon: "🪑" },
							{ name: "Dining Chair", icon: "🪑" },
							{ name: "Office Chair", icon: "💺" },
						],
					},
					{
						name: "Tables",
						items: [
							{ name: "Dining Table", icon: "🍽️" },
							{ name: "Coffee Table", icon: "☕" },
							{ name: "Desk", icon: "🖥️" },
							{ name: "Console Table", icon: "🪞" },
						],
					},
					{
						name: "Beds",
						items: [
							{ name: "King Bed", icon: "🛏️" },
							{ name: "Queen Bed", icon: "🛏️" },
							{ name: "Single Bed", icon: "🛏️" },
						],
					},
					{
						name: "Storage",
						items: [
							{ name: "Wardrobe", icon: "🚪" },
							{ name: "Bookshelf", icon: "📚" },
							{ name: "Dresser", icon: "🗄️" },
							{ name: "TV Unit", icon: "📺" },
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
									onClick={onNext}
									className='px-6 py-2 rounded-lg text-sm font-medium bg-[#E07B47] text-white hover:bg-[#D06A36] transition-colors'
								>
									Generate 3D View →
								</button>
							</div>
						</div>

						{/* Floorplan Content */}
						<div className='flex-1 flex items-center justify-center bg-[#F5F3EF]'>
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
										cursor: draggingId
											? "grabbing"
											: isPanning
											? "grabbing"
											: "grab",
									}}
								/>
							</div>
						</div>
					</div>
				</div>

				{/* Add Furniture Button - Bottom Right */}
				<div className='absolute bottom-8 right-8 flex flex-col gap-3 z-10'>
					<button
						onClick={() => setShowFurnitureModal(true)}
						className='px-6 py-3 bg-[#E07B47] text-white rounded-full font-medium hover:bg-[#D06A36] transition-colors duration-200 shadow-lg'
					>
						+ Add Furniture
					</button>
					{selectedFurnitureId && (
						<button
							onClick={handleDeleteFurniture}
							className='px-6 py-3 bg-[#EF4444] text-white rounded-full font-medium hover:bg-[#DC2626] transition-colors duration-200 shadow-lg'
						>
							Delete Selected
						</button>
					)}
				</div>
			</div>

			{/* Furniture Sidebar */}
			{furnitureSidebar}
		</>
	);
}
