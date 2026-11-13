/**
 * A pull request's conversation: the opening post, then comments, pushes with their checks,
 * reviews with the threads they left (each above its code), and merges, on one timeline; the
 * merge box with its checks under it, and a side panel of reviewers, assignees and labels.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	CircleCheckIcon,
	CircleDotIcon,
	EyeIcon,
	FileDiffIcon,
	GitCommitHorizontalIcon,
	GitMergeIcon,
	MessageSquareIcon,
} from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { raw } from "@sdxc/u/general";
import { Button, HeadingScope, PropertyList, RelativeTime, TextArea, Timeline } from "@sdxc/ui";
import { CheckRunIcon, CheckRuns } from "@sdxc/ui/app/check-runs";
import { FilterMenu } from "@sdxc/ui/app/filter-menu";
import { MergeBox } from "@sdxc/ui/app/merge-box";

import type { CiteContext } from "../markup";
import type { PullEntry, PullView, ReviewView } from "../pull-records";

import { actionHref, actionsHref, commitHref, issueHref, shortSha } from "../data";
import { CHECK_LABELS, COPY, MERGE_LABELS, PICKER_LABELS } from "../labels";
import { Body } from "../markup";
import { checksState } from "../pull-records";
import { SAVES_ATTRIBUTE } from "../saving";
import { PEOPLE } from "../seed/people";
import { Avatar, nameOf } from "../states";

import { Entry, SAVE_STATUS_ID, SidePanel, participantsOf } from "./issue";
import { PullHeader, PullThread } from "./pull-parts";

/** A review's glyph, tone and verb on the timeline. */
function reviewLine(review: ReviewView): { icon: RemixNode; tone: Timeline.Tone; verb: string } {
	if (review.kind === "approve") {
		return { icon: <CircleCheckIcon />, tone: "success", verb: COPY.pull.approved };
	}
	if (review.kind === "changes") {
		return { icon: <FileDiffIcon />, tone: "danger", verb: COPY.pull.requestedChanges };
	}
	return { icon: <EyeIcon />, tone: "neutral", verb: COPY.pull.reviewed };
}

namespace PullEntryView {
	export interface Props {
		entry: PullEntry;
		pull: PullView;
		now: number;
		context: CiteContext;
	}
}

/**
 * One entry of the conversation: a push as a group of commits with their checks, a review as a
 * line holding its body and its threads (each above its code), a merge as a line, and every
 * other comment and event as an issue draws it.
 */
