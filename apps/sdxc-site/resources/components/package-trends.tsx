/**
 * The focus view's trends beyond npm downloads: jsDelivr hits per day once there are any, the installed size
 * of each release, and how much of each week's installs had moved to the latest release.
 * A plot with nothing to draw yet says so, since a fresh snapshot fills each one over time.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { opacity } from "@sdxc/u/effects";
import { gap, grid, gridTemplate, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { m } from "@sdxc/u/size";
import { focusVisible, hover } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";
import { Chart } from "@sdxc/ui";

import type { PackageSummary } from "~/app/services/npm-stats";

import { formatFileSize } from "~/app/services/file-size";
import { sizeGrowth } from "~/app/services/npm-stats";
import { axisTop, formatDay, Plot } from "~/resources/components/download-chart";

/** How counts read in the tooltips. */
const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

/** How a share of installs reads. */
const SHARE_FORMAT = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 });

/** How a size change reads: signed, so growth and shrinkage look different. */
const GROWTH_FORMAT = new Intl.NumberFormat("en-US", {
	style: "percent",
	maximumFractionDigits: 1,
	signDisplay: "exceptZero",
});

namespace PackageTrends {
	export interface Props {
		summary: PackageSummary;
		/** The days the range covers, oldest first. */
		days: string[];
		/** jsDelivr hits per day, one per entry of `days`. */
		jsdelivr: number[];
	}
}

/** Renders the three plots in a grid, one column on a phone. */
export default function PackageTrends(handle: Handle<PackageTrends.Props>) {
	return () => {
		let { days, jsdelivr, summary } = handle.props;
		let { stats } = summary;
		let sizes = stats.sizes ?? [];
		let upgrades = stats.upgrades ?? [];
		let change = sizeGrowth(sizes);
		let first = sizes[0];
		let last = sizes.at(-1);

		return (
			<section
				aria-label="Trends"
				mix={[
					grid(),
					gap(8),
					media("(min-width: 64rem)", gridTemplate({ columns: "1fr 1fr 1fr" })),
				]}
			>
				{jsdelivr.some((value) => value > 0) ? (
					<Plot
						title={`jsDelivr hits, ${NUMBER_FORMAT.format(summary.jsdelivr30)} in 30 days`}
						label={`${stats.name}: jsDelivr hits per day`}
						days={days}
						top={axisTop(Math.max(0, ...jsdelivr))}
					>
						<Chart.Area
							color={4}
							markerCount={days.length}
							parts={{ marker: [opacity(0), hover(opacity(100)), focusVisible(opacity(100))] }}
							points={jsdelivr.map((value, index) => ({
								x: index,
								y: value,
								label: `${formatDay(days[index] ?? "")}: ${NUMBER_FORMAT.format(value)} hits`,
							}))}
						/>
					</Plot>
				) : null}

				{sizes.length > 0 && first && last ? (
					<Plot
						title={
							change === null
								? "Size per release"
								: `Size per release, ${GROWTH_FORMAT.format(change)} since ${first.version}`
						}
						label={`${stats.name}: unpacked size per release, ${formatFileSize(first.unpackedSize)} to ${formatFileSize(last.unpackedSize)}`}
						days={sizes.map((point) => point.publishedAt)}
						top={axisTop(Math.max(...sizes.map((point) => point.unpackedSize)))}
						format={formatFileSize}
					>
						<Chart.Line
							color={5}
							markerCount={sizes.length}
							points={sizes.map((point, index) => ({
								x: index,
								y: point.unpackedSize,
								label: `${point.version}, ${formatDay(point.publishedAt)}: ${formatFileSize(point.unpackedSize)}`,
							}))}
						/>
					</Plot>
				) : (
					<Pending title="Size per release" />
				)}

				{upgrades.length > 0 ? (
					<Plot
						title="Share of last week's installs on the latest release"
						label={`${stats.name}: share of each week's installs on the version latest that day`}
						days={upgrades.map((point) => point.day)}
						top={1}
						format={(value) => SHARE_FORMAT.format(value)}
					>
						<Chart.Line
							color={6}
							markerCount={upgrades.length}
							parts={{
								marker:
									upgrades.length > 1
										? [opacity(0), hover(opacity(100)), focusVisible(opacity(100))]
										: [],
							}}
							points={upgrades.map((point, index) => ({
								x: index,
								y: point.share,
								label: `${formatDay(point.day)}: ${SHARE_FORMAT.format(point.share)} on ${point.latest}`,
							}))}
						/>
					</Plot>
				) : (
					<Pending title="Share on the latest release" />
				)}
			</section>
		);
	};
}

namespace Pending {
	export interface Props {
		title: string;
	}
}

/** Renders a plot's place while the snapshot holds nothing for it, until the next refresh. */
function Pending(handle: Handle<Pending.Props>) {
	return () => (
		<figure mix={[vstack({ gap: 2, align: "stretch" }), m(0)]}>
			<figcaption mix={[text("sm"), weight("semibold"), fg("neutral.emphasis")]}>
				{handle.props.title}
			</figcaption>
			<p mix={[text("sm"), fg("neutral.muted")]}>Recorded from the next refresh on.</p>
		</figure>
	);
}
