/**
 * What every CMS list shares: the query its filter bar writes into the address (status tab,
 * search, sort, page), one page of rows with the footer's range, the row keys, the first-run
 * and no-results states, and the confirmed delete a row offers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { Trash2Icon } from "@sdxc/icons";
import { Button, Confirm, LinkButton } from "@sdxc/ui";
import { clearFiltersHref, setParamHref } from "@sdxc/ui/app";
import { Empty } from "@sdxc/ui/app/empty";
import { FilterBar } from "@sdxc/ui/app/filter-bar";
import { SelectionBar } from "@sdxc/ui/app/selection-bar";
import { Table } from "@sdxc/ui/app/table";
import { HeadingScope } from "@sdxc/ui/heading-scope";

import { currentRequest } from "~/app/http/current-request";

/** Rows one page of a CMS list shows. */
export const PAGE_SIZE = 50;

/** The params a list's filter bar owns, which "Clear filters" drops. */
const FILTER_PARAMS = ["status", "q", "page"] as const;

/** A list's state as the address carries it, so a filtered view is a link the author can keep. */
export interface ListQuery {
	/** The current address, which every tab, sort and page link is built from. */
	url: URL;
	/** The status tab, `"all"` when none is chosen. */
	status: string;
	/** The search text, trimmed. */
	q: string;
	/** The sort key, `""` when the list's default applies. */
	sort: string;
	/** The page, from 1. */
	page: number;
}

/** Where a list renders outside a request, as a test rendering one view does. */
const FALLBACK_URL = "http://localhost/cms";

/** Reads the list's query from the request being rendered. */
export function readListQuery(): ListQuery {
	let url = new URL(currentRequest()?.request.url ?? FALLBACK_URL);
	let page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
	return {
		url,
		status: url.searchParams.get("status") ?? "all",
		q: (url.searchParams.get("q") ?? "").trim(),
		sort: url.searchParams.get("sort") ?? "",
		page: Number.isFinite(page) && page > 0 ? page : 1,
	};
}

/**
 * Whether any of `fields` contains the search text, ignoring case; an empty search matches all.
 *
 * @param q The trimmed search text.
 * @param fields The row's searchable text.
 */
export function matchesSearch(q: string, ...fields: Array<string | null | undefined>): boolean {
	if (q === "") return true;
	let needle = q.toLowerCase();
	return fields.some((field) => field?.toLowerCase().includes(needle));
}

/** How a row is read for sorting: its title, and its date as an ISO string or `null`. */
export interface SortKeys<T> {
	title: (row: T) => string;
	date: (row: T) => string | null;
}

/**
 * Orders rows by the list's sort param: `""` is newest first, `"date"` oldest first and
 * `"title"` A–Z. A row without a date sorts as the oldest.
 *
 * @param rows The rows the filters kept.
 * @param sort The list's sort param.
 * @param keys How to read a row's title and date.
 */
export function sortRows<T>(rows: T[], sort: string, keys: SortKeys<T>): T[] {
	let byDate = (a: T, b: T) => (keys.date(a) ?? "").localeCompare(keys.date(b) ?? "");
	if (sort === "title") return [...rows].sort((a, b) => keys.title(a).localeCompare(keys.title(b)));
	if (sort === "date") return [...rows].sort(byDate);
	return [...rows].sort((a, b) => byDate(b, a));
}

/** The sort menu every dated CMS list offers. */
export const SORT_OPTIONS = {
	label: "Sort by",
	defaultValue: "",
	options: [
		{ value: "", label: "Newest first" },
		{ value: "date", label: "Oldest first" },
		{ value: "title", label: "Title A–Z" },
	],
};

/** The sort menu for a list whose rows have a date and no title, such as notes or mentions. */
export const DATE_SORT_OPTIONS = {
	label: "Sort by",
	defaultValue: "",
	options: [
		{ value: "", label: "Newest first" },
		{ value: "date", label: "Oldest first" },
	],
};

/** One page of rows, with the footer's range and the links either side of it. */
export interface ListPage<T> {
	rows: T[];
	pagination: SelectionBar.Pagination;
}

/**
 * Cuts `items` to the page the query names. A page past the end shows the last one, so a
 * delete that empties the final page still lands on rows.
 *
 * @param items Every row the filters kept, in order.
 * @param query The list's query, for the page and the links.
 */
export function pageOf<T>(items: T[], query: ListQuery): ListPage<T> {
	let pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
	let page = Math.min(query.page, pages);
	let start = (page - 1) * PAGE_SIZE;
	let rows = items.slice(start, start + PAGE_SIZE);
	let link = (to: number) => setParamHref(query.url, "page", to === 1 ? null : String(to), []);
	let summary =
		items.length === 0
			? "No rows"
			: `${String(start + 1)}–${String(start + rows.length)} of ${String(items.length)}`;
	return {
		rows,
		pagination: {
			summary,
			previous: page > 1 ? link(page - 1) : undefined,
			next: page < pages ? link(page + 1) : undefined,
		},
	};
}

/**
 * A status tab: its count under the current search, its link, and whether it is open.
 *
 * @param query The list's query.
 * @param value The status the tab shows, or `"all"`.
 * @param label The tab's text.
 * @param count The rows it would show.
 */
