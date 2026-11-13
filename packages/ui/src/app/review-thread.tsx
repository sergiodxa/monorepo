/**
 * A conversation anchored to lines of a change: comment cards, a suggested change drawn as a
 * small diff, a reply box and Resolve, all plain POST forms that reload the thread's own
 * frame. A resolved or outdated thread folds to one line, and pending comments say so.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Hunk } from "@sdxc/diff";
import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { ChevronDownIcon } from "@sdxc/icons";
import { bg, border, fg, outline } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { cursor, mergeMix, raw } from "@sdxc/u/general";
import { flexWrap, hstack, shrink, vstack } from "@sdxc/u/layout";
import { minIs, p, pb, pi } from "@sdxc/u/size";
import { focusVisible, when } from "@sdxc/u/state";
import { font, text, weight } from "@sdxc/u/typography";

import { Badge } from "../components/badge.js";
import { Button } from "../components/button.js";
import { TextArea } from "../components/textarea.js";
import { Timeline } from "../components/timeline.js";

import { Diff } from "./diff.js";

/** Field the reply form posts its text under. */
const REPLY_FIELD = "body";

/** Field the resolve form posts the thread's next state under, `"true"` or `"false"`. */
const RESOLVED_FIELD = "resolved";

/**
 * Prop types for {@link ReviewThread}.
 */
export namespace ReviewThread {
	/** One comment of the thread, drawn as a `Timeline.Comment` card. */
	export interface Comment {
		/** The card's id, so `#discussion_r123` lands on it. */
		id?: string;
		/** The author's picture, such as an `Avatar`, at the card's start. */
		avatar: RemixNode;
		/** The author's name, usually a link to their profile. */
		author: RemixNode;
		/** The muted verb after the name, such as "commented". */
		action?: RemixNode;
		/** When it was written, such as a `RelativeTime`, after the verb. */
		time?: RemixNode;
		/** A `⋯` menu trigger at the card's header end. */
		menu?: RemixNode;
		/** The reactions row under the body. */
		reactions?: RemixNode;
		/** The comment belongs to a review not yet submitted, so only its author sees it. */
		pending?: boolean;
		/** The rendered Markdown body. */
		body: RemixNode;
	}

	/** Lines of a file drawn as a small diff: the code a thread is about, or a suggestion. */
	export interface Lines {
		/** The file's path, which names the excerpt. */
		path: string;
		/** The lines to draw, as parsed hunks. */
		hunks: readonly Hunk[];
		/** Language the lines highlight as. */
		language?: string;
	}

	/** A suggested change and where accepting it posts. */
	export interface Suggestion extends Lines {
		/** Where "Apply suggestion" posts; omitted, the suggestion only reads. */
		applyAction?: string;
	}

	/** Every string the thread shows or announces; the library ships no copy. */
	export interface Labels {
		/** The reply box's name and its button, such as "Reply". */
		reply: string;
		/** Shown in the empty reply box, such as "Reply…". */
		replyPlaceholder?: string;
		/** The button on an open thread, such as "Resolve conversation". */
		resolve: string;
		/** The button on a resolved thread, such as "Unresolve conversation". */
		unresolve: string;
		/** The badge on an outdated thread, such as "Outdated". */
		outdated: string;
		/** The badge on an unsent comment, such as "Pending". */
		pending: string;
		/** Heads a suggestion block, such as "Suggested change". */
		suggestion: string;
		/** The button under a suggestion with an `applyAction`, such as "Apply suggestion". */
		applySuggestion: string;
		/** Hidden column headers for the excerpt and suggestion tables. */
		columns: Diff.ColumnLabels;
	}

	/** Props accepted by {@link ReviewThread}: every native `<div>` attribute for its root. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/** The thread's comments, oldest first. */
		comments: readonly Comment[];
		/** The thread is resolved, which folds it to `resolvedSummary`. */
		resolved?: boolean;
		/** The folded line of a resolved thread, such as "ana marked this conversation as resolved". */
		resolvedSummary?: RemixNode;
		/** The lines the thread cites have changed since, which folds it and labels it. */
		outdated?: boolean;
		/**
		 * The code the thread is about, drawn above the comments: on the timeline, and for an
		 * outdated thread, whose original lines no longer show in the diff.
		 */
		excerpt?: Lines;
		/** A change the reviewer proposes, drawn as a small diff under the comments. */
		suggestion?: Suggestion;
		/** Where a reply posts its text (as `body`); omitted, the thread draws no reply box. */
		replyAction?: string;
		/** Where Resolve and Unresolve post `resolved=true|false`; omitted, no button. */
		resolveAction?: string;
		/** The named frame the thread renders in, which every form reloads in place. */
		frame?: string;
		/** Hidden inputs every form carries, such as a CSRF token. */
		fields?: RemixNode;
		/** Every string the thread shows or announces, so it reads in any language. */
		labels: Labels;
	}
}

