import { cn } from "cn";
import type { ComponentProps, CSSProperties } from "react";

// Adapted from https://transitions.dev/detail.html?t=matrix-dot-loader
const CLOCKWISE_PERIMETER = [0, 1, 2, 5, 8, 7, 6, 3];
const POSITIONS = [
	"top-left",
	"top",
	"top-right",
	"left",
	"center",
	"right",
	"bottom-left",
	"bottom",
	"bottom-right",
];

export function MatrixDotLoader({
	className,
	...props
}: ComponentProps<"span">) {
	return (
		<span className={cn("t-matrix", className)} aria-hidden="true" {...props}>
			{POSITIONS.map((position, index) => (
				<i
					key={position}
					className={index === 4 ? "t-matrix-center" : undefined}
					style={
						index === 4
							? undefined
							: ({
									"--t-matrix-step": CLOCKWISE_PERIMETER.indexOf(index),
								} as CSSProperties)
					}
				/>
			))}
		</span>
	);
}