export function statusTab(query: ListQuery, value: string, label: string, count: number) {
	return {
		label,
		count,
		href: setParamHref(query.url, "status", value === "all" ? null : value),
		current: query.status === value,
	};
}

/** The filter bar's strings, shared by every CMS list. */
export const FILTER_LABELS: FilterBar.Labels = {
	toolbar: "Filter",
	tabs: "Status",
	filters: "Filters",
	apply: "Apply",
	is: "is",
	isAnyOf: "is any of",
	clear: "Clear filters",
	remove: (field, values) => `Remove ${field}: ${values}`,
	options: "View",
};

/** The footer's strings; the CMS lists select nothing, so only the pagination ones show. */
export const PAGINATION_LABELS: SelectionBar.Labels = {
	toolbar: "Pages",
	clear: "Clear selection",
	selected: "{count} selected",
	cleared: "Selection cleared",
	previous: "Previous page",
	next: "Next page",
};

/** Props accepted by {@link ListKeys}. */
interface ListKeysProps {
	/** The filter bar's id, whose search field `/` focuses. */
	filterBar: string;
}

/** j/k, Enter and `/` on a list's rows, listed in the keyboard help sheet. */
export function ListKeys(handle: Handle<ListKeysProps>) {
	return () => (
		<Table.Keys
			search={`${handle.props.filterBar}-search`}
			labels={{
				group: "List",
				next: "Next row",
				previous: "Previous row",
				open: "Open row",
				search: "Search",
			}}
		/>
	);
}

/** Props accepted by {@link ListEmpty}. */
interface ListEmptyProps {
	query: ListQuery;
	/** What the list holds, plural and lower case: "articles". */
	noun: string;
	/** Whether the list holds nothing at all, rather than nothing these filters keep. */
	firstRun: boolean;
	/** The first-run state's action, such as "New article". */
	action?: RemixNode;
	/** The first-run state's sentence, for a list the author does not write, such as a queue. */
	description?: RemixNode;
	/** Params "Clear filters" keeps, such as the queue tab a moderation list is on. */
	keep?: string[];
}

/**
 * The list's empty state by cause: nothing written yet offers the first one; nothing matching
 * keeps the toolbar above it and offers to clear the filters.
 */
export function ListEmpty(handle: Handle<ListEmptyProps>) {
	return () => {
		let { query, noun, firstRun, action, description, keep = [] } = handle.props;
		let cleared = FILTER_PARAMS.filter((name) => !keep.includes(name));
		return (
			<Table.Empty>
				<HeadingScope level={2}>
					{firstRun ? (
						<Empty kind="first-run" size="compact">
							<Empty.Title>No {noun} yet</Empty.Title>
							<Empty.Description>
								{description ?? "The first one you write shows up here."}
							</Empty.Description>
							{action ? <Empty.Action>{action}</Empty.Action> : null}
						</Empty>
					) : (
						<Empty kind="no-results" size="compact">
							<Empty.Title>No {noun} match</Empty.Title>
							<Empty.Description>
								{query.q === "" ? (
									"Nothing here fits this filter."
								) : (
									<>
										Nothing matches <Empty.Query>{query.q}</Empty.Query>.
									</>
								)}
							</Empty.Description>
							<Empty.Action>
								<LinkButton
									href={clearFiltersHref(query.url, cleared)}
									variant="outline"
									color="neutral"
									size="sm"
								>
									Clear filters
								</LinkButton>
							</Empty.Action>
						</Empty>
					)}
				</HeadingScope>
			</Table.Empty>
		);
	};
}

/** What a confirmed delete says it does when the record names nothing more specific. */
const DEFAULT_CONSEQUENCE = "is removed from the site. This can't be undone.";

/** Props accepted by {@link DeleteAction}. */
interface DeleteActionProps {
	/** Unique on the page; the confirm dialog's id is built from it. */
	id: string;
	/** The record's name as the author knows it, which the dialog repeats. */
	name: string;
	/** What the record is, lower case: "article". */
	noun: string;
	/** The destroy route's address. */
	action: string;
	/** Draws the trigger as a full button instead of a quiet row action. */
	prominent?: boolean;
	/** What deleting does, after the record's name. */
	consequence?: string;
}

/**
 * A delete the author confirms first, naming the record. It posts with `_method=DELETE`, the
 * override the router reads, since a form can only send GET or POST.
 */
export function DeleteAction(handle: Handle<DeleteActionProps>) {
	return () => {
		let { id, name, noun, action, prominent, consequence = DEFAULT_CONSEQUENCE } = handle.props;
		let dialog = `delete-${id}`;
		return (
			<>
				<Button
					type="button"
					commandfor={dialog}
					command="show-modal"
					variant={prominent ? "outline" : "ghost"}
					color="danger"
					size="sm"
				>
					{prominent ? <Trash2Icon size={16} aria-hidden="true" /> : null}
					Delete
				</Button>
				<Confirm
					id={dialog}
					title={`Delete this ${noun}?`}
					description={
						<>
							<strong>{name}</strong> {consequence}
						</>
					}
					confirmLabel={`Delete ${noun}`}
					cancelLabel="Cancel"
					color="danger"
					form={{
						action,
						method: "post",
						fields: <input type="hidden" name="_method" value="DELETE" />,
					}}
				/>
			</>
		);
	};
}
