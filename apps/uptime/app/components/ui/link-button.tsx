import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import { Link as AriaLink } from "react-aria-components";

export function LinkButton({
	color = "primary",
	...props
}: ComponentProps<typeof AriaLink> & {
	color?: "neutral" | "primary" | "danger" | "warning";
}) {
	return (
		<AriaLink
			{...props}
			className={cn(
				"flex flex-shrink-0 items-center gap-2 rounded-md px-4 py-2",
				"focus:ring-2 focus:ring-offset-2 focus:outline-none",
				"text-white text-sm font-medium",
				props.className,
				{
					"bg-neutral-950 hover:bg-neutral-800 focus:ring-primary-500 text-neutral-50 dark:text-neutral-950 dark:bg-neutral-50 dark:hover:bg-neutral-200":
						color === "neutral",
					"bg-primary-600 hover:bg-primary-700 focus:ring-primary-500": color === "primary",
					"bg-danger-600 hover:bg-danger-700 focus:ring-danger-500": color === "danger",
					"bg-warning-600 hover:bg-warning-700 focus:ring-warning-500": color === "warning",
					"cursor-not-allowed opacity-50": props.isDisabled,
					"cursor-pointer": !props.isDisabled,
				},
			)}
		>
			{props.children}
		</AriaLink>
	);
}
