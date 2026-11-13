/**
 * Cairn's issue list: issues grouped by status (or priority, assignee or project) as dense
 * rows, every filter, grouping, order and density in the address, a checkbox per row that
 * turns the footer into the bulk bar, and the open issue beside the list rather than over it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	CircleCheckIcon,
	CircleUserRoundIcon,
	SignalHighIcon,
	TriangleAlertIcon,
} from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { raw } from "@sdxc/u/general";
import { HeadingScope, LinkButton } from "@sdxc/ui";
import { clearFiltersHref, paramValues, setParamHref } from "@sdxc/ui/app";
import { Empty } from "@sdxc/ui/app/empty";
import { FilterBar } from "@sdxc/ui/app/filter-bar";
import { SelectionBar } from "@sdxc/ui/app/selection-bar";
import { SPLIT_VIEW_ITEM_ATTRIBUTE, SplitView } from "@sdxc/ui/app/split-view";
import { TAB_BAR_BLOCK_SIZE } from "@sdxc/ui/app/tab-bar";
import { ViewOptions } from "@sdxc/ui/app/view-options";
import { Frame } from "remix/component";

import { demoAppCookiePath } from "~/resources/views/demo-apps";
import { MainAnchor } from "~/resources/views/demo-apps/main-frame";

import type { PriorityId, StatusId } from "./data";
import type { IssueView, VisitorState } from "./state";

import { CurrentRow } from "./current-row";
import {
	LABELS,
	LOCALE,
	ME,
	PEOPLE,
	PRIORITIES,
	PRIORITY_NAMES,
	PROJECTS,
	STATUSES,
	STATUS_NAMES,
	editHref,
	findLabel,
	findPerson,
	findProject,
	priorityRank,
} from "./data";
import { IssueDetail } from "./detail";
import { LabelChip, PersonTile, PriorityIcon, ProjectGlyph, StatusIcon } from "./glyphs";
import { FILTER_LABELS, SELECTION_LABELS, SPLIT_LABELS, VIEW_LABELS } from "./labels";
import { ListKeys } from "./list-keys";
import { CairnShell, type ShellSection } from "./shell";

/** The cookie the list's width beside an open issue is remembered in. */
export const SPLIT_COOKIE = "cairn-split";

/**
 * The frame holding a list screen's view: the list and, beside it, the open issue. Filters,
 * grouping, a row opening its issue, an edit and Close reload it, and nothing outside it.
 */
export const VIEW_FRAME = "cairn-view";

/**
 * The frame inside {@link VIEW_FRAME} holding only the open issue, which a row opened beside
 * the list, Previous, Next and a comment reload.
 */
export const ISSUE_FRAME = "cairn-issue";

/**
 * The address a screen's frames load from: the screen's own path and query, without the toast
 * parameter, so the page route answers each frame by its name.
 */
export function frameSrc(url: URL): string {
	let next = new URL(url);
	next.searchParams.delete("toast");
	return `${next.pathname}${next.search}`;
}

/** The id the bulk form, the row checkboxes and the bulk bar share. */
const BULK_FORM = "cairn-bulk";

/**
 * The width of the column a row's checkbox is centered in. A group heading centers its glyph in
 * the same width, so glyphs and checkboxes share one axis and the heading's text starts where a
 * row's first glyph does.
 */
const CHECK_COLUMN = "2.25rem";

/** How rows can be grouped. */
const GROUPINGS = ["status", "priority", "assignee", "project", "none"] as const;

/** How rows can be ordered inside a group. */
const ORDERINGS = ["priority", "updated", "created"] as const;

/** Every parameter the toolbar's filters own, which "Clear filters" drops. */
const FILTER_PARAMS = ["status", "priority", "assignee", "label", "project", "q"] as const;

/** The list's state as the address holds it. */
export interface ListQuery {
	status: StatusId[];
	priority: PriorityId[];
	assignee: string[];
	label: string[];
	project: string[];
	q: string;
	group: (typeof GROUPINGS)[number];
	order: (typeof ORDERINGS)[number];
	density: "compact" | "comfortable";
}

/** Picks a parameter's value when it is one of `options`, else `fallback`. */
function pick<T extends string>(url: URL, name: string, options: readonly T[], fallback: T): T {
	let value = url.searchParams.get(name);
	return options.find((option) => option === value) ?? fallback;
}

