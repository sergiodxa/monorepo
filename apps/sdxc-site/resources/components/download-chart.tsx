/**
 * Daily downloads drawn as an area with a trailing seven-day average over it, and a running
 * total beside it, with the dates and the peak labelled around the plot. Every day is a
 * marker, shown on hover, whose native tooltip names its date and count, without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { fg } from "@sdxc/u/color";
import { opacity } from "@sdxc/u/effects";
import { gap, grid, gridTemplate, hstack, vstack } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { media } from "@sdxc/u/responsive";
import { m } from "@sdxc/u/size";
import { focusVisible, hover } from "@sdxc/u/state";
import { tabularNums, text, weight } from "@sdxc/u/typography";
import { Chart } from "@sdxc/ui/app";

import { cumulative, rollingAverage } from "~/app/services/npm-stats";

/** How numbers read on the axes and in each day's tooltip. */
const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

/** How a day reads on the axis and in its tooltip; the series are counted in UTC days. */
const DAY_FORMAT = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	timeZone: "UTC",
});

/** The coordinate space each plot is drawn in; the SVG scales it to its column. */
const PLOT = { width: 640, height: 220 };

/**
 * Formats a `YYYY-MM-DD` day for a label.
 *
 * @param day The day as the snapshot stores it.
 */
export function formatDay(day: string): string {
	return DAY_FORMAT.format(new Date(`${day}T00:00:00Z`));
}

/**
 * The top of the y axis: the series' peak rounded up to a figure an axis label reads
 * cleanly, so the highest point sits below the frame rather than on it.
 *
 * @param peak The largest value plotted.
 */
export function axisTop(peak: number): number {
	if (peak <= 0) return 10;
	let magnitude = 10 ** Math.floor(Math.log10(peak));
	let steps = [1, 2, 2.5, 5, 10];
	let step = steps.find((candidate) => candidate * magnitude >= peak) ?? 10;
	return step * magnitude;
}

namespace DownloadChart {
	export interface Props {
		/** Names the series, as the charts' accessible label and their heading. */
		label: string;
		/** The days plotted, oldest first. */
		days: string[];
		/** Downloads per day, one per entry of `days`. */
		daily: number[];
	}
}

/** Renders the daily plot and the running-total plot side by side, stacked on a phone. */
export default function DownloadChart(handle: Handle<DownloadChart.Props>) {
	return () => {
		let { days, daily, label } = handle.props;
		let average = rollingAverage(daily, 7);
		let running = cumulative(daily);

		return (
			<div
				mix={[grid(), gap(8), media("(min-width: 64rem)", gridTemplate({ columns: "1fr 1fr" }))]}
			>
				<Plot
					title="Downloads per day, line is the 7-day average"
					label={`${label}: downloads per day`}
					days={days}
					top={axisTop(Math.max(0, ...daily))}
				>
					<Chart.Area
						color={1}
						markerCount={days.length}
						parts={{ marker: [opacity(0), hover(opacity(100)), focusVisible(opacity(100))] }}
						points={daily.map((value, index) => ({
							x: index,
							y: value,
							label: `${formatDay(days[index] ?? "")}: ${NUMBER_FORMAT.format(value)} downloads`,
						}))}
					/>
					<Chart.Line
						color={2}
						markerCount={0}
						points={average.map((value, index) => ({
							x: index,
							y: value,
							label: `${formatDay(days[index] ?? "")}: ${NUMBER_FORMAT.format(Math.round(value))} a day over the week`,
						}))}
					/>
				</Plot>

				<Plot
					title="Running total"
					label={`${label}: running total of downloads`}
					days={days}
					top={axisTop(running.at(-1) ?? 0)}
				>
					<Chart.Area
						color={3}
						markerCount={days.length}
						parts={{ marker: [opacity(0), hover(opacity(100)), focusVisible(opacity(100))] }}
						points={running.map((value, index) => ({
							x: index,
							y: value,
							label: `${formatDay(days[index] ?? "")}: ${NUMBER_FORMAT.format(value)} in total`,
						}))}
					/>
				</Plot>
			</div>
		);
	};
}

export namespace Plot {
	export interface Props {
		title: string;
		label: string;
		/** The day under each x position, of which the first, middle and last are labelled. */
		days: string[];
		/** The value the top of the y axis stands for. */
		top: number;
		/**
		 * How the top of the axis reads.
		 *
		 * @default A plain count
		 */
		format?: (value: number) => string;
		children: RemixNode;
	}
}

/**
 * One framed plot: its title and peak above, the series in a shared coordinate space, and
 * the first, middle and last day below.
 */
export function Plot(handle: Handle<Plot.Props>) {
	return () => {
		let {
			children,
			days,
			format = (value: number) => NUMBER_FORMAT.format(value),
			label,
			title,
			top,
		} = handle.props;
		let middle = days[Math.floor(days.length / 2)];

		return (
			<figure mix={[vstack({ gap: 2, align: "stretch" }), m(0)]}>
				<figcaption mix={hstack({ gap: 2, align: "center", justify: "between" })}>
					<span mix={[text("sm"), weight("semibold"), fg("neutral.emphasis")]}>{title}</span>
					<span mix={[text("xs"), fg("neutral.muted"), tabularNums()]}>{format(top)}</span>
				</figcaption>

				<Chart
					width={PLOT.width}
					height={PLOT.height}
					xDomain={[0, Math.max(1, days.length - 1)]}
					yDomain={[0, top]}
					aria-label={label}
					mix={overflow("visible")}
				>
					{children}
				</Chart>

				<div
					mix={[
						hstack({ gap: 2, align: "center", justify: "between" }),
						text("xs"),
						fg("neutral.muted"),
					]}
				>
					<span>{days[0] ? formatDay(days[0]) : ""}</span>
					<span>{middle ? formatDay(middle) : ""}</span>
					<span>{days.at(-1) ? formatDay(days.at(-1) ?? "") : ""}</span>
				</div>
			</figure>
		);
	};
}
