import { cn } from "@pkg/cn";

export function StatCard(props: {
	label: React.ReactNode;
	value: React.ReactNode;
	description: React.ReactNode;
}) {
	return (
		<div
			className={cn(
				"flex flex-col gap-1.5 rounded-xl leading-none p-4 relative",
				"border border-neutral-300 dark:border-neutral-700",
				"bg-neutral-100 text-neutral-950",
				"dark:bg-neutral-900 dark:text-neutral-50",
				"shadow-sm shadow-neutral-300 dark:shadow-neutral-700",
			)}
		>
			<div className="text-sm text-neutral-700 dark:text-neutral-300 line-clamp-1">
				{props.label}
			</div>
			<div className="text-3xl/none font-semibold">{props.value}</div>
			<div className="text-sm text-neutral-700 dark:text-neutral-300">{props.description}</div>
		</div>
	);
}
