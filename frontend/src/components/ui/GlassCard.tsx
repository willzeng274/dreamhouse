"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { ReactNode } from "react";

interface GlassCardProps extends Omit<HTMLMotionProps<"div">, "children"> {
	children: ReactNode;
	className?: string;
	blur?: "sm" | "md" | "lg" | "xl";
	hover?: boolean;
}

export default function GlassCard({
	children,
	className = "",
	blur = "md",
	hover = true,
	...props
}: GlassCardProps) {
	const blurClasses = {
		sm: "backdrop-blur-sm",
		md: "backdrop-blur-md",
		lg: "backdrop-blur-lg",
		xl: "backdrop-blur-xl",
	};

	return (
		<motion.div
			className={`
				bg-white/70 
				${blurClasses[blur]}
				rounded-3xl 
				border border-white/20 
				shadow-xl shadow-black/5
				${className}
			`}
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.5 }}
			whileHover={
				hover
					? {
							scale: 1.01,
							boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.1)",
					  }
					: undefined
			}
			{...props}
		>
			{children}
		</motion.div>
	);
}

