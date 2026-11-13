/**
 * Delta's issues list: one query in GitHub's grammar (`is:open label:bug`) with Author, Labels
 * and Assignees facets beside it, Open and Closed tabs that count, two-line rows walked with
 * `j` and `k`, and a selection that turns the footer into a bulk bar.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import {
	CircleUserRoundIcon,
	CircleDotIcon,
	MessageSquareIcon,
	TagIcon,
	UserRoundIcon,
} from "@sdxc/icons";
import { iife } from "@sdxc/iife";
import { visuallyHidden } from "@sdxc/u/a11y";
import { raw } from "@sdxc/u/general";
import { HeadingScope, LabelChip, RelativeTime } from "@sdxc/ui";
import { Empty } from "@sdxc/ui/app/empty";
import { FilterBar } from "@sdxc/ui/app/filter-bar";
import { SelectionBar } from "@sdxc/ui/app/selection-bar";

import type { ListQuery } from "../query";
import type { IssueView } from "../records";
import type { RecordState } from "../states";

import { actionHref, issueHref } from "../data";
import { InitialsTile } from "../glyphs";
import { COPY, FILTER_LABELS, SELECTION_LABELS } from "../labels";
import { ListKeys } from "../list-keys";
import { DEFAULT_QUERY, matchesWords, parseQuery, withState, withoutState } from "../query";
import { findLabel, findMilestone, LABELS } from "../seed/issues";
import { ME, PEOPLE } from "../seed/people";
import { RepoHeader } from "../shell";
import { Avatar, StateIcon, nameOf } from "../states";

/** The id the bulk form, the row checkboxes and the bulk bar share. */
const BULK_FORM = "delta-issues-bulk";

/** The box the rows sit in, which the bulk bar and the row keys watch. */
const ROWS_ID = "delta-issue-rows";

/** The query field's id, which `/` focuses. */
const SEARCH_ID = "delta-issues-search";

/** The facets a list filters by beside its query, each one repeated parameter. */
export const FACETS = ["author", "label", "assignee"] as const;

/** One facet's parameter. */
export type Facet = (typeof FACETS)[number];

/** The orders the Sort menu offers. */
const SORTS = ["newest", "oldest", "comments", "updated"] as const;

/** The list's address with its query written out, so the field and tabs show what applies. */
export function listUrl(url: URL): URL {
	let next = new URL(url);
	if (!next.searchParams.has("q")) next.searchParams.set("q", DEFAULT_QUERY);
	next.searchParams.delete("toast");
	return next;
}

/** What the query and the facets read from an issue or a pull request. */
export interface ListRecord {
	number: number;
	title: string;
	author: string;
	state: "open" | "closed" | "merged";
	labels: readonly string[];
	assignees: readonly string[];
	milestone?: string;
}

/** Whether a label filter, by id or by name, names this label. */
function labelMatches(filter: string, id: string): boolean {
	let label = findLabel(id);
	let wanted = filter.toLowerCase();
	return id === wanted || label?.name.toLowerCase() === wanted;
}

/**
 * Whether an issue passes the query and the facets. A facet left out (`skip`) is not applied,
 * which is how each facet counts its own options.
 */
export function issueMatches(
	issue: ListRecord,
	query: ListQuery,
	facets: Record<Facet, string[]>,
	skip?: Facet,
): boolean {
	if (query.state === "open" && issue.state !== "open") return false;
	if (query.state === "closed" && issue.state === "open") return false;
	if (query.state === "merged" && issue.state !== "merged") return false;
	if (!query.labels.every((filter) => issue.labels.some((id) => labelMatches(filter, id))))
		return false;
	if (query.authors.length > 0 && !query.authors.includes(issue.author)) return false;
	if (!query.assignees.every((person) => issue.assignees.includes(person))) return false;
	if (query.missing.includes("assignee") && issue.assignees.length > 0) return false;
	if (query.missing.includes("label") && issue.labels.length > 0) return false;
	if (query.missing.includes("milestone") && issue.milestone !== undefined) return false;
	if (query.milestone !== undefined) {
		let milestone = findMilestone(issue.milestone);
		if (milestone?.title.toLowerCase() !== query.milestone.toLowerCase()) return false;
	}
	if (!matchesWords(query.words, issue.title, issue.number)) return false;
	if (skip !== "author" && facets.author.length > 0 && !facets.author.includes(issue.author)) {
		return false;
	}
	if (skip !== "label" && facets.label.length > 0) {
		if (!facets.label.some((id) => issue.labels.includes(id))) return false;
	}
	if (skip !== "assignee" && facets.assignee.length > 0) {
		let none = facets.assignee.includes("none") && issue.assignees.length === 0;
		if (!none && !facets.assignee.some((person) => issue.assignees.includes(person))) return false;
	}
	return true;
}

