"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useExportScene } from "@/hooks/useApi";

interface ViewStepProps {
	onNext: () => void;
	onPrevious: () => void;
	currentStep: number;
}

export default function ViewStep({ onPrevious }: ViewStepProps) {
	const floorplanObjects = useAppStore((state) => state.floorplanObjects);
	const unityScene = useAppStore((state) => state.unityScene);
	const exportScene = useExportScene();

	const [selectedRoom, setSelectedRoom] = useState<
		"living" | "dining" | "bedroom"
	>("living");

	// Export scene on mount
	useEffect(() => {
		if (floorplanObjects.length > 0 && !unityScene && !exportScene.isPending) {
			exportScene.mutate(floorplanObjects);
		}
	}, [floorplanObjects]);

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
					<div className='flex-1 flex items-center justify-center bg-gradient-to-br from-[#F5F3EF] to-[#E5E2DA]'>
						{exportScene.isPending ? (
							<div className='text-center space-y-4'>
								<div className='w-16 h-16 border-4 border-[#E5E2DA] border-t-[#E07B47] rounded-full animate-spin mx-auto'></div>
								<p className='text-[#6B6862] text-sm'>
									Exporting to Unity format...
								</p>
							</div>
						) : unityScene ? (
							<div className='text-center space-y-6 max-w-md px-6'>
								<div className='text-6xl mb-4'>
									{rooms.find((r) => r.id === selectedRoom)?.icon}
								</div>
								<h4 className='text-2xl font-medium text-[#1A1815]'>
									{rooms.find((r) => r.id === selectedRoom)?.name}
								</h4>
								<p className='text-[#6B6862]'>
									Scene exported to Unity format successfully!
									3D walkthrough visualization ready.
								</p>
								<div className='pt-4 space-y-2 text-sm text-[#6B6862]'>
									<div className='flex items-center justify-between px-4 py-2 bg-white/50 rounded-lg'>
										<span>Objects Exported:</span>
										<span className='font-medium text-[#1A1815]'>
											{unityScene.objects?.length || 0}
										</span>
									</div>
									<div className='flex items-center justify-between px-4 py-2 bg-white/50 rounded-lg'>
										<span>Scene Data:</span>
										<span className='font-medium text-[#1A1815]'>
											Ready
										</span>
									</div>
									<div className='flex items-center justify-between px-4 py-2 bg-white/50 rounded-lg'>
										<span>Status:</span>
										<span className='font-medium text-[#10B981]'>
											✓ Complete
										</span>
									</div>
								</div>
								<button
									onClick={() => {
										const dataStr = JSON.stringify(unityScene, null, 2);
										const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
										const exportFileDefaultName = 'unity_scene.json';

										const linkElement = document.createElement('a');
										linkElement.setAttribute('href', dataUri);
										linkElement.setAttribute('download', exportFileDefaultName);
										linkElement.click();
									}}
									className='mt-4 px-6 py-2 rounded-lg text-sm font-medium bg-[#E07B47] text-white hover:bg-[#D06A36] transition-colors'
								>
									Download Unity Scene
								</button>
							</div>
						) : (
							<div className='text-center space-y-4'>
								<p className='text-[#6B6862] text-sm'>
									No floorplan objects available. Please go back.
								</p>
								<button
									onClick={onPrevious}
									className='px-4 py-2 rounded-lg text-sm font-medium bg-[#E07B47] text-white hover:bg-[#D06A36] transition-colors'
								>
									← Back
								</button>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