/**
 * Reads the list's state from the address, ignoring values the toolbar never offers, so a
 * hand-edited link still renders a real view.
 *
 * @param url The request's address.
 */
export function readListQuery(url: URL): ListQuery {
	return {
		status: paramValues(url, "status").filter((value): value is StatusId =>
			STATUSES.includes(value as StatusId),
		),
		priority: paramValues(url, "priority")
			.map(Number)
			.filter((value): value is PriorityId => PRIORITIES.includes(value as PriorityId)),
		assignee: paramValues(url, "assignee").filter(
			(value) => value === "none" || PEOPLE.some((person) => person.id === value),
		),
		label: paramValues(url, "label").filter((value) => findLabel(value) !== undefined),
		project: paramValues(url, "project").filter(
			(value) => value === "none" || findProject(value) !== undefined,
		),
		q: (url.searchParams.get("q") ?? "").trim().toLowerCase(),
		group: pick(url, "group", GROUPINGS, "status"),
		order: pick(url, "order", ORDERINGS, "priority"),
		density: pick(url, "density", ["compact", "comfortable"] as const, "compact"),
	};
}

/** The facets a query filters on, each of which can count while leaving itself out. */
type Facet = "status" | "priority" | "assignee" | "label" | "project";

/** Whether an issue passes the query, leaving out one facet so that facet can count. */
function matches(issue: IssueView, query: ListQuery, skip?: Facet): boolean {
	if (skip !== "status" && query.status.length > 0 && !query.status.includes(issue.status)) {
		return false;
	}
	if (
		skip !== "priority" &&
		query.priority.length > 0 &&
		!query.priority.includes(issue.priority)
	) {
		return false;
	}
	if (skip !== "assignee" && query.assignee.length > 0) {
		if (!query.assignee.includes(issue.assignee ?? "none")) return false;
	}
	if (skip !== "label" && query.label.length > 0) {
		if (!query.label.some((label) => issue.labels.includes(label))) return false;
	}
	if (skip !== "project" && query.project.length > 0) {
		if (!query.project.includes(issue.project ?? "none")) return false;
	}
	if (query.q !== "") {
		let haystack = `${issue.id} ${issue.title}`.toLowerCase();
		if (!haystack.includes(query.q)) return false;
	}
	return true;
}

/** Orders rows: by priority then id, most recently updated, or newest first. */
function compare(order: ListQuery["order"]): (a: IssueView, b: IssueView) => number {
	if (order === "updated") return (a, b) => b.updatedAt.localeCompare(a.updatedAt);
	if (order === "created") return (a, b) => b.createdAt.localeCompare(a.createdAt);
	return (a, b) =>
		priorityRank(a.priority) - priorityRank(b.priority) ||
		a.id.localeCompare(b.id, "en", { numeric: true });
}

/** One group of rows, with its heading's glyph. */
interface Group {
	key: string;
	title: string;
	icon: RemixNode;
	issues: IssueView[];
}

/**
 * Splits the rows into groups in the grouping's natural order, leaving out empty groups so
 * the list never shows a heading over nothing.
 */
export function groupIssues(issues: IssueView[], query: ListQuery): Group[] {
	let sorted = [...issues].sort(compare(query.order));
	let build = (
		key: string,
		title: string,
		icon: RemixNode,
		test: (issue: IssueView) => boolean,
	) => ({
		key,
		title,
		icon,
		issues: sorted.filter(test),
	});
	let groups: Group[];
	if (query.group === "status") {
		groups = STATUSES.map((status) =>
			build(
				status,
				STATUS_NAMES[status],
				<StatusIcon status={status} />,
				(issue) => issue.status === status,
			),
		);
	} else if (query.group === "priority") {
		groups = [1, 2, 3, 4, 0].map((priority) =>
			build(
				String(priority),
				PRIORITY_NAMES[priority as PriorityId],
				<PriorityIcon priority={priority as PriorityId} />,
				(issue) => issue.priority === priority,
			),
		);
	} else if (query.group === "assignee") {
		groups = [
			...PEOPLE.map((person) =>
				build(
					person.id,
					person.name,
					<PersonTile person={person} size={16} decorative />,
					(issue) => issue.assignee === person.id,
				),
			),
			build(
				"none",
				"No assignee",
				<PersonTile person={undefined} size={16} decorative />,
				(issue) => !issue.assignee,
			),
		];
	} else if (query.group === "project") {
		groups = [
			...PROJECTS.map((project) =>
				build(
					project.id,
					project.name,
					<ProjectGlyph hue={project.hue} />,
					(issue) => issue.project === project.id,
				),
			),
			build("none", "No project", <ProjectGlyph hue={0} />, (issue) => !issue.project),
		];
	} else {
		groups = [build("all", "All issues", <CircleCheckIcon />, () => true)];
	}
	return groups.filter((group) => group.issues.length > 0);
}