/** Orders issues as the address's `sort` asks, newest first by default. */
function sortIssues(issues: IssueView[], sort: string): IssueView[] {
	let sorted = [...issues];
	if (sort === "oldest") return sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
	if (sort === "comments")
		return sorted.sort((a, b) => b.comments - a.comments || b.number - a.number);
	if (sort === "updated") return sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
	return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** The facet values the address applies. */
export function readFacets(url: URL): Record<Facet, string[]> {
	return {
		author: url.searchParams.getAll("author"),
		label: url.searchParams.getAll("label"),
		assignee: url.searchParams.getAll("assignee"),
	};
}

namespace IssueRow {
	export interface Props {
		issue: IssueView;
		now: number;
	}
}

/**
 * One issue as a two-line row: its checkbox, its state, its title and labels, then its number,
 * author, age and milestone; assignees and the comment count sit at the end.
 */
function IssueRow(handle: Handle<IssueRow.Props>) {
	return () => {
		let { issue, now } = handle.props;
		let milestone = findMilestone(issue.milestone);
		let state: RecordState = issue.state === "open" ? "open" : (issue.reason ?? "completed");
		return (
			<li
				data-row=""
				data-issue={issue.number}
				id={`issue-${issue.number}`}
				mix={[
					raw({
						position: "relative",
						display: "grid",
						gridTemplateColumns: "2.25rem 1.25rem minmax(0, 1fr) auto",
						alignItems: "start",
						columnGap: "0.25rem",
						paddingBlock: "0.625rem",
						paddingInlineEnd: "1rem",
						borderBlockStart: "1px solid var(--ui-neutral-border)",
						"&:first-child": { borderBlockStart: 0 },
						"&:hover": { backgroundColor: "var(--ui-neutral-bg-tint-hover)" },
						"&:has(:checked)": {
							backgroundColor: "color-mix(in oklch, var(--ui-brand-bg-solid) 9%, transparent)",
						},
						"&:has(a[data-row-link]:focus-visible)": {
							boxShadow: "inset 0 0 0 2px var(--ui-brand-ring)",
						},
					}),
				]}
			>
				<label
					mix={[
						raw({
							display: "grid",
							placeItems: "center",
							alignSelf: "stretch",
							marginBlock: "-0.625rem",
							cursor: "pointer",
						}),
					]}
				>
					<input
						type="checkbox"
						name="ids"
						value={String(issue.number)}
						form={BULK_FORM}
						data-selection-item=""
						mix={[raw({ margin: 0, accentColor: "var(--ui-brand-bg-solid)" })]}
					/>
					<span mix={[visuallyHidden()]}>{COPY.issues.select(issue.number)}</span>
				</label>
				<span mix={[raw({ paddingBlockStart: "0.125rem" })]}>
					<StateIcon
						state={state}
						label={issue.state === "open" ? COPY.issues.open : COPY.issues.closed}
					/>
				</span>
				<div mix={[raw({ display: "grid", gap: "0.25rem", minInlineSize: 0 })]}>
					<div
						mix={[
							raw({
								display: "flex",
								flexWrap: "wrap",
								alignItems: "center",
								columnGap: "0.375rem",
								rowGap: "0.25rem",
							}),
						]}
					>
						<a
							href={issueHref(issue.number)}
							data-row-link=""
							data-rmx-prefetch="intent"
							mix={[
								raw({
									fontSize: "0.9375rem",
									lineHeight: "1.375rem",
									fontWeight: 600,
									color: "var(--ui-neutral-fg-emphasis)",
									textDecoration: "none",
									overflowWrap: "anywhere",
									outline: "none",
									"&:hover": { color: "var(--ui-brand-fg, inherit)", textDecoration: "underline" },
								}),
							]}
						>
							{issue.title}
						</a>
						{issue.labels.map((id) => {
							let label = findLabel(id);
							return label === undefined ? null : (
								<LabelChip color={label.color} title={label.description}>
									{label.name}
								</LabelChip>
							);
						})}
					</div>
					<span
						mix={[
							raw({
								fontSize: "0.75rem",
								lineHeight: "1.125rem",
								color: "var(--ui-neutral-fg-muted)",
								overflowWrap: "anywhere",
							}),
						]}
					>
						<span mix={[raw({ fontFamily: "var(--ui-font-mono)" })]}>{`#${issue.number}`}</span>
						{` · ${nameOf(issue.author)} ${COPY.issues.opened} `}
						<RelativeTime date={issue.createdAt} now={now} locale="en" />
						{milestone === undefined ? null : ` · ${milestone.title}`}
					</span>
				</div>
				<div
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							gap: "0.875rem",
							paddingBlockStart: "0.125rem",
							fontSize: "0.75rem",
							color: "var(--ui-neutral-fg-muted)",
						}),
					]}
				>
					{issue.assignees.length === 0 ? null : (
						<span
							title={COPY.issues.assignedTo(issue.assignees.map(nameOf).join(", "))}
							mix={[
								raw({
									display: "inline-flex",
									"& > [data-slot='delta-avatar'] + [data-slot='delta-avatar']": {
										marginInlineStart: "-0.375rem",
										boxShadow: "0 0 0 2px var(--ui-bg, Canvas)",
									},
									"@media (max-width: 40rem)": { display: "none" },
								}),
							]}
						>
							{issue.assignees.map((person) => (
								<Avatar handle={person} size={20} />
							))}
							<span mix={[visuallyHidden()]}>
								{COPY.issues.assignedTo(issue.assignees.map(nameOf).join(", "))}
							</span>
						</span>
					)}
					{issue.comments === 0 ? null : (
						<span
							mix={[
								raw({
									display: "inline-flex",
									alignItems: "center",
									gap: "0.25rem",
									fontVariantNumeric: "tabular-nums",
								}),
							]}
						>
							<MessageSquareIcon size={14} aria-hidden="true" />
							{String(issue.comments)}
							<span mix={[visuallyHidden()]}>{COPY.issues.comments(issue.comments)}</span>
						</span>
					)}
				</div>
			</li>
		);
	};
}

