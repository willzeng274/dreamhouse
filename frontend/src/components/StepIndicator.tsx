interface Step {
	number: number;
	title: string;
}

interface StepIndicatorProps {
	steps: Step[];
	currentStep: number;
	onStepClick: (step: number) => void;
}

export default function StepIndicator({
	steps,
	currentStep,
	onStepClick,
}: StepIndicatorProps) {
	return (
		<div className='flex items-center gap-2'>
			{steps.map((step, index) => (
				<div key={step.number} className='flex items-start'>
					<div className='flex items-center gap-2 flex-col'>
						<button
							onClick={() => onStepClick(step.number)}
							className={`flex items-center gap-3 size-8 justify-center rounded-full transition-all duration-300 ${
								currentStep === step.number
									? "bg-[#1A1815] text-white"
									: currentStep > step.number
									? "bg-[#E07B47] text-white hover:bg-[#D06A36]"
									: "bg-[#E5E2DA] text-[#6B6862] hover:bg-[#D5D2CA]"
							}`}
						>
							<span className='text-sm font-medium'>
								{step.number}
							</span>
						</button>
						<span className='text-sm font-medium'>
							{step.title}
						</span>
					</div>
					{index < steps.length - 1 && (
						<div
							className={`w-12 h-1 mx-1 transition-colors duration-300 mt-4 ${
								currentStep > step.number
									? "bg-[#E07B47]"
									: "bg-[#E5E2DA]"
							}`}
						/>
					)}
				</div>
			))}
		</div>
	);
}