function PullEntryView(handle: Handle<PullEntryView.Props>) {
	return () => {
		let { context, entry, now, pull } = handle.props;
		let time = <RelativeTime date={entry.at} now={now} locale="en" />;
		if (entry.type === "commits") {
			let state = checksState(pull.checks);
			return (
				<Timeline.Commits
					icon={<GitCommitHorizontalIcon />}
					avatar={<Avatar handle={entry.actor} size={20} />}
					actor={nameOf(entry.actor)}
					summary={COPY.pull.added(entry.commits.length)}
					time={time}
				>
					{entry.commits.map((commit) => (
						<Timeline.Commit
							sha={shortSha(commit.sha)}
							href={commitHref(commit.sha)}
							avatar={<Avatar handle={entry.actor} size={16} />}
							check={
								commit.sha === pull.head ? (
									<CheckRunIcon state={state} label={CHECK_LABELS.states[state]} />
								) : (
									<CheckRunIcon state="success" label={CHECK_LABELS.states.success} />
								)
							}
						>
							{commit.subject}
						</Timeline.Commit>
					))}
				</Timeline.Commits>
			);
		}
		if (entry.type === "review") {
			let { icon, tone, verb } = reviewLine(entry.review);
			let threads = pull.threads.filter((thread) => entry.review.threads.includes(thread.id));
			let body =
				entry.review.body.length === 0 && threads.length === 0 ? undefined : (
					<div mix={[raw({ display: "grid", gap: "0.75rem", minInlineSize: 0 })]}>
						{entry.review.body.length === 0 ? null : (
							<Body blocks={entry.review.body} context={context} />
						)}
						{threads.map((thread) => (
							<PullThread pull={pull} thread={thread} now={now} context={context} excerpt />
						))}
					</div>
				);
			return (
				<Timeline.Event
					id={`review-${entry.review.id}`}
					icon={icon}
					tone={tone}
					avatar={<Avatar handle={entry.review.author} size={20} />}
					actor={nameOf(entry.review.author)}
					time={time}
					body={body}
				>
					{verb}
				</Timeline.Event>
			);
		}
		if (entry.type === "merged") {
			return (
				<Timeline.Event
					id="merged"
					icon={<GitMergeIcon />}
					tone="brand"
					avatar={<Avatar handle={entry.actor} size={20} />}
					actor={nameOf(entry.actor)}
					time={time}
				>
					{`${COPY.pull.mergedCommit} `}
					<a href={commitHref(entry.sha)} mix={[raw({ fontFamily: "var(--ui-font-mono)" })]}>
						{shortSha(entry.sha)}
					</a>
					{` ${COPY.pull.into} `}
					<code mix={[raw({ fontFamily: "var(--ui-font-mono)" })]}>main</code>
				</Timeline.Event>
			);
		}
		return <Entry entry={entry} now={now} context={context} />;
	};
}

/** A reviewer's state as a small toned glyph with its name for assistive technology. */
function ReviewState(handle: Handle<{ state: keyof typeof COPY.pull.reviewStates }>) {
	return () => {
		let { state } = handle.props;
		let label = COPY.pull.reviewStates[state];
		let glyph = reviewGlyph(state);
		return (
			<span title={label} mix={[raw({ display: "inline-flex", color: glyph.color })]}>
				{glyph.icon}
				<span mix={[visuallyHidden()]}>{label}</span>
			</span>
		);
	};
}

/** The glyph and colour each review state is drawn in. */
function reviewGlyph(state: keyof typeof COPY.pull.reviewStates): {
	icon: RemixNode;
	color: string;
} {
	if (state === "approved") {
		return {
			icon: <CircleCheckIcon size={16} aria-hidden="true" />,
			color: "var(--ui-success-fg)",
		};
	}
	if (state === "changes") {
		return { icon: <FileDiffIcon size={16} aria-hidden="true" />, color: "var(--ui-danger-fg)" };
	}
	if (state === "commented") {
		return {
			icon: <MessageSquareIcon size={16} aria-hidden="true" />,
			color: "var(--ui-neutral-fg-muted)",
		};
	}
	return { icon: <CircleDotIcon size={16} aria-hidden="true" />, color: "var(--ui-warning-fg)" };
}

namespace Merge {
	export interface Props {
		pull: PullView;
	}
}

/**
 * The merge box: whether the reviews are in, how the checks stand (with every run listed), and
 * whether the branch merges cleanly, then the merge button or the outcome. A failing check or a
 * missing approval blocks it, and the button says why.
 */
function Merge(handle: Handle<Merge.Props>) {
	return () => {
		let { pull } = handle.props;
		let approvals = pull.reviewers.filter((reviewer) => reviewer.state === "approved").length;
		let changes = pull.reviewers.some((reviewer) => reviewer.state === "changes");
		let checks = checksState(pull.checks);
		let rows = COPY.pull;
		let reviews = reviewsRow(approvals, changes);
		let tone = CHECK_TONES[checks];
		let state: MergeBox.State = mergeState(pull, checks, approvals > 0 && !changes);
		return (
			<MergeBox
				id="delta-merge"
				state={state}
				action={`${actionHref(`delta/pull/${pull.number}`)}?do=merge`}
				rows={{
					reviews,
					checks: {
						tone,
						title: rows.checksRow[checks],
						children: (
							<CheckRuns
								runs={pull.checks.map((check) => ({ ...check, href: actionsHref() }))}
								labels={CHECK_LABELS}
								locale="en"
							/>
						),
					},
					conflicts: { tone: "success", title: rows.conflictsRow, detail: rows.conflictsDetail },
				}}
				labels={{
					...MERGE_LABELS,
					status: {
						...MERGE_LABELS.status,
						blocked: checks === "failure" ? rows.reasons.failing : rows.reasons.review,
					},
				}}
			/>
		);
	};
}

