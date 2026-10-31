/**
 * The stats page's GitHub section: stars over time, open issues and pull requests from other
 * people, and the repository's views, clones, referrers and most visited paths.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { opacity } from "@sdxc/u/effects";
import { gap, grid, gridTemplate, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { focusVisible, hover } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";
import { Chart, Link, StatStrip, Table } from "@sdxc/ui";

import type {
	GitHubStatsSnapshot,
	OpenItem,
	TrafficDay,
	TrafficSource,
} from "~/app/services/github-stats";

import { GITHUB_REPOSITORY } from "~/app/services/github-stats";
import { daysBetween } from "~/app/services/npm-stats";
import { axisTop, formatDay, Plot } from "~/resources/components/download-chart";

/** How counts read across the section. */
const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

/** One day in milliseconds, for counting back thirty days from the read. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** The marker styling that keeps each day's tooltip target invisible until pointed at. */
const HOVER_MARKERS = [opacity(0), hover(opacity(100)), focusVisible(opacity(100))];

/**
 * The running star total for every day from the first star through the day of the read, so
 * the line stays flat across days nobody starred.
 *
 * @param stars Stars per day, only days with a star.
 * @param through The last day to cover.
 */
export function starHistory(
	stars: Array<{ day: string; count: number }>,
	through: string,
): { days: string[]; totals: number[] } {
	let first = stars[0]?.day;
	if (first === undefined) return { days: [], totals: [] };
	let byDay = new Map(stars.map((entry) => [entry.day, entry.count]));
	let days = daysBetween(first, through < first ? first : through);
	let sum = 0;
	return { days, totals: days.map((day) => (sum += byDay.get(day) ?? 0)) };
}

/**
 * Views and clones lined up on every day from the first recorded day to the last, with zero
 * on days GitHub reported nothing for.
 *
 * @param views Daily views, oldest first.
 * @param clones Daily clones, oldest first.
 */
export function trafficSeries(
	views: TrafficDay[],
	clones: TrafficDay[],
): { days: string[]; views: TrafficDay[]; clones: TrafficDay[] } {
	let recorded = [...views, ...clones].map((entry) => entry.day).sort();
	let first = recorded[0];
	let last = recorded.at(-1);
	if (first === undefined || last === undefined) return { days: [], views: [], clones: [] };
	let days = daysBetween(first, last);
	let align = (series: TrafficDay[]) => {
		let byDay = new Map(series.map((entry) => [entry.day, entry]));
		return days.map((day) => byDay.get(day) ?? { day, count: 0, uniques: 0 });
	};
	return { days, views: align(views), clones: align(clones) };
}

namespace GitHubSection {
	export interface Props {
		/** The stored snapshot, or `null` while nothing has been read. */
		snapshot: GitHubStatsSnapshot | null;
	}
}

/** Renders the section: a note while nothing is stored, otherwise the figures, charts and tables. */
export default function GitHubSection(handle: Handle<GitHubSection.Props>) {
	return () => {
		let { snapshot } = handle.props;

		return (
			<section mix={vstack({ gap: 6, align: "stretch" })}>
				<header mix={vstack({ gap: 1, align: "stretch" })}>
					<h2 mix={[text("lg"), weight("semibold"), fg("neutral.emphasis")]}>GitHub</h2>
					<p mix={[text("sm"), fg("neutral.muted")]}>
						<Link href={`https://github.com/${GITHUB_REPOSITORY}`}>{GITHUB_REPOSITORY}</Link>
						{snapshot ? `, read ${snapshot.fetchedAt.slice(0, 16).replace("T", " ")} UTC.` : null}
					</p>
				</header>

				{snapshot ? (
					<GitHubBody snapshot={snapshot} />
				) : (
					<p mix={[text("sm"), fg("neutral.muted")]}>
						Reading GitHub; this fills in after the next visit.
					</p>
				)}
			</section>
		);
	};
}

namespace GitHubBody {
	export interface Props {
		snapshot: GitHubStatsSnapshot;
	}
}

