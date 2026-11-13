/**
 * Relay's reports: how much support the team handled over the last two weeks and how fast,
 * each figure with its change from the two weeks before, and a chart of daily volume drawn
 * against the same days one period earlier.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { HeadingScope, LinkButton } from "@sdxc/ui";
import { Chart } from "@sdxc/ui/app/chart";
import { Empty } from "@sdxc/ui/app/empty";
import { PageHeader } from "@sdxc/ui/app/page-header";
import { Skeleton } from "@sdxc/ui/app/skeleton";
import { StatCard } from "@sdxc/ui/app/stat-card";
import { Table } from "@sdxc/ui/app/table";

import DemoAppFrame from "~/resources/views/demo-apps/frame";
import {
	DAILY_CONVERSATIONS,
	PREVIOUS_DAILY_CONVERSATIONS,
} from "~/resources/views/demo-apps/relay/data";
import { conversationsIn, findView, href } from "~/resources/views/demo-apps/relay/views";

/** The day each point of the chart stands for, oldest first, ending today. */
const DAYS = [
	"Oct 19",
	"Oct 20",
	"Oct 21",
	"Oct 22",
	"Oct 23",
	"Oct 24",
	"Oct 25",
	"Oct 26",
	"Oct 27",
	"Oct 28",
	"Oct 29",
	"Oct 30",
	"Oct 31",
	"Nov 1",
] as const;

/** Each saved view's share of the period, with its median first response in minutes. */
const BY_VIEW = [
	{ slug: "billing", conversations: 142, firstResponse: 22 },
	{ slug: "bugs", conversations: 118, firstResponse: 54 },
	{ slug: "enterprise", conversations: 96, firstResponse: 14 },
] as const;

namespace ReportsScreen {
	export interface Props {
		/** Shows the chart's failure in its own region, as the demo's error link asks. */
		failed: boolean;
	}
}

/**
 * Turns a run of daily counts into the chart's points, each labelled for a screen reader.
 *
 * @param values One count per day, oldest first.
 * @param period Which period the line draws, read before each value.
 * @returns The line's points.
 */
function points(values: readonly number[], period: string) {
	return values.map((y, x) => ({ x, y, label: `${period}, ${DAYS[x]}: ${y} conversations` }));
}

/** The chart's drawing box; the page scales it to the column, keeping this ratio. */
const CHART_SIZE = { width: 960, height: 240 } as const;

/** What the chart's caption says, which its placeholder draws as bars too. */
const CHART_CAPTION = [
	"Weekdays run busier.",
	" Solid: the last 14 days. Dashed: the 14 days before.",
] as const;

/** The daily volume chart with the previous period dashed behind it. */
function VolumeChart() {
	return () => (
		<figure mix={[vstack({ gap: 2, align: "stretch" }), m(0)]}>
			<Chart
				width={CHART_SIZE.width}
				height={CHART_SIZE.height}
				xDomain={[0, DAYS.length - 1]}
				yDomain={[0, 50]}
				aria-label="New conversations per day, the last 14 days against the 14 before"
				mix={[raw({ inlineSize: "100%", blockSize: "auto" })]}
			>
				<Chart.Line points={points(PREVIOUS_DAILY_CONVERSATIONS, "Previous period")} comparison />
				<Chart.Line points={points(DAILY_CONVERSATIONS, "This period")} />
			</Chart>
			<div
				aria-hidden="true"
				mix={[hstack({ gap: 0, justify: "between" }), text("xs"), fg("neutral.muted")]}
			>
				<span>{DAYS[0]}</span>
				<span>{DAYS[7]}</span>
				<span>{DAYS.at(-1)}</span>
			</div>
			<figcaption mix={[text("sm"), fg("neutral.muted")]}>
				<span mix={[weight("medium"), fg("neutral.emphasis")]}>{CHART_CAPTION[0]}</span>
				{CHART_CAPTION[1]}
			</figcaption>
		</figure>
	);
}

/** The chart's region when its data failed to load: what happened, and Retry. */
function ChartError() {
	return () => (
		<HeadingScope level={2}>
			<Empty kind="error">
				<Empty.Title>Couldn’t load the volume chart</Empty.Title>
				<Empty.Description>
					The report service didn’t answer. The figures above are from 4 minutes ago.
				</Empty.Description>
				<Empty.Action>
					<LinkButton href={href("reports")} variant="outline" color="neutral">
						Retry
					</LinkButton>
				</Empty.Action>
				<Empty.RequestId label="Request ID">rep_7Kq2xV9mTb</Empty.RequestId>
			</Empty>
		</HeadingScope>
	);
}

/** One headline figure: what it counts, its value, and its change against the period before. */
interface Figure {
	label: string;
	value: string;
	change: string;
	trend: "up" | "down" | "flat";
	/** Tones a fall as good, for a time to respond. */
	invert?: boolean;
	comparison: string;
	/** Where the card leads, for a figure with a list behind it. */
	href?: string;
}

