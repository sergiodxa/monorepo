---
title: How to Build a Composable Heatmap Component
excerpt: Create a flexible heatmap using the compound component pattern for data visualization.
technologies: react@19.0.0
---

Heatmaps are a common way to visualize data over time, like GitHub's contribution graph or uptime monitoring dashboards. The challenge is building one that's flexible enough to handle different data sources, cell sizes, and tooltip content while keeping the API clean.

The [compound component pattern](/articles/compound-component-pattern-in-react) solves this by splitting the heatmap into composable pieces: a table that handles the grid layout, cells that display individual data points, tooltips for additional context, and a legend that explains the color scale. Each piece works independently but combines into a cohesive visualization.

## Create the Cell Component

Start with the smallest building block: the cell. Each cell represents a single data point and changes color based on its value.

```tsx {% path="app/components/heatmap.tsx" %}
import { cn } from "@pkg/cn";
import { Button as AriaButton } from "react-aria-components";

export namespace Cell {
	export type Size = "sm" | "md" | "lg";
}

function getCellColor(successRate: number | null): string {
	if (!successRate) return "bg-neutral-300 dark:bg-neutral-700";
	if (successRate === 100) return "bg-green-600 dark:bg-green-500";
	if (successRate >= 90) return "bg-green-500 dark:bg-green-400";
	if (successRate >= 70) return "bg-green-400 dark:bg-green-300";
	if (successRate >= 40) return "bg-yellow-400 dark:bg-yellow-300";
	if (successRate >= 20) return "bg-red-400 dark:bg-red-300";
	if (successRate >= 0) return "bg-red-500 dark:bg-red-400";
	throw new Error("Invalid success rate");
}

export function Cell(props: { size: Cell.Size; successRate: number | null }) {
	return (
		<AriaButton
			className={cn(
				"rounded-sm",
				{
					"size-2.5": props.size === "sm",
					"size-3": props.size === "md",
					"size-4": props.size === "lg",
				},
				getCellColor(props.successRate),
			)}
		/>
	);
}
```

