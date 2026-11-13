/**
 * Delta's pull requests list: the same query grammar as issues (`is:open`, `is:merged`,
 * `review:approved`, `author:mara`) with Author, Labels and Assignees facets, Open and Closed
 * tabs that count, and two-line rows that say where each review and its checks stand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import {
	CircleUserRoundIcon,
	GitPullRequestIcon,
	MessageSquareIcon,
	TagIcon,
	UserRoundIcon,
} from "@sdxc/icons";
import { iife } from "@sdxc/iife";
import { visuallyHidden } from "@sdxc/u/a11y";
import { raw } from "@sdxc/u/general";
import { HeadingScope, LabelChip, LinkButton, RelativeTime } from "@sdxc/ui";
import { CheckRunIcon } from "@sdxc/ui/app/check-runs";
import { Empty } from "@sdxc/ui/app/empty";
import { FilterBar } from "@sdxc/ui/app/filter-bar";

import type { PullView } from "../pull-records";
import type { ListQuery } from "../query";

import { pullHref, pullsHref } from "../data";
import { InitialsTile } from "../glyphs";
import { COPY, FILTER_LABELS } from "../labels";
import { ListKeys } from "../list-keys";
import { checksState } from "../pull-records";
import { DEFAULT_QUERY, parseQuery, withState, withoutState } from "../query";
import { LABELS, findLabel, findMilestone } from "../seed/issues";
import { ME, PEOPLE } from "../seed/people";
import { RepoHeader } from "../shell";
import { nameOf, StateIcon } from "../states";

import type { Facet } from "./issues";

import { FACETS, LabelDot, issueMatches, listUrl, queryChips, readFacets } from "./issues";
import { pullState } from "./pull-parts";

/** The query field's id, which `/` focuses. */
const SEARCH_ID = "delta-pulls-search";

/** Where a pull request's reviews stand, as its row says it. */
function reviewWord(pull: PullView): string | undefined {
	if (pull.state !== "open") return undefined;
	if (pull.reviewers.some((reviewer) => reviewer.state === "changes")) return COPY.pulls.changes;
	if (pull.reviewers.some((reviewer) => reviewer.state === "approved")) return COPY.pulls.approved;
	return COPY.pulls.required;
}

/** Whether a pull request passes the query's review qualifier, `review:approved` and the like. */
function reviewMatches(pull: PullView, query: ListQuery): boolean {
	if (query.review === undefined) return true;
	let word = reviewWord(pull);
	if (query.review === "approved") return word === COPY.pulls.approved;
	if (query.review === "changes_requested") return word === COPY.pulls.changes;
	return word === COPY.pulls.required;
}

/** Whether a pull request passes the query, its review qualifier and the facets. */
function pullMatches(
	pull: PullView,
	query: ListQuery,
	facets: Record<Facet, string[]>,
	skip?: Facet,
): boolean {
	if (query.draft === true && !pull.draft) return false;
	return reviewMatches(pull, query) && issueMatches(pull, query, facets, skip);
}

namespace PullRow {
	export interface Props {
		pull: PullView;
		now: number;
	}
}

/**
 * One pull request as a two-line row: its state, title and labels, then its number, author,
 * age and where its review stands; its checks and comment count sit at the end.
 */
function PullRow(handle: Handle<PullRow.Props>) {
	return () => {
		let { now, pull } = handle.props;
		let checks = checksState(pull.checks);
		let review = reviewWord(pull);
		let milestone = findMilestone(pull.milestone);
		let comments =
			pull.comments + pull.threads.reduce((sum, thread) => sum + thread.comments.length, 0);
		return (
			<li
				data-row=""
				data-pull={pull.number}
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "1.25rem minmax(0, 1fr) auto",
						alignItems: "start",
						columnGap: "0.5rem",
						padding: "0.625rem 1rem",
						borderBlockStart: "1px solid var(--ui-neutral-border)",
						"&:first-child": { borderBlockStart: 0 },
						"&:hover": { backgroundColor: "var(--ui-neutral-bg-tint-hover)" },
						"&:has(a[data-row-link]:focus-visible)": {
							boxShadow: "inset 0 0 0 2px var(--ui-brand-ring)",
						},
					}),
				]}
			>
				<span mix={[raw({ paddingBlockStart: "0.125rem" })]}>
					<StateIcon state={pullState(pull)} label={STATE_NAMES[pullState(pull)] ?? ""} />
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
							href={pullHref(pull.number)}
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
									"&:hover": { textDecoration: "underline" },
								}),
							]}
						>
							{pull.title}
						</a>
						{pull.labels.map((id) => {
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
						<span mix={[raw({ fontFamily: "var(--ui-font-mono)" })]}>{`#${pull.number}`}</span>
						{iife(() => {
							if (pull.state === "merged" && pull.settled !== undefined) {
								return (
									<>
										{` · ${nameOf(pull.author)} · ${COPY.pull.merged.toLowerCase()} `}
										<RelativeTime date={pull.settled.at} now={now} locale="en" />
									</>
								);
							}
							return (
								<>
									{` · ${nameOf(pull.author)} ${COPY.pulls.opened} `}
									<RelativeTime date={pull.createdAt} now={now} locale="en" />
								</>
							);
						})}
						{review === undefined ? null : ` · ${review}`}
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
					<span title={COPY.pulls.checks[checks]} mix={[raw({ display: "inline-flex" })]}>
						<CheckRunIcon state={checks} label={COPY.pulls.checks[checks]} />
					</span>
					{comments === 0 ? null : (
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
							{String(comments)}
							<span mix={[visuallyHidden()]}>{COPY.issues.comments(comments)}</span>
						</span>
					)}
				</div>
			</li>
		);
	};
}