/** The tone the checks row reads in, by how the checks stand. */
const CHECK_TONES: Record<"failure" | "pending" | "success", MergeBox.Tone> = {
	failure: "danger",
	pending: "warning",
	success: "success",
};

/** The reviews row: changes requested, approved, or waiting on a review. */
function reviewsRow(approvals: number, changes: boolean): MergeBox.Row {
	let rows = COPY.pull.reviewsRow;
	if (changes) return { tone: "danger", title: rows.changes, detail: rows.changesDetail };
	if (approvals > 0) {
		return { tone: "success", title: rows.approved(approvals), detail: rows.approvedDetail };
	}
	return { tone: "warning", title: rows.required, detail: rows.requiredDetail };
}

/** Where the merge box stands: settled, blocked by a check or a review, or ready. */
function mergeState(
	pull: PullView,
	checks: "failure" | "pending" | "success",
	approved: boolean,
): MergeBox.State {
	if (pull.state === "merged") return "merged";
	if (pull.state === "closed") return "closed";
	if (checks === "failure" || !approved) return "blocked";
	return "ready";
}

namespace PullScreen {
	export interface Props {
		pull: PullView;
		context: CiteContext;
		now: number;
		commits: number;
		listHref?: string;
		filesHref?: string;
	}
}

/**
 * Renders the conversation: the header, the timeline with the merge box and the comment box at
 * its end, and the side panel beside them on a wide screen or under them on a narrow one.
 */
