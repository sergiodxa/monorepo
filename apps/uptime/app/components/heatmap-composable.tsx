import { cn } from "@pkg/cn";
import { useMemo } from "react";
import {
	Button as AriaButton,
	Collection as AriaCollection,
	OverlayArrow as AriaOverlayArrow,
	Tooltip as AriaTooltip,
	TooltipTrigger as AriaTooltipTrigger,
} from "react-aria-components";
import { useTranslation } from "react-i18next";

import { useHints } from "~/utils/client-hints";
import getCellColor from "~/utils/get-cell-color";
import getDayLabel from "~/utils/get-day-label";

export namespace Cell {
	export type Size = "sm" | "md" | "lg";
	export type Status = "pending" | "failed" | "loaded" | "empty";
}

export function Cell(props: { size: Cell.Size; successRate: number | null; status?: Cell.Status }) {
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
				{ "animate-pulse": props.status === "pending" },
				{ "cursor-not-allowed opacity-50": props.status === "failed" },
			)}
		/>
	);
}

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

export function DayLabels() {
	let { i18n } = useTranslation();
	let hints = useHints();

	let dayLabels = [
		getDayLabel(i18n.language, 1, hints?.timeZone),
		getDayLabel(i18n.language, 3, hints?.timeZone),
		getDayLabel(i18n.language, 5, hints?.timeZone),
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

export function Legend(props: { size: Cell.Size }) {
	let { t } = useTranslation("translation", {
		keyPrefix: "components.heatmap.legend",
	});

	return (
		<div
			className={cn(
				"ml-auto flex flex-row flex-wrap items-center justify-end gap-2 text-sm sm:gap-8",
				"text-neutral-900 dark:text-neutral-100",
			)}
		>
			{[
				{
					label: t("success"),
					rates: [70, 90, 100],
					range: ["70–89%", "90–99%", "100%"],
				},
				{
					label: t("mixed"),
					rates: [40],
					range: ["40–70%"],
				},
				{
					label: t("failure"),
					rates: [1, 20],
					range: ["0–19%", "20–39%"],
				},
				{
					label: t("noData"),
					rates: [null],
					range: [null],
				},
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
							title={range[index] ?? t("noData")}
						/>
					))}
					<span>{label}</span>
				</div>
			))}
		</div>
	);
}
