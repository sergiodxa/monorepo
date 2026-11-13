/**
 * The parts both of a pull request's pages draw: the header that sticks and compacts with its
 * state, branches and tabs, and a review thread wired to the pull request's own page, so a
 * reply or a resolve posts there and redraws the page in place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { GitBranchIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { RelativeTime } from "@sdxc/ui";
import { ReviewThread } from "@sdxc/ui/app/review-thread";

import { languageOf } from "~/app/services/delta/source";

import type { CiteContext } from "../markup";
import type { PullView, ThreadView } from "../pull-records";
import type { RecordState } from "../states";

import { actionHref, pullHref } from "../data";
import { COPY, THREAD_LABELS } from "../labels";
import { Body } from "../markup";
import { RepoHeader } from "../shell";
import { Avatar, StatePill, nameOf } from "../states";

/** The state a pull request's icon and pill draw. */
export function pullState(pull: PullView): RecordState {
	if (pull.state === "merged") return "merged";
	if (pull.state === "closed") return "pr-closed";
	return pull.draft ? "draft" : "pr-open";
}

/** The word a pull request's pill says. */
function pillWord(pull: PullView): string {
	if (pull.state === "merged") return COPY.pull.merged;
	if (pull.state === "closed") return COPY.pull.closed;
	return pull.draft ? COPY.pull.draft : COPY.pull.open;
}

/** A branch name as GitHub sets it: monospace on a brass tint. */
function BranchName(handle: Handle<{ name: string }>) {
	return () => (
		<span
			mix={[
				raw({
					display: "inline-flex",
					alignItems: "center",
					gap: "0.25rem",
					paddingInline: "0.375rem",
					borderRadius: "var(--ui-radius-md)",
					fontFamily: "var(--ui-font-mono)",
					fontSize: "0.75rem",
					lineHeight: "1.25rem",
					color: "var(--ui-brand-fg, var(--ui-neutral-fg-emphasis))",
					backgroundColor: "color-mix(in oklch, var(--ui-brand-bg-solid) 12%, transparent)",
				}),
			]}
		>
			<GitBranchIcon size={12} aria-hidden="true" />
			{handle.props.name}
		</span>
	);
}

namespace PullHeader {
	export interface Props {
		pull: PullView;
		tab: "conversation" | "files";
		now: number;
		commits: number;
		/** The pull requests list's address, for the trail; absent while the list isn't linked. */
		listHref?: string;
		/** The changed files' address, for the second tab; absent while that page isn't linked. */
		filesHref?: string;
	}
}

/**
 * Renders a pull request's header: the trail back to the list, its title and number, its state
 * pill, who wants to merge how many commits from which branch, and its tabs. It sticks under the
 * top bar and compacts as the page scrolls, keeping the pill, the title and the tabs in view.
 */
