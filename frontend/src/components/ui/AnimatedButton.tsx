"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { ReactNode } from "react";

interface AnimatedButtonProps
	extends Omit<HTMLMotionProps<"button">, "children"> {
	children: ReactNode;
	variant?: "primary" | "secondary" | "ghost";
	size?: "sm" | "md" | "lg";
	glow?: boolean;
}

export default function AnimatedButton({
	children,
	variant = "primary",
	size = "md",
	glow = false,
	className = "",
	...props
}: AnimatedButtonProps) {
	const baseClasses = "font-medium rounded-xl transition-all duration-200 relative overflow-hidden";

	const variantClasses = {
		primary:
			"bg-gradient-to-r from-purple-500 via-orange-500 to-pink-500 text-white shadow-lg shadow-purple-500/30",
		secondary:
			"bg-white/90 backdrop-blur-md text-gray-700 border border-white/40 shadow-md",
		ghost: "bg-transparent text-gray-700 hover:bg-white/50",
	};

	const sizeClasses = {
		sm: "px-4 py-2 text-sm",
		md: "px-6 py-2.5 text-base",
		lg: "px-8 py-3 text-lg",
	};

	return (
		<motion.button
			className={`
				${baseClasses}
				${variantClasses[variant]}
				${sizeClasses[size]}
				${className}
				${props.disabled ? "opacity-50 cursor-not-allowed" : ""}
			`}
			whileHover={
				!props.disabled
					? {
							scale: 1.05,
							boxShadow:
								variant === "primary"
									? "0 20px 40px -12px rgba(147, 51, 234, 0.4)"
									: "0 10px 30px -10px rgba(0, 0, 0, 0.2)",
					  }
					: undefined
			}
			whileTap={!props.disabled ? { scale: 0.95 } : undefined}
			{...props}
		>
			{/* Animated background gradient */}
			{variant === "primary" && (
				<motion.div
					className="absolute inset-0 bg-gradient-to-r from-pink-500 via-purple-500 to-orange-500"
					initial={{ x: "-100%" }}
					whileHover={{ x: "100%" }}
					transition={{ duration: 0.6 }}
				/>
			)}

			{/* Glow effect */}
			{glow && variant === "primary" && (
				<motion.div
					className="absolute inset-0 rounded-xl"
					animate={{
						boxShadow: [
							"0 0 20px rgba(147, 51, 234, 0.5)",
							"0 0 40px rgba(236, 72, 153, 0.5)",
							"0 0 20px rgba(147, 51, 234, 0.5)",
						],
					}}
					transition={{ duration: 2, repeat: Infinity }}
				/>
			)}

			<span className="relative z-10">{children}</span>
		</motion.button>
	);
}