/** The period's four headline figures, against the two weeks before. */
function figures(): Figure[] {
	let total = DAILY_CONVERSATIONS.reduce((sum, value) => sum + value, 0);
	let previous = PREVIOUS_DAILY_CONVERSATIONS.reduce((sum, value) => sum + value, 0);
	let change = Math.round(((total - previous) / previous) * 100);
	let inbox = findView("inbox");
	let open = inbox ? conversationsIn(inbox).length : 0;
	return [
		{
			label: "New conversations",
			value: String(total),
			change: `${change >= 0 ? "+" : ""}${change}%`,
			trend: change >= 0 ? "up" : "down",
			comparison: "vs previous 14 days",
		},
		{
			label: "Median first response",
			value: "38 min",
			change: "−12%",
			trend: "down",
			invert: true,
			comparison: "vs previous 14 days",
		},
		{
			label: "Resolved within a day",
			value: "91%",
			change: "+3 pts",
			trend: "up",
			comparison: "vs previous 14 days",
		},
		{
			label: "Open now",
			value: String(open),
			change: "±0",
			trend: "flat",
			comparison: "same as yesterday",
			href: href(),
		},
	];
}

/**
 * The period's four headline figures, each against the two weeks before: the
 * `reports/stats` frame. As a ghost it is the frame's placeholder, every line drawn as a bar
 * that wraps where its text does, so a phone's two narrow columns keep their height.
 */
export function ReportStats(handle: Handle<{ ghost?: boolean }>) {
	return () => {
		let ghost = handle.props.ghost ?? false;
		let shown = (node: string) => (ghost ? <Skeleton.Text>{node}</Skeleton.Text> : node);

		return (
			<StatCard.Group
				variant="ruled"
				columns={4}
				aria-label={ghost ? undefined : "The last 14 days"}
				aria-hidden={ghost ? "true" : undefined}
			>
				{figures().map((figure) => (
					<StatCard href={ghost ? undefined : figure.href}>
						<StatCard.Label>{shown(figure.label)}</StatCard.Label>
						<StatCard.Value>{shown(figure.value)}</StatCard.Value>
						<StatCard.Delta
							trend={ghost ? "flat" : figure.trend}
							invert={figure.invert}
							comparison={shown(figure.comparison)}
						>
							{shown(figure.change)}
						</StatCard.Delta>
					</StatCard>
				))}
			</StatCard.Group>
		);
	};
}

namespace ReportChart {
	export interface Props {
		/** Answers the chart's failure in its region, as the demo's error link asks. */
		failed: boolean;
	}
}

/** The volume chart, or why it failed to load: the `reports/chart` frame. */
export function ReportChart(handle: Handle<ReportChart.Props>) {
	return () => (handle.props.failed ? <ChartError /> : <VolumeChart />);
}

/**
 * The chart's placeholder: the plot at its aspect ratio, the day row, and the caption's
 * own lines as bars, so the table below stays put when the chart lands.
 */
export function ChartPlaceholder() {
	return () => (
		<div aria-hidden="true" mix={[vstack({ gap: 2, align: "stretch" })]}>
			<div
				mix={[
					raw({
						inlineSize: "100%",
						aspectRatio: `${CHART_SIZE.width} / ${CHART_SIZE.height}`,
						borderRadius: "var(--ui-radius-md)",
						background: "var(--ui-neutral-bg-tint)",
					}),
				]}
			/>
			<div mix={[text("xs"), raw({ visibility: "hidden" })]}>&nbsp;</div>
			<div mix={[text("sm")]}>
				<Skeleton.Text>
					<span mix={[weight("medium")]}>{CHART_CAPTION[0]}</span>
					{CHART_CAPTION[1]}
				</Skeleton.Text>
			</div>
		</div>
	);
}

/** Renders the reports screen. */
export function ReportsScreen(handle: Handle<ReportsScreen.Props>) {
	return () => {
		let { failed } = handle.props;
		let busiest = Math.max(...BY_VIEW.map((row) => row.conversations));

		return (
			<div mix={[vstack({ gap: 6, align: "stretch" })]}>
				<PageHeader title="Reports" description="The last 14 days, against the 14 before." />
				<DemoAppFrame app="relay" part="reports/stats" fallback={<ReportStats ghost />} />
				<section aria-labelledby="relay-volume" mix={[vstack({ gap: 3, align: "stretch" })]}>
					<h2
						id="relay-volume"
						mix={[m(0), text("base"), weight("semibold"), fg("neutral.emphasis")]}
					>
						Conversations per day
					</h2>
					<DemoAppFrame
						app="relay"
						part={failed ? "reports/chart?state=error" : "reports/chart"}
						fallback={<ChartPlaceholder />}
					/>
				</section>
				<section aria-labelledby="relay-by-view" mix={[vstack({ gap: 3, align: "stretch" })]}>
					<h2
						id="relay-by-view"
						mix={[m(0), text("base"), weight("semibold"), fg("neutral.emphasis")]}
					>
						By view
					</h2>
					<Table.Container>
						<Table aria-labelledby="relay-by-view">
							<Table.Header>
								<Table.Row>
									<Table.Column>View</Table.Column>
									<Table.Column numeric>Conversations</Table.Column>
									<Table.Column numeric>Median first response</Table.Column>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{BY_VIEW.map((row) => (
									<Table.Row>
										<Table.Cell>
											<Table.RowLink data-rmx-prefetch="intent" href={href(row.slug)}>
												{findView(row.slug)?.label}
											</Table.RowLink>
										</Table.Cell>
										<Table.BarCell
											value={row.conversations}
											max={busiest}
											locale="en"
											color="brand"
										/>
										<Table.NumberCell
											value={row.firstResponse}
											locale="en"
											format={{ style: "unit", unit: "minute", unitDisplay: "short" }}
										/>
									</Table.Row>
								))}
							</Table.Body>
						</Table>
					</Table.Container>
				</section>
			</div>
		);
	};
}
