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
import { StatCard } from "@sdxc/ui/app/stat-card";
import { Table } from "@sdxc/ui/app/table";

import {
	DAILY_CONVERSATIONS,
	PREVIOUS_DAILY_CONVERSATIONS,
} from "~/resources/views/demo-apps/relay/data";
import { RelayShell } from "~/resources/views/demo-apps/relay/shell";
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
		collapsed: boolean;
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

/** The daily volume chart with the previous period dashed behind it. */
function VolumeChart() {
	return () => (
		<figure mix={[vstack({ gap: 2, align: "stretch" }), m(0)]}>
			<Chart
				width={960}
				height={240}
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
				<span mix={[weight("medium"), fg("neutral.emphasis")]}>Weekdays run busier.</span> Solid:
				the last 14 days. Dashed: the 14 days before.
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

/** Renders the reports screen. */
export function ReportsScreen(handle: Handle<ReportsScreen.Props>) {
	return () => {
		let { collapsed, failed } = handle.props;
		let total = DAILY_CONVERSATIONS.reduce((sum, value) => sum + value, 0);
		let previous = PREVIOUS_DAILY_CONVERSATIONS.reduce((sum, value) => sum + value, 0);
		let change = Math.round(((total - previous) / previous) * 100);
		let busiest = Math.max(...BY_VIEW.map((row) => row.conversations));
		let inbox = findView("inbox");
		let open = inbox ? conversationsIn(inbox).length : 0;

		return (
			<RelayShell current="reports" collapsed={collapsed} crumb="Reports">
				<div mix={[vstack({ gap: 6, align: "stretch" })]}>
					<PageHeader title="Reports" description="The last 14 days, against the 14 before." />
					<StatCard.Group variant="ruled" columns={4} aria-label="The last 14 days">
						<StatCard>
							<StatCard.Label>New conversations</StatCard.Label>
							<StatCard.Value>{total}</StatCard.Value>
							<StatCard.Delta trend={change >= 0 ? "up" : "down"} comparison="vs previous 14 days">
								{`${change >= 0 ? "+" : ""}${change}%`}
							</StatCard.Delta>
						</StatCard>
						<StatCard>
							<StatCard.Label>Median first response</StatCard.Label>
							<StatCard.Value>38 min</StatCard.Value>
							<StatCard.Delta trend="down" invert comparison="vs previous 14 days">
								−12%
							</StatCard.Delta>
						</StatCard>
						<StatCard>
							<StatCard.Label>Resolved within a day</StatCard.Label>
							<StatCard.Value>91%</StatCard.Value>
							<StatCard.Delta trend="up" comparison="vs previous 14 days">
								+3 pts
							</StatCard.Delta>
						</StatCard>
						<StatCard href={href()}>
							<StatCard.Label>Open now</StatCard.Label>
							<StatCard.Value>{open}</StatCard.Value>
							<StatCard.Delta trend="flat" comparison="same as yesterday">
								±0
							</StatCard.Delta>
						</StatCard>
					</StatCard.Group>
					<section aria-labelledby="relay-volume" mix={[vstack({ gap: 3, align: "stretch" })]}>
						<h2
							id="relay-volume"
							mix={[m(0), text("base"), weight("semibold"), fg("neutral.emphasis")]}
						>
							Conversations per day
						</h2>
						{failed ? <ChartError /> : <VolumeChart />}
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
												<Table.RowLink href={href(row.slug)}>
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
			</RelayShell>
		);
	};
}