/**
 * Open, it shows the excerpt, comments, suggestion and forms; resolved or outdated, it folds into
 * a closed `<details>` behind one line. Every form is a plain POST, so it works without script and
 * needs no island; with the page's runtime, `frame` reloads only the thread in place.
 *
 * @param handle Runtime handle carrying the thread's props.
 * @returns The render function producing the thread.
 * @example
 * <Frame name={`thread-${thread.id}`} src={`/threads/${thread.id}`}>
 * 	<ReviewThread id={`thread-${thread.id}`} frame={`thread-${thread.id}`} comments={comments}
 * 		replyAction={`/threads/${thread.id}/replies`} resolveAction={`/threads/${thread.id}/resolve`} labels={labels} />
 * </Frame>
 * @example <ReviewThread resolved resolvedSummary={t("thread.resolvedBy", { name: "ana" })} comments={comments} labels={labels} />
 */
export function ReviewThread(handle: Handle<ReviewThread.Props>) {
	return () => {
		let {
			comments,
			excerpt,
			fields,
			frame,
			labels,
			mix,
			outdated,
			replyAction,
			resolveAction,
			resolved,
			resolvedSummary,
			suggestion,
			...rest
		} = handle.props;
		let state = threadState(resolved, outdated);
		let content = (
			<div data-slot="review-thread-content" mix={[vstack({ gap: 3 }), p(3), minIs(0)]}>
				{excerpt ? <ThreadLines lines={excerpt} columns={labels.columns} /> : null}
				<Timeline mix={[raw({ "--ui-timeline-surface": "var(--review-thread-bg)" })]}>
					{comments.map((comment) => (
						<Timeline.Comment
							id={comment.id}
							avatar={comment.avatar}
							author={comment.author}
							action={
								comment.pending ? (
									<span mix={[hstack({ gap: 1.5, align: "center" })]}>
										{comment.action}
										<Badge color="warning" variant="outline" data-slot="review-thread-pending">
											{labels.pending}
										</Badge>
									</span>
								) : (
									comment.action
								)
							}
							time={comment.time}
							menu={comment.menu}
							reactions={comment.reactions}
							data-pending={comment.pending ? "" : undefined}
						>
							{comment.body}
						</Timeline.Comment>
					))}
				</Timeline>
				{suggestion ? (
					<div
						data-slot="review-thread-suggestion"
						mix={[
							vstack({ gap: 0 }),
							rounded("md"),
							border({ color: "neutral.border", width: 1 }),
							raw({ overflow: "clip" }),
						]}
					>
						<p
							mix={[
								raw({ margin: 0 }),
								pi(3),
								pb(1.5),
								bg("neutral.bg-tint"),
								text("xs"),
								weight(600),
								fg("neutral.muted"),
							]}
						>
							{labels.suggestion}
						</p>
						<Diff.Hunks
							path={suggestion.path}
							hunks={suggestion.hunks}
							language={suggestion.language}
							anchored={false}
							labels={{ columns: labels.columns }}
						/>
						{suggestion.applyAction ? (
							<form
								method="post"
								action={suggestion.applyAction}
								data-rmx-target={frame}
								data-slot="review-thread-apply"
								mix={[
									hstack({ justify: "end" }),
									pi(3),
									pb(2),
									raw({ borderBlockStart: "1px solid var(--ui-neutral-border)" }),
								]}
							>
								{fields}
								<Button type="submit" size="sm" color="neutral" variant="surface">
									{labels.applySuggestion}
								</Button>
							</form>
						) : null}
					</div>
				) : null}
				{replyAction || resolveAction ? (
					<div data-slot="review-thread-footer" mix={[vstack({ gap: 2 })]}>
						{replyAction ? (
							<form
								method="post"
								action={replyAction}
								data-rmx-target={frame}
								data-slot="review-thread-reply"
								mix={[vstack({ gap: 2 })]}
							>
								{fields}
								<TextArea
									name={REPLY_FIELD}
									required
									rows={2}
									aria-label={labels.reply}
									placeholder={labels.replyPlaceholder}
								/>
								<span mix={[hstack({ justify: "end" })]}>
									<Button type="submit" size="sm">
										{labels.reply}
									</Button>
								</span>
							</form>
						) : null}
						{resolveAction ? (
							<form
								method="post"
								action={resolveAction}
								data-rmx-target={frame}
								data-slot="review-thread-resolve"
							>
								{fields}
								<input type="hidden" name={RESOLVED_FIELD} value={resolved ? "false" : "true"} />
								<Button type="submit" size="sm" color="neutral" variant="outline">
									{resolved ? labels.unresolve : labels.resolve}
								</Button>
							</form>
						) : null}
					</div>
				) : null}
			</div>
		);

		return (
			<div
				{...rest}
				data-slot="review-thread"
				data-state={state}
				mix={mergeMix(
					[
						minIs(0),
						rounded("md"),
						border({ color: "neutral.border", width: 1 }),
						raw({
							overflow: "clip",
							backgroundColor: "var(--review-thread-bg)",
							"--review-thread-bg": "var(--ui-surface-raised, var(--ui-bg, Canvas))",
						}),
					],
					mix,
				)}
			>
				{state === "open" ? (
					content
				) : (
					<details data-slot="review-thread-details">
						<summary
							data-slot="review-thread-summary"
							mix={[
								hstack({ gap: 2, align: "center" }),
								flexWrap("wrap"),
								pi(3),
								pb(2),
								text("sm"),
								fg("neutral.muted"),
								cursor("pointer"),
								raw({ listStyle: "none", "&::-webkit-details-marker": { display: "none" } }),
								focusVisible(outline({ color: "brand.ring", offset: -2 })),
							]}
						>
							<ChevronDownIcon
								size={16}
								aria-hidden="true"
								mix={[
									shrink(0),
									raw({ rotate: "-90deg", transition: "rotate 150ms ease" }),
									when(":is(details[open] > summary) > &", raw({ rotate: "0deg" })),
								]}
							/>
							{outdated ? (
								<Badge color="warning" variant="outline" data-slot="review-thread-outdated">
									{labels.outdated}
								</Badge>
							) : null}
							{resolved ? <span>{resolvedSummary}</span> : null}
							{!resolved && excerpt ? (
								<span mix={[font("mono"), text("xs"), raw({ overflowWrap: "anywhere" })]}>
									{excerpt.path}
								</span>
							) : null}
						</summary>
						<div mix={[raw({ borderBlockStart: "1px solid var(--ui-neutral-border)" })]}>
							{content}
						</div>
					</details>
				)}
			</div>
		);
	};
}

