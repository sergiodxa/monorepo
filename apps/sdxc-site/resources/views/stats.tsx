/**
 * The npm stats page's body: headline figures for the collection or one package, its
 * download charts over the chosen range, and every package in a sortable table whose rows
 * link to that package's own view. Every control is a link, so the page works without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { iife } from "@sdxc/iife";
import { fg } from "@sdxc/u/color";
import { hstack, vstack } from "@sdxc/u/layout";
import { is, maxIs, mi, p } from "@sdxc/u/size";
import { nowrap, tabularNums, text, weight } from "@sdxc/u/typography";
import { Link, StatStrip, Table } from "@sdxc/ui";

import type { NpmStatsSnapshot, PackageSummary } from "~/app/services/npm-stats";

import { formatFileSize } from "~/app/services/file-size";
import { windowSum } from "~/app/services/npm-stats";
import DownloadChart, { formatDay, Sparkline } from "~/resources/components/download-chart";
import routes from "~/routes/web";

/** How counts read across the page. */
const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

/** How a change reads: always signed, so a flat week and a small gain look different. */
const PERCENT_FORMAT = new Intl.NumberFormat("en-US", {
	style: "percent",
	maximumFractionDigits: 0,
	signDisplay: "exceptZero",
});

/** How a share of installs reads. */
const SHARE_FORMAT = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 });

/** The ranges the charts can cover, by their query value. */
export const RANGES = { "30": 30, "90": 90, all: Number.POSITIVE_INFINITY } as const;

/** A range the charts cover. */
export type Range = keyof typeof RANGES;

/** A column the table can be ordered by. */
export type SortKey = "name" | "week" | "growth" | "month" | "total";

/** What the reader picked, carried through every link so one choice never resets another. */
export interface StatsQuery {
	range: Range;
	sort: SortKey;
	/** The package directory in focus, or `null` for the whole collection. */
	package: string | null;
}

/**
 * The page's URL with `changes` applied over `query`, leaving defaults out so the plain
 * address stays plain.
 */
export function statsHref(query: StatsQuery, changes: Partial<StatsQuery>): string {
	let next = { ...query, ...changes };
	let params = new URLSearchParams();
	if (next.range !== "90") params.set("range", next.range);
	if (next.sort !== "week") params.set("sort", next.sort);
	if (next.package !== null) params.set("package", next.package);
	let search = params.toString();
	return search ? `${routes.stats.href()}?${search}` : routes.stats.href();
}

/**
 * Orders the table. Numbers sort largest first, and a package without a comparable week
 * sorts after every one with one, so new packages never crowd the top of "growth".
 */
export function sortSummaries(rows: PackageSummary[], key: SortKey): PackageSummary[] {
	let byName = (a: PackageSummary, b: PackageSummary) =>
		a.stats.directory.localeCompare(b.stats.directory);
	let value = (row: PackageSummary): number => {
		if (key === "week") return row.last7;
		if (key === "month") return row.last30;
		if (key === "total") return row.total;
		return row.growth7 ?? Number.NEGATIVE_INFINITY;
	};

	if (key === "name") return [...rows].sort(byName);
	return [...rows].sort((a, b) => value(b) - value(a) || byName(a, b));
}

/** The direction a column sorts in: names read A to Z, figures largest first. */
function sortDirection(key: SortKey): "ascending" | "descending" {
	return key === "name" ? "ascending" : "descending";
}

namespace Change {
	export interface Props {
		value: number | null;
		/** Whether there is anything this period, which tells "new" apart from "nothing". */
		current: number;
	}
}

/** Renders a period-over-period change, coloured by direction. */
function Change(handle: Handle<Change.Props>) {
	return () => {
		let { current, value } = handle.props;
		if (value === null) {
			return <span mix={fg("neutral.muted")}>{current > 0 ? "new" : "—"}</span>;
		}

		let tone = iife(() => {
			if (value > 0) return "success";
			if (value < 0) return "danger";
			return "neutral.muted";
		});
		return <span mix={[fg(tone), tabularNums()]}>{PERCENT_FORMAT.format(value)}</span>;
	};
}

namespace Headline {
	export interface Props {
		/** The series the figures are read from. */
		summary: Pick<PackageSummary, "last7" | "previous7" | "last30" | "previous30" | "total">;
		days: string[];
		daily: number[];
		children?: RemixNode;
	}
}