namespace IssuesScreen {
	export interface Props {
		issues: IssueView[];
		url: URL;
		now: number;
		commits: number;
	}
}

/**
 * Renders the list: the header, the toolbar, the rows in one bordered box and the bulk bar.
 * The query and the facets narrow the rows together, every facet counting its options against
 * the rest, and each tab counting its state.
 */
export function IssuesScreen(handle: Handle<IssuesScreen.Props>) {
	return () => {
		let { commits, issues, now } = handle.props;
		let url = listUrl(handle.props.url);
		let text = url.searchParams.get("q") ?? DEFAULT_QUERY;
		let query = parseQuery(text, ME);
		let facets = readFacets(url);
		let sort = url.searchParams.get("sort") ?? "newest";
		let rows = sortIssues(
			issues.filter((issue) => issueMatches(issue, query, facets)),
			sort,
		);
		let stateless = parseQuery(withoutState(text), ME);
		let count = (state: "open" | "closed") =>
			issues.filter((issue) => issue.state === state && issueMatches(issue, stateless, facets))
				.length;
		let tabHref = (state: "open" | "closed") => {
			let next = new URL(url);
			next.searchParams.set("q", withState(text, state));
			return `${next.pathname}${next.search}`;
		};
		let facetCount = (facet: Facet, test: (issue: IssueView) => boolean) =>
			issues.filter((issue) => issueMatches(issue, query, facets, facet) && test(issue)).length;
		let authors = PEOPLE.filter((person) => issues.some((issue) => issue.author === person.handle));
		let barFacets: FilterBar.Facet[] = [
			{
				name: "author",
				label: COPY.issues.author,
				icon: <UserRoundIcon size={16} />,
				options: authors.map((person) => ({
					value: person.handle,
					label: person.name,
					count: facetCount("author", (issue) => issue.author === person.handle),
					icon: <InitialsTile name={person.name} size={16} />,
				})),
			},
			{
				name: "label",
				label: COPY.issues.label,
				icon: <TagIcon size={16} />,
				options: LABELS.map((label) => ({
					value: label.id,
					label: label.name,
					count: facetCount("label", (issue) => issue.labels.includes(label.id)),
					icon: <LabelDot color={label.color} />,
				})),
			},
			{
				name: "assignee",
				label: COPY.issues.assignee,
				icon: <CircleUserRoundIcon size={16} />,
				options: [
					...PEOPLE.map((person) => ({
						value: person.handle,
						label: person.name,
						count: facetCount("assignee", (issue) => issue.assignees.includes(person.handle)),
						icon: <InitialsTile name={person.name} size={16} />,
					})),
					{
						value: "none",
						label: COPY.issues.noAssignee,
						count: facetCount("assignee", (issue) => issue.assignees.length === 0),
					},
				],
			},
		];
		let filtered =
			text.trim() !== DEFAULT_QUERY || FACETS.some((facet) => facets[facet].length > 0);
		let state = query.state === "closed" ? "closed" : "open";
		let emptyTitle = iife(() => {
			if (filtered) return COPY.issues.noneTitle;
			return state === "open" ? COPY.issues.emptyOpenTitle : COPY.issues.emptyClosedTitle;
		});

		return (
			<>
				<RepoHeader
					title={COPY.issues.title}
					trail={[{ label: COPY.issues.title }]}
					tab="issues"
					commits={commits}
				/>
				<HeadingScope level={2}>
					<div mix={[raw({ display: "grid", gap: "0.75rem", paddingBlockStart: "1rem" })]}>
						<FilterBar
							id="delta-issues"
							prefetch="intent"
							url={url}
							locale="en"
							tabs={[
								{
									label: COPY.issues.open,
									count: count("open"),
									href: tabHref("open"),
									current: query.state === "open",
								},
								{
									label: COPY.issues.closed,
									count: count("closed"),
									href: tabHref("closed"),
									current: query.state === "closed",
								},
							]}
							search={{
								id: SEARCH_ID,
								label: COPY.issues.search,
								placeholder: COPY.issues.placeholder,
							}}
							facets={barFacets}
							sort={{
								label: COPY.issues.sort,
								defaultValue: "newest",
								options: SORTS.map((value) => ({ value, label: SORT_LABELS[value] })),
							}}
							collapse
							labels={FILTER_LABELS}
							mix={[queryChips(filtered)]}
						/>
						<form
							id={BULK_FORM}
							method="post"
							action={`${actionHref("delta/issues")}${url.search}`}
							hidden
						>
							<input type="hidden" name="bulk" value="1" />
						</form>
						<section
							aria-label={COPY.issues.list}
							data-slot="delta-rows"
							mix={[
								raw({
									border: "1px solid var(--ui-neutral-border)",
									borderRadius: "var(--ui-radius-lg)",
									backgroundColor: "var(--ui-bg, Canvas)",
									overflow: "clip",
								}),
							]}
						>
							<ListKeys
								within='[data-slot="delta-rows"]'
								search={SEARCH_ID}
								labels={COPY.issues.keys}
							/>
							{rows.length === 0 ? (
								<div mix={[raw({ padding: "2.5rem 1rem" })]}>
									<Empty
										kind={filtered ? "no-results" : "cleared"}
										size="compact"
										icon={<CircleDotIcon />}
									>
										<Empty.Title>{emptyTitle}</Empty.Title>
										<Empty.Description>
											{filtered ? COPY.issues.noneHint : COPY.issues.emptyHint}
										</Empty.Description>
									</Empty>
								</div>
							) : (
								<ul id={ROWS_ID} mix={[raw({ listStyle: "none", margin: 0, padding: 0 })]}>
									{rows.map((issue) => (
										<IssueRow issue={issue} now={now} />
									))}
								</ul>
							)}
						</section>
						<SelectionBar
							target={ROWS_ID}
							form={BULK_FORM}
							locale="en"
							pagination={{ summary: COPY.issues.shown(rows.length) }}
							actions={[
								state === "open"
									? { label: COPY.issues.close, key: "shift+c", name: "intent", value: "close" }
									: { label: COPY.issues.reopen, key: "shift+o", name: "intent", value: "reopen" },
								{
									label: COPY.issues.assignMe,
									key: "shift+a",
									icon: <CircleUserRoundIcon size={16} />,
									name: "intent",
									value: "assign-me",
								},
							]}
							labels={SELECTION_LABELS}
						/>
					</div>
				</HeadingScope>
			</>
		);
	};
}

/**
 * Hides the chip the query field would add, since the field already reads it, and the chip
 * row itself until something narrows the list past the default query.
 */
export function queryChips(filtered: boolean) {
	return raw({
		"& [data-slot='filter-bar-chip'][data-name='q']": { display: "none" },
		"& [data-slot='filter-bar-chips']": filtered ? {} : { display: "none" },
	});
}

/** Each sort's name in the menu. */
const SORT_LABELS: Record<(typeof SORTS)[number], string> = {
	newest: COPY.issues.newest,
	oldest: COPY.issues.oldest,
	comments: COPY.issues.commented,
	updated: COPY.issues.updated,
};

/** A label's colour as a dot, for the Labels facet's options. */
export function LabelDot(handle: Handle<{ color: string }>) {
	return () => (
		<span
			aria-hidden="true"
			mix={[
				raw({
					display: "inline-block",
					inlineSize: "0.625rem",
					blockSize: "0.625rem",
					borderRadius: "999px",
					backgroundColor: handle.props.color,
				}),
			]}
		/>
	);
}