/** The scope a list screen shows before any filter: a team, a view, a project, or one person. */
export interface ListScope {
	/** The page path the list lives at, such as `team/web`. */
	page: string;
	title: string;
	description: string;
	section: ShellSection;
	/** The team a new issue made from this list starts in. */
	team?: string;
	/** Hides a facet the scope already fixes, such as Project on a project's page. */
	hide?: Facet[];
	/** Which of the visitor's issues belong. */
	includes: (issue: IssueView) => boolean;
	/** Drawn above the toolbar, such as a project's progress. */
	header?: RemixNode;
}

/** The address without the toast and the open issue, which every row and filter link builds on. */
export function listUrl(url: URL): URL {
	let clean = new URL(url);
	clean.searchParams.delete("toast");
	return clean;
}

/** The page path a row action returns to: this list with its filters, keeping the open issue. */
export function returnPage(scope: ListScope, url: URL): string {
	let search = listUrl(url).searchParams.toString();
	return search === "" ? scope.page : `${scope.page}?${search}`;
}

/** Formats a short date for a row's last column. */
const SHORT_DATE = new Intl.DateTimeFormat(LOCALE, {
	month: "short",
	day: "numeric",
	timeZone: "UTC",
});

/** One issue row: checkbox, then the link holding priority, id, state, title and its meta. */
function IssueRow(
	handle: Handle<{ issue: IssueView; href: string; open: boolean; split: boolean }>,
) {
	return () => {
		let { issue, open, split } = handle.props;
		let assignee = findPerson(issue.assignee);
		let project = findProject(issue.project);
		return (
			<li
				data-issue={issue.id}
				id={`issue-${issue.id}`}
				mix={[
					raw({
						position: "relative",
						display: "flex",
						alignItems: "center",
						borderBlockEnd: "1px solid var(--ui-neutral-border-subtle, var(--ui-neutral-border))",
						"&:has(:checked)": {
							backgroundColor: "color-mix(in oklch, var(--ui-brand-bg-solid) 8%, transparent)",
						},
						"&:has([aria-current='page'])": {
							backgroundColor: "color-mix(in oklch, var(--ui-brand-bg-solid) 12%, transparent)",
						},
						"&:hover": {
							backgroundColor: "var(--ui-neutral-bg-tint-hover)",
						},
					}),
				]}
			>
				<label
					mix={[
						raw({
							display: "grid",
							placeItems: "center",
							flex: `0 0 ${CHECK_COLUMN}`,
							alignSelf: "stretch",
							cursor: "pointer",
						}),
					]}
				>
					<input
						type="checkbox"
						name="ids"
						value={issue.id}
						form={BULK_FORM}
						data-selection-item
						mix={[raw({ margin: "0", accentColor: "var(--ui-brand-bg-solid)" })]}
					/>
					<span mix={[visuallyHidden()]}>{`Select ${issue.id}`}</span>
				</label>
				<a
					href={handle.props.href}
					data-rmx-target={split ? ISSUE_FRAME : VIEW_FRAME}
					data-issue-link
					data-rmx-prefetch="intent"
					aria-current={open ? "page" : undefined}
					{...(split ? { [SPLIT_VIEW_ITEM_ATTRIBUTE]: "" } : {})}
					mix={[
						raw({
							flex: "1 1 auto",
							minInlineSize: 0,
							display: "grid",
							gridTemplateColumns: "auto 4.25rem auto minmax(0, 1fr) auto",
							gridTemplateAreas: '"priority id status title meta"',
							alignItems: "center",
							columnGap: "0.625rem",
							rowGap: "0.125rem",
							minBlockSize: "var(--cairn-row-height, 2.375rem)",
							paddingInlineEnd: "0.75rem",
							color: "var(--ui-neutral-fg-emphasis)",
							textDecoration: "none",
							outline: "none",
							"&:focus-visible": { boxShadow: "inset 0 0 0 2px var(--ui-brand-ring)" },
							"@container cairn-list (width < 36rem)": {
								gridTemplateColumns: "auto auto minmax(0, 1fr) auto",
								gridTemplateAreas: '"status title title meta" "priority id id meta"',
								paddingBlock: "0.5rem",
							},
						}),
					]}
				>
					<span mix={[raw({ gridArea: "priority", display: "inline-flex" })]}>
						<PriorityIcon priority={issue.priority} label />
					</span>
					<span
						mix={[
							raw({
								gridArea: "id",
								fontFamily: "var(--ui-font-mono)",
								fontSize: "0.75rem",
								color: "var(--ui-neutral-fg-muted)",
								whiteSpace: "nowrap",
							}),
						]}
					>
						{issue.id}
					</span>
					<span mix={[raw({ gridArea: "status", display: "inline-flex" })]}>
						<StatusIcon status={issue.status} label />
					</span>
					<span
						mix={[
							raw({
								gridArea: "title",
								minInlineSize: 0,
								fontSize: "0.875rem",
								lineHeight: "1.25rem",
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
								"@container cairn-list (width < 36rem)": { whiteSpace: "normal" },
							}),
						]}
					>
						{issue.title}
					</span>
					<span
						mix={[
							raw({
								gridArea: "meta",
								display: "flex",
								alignItems: "center",
								gap: "0.5rem",
								fontSize: "0.75rem",
								color: "var(--ui-neutral-fg-muted)",
							}),
						]}
					>
						<span
							mix={[
								raw({
									display: "flex",
									gap: "0.25rem",
									"@container cairn-list (width < 48rem)": { display: "none" },
								}),
							]}
						>
							{issue.labels.map((id) => {
								let label = findLabel(id);
								return label ? <LabelChip label={label} /> : null;
							})}
						</span>
						{project ? (
							<span
								mix={[
									raw({
										display: "inline-flex",
										alignItems: "center",
										gap: "0.25rem",
										maxInlineSize: "9rem",
										whiteSpace: "nowrap",
										overflow: "hidden",
										textOverflow: "ellipsis",
										"@container cairn-list (width < 60rem)": { display: "none" },
									}),
								]}
							>
								<ProjectGlyph hue={project.hue} size={12} />
								{project.name}
							</span>
						) : null}
						{issue.estimate === undefined ? null : (
							<span
								title={`${issue.estimate} points`}
								mix={[
									raw({
										minInlineSize: "1.25rem",
										textAlign: "end",
										fontFamily: "var(--ui-font-mono)",
										fontVariantNumeric: "tabular-nums",
										"@container cairn-list (width < 36rem)": { display: "none" },
									}),
								]}
							>
								<span mix={[visuallyHidden()]}>Estimate </span>
								{issue.estimate}
							</span>
						)}
						<span
							mix={[
								raw({
									minInlineSize: "3rem",
									textAlign: "end",
									whiteSpace: "nowrap",
									"@container cairn-list (width < 48rem)": { display: "none" },
								}),
							]}
						>
							{SHORT_DATE.format(new Date(issue.updatedAt))}
						</span>
						<PersonTile person={assignee} />
					</span>
				</a>
			</li>
		);
	};
}