/** Renders the headline strip: the last week and month against the ones before, and the peak. */
function Headline(handle: Handle<Headline.Props>) {
	return () => {
		let { children, daily, days, summary } = handle.props;
		let peak = Math.max(0, ...daily);
		let peakDay = days[daily.indexOf(peak)];

		return (
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
				{children}
			</StatStrip>
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
	}
}

/** Renders the whole body under the site header. */
export default function StatsPage(handle: Handle<StatsPage.Props>) {
	return () => {
		let { collection, current, focus, published, query, rows, snapshot } = handle.props;
		let length = Math.min(RANGES[query.range], snapshot.days.length);
		let days = snapshot.days.slice(-length);
		let series = (focus?.stats.daily ?? collection).slice(-length);
		let active = rows.filter((row) => row.last7 > 0).length;
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
							{focus ? focus.stats.name : "npm downloads"}
						</h1>
						<RangePicker query={query} />
					</div>
					<p mix={[text("sm"), fg("neutral.muted")]}>
						{focus ? (
							<>
								<Link href={statsHref(query, { package: null })}>All packages</Link>
								{" · "}
								<Link href={`https://www.npmjs.com/package/${focus.stats.name}`}>npm</Link>
								{" · "}
							</>
						) : null}
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
				</header>

				{focus ? (
					<Headline summary={focus} days={snapshot.days} daily={focus.stats.daily}>
						<StatStrip.Item label="On the latest version, last week">
							{focus.latestShare === null ? "—" : SHARE_FORMAT.format(focus.latestShare)}
						</StatStrip.Item>
					</Headline>
				) : (
					<Headline summary={collectionSummary} days={snapshot.days} daily={collection}>
						<StatStrip.Item label="Packages downloaded last week">
							{active} of {rows.length}
						</StatStrip.Item>
					</Headline>
				)}

				<DownloadChart label={focus?.stats.name ?? "Every package"} days={days} daily={series} />

				{focus ? <PackageDetails summary={focus} /> : null}

				<PackageTable rows={rows} query={query} />
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

namespace PackageTable {
	export interface Props {
		rows: PackageSummary[];
		query: StatsQuery;
	}
}

/** Renders every package's figures; each sortable header re-requests the page ordered by it. */
function PackageTable(handle: Handle<PackageTable.Props>) {
	return () => {
		let { query, rows } = handle.props;
		let sortable = (key: SortKey) => ({
			href: statsHref(query, { sort: key }),
			sortDirection: query.sort === key ? sortDirection(key) : undefined,
		});

		return (
			<Table.Container>
				<Table aria-label="Downloads by package">
					<Table.Header>
						<Table.Row>
							<Table.Column {...sortable("name")}>Package</Table.Column>
							<Table.Column>Last 30 days</Table.Column>
							<Table.Column numeric {...sortable("week")}>
								7 days
							</Table.Column>
							<Table.Column numeric {...sortable("growth")}>
								Change
							</Table.Column>
							<Table.Column numeric {...sortable("month")}>
								30 days
							</Table.Column>
							<Table.Column numeric {...sortable("total")}>
								Total
							</Table.Column>
							<Table.Column>Latest</Table.Column>
							<Table.Column numeric>On latest</Table.Column>
							<Table.Column numeric>Versions</Table.Column>
							<Table.Column numeric>Size</Table.Column>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{rows.map((row) => (
							<Table.Row key={row.stats.directory}>
								<Table.Cell mix={nowrap()}>
									<Link href={statsHref(query, { package: row.stats.directory })}>
										{row.stats.directory}
									</Link>
								</Table.Cell>
								<Table.Cell>
									<Sparkline
										label={`${row.stats.name}, downloads per day over the last 30 days`}
										values={row.stats.daily.slice(-30)}
									/>
								</Table.Cell>
								<Table.Cell numeric>{NUMBER_FORMAT.format(row.last7)}</Table.Cell>
								<Table.Cell numeric>
									<Change value={row.growth7} current={row.last7} />
								</Table.Cell>
								<Table.Cell numeric>{NUMBER_FORMAT.format(row.last30)}</Table.Cell>
								<Table.Cell numeric>{NUMBER_FORMAT.format(row.total)}</Table.Cell>
								<Table.Cell mix={[nowrap(), text("xs"), fg("neutral.muted")]}>
									{row.stats.latest ?? "unpublished"}
								</Table.Cell>
								<Table.Cell numeric>
									{row.latestShare === null ? "—" : SHARE_FORMAT.format(row.latestShare)}
								</Table.Cell>
								<Table.Cell numeric>{row.stats.versions}</Table.Cell>
								<Table.Cell numeric mix={nowrap()}>
									{row.stats.unpackedSize === null ? "—" : formatFileSize(row.stats.unpackedSize)}
								</Table.Cell>
							</Table.Row>
						))}
					</Table.Body>
				</Table>
			</Table.Container>
		);
	};
}
