import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import { Button as AriaButton } from "react-aria-components";

export function Button({
	color = "primary",
	...props
}: ComponentProps<typeof AriaButton> & {
	color?: "neutral" | "primary" | "danger" | "warning";
}) {
	return (
		<AriaButton
			{...props}
			className={cn(
				"flex items-center flex-shrink-0 gap-2 py-2 px-4 rounded-md",
				"focus:outline-none focus:ring-2 focus:ring-offset-2",
				"text-sm font-medium text-white",
				props.className,
				{
					"bg-neutral-950 hover:bg-neutral-800 focus:ring-primary-500 text-neutral-50 dark:text-neutral-950 dark:bg-neutral-50 dark:hover:bg-neutral-200":
						color === "neutral",
					"bg-primary-600 hover:bg-primary-700 focus:ring-primary-500": color === "primary",
					"bg-danger-600 hover:bg-danger-700 focus:ring-danger-500": color === "danger",
					"bg-warning-600 hover:bg-warning-700 focus:ring-warning-500": color === "warning",
					"cursor-not-allowed opacity-50": props.isDisabled,
					"cursor-progress": props.isPending,
				},
			)}
		>
			{props.children}
		</AriaButton>
	);
}
