interface SidebarProps {
	content: React.ReactNode;
	actions?: React.ReactNode;
}

export default function Sidebar({ content, actions }: SidebarProps) {
	return (
		<div className='w-96 flex-shrink-0 bg-white border-l border-[#E5E2DA] flex flex-col'>
			{/* Sidebar content */}
			<div className='flex-1 overflow-y-auto p-8'>{content}</div>

			{/* Sidebar actions */}
			{actions && (
				<div className='border-t border-[#E5E2DA] p-6'>{actions}</div>
			)}
		</div>
	);
}