export function PullScreen(handle: Handle<PullScreen.Props>) {
	return () => {
		let { commits, context, filesHref, listHref, now, pull } = handle.props;
		let page = `delta/pull/${pull.number}`;
		let saves = { [SAVES_ATTRIBUTE]: SAVE_STATUS_ID };
		let reviewers = (
			<PropertyList.Item
				label={COPY.pull.reviewers}
				empty={COPY.pull.noReviewers}
				edit={{
					id: "delta-pull-reviewers",
					label: COPY.pull.editReviewers,
					popover: (
						<FilterMenu.Popover
							id="delta-pull-reviewers"
							mode="multiple"
							name="reviewer"
							action={`${actionHref(page)}?set=reviewers`}
							groups={[
								{
									label: COPY.issue.suggestions,
									items: PEOPLE.filter((person) => person.handle !== pull.author).map((person) => ({
										value: person.handle,
										label: person.name,
										description: `@${person.handle}`,
										selected: pull.reviewers.some(
											(reviewer) =>
												reviewer.handle === person.handle && reviewer.state === "requested",
										),
									})),
								},
							]}
							labels={PICKER_LABELS.reviewers}
							{...saves}
						/>
					),
				}}
			>
				{pull.reviewers.length === 0 ? null : (
					<span mix={[raw({ display: "grid", gap: "0.375rem" })]}>
						{pull.reviewers.map((reviewer) => (
							<span
								data-reviewer={reviewer.handle}
								data-review-state={reviewer.state}
								mix={[raw({ display: "flex", alignItems: "center", gap: "0.375rem" })]}
							>
								<Avatar handle={reviewer.handle} size={20} />
								<span mix={[raw({ flex: "1 1 auto", minInlineSize: 0 })]}>
									{nameOf(reviewer.handle)}
								</span>
								<ReviewState state={reviewer.state} />
							</span>
						))}
					</span>
				)}
			</PropertyList.Item>
		);
		let development =
			pull.closes.length === 0 ? null : (
				<PropertyList.Item label={COPY.pull.development}>
					<span mix={[raw({ display: "grid", gap: "0.25rem" })]}>
						<span mix={[raw({ fontSize: "0.75rem", color: "var(--ui-neutral-fg-muted)" })]}>
							{COPY.pull.closes}
						</span>
						{pull.closes.map((number) => (
							<a href={issueHref(number)} data-rmx-prefetch="intent">{`#${number}`}</a>
						))}
					</span>
				</PropertyList.Item>
			);
		return (
			<>
				<PullHeader
					pull={pull}
					tab="conversation"
					now={now}
					commits={commits}
					listHref={listHref}
					filesHref={filesHref}
				/>
				<div data-slot="delta-record" mix={[raw({ container: "delta-record / inline-size" })]}>
					<div
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "minmax(0, 1fr)",
								gap: "1.5rem",
								paddingBlock: "1.25rem 2rem",
								"@container delta-record (width >= 52rem)": {
									gridTemplateColumns: "minmax(0, 1fr) 15rem",
									alignItems: "start",
									columnGap: "2rem",
								},
							}),
						]}
					>
						<HeadingScope level={2}>
							<section
								aria-labelledby="delta-pull-conversation"
								mix={[raw({ display: "grid", gap: "1rem", minInlineSize: 0 })]}
							>
								<h2 id="delta-pull-conversation" mix={[visuallyHidden()]}>
									{COPY.pull.conversation}
								</h2>
								<Timeline>
									<Timeline.Comment
										id={`pull-${pull.number}-body`}
										avatar={<Avatar handle={pull.author} size={32} />}
										author={nameOf(pull.author)}
										action={COPY.issue.commented}
										time={<RelativeTime date={pull.createdAt} now={now} locale="en" />}
									>
										<Body blocks={pull.body} context={context} />
									</Timeline.Comment>
									{pull.timeline.map((entry) => (
										<PullEntryView entry={entry} pull={pull} now={now} context={context} />
									))}
								</Timeline>
								<Merge pull={pull} />
								<form
									method="post"
									action={actionHref(page)}
									data-slot="delta-comment-form"
									mix={[
										raw({
											display: "grid",
											gap: "0.5rem",
											padding: "0.75rem",
											border: "1px solid var(--ui-neutral-border)",
											borderRadius: "var(--ui-radius-lg)",
											backgroundColor: "var(--ui-bg, Canvas)",
										}),
									]}
								>
									<input type="hidden" name="intent" value="comment" />
									<label
										htmlFor="delta-pull-comment"
										mix={[raw({ fontSize: "0.875rem", fontWeight: 600 })]}
									>
										{COPY.pull.commentLabel}
									</label>
									<TextArea
										id="delta-pull-comment"
										name="body"
										rows={4}
										maxLength={600}
										required
										placeholder={COPY.pull.commentPlaceholder}
									/>
									<span mix={[raw({ display: "flex", justifyContent: "flex-end" })]}>
										<Button type="submit" size="sm">
											{COPY.pull.comment}
										</Button>
									</span>
								</form>
							</section>
							<SidePanel
								page={page}
								assignees={pull.assignees}
								labels={pull.labels}
								milestone={pull.milestone}
								editedAt={pull.editedAt}
								participants={[
									...new Set([
										...participantsOf(
											pull.author,
											pull.timeline.flatMap((entry) =>
												entry.type === "comment" || entry.type === "event" ? [entry] : [],
											),
										),
										...pull.reviews.map((review) => review.author),
										...pull.threads.flatMap((thread) =>
											thread.comments.map((comment) => comment.author),
										),
									]),
								]}
								before={reviewers}
								after={development}
							/>
						</HeadingScope>
					</div>
				</div>
			</>
		);
	};
}