The cell uses [React Aria's](/articles/building-accessible-ui-with-react-aria-components) `Button` for accessibility, ensuring keyboard navigation and focus management work correctly. The `getCellColor` function maps success rates to Tailwind classes, creating a gradient from red (failure) through yellow (mixed) to green (success). A `null` value renders a neutral color for days without data. The namespace pattern here helps organize types alongside the component, as explained in [Simplify Component Imports with TypeScript Namespaces](/tutorials/simplify-component-imports-with-typescript-namespaces).

## Add Tooltips to Cells

Wrap cells with a tooltip component to show detailed information on hover or focus.

```tsx {% path="app/components/heatmap.tsx" %}
import {
	OverlayArrow as AriaOverlayArrow,
	Tooltip as AriaTooltip,
	TooltipTrigger as AriaTooltipTrigger,
} from "react-aria-components";

export function CellTooltip(props: { children: React.ReactNode; message: string }) {
	return (
		<AriaTooltipTrigger>
			{props.children}

			<AriaTooltip
				className={cn(
					"mb-2 rounded-lg p-2 text-sm font-medium whitespace-pre-line",
					"border border-neutral-300 shadow shadow-neutral-300",
					"bg-neutral-50 text-neutral-950",
					"dark:border-neutral-700 dark:shadow-neutral-700",
					"dark:bg-neutral-950 dark:text-neutral-50",
				)}
			>
				<AriaOverlayArrow className="text-white drop-shadow dark:text-neutral-900">
					<svg width={8} height={8} viewBox="0 0 8 8">
						<title>Arrow</title>
						<path d="M0 0 L4 4 L8 0" fill="currentColor" />
					</svg>
				</AriaOverlayArrow>

				{props.message}
			</AriaTooltip>
		</AriaTooltipTrigger>
	);
}
```

The `CellTooltip` component wraps any cell and displays a message on interaction. React Aria handles positioning, focus management, and keyboard accessibility automatically. The `whitespace-pre-line` class preserves line breaks in the message, useful for multi-line tooltips.

## Build the Table Component

The table component handles the grid layout, rendering weeks as columns and days as rows.

```tsx {% path="app/components/heatmap.tsx" %}
import { useMemo } from "react";
import { Collection as AriaCollection } from "react-aria-components";

export function Table(props: { dates: Date[][]; children(date: Date): React.ReactNode }) {
	let rows = useMemo(() => {
		return props.dates.map((dates, id) => {
			return { id, dates: dates.map((date, id) => ({ id, date })) };
		});
	}, [props.dates]);

	return (
		<div className="flex w-full flex-row gap-1">
			<AriaCollection items={rows}>
				{({ dates }) => {
					return (
						<div className="flex flex-col gap-1">
							<AriaCollection items={dates}>{({ date }) => props.children(date)}</AriaCollection>
						</div>
					);
				}}
			</AriaCollection>
		</div>
	);
}
```

The table expects a two-dimensional array of dates, where each inner array represents a week. The `children` prop is a render function that receives each date, letting consumers decide how to render each cell. React Aria's `Collection` component optimizes rendering for large datasets.

## Add Day Labels

Day labels help users orient themselves in the grid by showing which row corresponds to which day of the week.

```tsx {% path="app/components/heatmap.tsx" %}
const BASE_DATE = new Date(Date.UTC(2025, 0, 6));
const MILLISECONDS_PER_DAY = 86400000;

function getDayLabel(locale: string, dayOfWeek: number, timeZone = "UTC"): string {
	return new Intl.DateTimeFormat(locale, {
		weekday: "short",
		timeZone,
	}).format(new Date(BASE_DATE.getTime() + dayOfWeek * MILLISECONDS_PER_DAY));
}

export function DayLabels(props: { locale?: string; timeZone?: string }) {
	let locale = props.locale ?? "en-US";
	let timeZone = props.timeZone ?? "UTC";

	let dayLabels = [
		getDayLabel(locale, 1, timeZone),
		getDayLabel(locale, 3, timeZone),
		getDayLabel(locale, 5, timeZone),
	];

	return (
		<div className="flex flex-col justify-between gap-1">
			<span />
			{dayLabels.map((label) => {
				return (
					<span
						key={label}
						className="text-left font-mono text-xs font-semibold text-neutral-500 dark:text-neutral-300"
					>
						{label}
					</span>
				);
			})}
			<span />
		</div>
	);
}
```

The `getDayLabel` function uses `Intl.DateTimeFormat` to get localized day names. Only Monday, Wednesday, and Friday are shown to avoid clutter, matching GitHub's contribution graph style. The empty `<span>` elements at the top and bottom align the labels with the grid rows.

## Create the Legend Component

The legend explains what each color means, helping users interpret the visualization.

```tsx {% path="app/components/heatmap.tsx" %}
export function Legend(props: { size: Cell.Size }) {
	return (
		<div
			className={cn(
				"ml-auto flex flex-row flex-wrap items-center justify-end gap-2 text-sm sm:gap-8",
				"text-neutral-900 dark:text-neutral-100",
			)}
		>
			{[
				{ label: "Success", rates: [70, 90, 100], range: ["70–89%", "90–99%", "100%"] },
				{ label: "Mixed", rates: [40], range: ["40–70%"] },
				{ label: "Failure", rates: [1, 20], range: ["0–19%", "20–39%"] },
				{ label: "No data", rates: [null], range: [null] },
			].map(({ label, rates, range }) => (
				<div key={label} className="flex items-center gap-1">
					{rates.map((rate, index) => (
						<div
							key={rate}
							className={cn(
								"rounded-sm",
								{
									"size-2.5": props.size === "sm",
									"size-3": props.size === "md",
									"size-4": props.size === "lg",
								},
								getCellColor(rate),
							)}
							title={range[index] ?? "No data"}
						/>
					))}
					<span>{label}</span>
				</div>
			))}
		</div>
	);
}
```

The legend groups colors by category (success, mixed, failure, no data) and shows the percentage ranges. Each color swatch uses the same `getCellColor` function as the cells, ensuring consistency. The `title` attribute provides additional context on hover.

## Compose the Heatmap

Now combine all the pieces into a complete heatmap. The compound component pattern lets consumers customize each part while the library handles layout and accessibility.

```tsx {% path="app/routes/dashboard.tsx" %}
import { isSameDay } from "date-fns";
import * as Heatmap from "~/components/heatmap";

type DataPoint = {
	date: Date;
	successRate: number;
	total: number;
};

export default function Dashboard(props: { points: DataPoint[]; weeks: Date[][] }) {
	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-row gap-2 overflow-x-auto pb-2">
				<Heatmap.DayLabels locale="en-US" timeZone="America/New_York" />

				<Heatmap.Table dates={props.weeks}>
					{(date) => {
						let point = props.points.find((p) => isSameDay(p.date, date));

						if (!point) {
							return <Heatmap.Cell size="md" successRate={null} />;
						}

						let successRate = point.successRate * 100;

						return (
							<Heatmap.CellTooltip
								message={`${successRate.toFixed(1)}% success\n${point.total} checks`}
							>
								<Heatmap.Cell size="md" successRate={successRate} />
							</Heatmap.CellTooltip>
						);
					}}
				</Heatmap.Table>
			</div>

			<Heatmap.Legend size="md" />
		</div>
	);
}
```

The consumer controls how data maps to cells through the render function. This example finds matching data points by date, renders empty cells for missing data, and wraps cells with tooltips showing success rate and check count. The namespace import (`* as Heatmap`) keeps the API clean and discoverable.

## Final Thoughts

The compound component pattern works well for data visualizations because it separates concerns: the library handles layout, accessibility, and styling while consumers control data mapping and content. This approach scales to more complex visualizations by adding new composable pieces without changing existing ones.