export function PullHeader(handle: Handle<PullHeader.Props>) {
	return () => {
		let { commits, filesHref, listHref, now, pull, tab } = handle.props;
		let merged = pull.state === "merged";
		let tabs = [
			{
				label: COPY.pull.conversation,
				href: pullHref(pull.number),
				count: pull.comments + pull.reviews.length,
				current: tab === "conversation",
			},
			...(filesHref === undefined
				? []
				: [
						{
							label: COPY.pull.filesChanged,
							href: filesHref,
							count: pull.files,
							current: tab === "files",
						},
					]),
		];
		return (
			<>
				<RepoHeader
					title={
						<>
							{pull.title}{" "}
							<span mix={[raw({ fontWeight: 400, color: "var(--ui-neutral-fg-muted)" })]}>
								{`#${pull.number}`}
							</span>
						</>
					}
					trail={[{ label: COPY.pulls.title, href: listHref }, { label: `#${pull.number}` }]}
					parent={listHref === undefined ? undefined : { href: listHref, label: COPY.pulls.title }}
					status={<StatePill state={pullState(pull)}>{pillWord(pull)}</StatePill>}
					description={
						<span
							mix={[
								raw({
									display: "inline-flex",
									flexWrap: "wrap",
									alignItems: "center",
									gap: "0.25rem 0.375rem",
									fontSize: "0.875rem",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							<strong mix={[raw({ fontWeight: 600, color: "var(--ui-neutral-fg-emphasis)" })]}>
								{nameOf(merged ? (pull.settled?.by ?? pull.author) : pull.author)}
							</strong>
							{merged
								? COPY.pull.mergedInto(pull.commits.length)
								: COPY.pull.wantsToMerge(pull.commits.length)}
							<BranchName name="main" />
							{COPY.pull.from}
							<BranchName name={pull.branch} />
							{merged && pull.settled !== undefined ? (
								<RelativeTime date={pull.settled.at} now={now} locale="en" />
							) : null}
						</span>
					}
					sticky
					tab="pulls"
					commits={commits}
				/>
				<nav
					aria-label={COPY.pull.tabs}
					data-slot="delta-pull-tabs"
					mix={[
						raw({
							display: "flex",
							gap: "0.25rem",
							marginBlockStart: "1rem",
							borderBlockEnd: "1px solid var(--ui-neutral-border)",
							overflowX: "auto",
							scrollbarWidth: "none",
						}),
					]}
				>
					{tabs.map((entry) => (
						<a
							href={entry.href}
							aria-current={entry.current ? "page" : undefined}
							data-rmx-prefetch="intent"
							mix={[
								raw({
									display: "inline-flex",
									alignItems: "center",
									gap: "0.5rem",
									flexShrink: 0,
									minBlockSize: "2.5rem",
									paddingInline: "0.75rem",
									marginBlockEnd: "-1px",
									borderBlockEnd: "2px solid transparent",
									fontSize: "0.875rem",
									color: "var(--ui-neutral-fg-muted)",
									textDecoration: "none",
									"&:hover": { color: "var(--ui-neutral-fg-emphasis)" },
									"&[aria-current='page']": {
										color: "var(--ui-neutral-fg-emphasis)",
										fontWeight: 600,
										borderBlockEndColor: "var(--ui-brand-bg-solid)",
									},
								}),
							]}
						>
							{entry.label}
							<span
								mix={[
									raw({
										minInlineSize: "1.25rem",
										paddingInline: "0.375rem",
										borderRadius: "999px",
										fontSize: "0.75rem",
										fontWeight: 500,
										lineHeight: "1.25rem",
										textAlign: "center",
										fontVariantNumeric: "tabular-nums",
										backgroundColor: "var(--ui-neutral-bg-tint)",
									}),
								]}
							>
								{String(entry.count)}
							</span>
						</a>
					))}
				</nav>
			</>
		);
	};
}

namespace PullThread {
	export interface Props {
		pull: PullView;
		thread: ThreadView;
		now: number;
		context: CiteContext;
		/** Draws the code the thread is about above it, as the conversation does. */
		excerpt?: boolean;
	}
}

/**
 * Renders one review thread whose reply and resolve post to the pull request's page, naming the
 * thread. On the conversation it shows its code; an outdated or resolved thread folds to a line.
 */
export function PullThread(handle: Handle<PullThread.Props>) {
	return () => {
		let { context, now, pull, thread } = handle.props;
		let page = `delta/pull/${pull.number}`;
		let action = (verb: string) =>
			`${actionHref(page)}?thread=${encodeURIComponent(thread.id)}&do=${verb}`;
		let showExcerpt = handle.props.excerpt === true || thread.outdated;
		let starter = thread.comments[0];
		let summary =
			thread.resolvedBy === undefined
				? undefined
				: `${nameOf(thread.resolvedBy)} marked this conversation as resolved`;
		return (
			<ReviewThread
				id={`thread-${thread.id}`}
				data-thread-id={thread.id}
				comments={thread.comments.map((comment) => ({
					id: `discussion-${comment.id}`,
					avatar: <Avatar handle={comment.author} size={24} />,
					author: nameOf(comment.author),
					action: comment === starter ? `on ${thread.path}` : undefined,
					time: <RelativeTime date={comment.at} now={now} locale="en" />,
					pending: comment.pending,
					body: <Body blocks={comment.body} context={context} />,
				}))}
				resolved={thread.resolved}
				resolvedSummary={summary}
				outdated={thread.outdated}
				excerpt={
					showExcerpt && thread.excerpt !== undefined
						? { path: thread.path, hunks: [thread.excerpt], language: languageOf(thread.path) }
						: undefined
				}
				suggestion={
					thread.suggestion === undefined
						? undefined
						: { path: thread.path, hunks: thread.suggestion, language: languageOf(thread.path) }
				}
				replyAction={thread.pending || pull.state !== "open" ? undefined : action("reply")}
				resolveAction={thread.pending || pull.state !== "open" ? undefined : action("resolve")}
				labels={THREAD_LABELS}
			/>
		);
	};
}
