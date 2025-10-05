"use client";

interface FurnitureModalProps {
	onClose: () => void;
	onSelectFurniture: (furnitureName: string) => void;
	mode?: "add" | "switch";
	currentFurnitureType?: string;
}

const furnitureCategories = [
	{
		name: "Seating",
		items: [
			{
				name: "Modern Sofa",
				description: "Contemporary 3-seater",
				icon: "🛋️",
			},
			{
				name: "Armchair",
				description: "Comfortable accent chair",
				icon: "🪑",
			},
			{ name: "Dining Chair", description: "Set of 4", icon: "🪑" },
			{
				name: "Office Chair",
				description: "Ergonomic design",
				icon: "💺",
			},
		],
	},
	{
		name: "Tables",
		items: [
			{
				name: "Dining Table",
				description: "6-8 person capacity",
				icon: "🍽️",
			},
			{ name: "Coffee Table", description: "Glass top", icon: "☕" },
			{ name: "Desk", description: "Work surface", icon: "🖥️" },
			{
				name: "Console Table",
				description: "Narrow entryway",
				icon: "🪞",
			},
		],
	},
	{
		name: "Beds",
		items: [
			{
				name: "King Bed",
				description: "Upholstered headboard",
				icon: "🛏️",
			},
			{ name: "Queen Bed", description: "Platform style", icon: "🛏️" },
			{ name: "Single Bed", description: "Compact design", icon: "🛏️" },
		],
	},
	{
		name: "Storage",
		items: [
			{ name: "Wardrobe", description: "Double door", icon: "🚪" },
			{ name: "Bookshelf", description: "5 shelves", icon: "📚" },
			{ name: "Dresser", description: "6 drawers", icon: "🗄️" },
			{ name: "TV Unit", description: "Media console", icon: "📺" },
		],
	},
];

export default function FurnitureModal({
	onClose,
	onSelectFurniture,
	mode = "add",
	currentFurnitureType,
}: FurnitureModalProps) {
	return (
		<div className='fixed inset-0 bg-[#1A1815]/50 backdrop-blur-sm flex items-center justify-center z-50 p-8'>
			<div className='bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col'>
				{/* Modal Header */}
				<div className='px-8 py-6 border-b border-[#E5E2DA] flex items-center justify-between'>
					<div>
						<h2 className='text-2xl font-medium text-[#1A1815]'>
							{mode === "switch"
								? "Switch Furniture"
								: "Choose Furniture"}
						</h2>
						<p className='text-sm text-[#6B6862] mt-1'>
							{mode === "switch"
								? `Currently: ${
										currentFurnitureType || "Unknown"
								  } - Select a replacement`
								: "Select items to place in your floorplan"}
						</p>
					</div>
					<button
						onClick={onClose}
						className='w-10 h-10 rounded-full bg-[#F5F3EF] hover:bg-[#E5E2DA] transition-colors flex items-center justify-center text-[#1A1815] text-xl'
					>
						×
					</button>
				</div>

				{/* Modal Content */}
				<div className='flex-1 overflow-y-auto p-8'>
					<div className='space-y-8'>
						{furnitureCategories.map((category) => (
							<div key={category.name}>
								<h3 className='text-lg font-medium text-[#1A1815] mb-4'>
									{category.name}
								</h3>
								<div className='grid grid-cols-2 gap-4'>
									{category.items.map((item) => (
										<button
											key={item.name}
											onClick={() =>
												onSelectFurniture(item.name)
											}
											className='bg-[#F5F3EF] hover:bg-[#E5E2DA] rounded-xl p-6 transition-all duration-200 hover:shadow-md text-left group'
										>
											<div className='flex items-start gap-4'>
												<div className='text-4xl'>
													{item.icon}
												</div>
												<div className='flex-1'>
													<h4 className='text-[#1A1815] font-medium mb-1 group-hover:text-[#E07B47] transition-colors'>
														{item.name}
													</h4>
													<p className='text-sm text-[#6B6862]'>
														{item.description}
													</p>
												</div>
												<div className='text-[#E07B47] opacity-0 group-hover:opacity-100 transition-opacity'>
													+
												</div>
											</div>
										</button>
									))}
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Modal Footer */}
				<div className='px-8 py-6 border-t border-[#E5E2DA] flex items-center justify-between'>
					<p className='text-sm text-[#6B6862]'>
						{mode === "switch"
							? "Click any item to replace the selected furniture"
							: "Click any item to add it to your floorplan"}
					</p>
					<button
						onClick={onClose}
						className='px-6 py-3 rounded-full bg-[#F5F3EF] text-[#1A1815] font-medium hover:bg-[#E5E2DA] transition-colors'
					>
						Close
					</button>
				</div>
			</div>
		</div>
	);
}