/** Each state's name for assistive technology. */
const STATE_NAMES: Partial<Record<ReturnType<typeof pullState>, string>> = {
	"pr-open": "Open pull request",
	draft: "Draft pull request",
	merged: "Merged pull request",
	"pr-closed": "Closed pull request",
};

namespace PullsScreen {
	export interface Props {
		pulls: PullView[];
		url: URL;
		now: number;
		commits: number;
	}
}

/**
 * Renders the list: the header, the toolbar and the rows in one bordered box. The query and
 * the facets narrow the rows together, and each tab counts its state.
 */
export function PullsScreen(handle: Handle<PullsScreen.Props>) {
	return () => {
		let { commits, now, pulls } = handle.props;
		let url = listUrl(handle.props.url);
		let text = url.searchParams.get("q") ?? DEFAULT_QUERY;
		let query = parseQuery(text, ME);
		let facets = readFacets(url);
		let rows = pulls
			.filter((pull) => pullMatches(pull, query, facets))
			.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
		let stateless = parseQuery(withoutState(text), ME);
		let count = (open: boolean) =>
			pulls.filter(
				(pull) => (pull.state === "open") === open && pullMatches(pull, stateless, facets),
			).length;
		let tabHref = (state: "open" | "closed") => {
			let next = new URL(url);
			next.searchParams.set("q", withState(text, state));
			return `${next.pathname}${next.search}`;
		};
		let facetCount = (facet: Facet, test: (pull: PullView) => boolean) =>
			pulls.filter((pull) => pullMatches(pull, query, facets, facet) && test(pull)).length;
		let barFacets: FilterBar.Facet[] = [
			{
				name: "author",
				label: COPY.issues.author,
				icon: <UserRoundIcon size={16} />,
				options: PEOPLE.filter((person) => pulls.some((pull) => pull.author === person.handle)).map(
					(person) => ({
						value: person.handle,
						label: person.name,
						count: facetCount("author", (pull) => pull.author === person.handle),
						icon: <InitialsTile name={person.name} size={16} />,
					}),
				),
			},
			{
				name: "label",
				label: COPY.issues.label,
				icon: <TagIcon size={16} />,
				options: LABELS.map((label) => ({
					value: label.id,
					label: label.name,
					count: facetCount("label", (pull) => pull.labels.includes(label.id)),
					icon: <LabelDot color={label.color} />,
				})),
			},
			{
				name: "assignee",
				label: COPY.issues.assignee,
				icon: <CircleUserRoundIcon size={16} />,
				options: PEOPLE.map((person) => ({
					value: person.handle,
					label: person.name,
					count: facetCount("assignee", (pull) => pull.assignees.includes(person.handle)),
					icon: <InitialsTile name={person.name} size={16} />,
				})),
			},
		];
		let filtered =
			text.trim() !== DEFAULT_QUERY || FACETS.some((facet) => facets[facet].length > 0);
		let emptyTitle = iife(() => {
			if (filtered) return COPY.pulls.noneTitle;
			return query.state === "open" ? COPY.pulls.emptyOpenTitle : COPY.pulls.emptyClosedTitle;
		});
		return (
			<>
				<RepoHeader
					title={COPY.pulls.title}
					trail={[{ label: COPY.pulls.title }]}
					tab="pulls"
					commits={commits}
				/>
				<HeadingScope level={2}>
					<div mix={[raw({ display: "grid", gap: "0.75rem", paddingBlock: "1rem 2rem" })]}>
						<FilterBar
							id="delta-pulls"
							prefetch="intent"
							url={url}
							locale="en"
							tabs={[
								{
									label: COPY.pulls.open,
									count: count(true),
									href: tabHref("open"),
									current: query.state === "open",
								},
								{
									label: COPY.pulls.closed,
									count: count(false),
									href: tabHref("closed"),
									current: query.state === "closed" || query.state === "merged",
								},
							]}
							search={{
								id: SEARCH_ID,
								label: COPY.pulls.search,
								placeholder: COPY.pulls.placeholder,
							}}
							facets={barFacets}
							collapse
							labels={FILTER_LABELS}
							mix={[queryChips(filtered)]}
						/>
						<section
							aria-label={COPY.pulls.list}
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
								labels={COPY.pulls.keys}
							/>
							{rows.length === 0 ? (
								<div mix={[raw({ padding: "2.5rem 1rem" })]}>
									<Empty
										kind={filtered ? "no-results" : "cleared"}
										size="compact"
										icon={<GitPullRequestIcon />}
									>
										<Empty.Title>{emptyTitle}</Empty.Title>
										<Empty.Description>
											{filtered ? COPY.pulls.noneHint : COPY.pulls.emptyHint}
										</Empty.Description>
										{filtered ? (
											<Empty.Action>
												<LinkButton href={pullsHref()} size="sm" variant="outline" color="neutral">
													{COPY.issues.clear}
												</LinkButton>
											</Empty.Action>
										) : null}
									</Empty>
								</div>
							) : (
								<ul mix={[raw({ listStyle: "none", margin: 0, padding: 0 })]}>
									{rows.map((pull) => (
										<PullRow pull={pull} now={now} />
									))}
								</ul>
							)}
						</section>
						<p mix={[raw({ margin: 0, fontSize: "0.75rem", color: "var(--ui-neutral-fg-muted)" })]}>
							{COPY.pulls.shown(rows.length)}
						</p>
					</div>
				</HeadingScope>
			</>
		);
	};
}