/** Renders a stored snapshot; a part never read shows a dash, and refused traffic one line. */
function GitHubBody(handle: Handle<GitHubBody.Props>) {
	return () => {
		let { snapshot } = handle.props;
		let readDay = snapshot.fetchedAt.slice(0, 10);
		let monthAgo = new Date(Date.parse(snapshot.fetchedAt) - 29 * DAY_MS)
			.toISOString()
			.slice(0, 10);
		let stars = snapshot.stars ?? [];
		let starTotal = stars.reduce((sum, entry) => sum + entry.count, 0);
		let starsLast30 = stars
			.filter((entry) => entry.day >= monthAgo)
			.reduce((sum, entry) => sum + entry.count, 0);
		let history = starHistory(stars, readDay);
		let traffic = snapshot.trafficReadable ? snapshot.traffic : null;
		let openItems = [
			...(snapshot.issues?.items.map((item) => ({ ...item, kind: "Issue" })) ?? []),
			...(snapshot.pulls?.items.map((item) => ({ ...item, kind: "Pull request" })) ?? []),
		].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

		return (
			<div mix={vstack({ gap: 8, align: "stretch" })}>
				<StatStrip>
					<StatStrip.Item label="Stars">
						{snapshot.stars ? NUMBER_FORMAT.format(starTotal) : "—"}
					</StatStrip.Item>
					<StatStrip.Item label="Stars, last 30 days">
						{snapshot.stars ? NUMBER_FORMAT.format(starsLast30) : "—"}
					</StatStrip.Item>
					<StatStrip.Item label="Open issues from others">
						{snapshot.issues ? NUMBER_FORMAT.format(snapshot.issues.total) : "—"}
					</StatStrip.Item>
					<StatStrip.Item label="Open pull requests from others">
						{snapshot.pulls ? NUMBER_FORMAT.format(snapshot.pulls.total) : "—"}
					</StatStrip.Item>
					{traffic ? (
						<StatStrip.Item label="Views / uniques, last 14 days">
							{NUMBER_FORMAT.format(traffic.views14.count)} /{" "}
							{NUMBER_FORMAT.format(traffic.views14.uniques)}
						</StatStrip.Item>
					) : null}
				</StatStrip>

				<div
					mix={[grid(), gap(8), media("(min-width: 64rem)", gridTemplate({ columns: "1fr 1fr" }))]}
				>
					{history.days.length > 0 ? (
						<Plot
							title="Stars over time"
							label="Running total of stars"
							days={history.days}
							top={axisTop(history.totals.at(-1) ?? 0)}
						>
							<Chart.Area
								color={3}
								markerCount={history.days.length}
								parts={{ marker: HOVER_MARKERS }}
								points={history.totals.map((value, index) => ({
									x: index,
									y: value,
									label: `${formatDay(history.days[index] ?? "")}: ${NUMBER_FORMAT.format(value)} stars`,
								}))}
							/>
						</Plot>
					) : null}
					{traffic ? <TrafficPlot views={traffic.views} clones={traffic.clones} /> : null}
				</div>

				{snapshot.trafficReadable ? null : (
					<p mix={[text("sm"), fg("neutral.muted")]}>
						Traffic is hidden: the token needs the repository&apos;s Administration read access.
					</p>
				)}

				{traffic ? (
					<div
						mix={[
							grid(),
							gap(8),
							media("(min-width: 64rem)", gridTemplate({ columns: "1fr 1fr" })),
						]}
					>
						<SourceTable
							label="Referrers, last 14 days"
							heading="Referrer"
							rows={traffic.referrers}
						/>
						<SourceTable label="Popular paths, last 14 days" heading="Path" rows={traffic.paths} />
					</div>
				) : null}

				<OpenItemsTable items={openItems} />
			</div>
		);
	};
}

namespace TrafficPlot {
	export interface Props {
		views: TrafficDay[];
		clones: TrafficDay[];
	}
}

