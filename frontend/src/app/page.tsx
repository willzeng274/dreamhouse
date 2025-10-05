"use client";

import { useState } from "react";
import StepIndicator from "@/components/StepIndicator";
import SketchStep from "@/components/steps/SketchStep";
import RenderStep from "@/components/steps/RenderStep";
import FloorplanStep from "@/components/steps/FloorplanStep";
import ViewStep from "@/components/steps/ViewStep";

export default function Home() {
	const [currentStep, setCurrentStep] = useState(1);
	const [sketchData, setSketchData] = useState<string | null>(null);

	const steps = [
		{ number: 1, title: "Sketch", component: SketchStep },
		{ number: 2, title: "Render", component: RenderStep },
		{ number: 3, title: "Floorplan", component: FloorplanStep },
		{ number: 4, title: "3D View", component: ViewStep },
	];

	const handleNext = () => {
		if (currentStep < 4) {
			setCurrentStep(currentStep + 1);
		}
	};

	const handlePrevious = () => {
		if (currentStep > 1) {
			setCurrentStep(currentStep - 1);
		}
	};

	const handleStepClick = (step: number) => {
		setCurrentStep(step);
	};

	const CurrentStepComponent = steps[currentStep - 1].component;

	return (
		<div className='h-screen bg-[#F5F3EF] flex flex-col overflow-hidden'>
			{/* Header */}
			<header className='bg-white border-b border-[#E5E2DA] px-8 py-4 flex items-center justify-center'>
				<StepIndicator
					steps={steps}
					currentStep={currentStep}
					onStepClick={handleStepClick}
				/>
			</header>

			{/* Main Content */}
			<div className='flex-1 overflow-hidden'>
				<CurrentStepComponent
					onNext={handleNext}
					onPrevious={handlePrevious}
					currentStep={currentStep}
					sketchData={sketchData}
					setSketchData={setSketchData}
				/>
			</div>
		</div>
	);
}
