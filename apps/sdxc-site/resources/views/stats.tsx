/**
 * The npm stats page's body: headline figures for the collection or one package, its
 * download charts over the chosen range, and every package in a sortable table whose rows
 * link to that package's own view. Every control is a link, so the page works without script;
 * the table hydrates to sort in place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { fg } from "@sdxc/u/color";
import { hstack, vstack } from "@sdxc/u/layout";
import { is, maxIs, mi, p } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Link } from "@sdxc/ui";
import { Table } from "@sdxc/ui/app";
import { StatStrip } from "@sdxc/ui/landing";

import type { NpmStatsSnapshot, PackageSummary } from "~/app/services/npm-stats";
import type { PackageRow, Range, StatsQuery } from "~/resources/components/package-table";

import { formatFileSize } from "~/app/services/file-size";
import { collectionJsdelivr, median, windowSum } from "~/app/services/npm-stats";
import Change from "~/resources/components/change";
import DownloadChart, { formatDay } from "~/resources/components/download-chart";
import PackageTable, { RANGES, statsHref } from "~/resources/components/package-table";
import PackageTrends from "~/resources/components/package-trends";

/** How counts read across the page. */
const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

/** How a share of installs reads. */
const SHARE_FORMAT = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 });

/**
 * The figures a table row shows, cut down from a package's summary to what hydrates: the
 * whole history stays on the server and only the last 30 days travel for the sparkline.
 */
export function packageRow(summary: PackageSummary): PackageRow {
	let { stats } = summary;
	return {
		directory: stats.directory,
		name: stats.name,
		trend: stats.daily.slice(-30),
		last7: summary.last7,
		growth7: summary.growth7,
		last30: summary.last30,
		total: summary.total,
		jsdelivr30: summary.jsdelivr30,
		latest: stats.latest,
		latestShare: summary.latestShare,
		versions: stats.versions,
		unpackedSize: stats.unpackedSize,
	};
}

namespace Headline {
	export interface Props {
		/** The series the figures are read from. */
		summary: Pick<PackageSummary, "last7" | "previous7" | "last30" | "previous30" | "total">;
		days: string[];
		daily: number[];
		/** Secondary figures, set as one quiet line under the strip so the four above stay large. */
		children?: RemixNode;
	}
}

/**
 * Renders the headline strip, the last week and month against the ones before, all time and
 * the peak, with any secondary figures on a quiet line beneath.
 */
function Headline(handle: Handle<Headline.Props>) {
	return () => {
		let { children, daily, days, summary } = handle.props;
		let peak = Math.max(0, ...daily);
		let peakDay = days[daily.indexOf(peak)];

		return (
			<div mix={vstack({ gap: 3, align: "stretch" })}>
				<StatStrip>
					<StatStrip.Item label={<Delta after={summary.last7} before={summary.previous7} />}>
						{NUMBER_FORMAT.format(summary.last7)}
					</StatStrip.Item>
					<StatStrip.Item
						label={<Delta after={summary.last30} before={summary.previous30} period="30 days" />}
					>
						{NUMBER_FORMAT.format(summary.last30)}
					</StatStrip.Item>
					<StatStrip.Item label="All time">{NUMBER_FORMAT.format(summary.total)}</StatStrip.Item>
					<StatStrip.Item
						label={peak > 0 && peakDay ? `Best day, ${formatDay(peakDay)}` : "Best day"}
					>
						{NUMBER_FORMAT.format(peak)}
					</StatStrip.Item>
				</StatStrip>
				{children ? <p mix={[text("sm"), fg("neutral.muted")]}>{children}</p> : null}
			</div>
		);
	};
}

namespace Delta {
	export interface Props {
		after: number;
		before: number;
		/** @default "7 days" */
		period?: string;
	}
}

/** Renders a headline label: the period, and its change against the one before. */
function Delta(handle: Handle<Delta.Props>) {
	return () => {
		let { after, before, period = "7 days" } = handle.props;
		return (
			<span>
				Last {period}{" "}
				<Change value={before === 0 ? null : (after - before) / before} current={after} />
			</span>
		);
	};
}

