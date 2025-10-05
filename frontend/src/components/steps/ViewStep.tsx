"use client";

import { useState } from "react";

interface ViewStepProps {
	onNext: () => void;
	onPrevious: () => void;
	currentStep: number;
}

export default function ViewStep({ onPrevious }: ViewStepProps) {
	const [selectedRoom, setSelectedRoom] = useState<
		"living" | "dining" | "bedroom"
	>("living");

	const rooms = [
		{ id: "living" as const, name: "Living Room", icon: "🛋️" },
		{ id: "dining" as const, name: "Dining", icon: "🍽️" },
		{ id: "bedroom" as const, name: "Bedroom", icon: "🛏️" },
	];

	return (
		<div className='h-full flex overflow-hidden'>
			{/* Main Panel - 3D View */}
			<div className='flex-1 p-4 flex flex-col min-w-0'>
				<div className='bg-white rounded-2xl shadow-lg flex-1 flex flex-col overflow-hidden'>
					{/* Header */}
					<div className='px-6 py-4 border-b border-[#E5E2DA] flex items-center justify-between'>
						<h3 className='text-lg font-medium text-[#1A1815]'>
							3D Walkthrough
						</h3>
						<div className='flex items-center gap-3'>
							{rooms.map((room) => (
								<button
									key={room.id}
									onClick={() => setSelectedRoom(room.id)}
									className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
										selectedRoom === room.id
											? "bg-[#1A1815] text-white"
											: "bg-[#F5F3EF] text-[#6B6862] hover:bg-[#E5E2DA]"
									}`}
								>
									{room.icon} {room.name}
								</button>
							))}
							<div className='w-px h-6 bg-[#E5E2DA]'></div>
							<button
								onClick={onPrevious}
								className='px-4 py-2 rounded-lg text-sm font-medium bg-[#F5F3EF] text-[#6B6862] hover:bg-[#E5E2DA] transition-colors'
							>
								← Back
							</button>
						</div>
					</div>

					{/* 3D View Content */}
					<div className='flex-1 relative overflow-hidden bg-gradient-to-b from-[#F5E6D3] to-[#E5D5C3]'>
						{/* Simulated 3D room view */}
						<div className='absolute inset-0 flex items-center justify-center'>
							{/* Floor */}
							<div
								className='absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-[#A67B5B] to-[#C4A584]'
								style={{
									transform: `perspective(800px) rotateX(45deg)`,
									transformOrigin: "bottom",
								}}
							></div>

							{/* Back wall */}
							<div className='absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-[#F5E6D3] to-[#E5D5C3]'>
								{/* Windows */}
								<div className='absolute top-1/4 left-1/4 w-32 h-40 bg-gradient-to-b from-[#87CEEB] to-[#B0E0E6] border-8 border-white shadow-lg'></div>
								<div className='absolute top-1/4 right-1/4 w-32 h-40 bg-gradient-to-b from-[#87CEEB] to-[#B0E0E6] border-8 border-white shadow-lg'></div>
							</div>

							{/* Furniture in perspective */}
							{selectedRoom === "living" && (
								<>
									{/* Sofa */}
									<div
										className='absolute bottom-1/3 left-1/4 w-48 h-32 bg-gradient-to-br from-[#5A6B7C] to-[#3E4F5E] rounded-lg shadow-2xl'
										style={{
											transform:
												"perspective(600px) rotateX(15deg)",
										}}
									>
										<div className='absolute top-2 left-4 right-4 h-8 bg-[#4A5A6B] rounded'></div>
									</div>

									{/* Coffee table */}
									<div
										className='absolute bottom-1/4 left-1/2 -translate-x-1/2 w-32 h-20 bg-gradient-to-br from-[#8B6F47] to-[#6B4E32] rounded-full shadow-2xl'
										style={{
											transform:
												"perspective(600px) rotateX(25deg)",
										}}
									>
										<div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-[#A67B5B] rounded-full opacity-60'></div>
									</div>

									{/* Floor lamp */}
									<div className='absolute bottom-1/3 right-1/4 w-3 h-48 bg-gradient-to-b from-[#2D2A25] to-[#4A4540]'>
										<div className='absolute -top-16 left-1/2 -translate-x-1/2 w-24 h-32 bg-gradient-to-b from-[#F5E6D3] to-[#E5D5C3] rounded-full opacity-80 blur-sm'></div>
									</div>
								</>
							)}

							{selectedRoom === "dining" && (
								<>
									{/* Dining table */}
									<div
										className='absolute bottom-1/3 left-1/2 -translate-x-1/2 w-56 h-40 bg-gradient-to-br from-[#8B6F47] to-[#6B4E32] rounded-lg shadow-2xl'
										style={{
											transform:
												"perspective(600px) rotateX(20deg)",
										}}
									></div>

									{/* Chairs */}
									<div className='absolute bottom-1/3 left-1/3 w-16 h-20 bg-gradient-to-b from-[#6B4E32] to-[#4A3422] rounded-lg shadow-lg'></div>
									<div className='absolute bottom-1/3 right-1/3 w-16 h-20 bg-gradient-to-b from-[#6B4E32] to-[#4A3422] rounded-lg shadow-lg'></div>
								</>
							)}

							{selectedRoom === "bedroom" && (
								<>
									{/* Bed */}
									<div
										className='absolute bottom-1/3 left-1/2 -translate-x-1/2 w-64 h-48 bg-gradient-to-br from-[#8B7BA8] to-[#6B5B88] rounded-lg shadow-2xl'
										style={{
											transform:
												"perspective(600px) rotateX(15deg)",
										}}
									>
										<div className='absolute top-4 left-4 right-4 h-12 bg-[#9B8BB8] rounded'></div>
									</div>
								</>
							)}

							{/* Sun/light source */}
							<div className='absolute top-16 left-1/3 w-24 h-24 bg-gradient-radial from-[#FFE4B5] to-transparent rounded-full opacity-60 blur-lg'></div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