/** The rows, group by group, each group's heading sticky over its rows with its count. */
function GroupedRows(
	handle: Handle<{ groups: Group[]; url: URL; open: string | null; split: boolean }>,
) {
	return () => {
		let { groups, url, open, split } = handle.props;
		return (
			<div>
				{groups.map((group) => (
					<section aria-labelledby={`group-${group.key}`} data-group={group.key}>
						<h3
							id={`group-${group.key}`}
							mix={[
								raw({
									position: "sticky",
									insetBlockStart: "0",
									zIndex: "1",
									display: "flex",
									alignItems: "center",
									margin: "0",
									blockSize: "2.25rem",
									paddingInlineEnd: "0.875rem",
									fontSize: "0.8125rem",
									fontWeight: "600",
									color: "var(--ui-neutral-fg-emphasis)",
									backgroundColor: "var(--ui-neutral-bg-tint)",
									borderBlockEnd: "1px solid var(--ui-neutral-border)",
								}),
							]}
						>
							<span
								aria-hidden="true"
								data-slot="group-glyph"
								mix={[
									raw({
										display: "inline-flex",
										justifyContent: "center",
										flex: `0 0 ${CHECK_COLUMN}`,
									}),
								]}
							>
								{group.icon}
							</span>
							{group.title}
							<span
								mix={[
									raw({
										marginInlineStart: "0.5rem",
										fontWeight: "400",
										color: "var(--ui-neutral-fg-muted)",
									}),
								]}
							>
								{group.issues.length}
							</span>
						</h3>
						<ul mix={[raw({ margin: "0", padding: "0", listStyle: "none" })]}>
							{group.issues.map((issue) => (
								<IssueRow
									issue={issue}
									href={setParamHref(url, "issue", issue.id)}
									open={issue.id === open}
									split={split}
								/>
							))}
						</ul>
					</section>
				))}
			</div>
		);
	};
}