/**
 * The collection's secondary figures as one line. jsDelivr hits join it only once there are
 * any, since a zero there says the source is quiet rather than anything about adoption.
 */
function collectionFacts(facts: {
	active: number;
	packages: number;
	hits: number;
	medianShare: number | null;
}): string {
	let parts = [`${facts.active} of ${facts.packages} packages downloaded last week`];
	if (facts.hits > 0)
		parts.push(`${NUMBER_FORMAT.format(facts.hits)} jsDelivr hits in the last 30 days`);
	if (facts.medianShare !== null) {
		parts.push(`${SHARE_FORMAT.format(facts.medianShare)} median share on the latest version`);
	}
	return parts.join(" · ");
}

namespace StatsPage {
	export interface Props {
		snapshot: NpmStatsSnapshot;
		/** Every package's figures, in the order the table lists them. */
		rows: PackageSummary[];
		/** The collection's downloads per day, over every day the snapshot covers. */
		collection: number[];
		/** The package in focus, when one is. */
		focus: PackageSummary | null;
		query: StatsQuery;
		/** How many packages hold counts through yesterday. */
		current: number;
		/** How many packages are published, which `current` reaches once a refresh catches up. */
		published: number;
		/** The sections about the collection beyond npm, drawn between its charts and its table. */
		sections?: RemixNode;
	}
}

/** Renders the whole body under the site header. */
export default function StatsPage(handle: Handle<StatsPage.Props>) {
	return () => {
		let { collection, current, focus, published, query, rows, sections, snapshot } = handle.props;
		let length = Math.min(RANGES[query.range], snapshot.days.length);
		let days = snapshot.days.slice(-length);
		let series = (focus?.stats.daily ?? collection).slice(-length);
		let active = rows.filter((row) => row.last7 > 0).length;
		let hits = collectionJsdelivr(snapshot);
		let medianShare = median(rows.flatMap((row) => row.latestShare ?? []));
		let through = snapshot.days.at(-1);

		let collectionSummary = {
			last7: windowSum(collection, 7),
			previous7: windowSum(collection, 7, 7),
			last30: windowSum(collection, 30),
			previous30: windowSum(collection, 30, 30),
			total: windowSum(collection, collection.length),
		};

		return (
			<main
				mix={[vstack({ gap: 10, align: "stretch" }), is("100%"), maxIs(300), mi("auto"), p(8, 4)]}
			>
				<header mix={vstack({ gap: 2, align: "stretch" })}>
					<div mix={hstack({ gap: 3, align: "center", justify: "between" })}>
						<h1 mix={[text("xl"), weight("bold"), fg("neutral.emphasis")]}>
							{focus ? focus.stats.name : "Usage stats"}
						</h1>
						<RangePicker query={query} />
					</div>
					{focus ? (
						<p mix={[text("sm"), fg("neutral.muted")]}>
							<Link href={statsHref(query, { package: null })}>All packages</Link>
							{" · "}
							<Link href={`https://www.npmjs.com/package/${focus.stats.name}`}>npm</Link>
						</p>
					) : null}
				</header>

				<section mix={vstack({ gap: 6, align: "stretch" })}>
					<div mix={vstack({ gap: 2, align: "stretch" })}>
						{focus ? null : (
							<h2 mix={[text("lg"), weight("semibold"), fg("neutral.emphasis")]}>npm downloads</h2>
						)}
						<p mix={[text("sm"), fg("neutral.muted")]}>
							Counts through {through ? formatDay(through) : "—"}, read from npm{" "}
							{new Date(snapshot.fetchedAt).toISOString().slice(0, 16).replace("T", " ")} UTC. npm
							counts every tarball fetch, CI and mirrors included.
						</p>
						{current < published ? (
							<p mix={[text("sm"), fg("warning")]}>
								{current} of {published} packages are up to date; npm rate-limits its downloads API,
								so the rest are read over the next visits and the daily refresh.
							</p>
						) : null}
					</div>

					{focus ? (
						<Headline summary={focus} days={snapshot.days} daily={focus.stats.daily}>
							{focus.latestShare === null
								? "No installs last week"
								: SHARE_FORMAT.format(focus.latestShare)}
							{focus.latestShare === null
								? null
								: " of last week's installs were on the latest version"}
						</Headline>
					) : (
						<Headline summary={collectionSummary} days={snapshot.days} daily={collection}>
							{collectionFacts({
								active,
								packages: rows.length,
								hits: windowSum(hits, 30),
								medianShare,
							})}
						</Headline>
					)}

					<DownloadChart label={focus?.stats.name ?? "Every package"} days={days} daily={series} />
				</section>

				{focus ? (
					<PackageTrends
						summary={focus}
						days={days}
						jsdelivr={(focus.stats.jsdelivr ?? snapshot.days.map(() => 0)).slice(-length)}
					/>
				) : null}

				{focus ? <PackageDetails summary={focus} /> : sections}

				<PackageTable rows={rows.map(packageRow)} query={query} />
			</main>
		);
	};
}