/** Renders views per day as an area with clones as a line over it, on one shared axis. */
function TrafficPlot(handle: Handle<TrafficPlot.Props>) {
	return () => {
		let series = trafficSeries(handle.props.views, handle.props.clones);
		if (series.days.length === 0) return null;
		let peak = Math.max(
			0,
			...series.views.map((d) => d.count),
			...series.clones.map((d) => d.count),
		);

		return (
			<Plot
				title="Views per day, line is clones"
				label="Repository views and clones per day"
				days={series.days}
				top={axisTop(peak)}
			>
				<Chart.Area
					color={1}
					markerCount={series.days.length}
					parts={{ marker: HOVER_MARKERS }}
					points={series.views.map((entry, index) => ({
						x: index,
						y: entry.count,
						label: `${formatDay(entry.day)}: ${NUMBER_FORMAT.format(entry.count)} views, ${NUMBER_FORMAT.format(entry.uniques)} unique`,
					}))}
				/>
				<Chart.Line
					color={2}
					markerCount={series.days.length}
					parts={{ marker: HOVER_MARKERS }}
					points={series.clones.map((entry, index) => ({
						x: index,
						y: entry.count,
						label: `${formatDay(entry.day)}: ${NUMBER_FORMAT.format(entry.count)} clones, ${NUMBER_FORMAT.format(entry.uniques)} unique`,
					}))}
				/>
			</Plot>
		);
	};
}

namespace SourceTable {
	export interface Props {
		label: string;
		/** The first column's header, naming what each row is. */
		heading: string;
		rows: TrafficSource[];
	}
}

/** Renders referrers or paths with their views and unique visitors. */
function SourceTable(handle: Handle<SourceTable.Props>) {
	return () => {
		let { heading, label, rows } = handle.props;

		return (
			<Table.Container>
				<Table aria-label={label}>
					<Table.Header>
						<Table.Row>
							<Table.Column>{heading}</Table.Column>
							<Table.Column numeric>Views</Table.Column>
							<Table.Column numeric>Unique</Table.Column>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{rows.length === 0 ? (
							<Table.Row>
								<Table.Cell colSpan={3}>
									<span mix={fg("neutral.muted")}>None in the last 14 days</span>
								</Table.Cell>
							</Table.Row>
						) : (
							rows.map((row) => (
								<Table.Row key={row.name}>
									<Table.Cell>{row.name}</Table.Cell>
									<Table.Cell numeric>{NUMBER_FORMAT.format(row.count)}</Table.Cell>
									<Table.Cell numeric>{NUMBER_FORMAT.format(row.uniques)}</Table.Cell>
								</Table.Row>
							))
						)}
					</Table.Body>
				</Table>
			</Table.Container>
		);
	};
}

namespace OpenItemsTable {
	export interface Props {
		/** Issues and pull requests from other people, newest first. */
		items: Array<OpenItem & { kind: string }>;
	}
}

/** Renders the open issues and pull requests other people opened, each linking to GitHub. */
function OpenItemsTable(handle: Handle<OpenItemsTable.Props>) {
	return () => {
		let { items } = handle.props;

		return (
			<Table.Container>
				<Table aria-label="Open issues and pull requests from others">
					<Table.Header>
						<Table.Row>
							<Table.Column>Open from others</Table.Column>
							<Table.Column>Kind</Table.Column>
							<Table.Column>Author</Table.Column>
							<Table.Column numeric>Opened</Table.Column>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{items.length === 0 ? (
							<Table.Row>
								<Table.Cell colSpan={4}>
									<span mix={fg("neutral.muted")}>Nothing open from other people</span>
								</Table.Cell>
							</Table.Row>
						) : (
							items.map((item) => (
								<Table.Row key={item.url}>
									<Table.Cell>
										<Link href={item.url}>
											#{item.number} {item.title}
										</Link>
									</Table.Cell>
									<Table.Cell>{item.kind}</Table.Cell>
									<Table.Cell>
										<Link href={`https://github.com/${item.author}`}>{item.author}</Link>
									</Table.Cell>
									<Table.Cell numeric>{formatDay(item.createdAt.slice(0, 10))}</Table.Cell>
								</Table.Row>
							))
						)}
					</Table.Body>
				</Table>
			</Table.Container>
		);
	};
}