namespace IssueList {
	export interface Props {
		scope: ListScope;
		state: VisitorState;
		url: URL;
		/** The rows to show, already narrowed to the scope; filtered here. */
		issues: IssueView[];
		/** Whether rows open beside the list in a split. */
		split: boolean;
	}
}

/** The list pane: the title, the toolbar, the rows and the bulk bar. */
function IssueList(handle: Handle<IssueList.Props>) {
	return () => {
		let { scope, url, issues, split } = handle.props;
		let query = readListQuery(url);
		let rows = issues.filter((issue) => matches(issue, query));
		let groups = groupIssues(rows, query);
		let open = url.searchParams.get("issue");
		let without = (facet: Facet) => issues.filter((issue) => matches(issue, query, facet));
		let count = (facet: Facet, test: (issue: IssueView) => boolean) =>
			without(facet).filter(test).length;
		let hidden = new Set(scope.hide ?? []);
		let facets: FilterBar.Facet[] = [
			{
				name: "status",
				label: "Status",
				options: STATUSES.map((status) => ({
					value: status,
					label: STATUS_NAMES[status],
					count: count("status", (issue) => issue.status === status),
					icon: <StatusIcon status={status} />,
				})),
			},
			{
				name: "priority",
				label: "Priority",
				icon: <SignalHighIcon />,
				options: PRIORITIES.map((priority) => ({
					value: String(priority),
					label: PRIORITY_NAMES[priority],
					count: count("priority", (issue) => issue.priority === priority),
					icon: <PriorityIcon priority={priority} />,
				})),
			},
			{
				name: "assignee",
				label: "Assignee",
				icon: <CircleUserRoundIcon />,
				options: [
					...PEOPLE.map((person) => ({
						value: person.id,
						label: person.id === ME ? "My issues" : person.name,
						count: count("assignee", (issue) => issue.assignee === person.id),
						icon: <PersonTile person={person} size={16} decorative />,
					})),
					{
						value: "none",
						label: "No assignee",
						count: count("assignee", (issue) => !issue.assignee),
					},
				],
			},
			{
				name: "label",
				label: "Label",
				options: LABELS.map((label) => ({
					value: label.id,
					label: label.name,
					count: count("label", (issue) => issue.labels.includes(label.id)),
				})),
			},
			{
				name: "project",
				label: "Project",
				options: PROJECTS.map((project) => ({
					value: project.id,
					label: project.name,
					count: count("project", (issue) => issue.project === project.id),
					icon: <ProjectGlyph hue={project.hue} />,
				})).filter((option) => option.count > 0),
			},
		].filter((facet) => !hidden.has(facet.name as Facet));

		return (
			<div
				mix={[
					raw({
						container: "cairn-list / inline-size",
						display: "flex",
						flexDirection: "column",
						flex: "1 1 auto",
						blockSize: "100%",
						minBlockSize: 0,
						"--cairn-row-height": query.density === "comfortable" ? "2.875rem" : "2.375rem",
					}),
				]}
			>
				<header
					mix={[
						raw({
							display: "flex",
							flexDirection: "column",
							gap: "0.75rem",
							padding: "1rem 1rem 0.75rem",
						}),
					]}
				>
					<div mix={[raw({ display: "flex", flexDirection: "column", gap: "0.125rem" })]}>
						<h1
							mix={[
								raw({
									margin: "0",
									fontSize: "1.125rem",
									lineHeight: "1.5rem",
									fontWeight: "600",
									color: "var(--ui-neutral-fg-emphasis)",
								}),
							]}
						>
							{scope.title}
						</h1>
						<p
							mix={[
								raw({ margin: "0", fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" }),
							]}
						>
							{`${rows.length} of ${issues.length} issues · ${scope.description}`}
						</p>
					</div>
					{scope.header}
					<HeadingScope level={2}>
						<FilterBar
							prefetch="intent"
							target={VIEW_FRAME}
							id="cairn-issues"
							url={listUrl(url)}
							locale={LOCALE}
							facets={facets}
							search={{ label: "Search issues", placeholder: "Search by title or id" }}
							options={
								<ViewOptions
									id="cairn-view"
									url={listUrl(url)}
									target={VIEW_FRAME}
									inline
									grouping={{
										defaultValue: "status",
										options: [
											{ value: "status", label: "Status" },
											{ value: "priority", label: "Priority" },
											{ value: "assignee", label: "Assignee" },
											{ value: "project", label: "Project" },
											{ value: "none", label: "No grouping" },
										],
									}}
									ordering={{
										defaultValue: "priority",
										options: [
											{ value: "priority", label: "Priority" },
											{ value: "updated", label: "Last updated" },
											{ value: "created", label: "Newest" },
										],
									}}
									density={{
										defaultValue: "compact",
										options: [
											{ value: "compact", label: "Compact" },
											{ value: "comfortable", label: "Comfortable" },
										],
									}}
									labels={VIEW_LABELS}
								/>
							}
							collapse
							labels={FILTER_LABELS}
						/>
					</HeadingScope>
				</header>
				<form
					id={BULK_FORM}
					method="post"
					action={editHref(returnPage(handle.props.scope, url))}
					hidden
				>
					<input type="hidden" name="bulk" value="1" />
				</form>
				<div
					id="cairn-rows"
					data-slot="cairn-list"
					mix={[
						raw({
							flex: "1 1 auto",
							minBlockSize: 0,
							overflowY: "auto",
							overscrollBehaviorY: "contain",
							borderBlockStart: "1px solid var(--ui-neutral-border)",
						}),
					]}
				>
					{split ? null : <ListKeys />}
					{groups.length === 0 ? (
						<HeadingScope level={2} mix={[raw({ padding: "2rem 1rem" })]}>
							<Empty kind={issues.length === 0 ? "cleared" : "no-results"} size="compact">
								<Empty.Title>
									{issues.length === 0 ? "Nothing here" : "No issues match"}
								</Empty.Title>
								{query.q === "" ? null : <Empty.Query>{query.q}</Empty.Query>}
								<Empty.Description>
									{issues.length === 0
										? "When an issue lands in this list, it shows up here."
										: "Try fewer filters, or search for an id like WEB-140."}
								</Empty.Description>
								{issues.length === 0 ? null : (
									<Empty.Action>
										<LinkButton
											href={clearFiltersHref(listUrl(url), FILTER_PARAMS)}
											data-rmx-target={VIEW_FRAME}
											size="sm"
											variant="outline"
											color="neutral"
										>
											Clear filters
										</LinkButton>
									</Empty.Action>
								)}
							</Empty>
						</HeadingScope>
					) : (
						<HeadingScope level={2}>
							<GroupedRows groups={groups} url={listUrl(url)} open={open} split={split} />
						</HeadingScope>
					)}
				</div>
				<SelectionBar
					target="cairn-rows"
					form={BULK_FORM}
					locale={LOCALE}
					pagination={{ summary: `${rows.length} issues` }}
					mix={[raw({ paddingInline: "1rem" })]}
					actions={[
						{
							label: "Start",
							key: "shift+s",
							icon: <StatusIcon status="started" />,
							name: "intent",
							value: "status-started",
						},
						{
							label: "Mark done",
							key: "shift+d",
							icon: <StatusIcon status="done" />,
							name: "intent",
							value: "status-done",
						},
						{
							label: "Assign to me",
							key: "shift+i",
							icon: <CircleUserRoundIcon size={16} />,
							name: "intent",
							value: "assign-me",
						},
						{
							label: "Mark urgent",
							key: "shift+u",
							icon: <TriangleAlertIcon size={16} />,
							name: "intent",
							value: "priority-1",
						},
					]}
					labels={SELECTION_LABELS}
				/>
			</div>
		);
	};
}

namespace IssueListScreen {
	export interface Props {
		scope: ListScope;
		state: VisitorState;
		url: URL;
		collapsed: boolean;
	}
}

/**
 * Renders a list screen: the shell, and the view inside it as {@link VIEW_FRAME}, loaded from
 * this same address. Everything the view does reloads that frame, so the sidebar, top bar,
 * command menu and dialogs stay as they are.
 */
export function IssueListScreen(handle: Handle<IssueListScreen.Props>) {
	return () => {
		let { scope, state, url, collapsed } = handle.props;
		return (
			<CairnShell
				current={scope.section}
				collapsed={collapsed}
				crumb={scope.title}
				state={state}
				team={scope.team}
				from={returnPage(scope, url)}
				flush
				fill
			>
				<Frame name={VIEW_FRAME} src={frameSrc(url)} />
			</CairnShell>
		);
	};
}

namespace ListView {
	export interface Props {
		scope: ListScope;
		state: VisitorState;
		url: URL;
		layout?: SplitView.Layout;
		issues: IssueView[];
	}
}

/**
 * The content of {@link VIEW_FRAME}. Without an open issue the list takes the whole card; with
 * one, the list and the issue split the card, each scrolling on its own, and a phone shows one
 * pane per address with a link back to the list. The issue is its own {@link ISSUE_FRAME}.
 */
export function ListView(handle: Handle<ListView.Props>) {
	return () => {
		let { scope, state, url, layout, issues } = handle.props;
		let openId = url.searchParams.get("issue");
		let open = openId === null ? undefined : issues.find((issue) => issue.id === openId);
		let list = (
			<IssueList scope={scope} state={state} url={url} issues={issues} split={open !== undefined} />
		);

		if (open === undefined) {
			return (
				<div
					mix={[
						raw({
							display: "flex",
							flexDirection: "column",
							flex: "1 1 auto",
							minBlockSize: `calc(100dvh - var(--ui-app-header-height, 3.5rem) - ${TAB_BAR_BLOCK_SIZE})`,
							"@media (min-width: 48rem)": {
								minBlockSize: "calc(100dvh - var(--ui-app-header-height, 3.5rem))",
							},
							"@media (min-width: 64rem)": { minBlockSize: 0 },
						}),
					]}
				>
					{list}
				</div>
			);
		}
		return (
			<div
				mix={[
					raw({
						blockSize: `calc(100dvh - var(--ui-app-header-height, 3.5rem) - ${TAB_BAR_BLOCK_SIZE})`,
						"@media (min-width: 48rem)": {
							blockSize:
								"calc(100dvh - var(--ui-app-header-height, 3.5rem) - 2 * var(--ui-app-inset-gap, 0.5rem) - 2px)",
						},
					}),
				]}
			>
				<CurrentRow />
				<SplitView
					cookiePath={demoAppCookiePath("cairn")}
					id="cairn-split"
					data-rmx-preserve-attrs="style data-collapsed"
					list={list}
					detail={<Frame name={ISSUE_FRAME} src={frameSrc(url)} />}
					active="detail"
					backHref={setParamHref(listUrl(url), "issue", null)}
					layout={layout}
					cookie={SPLIT_COOKIE}
					labels={SPLIT_LABELS}
				/>
			</div>
		);
	};
}

namespace OpenIssue {
	export interface Props {
		scope: ListScope;
		state: VisitorState;
		url: URL;
		issues: IssueView[];
	}
}

/**
 * The content of {@link ISSUE_FRAME}: the issue the address opens, with where it sits in the
 * filtered list for Previous and Next. Draws nothing when the address opens no issue in scope.
 */
export function OpenIssue(handle: Handle<OpenIssue.Props>) {
	return () => {
		let { scope, state, url, issues } = handle.props;
		let openId = url.searchParams.get("issue");
		let open = openId === null ? undefined : issues.find((issue) => issue.id === openId);
		if (open === undefined) return null;
		let query = readListQuery(url);
		let ordered = groupIssues(
			issues.filter((issue) => matches(issue, query)),
			query,
		).flatMap((group) => group.issues);
		let index = ordered.findIndex((issue) => issue.id === open.id);
		let step = (id: string | undefined) =>
			id === undefined ? null : setParamHref(listUrl(url), "issue", id);
		return (
			<>
				<MainAnchor url={url} />
				<IssueDetail
					issue={open}
					state={state}
					returnTo={returnPage(scope, url)}
					level={2}
					closeHref={setParamHref(listUrl(url), "issue", null)}
					frames={{ view: VIEW_FRAME, issue: ISSUE_FRAME }}
					position={{
						index: index + 1,
						total: ordered.length,
						previousHref: index > 0 ? step(ordered[index - 1]?.id) : null,
						nextHref: index >= 0 ? step(ordered[index + 1]?.id) : null,
					}}
				/>
			</>
		);
	};
}