namespace RangePicker {
	export interface Props {
		query: StatsQuery;
	}
}

/** Renders the range links, the current one marked as the page's own. */
function RangePicker(handle: Handle<RangePicker.Props>) {
	return () => {
		let { query } = handle.props;
		let labels: Record<Range, string> = { "30": "30 days", "90": "90 days", all: "All" };

		return (
			<nav aria-label="Range" mix={[hstack({ gap: 3, align: "center" }), text("sm")]}>
				{(Object.keys(labels) as Range[]).map((range) =>
					range === query.range ? (
						<span
							key={range}
							aria-current="page"
							mix={[weight("semibold"), fg("neutral.emphasis")]}
						>
							{labels[range]}
						</span>
					) : (
						<Link key={range} href={statsHref(query, { range })}>
							{labels[range]}
						</Link>
					),
				)}
			</nav>
		);
	};
}

namespace PackageDetails {
	export interface Props {
		summary: PackageSummary;
	}
}

/** Renders what the registry says about one package, and which versions last week installed. */
function PackageDetails(handle: Handle<PackageDetails.Props>) {
	return () => {
		let { stats } = handle.props.summary;
		let split = Object.entries(stats.versionDownloads).sort((a, b) => b[1] - a[1]);
		let weekly = split.reduce((sum, [, count]) => sum + count, 0);

		return (
			<section mix={vstack({ gap: 4, align: "stretch" })}>
				<StatStrip>
					<StatStrip.Item label="Latest">{stats.latest ?? "—"}</StatStrip.Item>
					<StatStrip.Item label="Published">
						{stats.latestPublishedAt ? formatDay(stats.latestPublishedAt.slice(0, 10)) : "—"}
					</StatStrip.Item>
					<StatStrip.Item label="First published">
						{stats.createdAt ? formatDay(stats.createdAt.slice(0, 10)) : "—"}
					</StatStrip.Item>
					<StatStrip.Item label="Versions">{NUMBER_FORMAT.format(stats.versions)}</StatStrip.Item>
					<StatStrip.Item label="Unpacked size">
						{stats.unpackedSize === null ? "—" : formatFileSize(stats.unpackedSize)}
					</StatStrip.Item>
				</StatStrip>

				{split.length > 0 ? (
					<Table.Container>
						<Table aria-label="Downloads by version, last week">
							<Table.Header>
								<Table.Row>
									<Table.Column>Version, last week</Table.Column>
									<Table.Column numeric>Downloads</Table.Column>
									<Table.Column numeric>Share</Table.Column>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{split.map(([version, count]) => (
									<Table.Row key={version}>
										<Table.Cell>
											{version}
											{version === stats.latest ? (
												<span mix={[fg("neutral.muted"), text("xs")]}> latest</span>
											) : null}
										</Table.Cell>
										<Table.Cell numeric>{NUMBER_FORMAT.format(count)}</Table.Cell>
										<Table.Cell numeric>
											{SHARE_FORMAT.format(weekly === 0 ? 0 : count / weekly)}
										</Table.Cell>
									</Table.Row>
								))}
							</Table.Body>
						</Table>
					</Table.Container>
				) : null}
			</section>
		);
	};
}
