/**
 * Client island: the stats page's table of every package, re-sorted in the browser when a
 * header is pressed, with the address updated so a reload keeps the order. Each header is
 * still a link to the page sorted on the server, and the header row stays pinned on scroll.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { bg, fg } from "@sdxc/u/color";
import { insTop, sticky } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { media } from "@sdxc/u/responsive";
import { z } from "@sdxc/u/stacking";
import { nowrap, text } from "@sdxc/u/typography";
import { Link, Table } from "@sdxc/ui";
import { clientEntry, on } from "remix/component";

import { formatFileSize } from "~/app/services/file-size";
import Change from "~/resources/components/change";
import Sparkline from "~/resources/components/sparkline";
import routes from "~/routes/web";

/**
 * Where the header row pins: just under the site header, which is itself sticky, so the
 * column titles stay visible below it. The extra pixel is the site header's bottom border.
 */
const HEADER_OFFSET = "calc(var(--ui-marketing-header-height) + 1px)";

/** How counts read in the table. */
const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

/** How a share of installs reads. */
const SHARE_FORMAT = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 });

/** The ranges the charts can cover, by their query value. */
export const RANGES = { "30": 30, "90": 90, all: Number.POSITIVE_INFINITY } as const;

/** A range the charts cover. */
export type Range = keyof typeof RANGES;

/** A column the table can be ordered by. */
export type SortKey = "name" | "week" | "growth" | "month" | "total";

/** The columns a header can sort by, in the order they appear. */
const SORT_KEYS: SortKey[] = ["name", "week", "growth", "month", "total"];

/** What the reader picked, carried through every link so one choice never resets another. */
export type StatsQuery = {
	range: Range;
	sort: SortKey;
	/** The package directory in focus, or `null` for the whole collection. */
	package: string | null;
};

/** One package's figures as the table draws them, plain enough to hydrate. */
export type PackageRow = {
	directory: string;
	name: string;
	/** Downloads per day over the last 30 days, oldest first. */
	trend: number[];
	last7: number;
	/** Week-over-week change as a fraction, or `null` when last week had no downloads. */
	growth7: number | null;
	last30: number;
	total: number;
	latest: string | null;
	latestShare: number | null;
	versions: number;
	unpackedSize: number | null;
};

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
 * Orders the rows. Numbers sort largest first, and a package without a comparable week sorts
 * after every one with one, so new packages never crowd the top of "growth".
 */
export function sortRows(rows: PackageRow[], key: SortKey): PackageRow[] {
	let byName = (a: PackageRow, b: PackageRow) => a.directory.localeCompare(b.directory);
	let value = (row: PackageRow): number => {
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

/** Props must be a `type` rather than an `interface` to satisfy `SerializableProps`. */
type PackageTableProps = {
	rows: PackageRow[];
	/** The query the page was rendered for, whose `sort` is the table's first order. */
	query: StatsQuery;
};

/** Lists every package, sorted by the column the reader last pressed. */
export const PackageTable = clientEntry(
	import.meta.url,
	function PackageTable(handle: Handle<PackageTableProps>) {
		let sort = handle.props.query.sort;

		/**
		 * Re-sorts in place and replaces the address with the one the header links to, so a
		 * reload, a shared link and the server's own render all agree on the order.
		 */
		function sortBy(key: SortKey, event: Event) {
			if (!(event instanceof MouseEvent)) return;
			if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
			event.preventDefault();
			sort = key;
			globalThis.history.replaceState(null, "", statsHref(handle.props.query, { sort }));
			void handle.update();
		}

		return () => {
			let query = { ...handle.props.query, sort };
			let rows = sortRows(handle.props.rows, sort);
			let sortable = SORT_KEYS.reduce(
				(columns, key) => {
					columns[key] = {
						href: statsHref(query, { sort: key }),
						sortDirection: sort === key ? sortDirection(key) : undefined,
						parts: { link: [on("click", (event) => sortBy(key, event))] },
					};
					return columns;
				},
				{} as Record<SortKey, Table.ColumnProps>,
			);

			return (
				<Table.Container mix={media("(min-width: 64rem)", overflow("visible"))}>
					<Table aria-label="Downloads by package">
						<Table.Header mix={[sticky(), insTop(HEADER_OFFSET), z(1), bg()]}>
							<Table.Row>
								<Table.Column {...sortable.name}>Package</Table.Column>
								<Table.Column>Last 30 days</Table.Column>
								<Table.Column numeric {...sortable.week}>
									7 days
								</Table.Column>
								<Table.Column numeric {...sortable.growth}>
									Change
								</Table.Column>
								<Table.Column numeric {...sortable.month}>
									30 days
								</Table.Column>
								<Table.Column numeric {...sortable.total}>
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
								<Table.Row key={row.directory}>
									<Table.Cell mix={nowrap()}>
										<Link href={statsHref(query, { package: row.directory })}>{row.directory}</Link>
									</Table.Cell>
									<Table.Cell>
										<Sparkline
											label={`${row.name}, downloads per day over the last 30 days`}
											values={row.trend}
										/>
									</Table.Cell>
									<Table.Cell numeric>{NUMBER_FORMAT.format(row.last7)}</Table.Cell>
									<Table.Cell numeric>
										<Change value={row.growth7} current={row.last7} />
									</Table.Cell>
									<Table.Cell numeric>{NUMBER_FORMAT.format(row.last30)}</Table.Cell>
									<Table.Cell numeric>{NUMBER_FORMAT.format(row.total)}</Table.Cell>
									<Table.Cell mix={[nowrap(), text("xs"), fg("neutral.muted")]}>
										{row.latest ?? "unpublished"}
									</Table.Cell>
									<Table.Cell numeric>
										{row.latestShare === null ? "—" : SHARE_FORMAT.format(row.latestShare)}
									</Table.Cell>
									<Table.Cell numeric>{row.versions}</Table.Cell>
									<Table.Cell numeric mix={nowrap()}>
										{row.unpackedSize === null ? "—" : formatFileSize(row.unpackedSize)}
									</Table.Cell>
								</Table.Row>
							))}
						</Table.Body>
					</Table>
				</Table.Container>
			);
		};
	},
);

export default PackageTable;