/** Which way the thread draws: open, or folded as resolved (first) or outdated. */
function threadState(
	resolved: boolean | undefined,
	outdated: boolean | undefined,
): "open" | "resolved" | "outdated" {
	if (resolved) return "resolved";
	if (outdated) return "outdated";
	return "open";
}

/** Props {@link ThreadLines} reads. */
interface ThreadLinesProps {
	lines: ReviewThread.Lines;
	columns: Diff.ColumnLabels;
}

/**
 * Renders an excerpt: the file's path over its lines as a small unified diff, so the thread
 * reads on the timeline, or after the diff moved on, as it did beside the code.
 *
 * @param handle Runtime handle carrying the excerpt.
 * @returns The render function producing the excerpt.
 */
function ThreadLines(handle: Handle<ThreadLinesProps>) {
	return () => {
		let { columns, lines } = handle.props;
		return (
			<figure
				data-slot="review-thread-excerpt"
				mix={[
					raw({ margin: 0, overflow: "clip" }),
					rounded("md"),
					border({ color: "neutral.border", width: 1 }),
				]}
			>
				<figcaption
					mix={[
						pi(3),
						pb(1.5),
						bg("neutral.bg-tint"),
						font("mono"),
						text("xs"),
						weight(600),
						raw({ overflowWrap: "anywhere" }),
					]}
				>
					{lines.path}
				</figcaption>
				<Diff.Hunks
					path={lines.path}
					hunks={lines.hunks}
					language={lines.language}
					anchored={false}
					labels={{ columns }}
				/>
			</figure>
		);
	};
}
