import type { ReactNode } from "react";

import { cn } from "@pkg/cn";
import { TriangleAlertIcon } from "lucide-react";

export function Alert(props: {
	title: string;
	description?: string;
	intent?: "warning";
	cta?: ReactNode;
}) {
	return (
		<div
			role="alert"
			className={cn("flex items-start gap-4 rounded-md border p-4 shadow", {
				"bg-warning-50 text-warning-950 border-warning-200": props.intent === "warning",
				"dark:bg-warning-950 dark:text-warning-50 dark:border-warning-900":
					props.intent === "warning",
				"shadow shadow-warning-200 dark:shadow-warning-900": props.intent === "warning",
			})}
		>
			{props.intent === "warning" && (
				<TriangleAlertIcon className="size-5 flex-shrink-0" aria-hidden />
			)}
			<div className="flex flex-grow flex-col gap-1">
				<h3 className="leading-tight font-semibold">{props.title}</h3>
				{props.description && <p className="text-sm">{props.description}</p>}
			</div>
			{props.cta && <div className="self-center">{props.cta}</div>}
		</div>
	);
}
