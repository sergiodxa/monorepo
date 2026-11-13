/**
 * A record's activity as an ordered list: a 2px rail threading 16px event icons toned by
 * what happened, one line per event, comment cards with an author header and reactions,
 * grouped commits, and a native `<details>` folding a run of quiet events into "N more".
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { EllipsisIcon } from "@sdxc/icons";
import { bg, border, fg, outline } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { cursor, listStyle, pseudoContent, raw, mergeMix } from "@sdxc/u/general";
import { flex, gap, grid, inlineFlex, items, justify, relative, vstack } from "@sdxc/u/layout";
import { bs, is, m, minIs, p, pi } from "@sdxc/u/size";
import { before, data, focusVisible, hover, when } from "@sdxc/u/state";
import { font, leading, text, truncate, weight } from "@sdxc/u/typography";

/** The side of the square each event's icon sits centred in; the rail runs through its middle. */
const ICON_BOX = "var(--ui-timeline-icon-box, 1.5rem)";

/** Tone an event's icon takes when `tone` is left unset. */
const DEFAULT_TONE: Timeline.Tone = "neutral";

/**
 * Prop types for {@link Timeline} and its compound parts.
 */
export namespace Timeline {
	/** The semantic role an event's icon is drawn in. */
	export type Tone = "neutral" | "brand" | "success" | "warning" | "danger";

	/** Every native `<ol>` attribute. */
	export interface Props extends TagProps<"ol"> {}

	/** Every native `<li>` attribute, plus the event's parts. */
	export interface EventProps extends Omit<TagProps<"li">, "children"> {
		/** A 16px glyph naming the kind of event, decorative beside the line's words. */
		icon: RemixNode;
		/** @default {@link DEFAULT_TONE} */
		tone?: Tone;
		/** A small avatar of the actor, shown before the name. */
		avatar?: RemixNode;
		/** Who did it, set in bold. */
		actor?: RemixNode;
		/** When it happened: a `RelativeTime` or plain text. */
		time?: RemixNode;
		/** A comment or other body, set as a card under the line. */
		body?: RemixNode;
		/** What happened, in muted text after the actor: "resolved the incident". */
		children?: RemixNode;
	}

	/** Every native `<li>` attribute, plus the comment's parts. */
	export interface CommentProps extends Omit<TagProps<"li">, "children"> {
		/** The author's avatar, set on the rail in place of an icon. */
		avatar: RemixNode;
		/** The author's name, set in bold at the start of the card's header. */
		author: RemixNode;
		/** The muted verb after the name: "commented", "reviewed". */
		action?: RemixNode;
		/** When it was written: a `RelativeTime` or plain text. */
		time?: RemixNode;
		/** A `⋯` menu trigger, drawn at the end of the header. */
		menu?: RemixNode;
		/** Reactions or other controls, drawn in a row under the body. */
		reactions?: RemixNode;
		/** The rendered Markdown body. */
		children: RemixNode;
	}

	/** Every native `<li>` attribute, plus the summary line and its commits. */
	export interface CommitsProps extends Omit<TagProps<"li">, "children"> {
		/** A 16px glyph for the group, such as a commit icon. */
		icon: RemixNode;
		/** A small avatar of the pusher, shown before the name. */
		avatar?: RemixNode;
		/** Who pushed, set in bold. */
		actor?: RemixNode;
		/** What happened, muted: "added 3 commits". */
		summary?: RemixNode;
		/** When the push happened. */
		time?: RemixNode;
		/** The {@link Timeline.Commit} rows. */
		children: RemixNode;
	}

	/** Every native `<li>` attribute, plus the commit's parts. */
	export interface CommitProps extends Omit<TagProps<"li">, "children"> {
		/** The commit's short sha, set in monospace at the end of the row. */
		sha: string;
		/** The commit's page; links the subject and the sha. */
		href?: string;
		/** A small avatar of the author. */
		avatar?: RemixNode;
		/** The commit's checks, such as a toned status icon with its accessible name. */
		check?: RemixNode;
		/** The commit's subject line. */
		children: RemixNode;
	}

	/** Every native `<li>` attribute, plus the folded events. */
	export interface MoreProps extends Omit<TagProps<"li">, "children"> {
		/** The disclosure's label, such as "4 more events". */
		summary: RemixNode;
		/** Starts unfolded. */
		open?: boolean;
		/** The folded {@link Timeline.Event} items. */
		children: RemixNode;
	}
}

/**
 * The two-column track every row shares: the icon box, then the line. Folded events use
 * it too, so their icons stay on the one rail the list draws.
 */
function rowTrack() {
	return [
		grid(),
		raw({ gridTemplateColumns: `${ICON_BOX} minmax(0, 1fr)` }),
		gap(3),
		raw({ rowGap: "0.5rem" }),
		items("start"),
	];
}

/**
 * Renders the `<ol>` and its rail, drawn once behind every icon so an opened fold keeps the line
 * whole; icons and {@link Timeline.Comment} cards sit on `--ui-timeline-surface`, masking the rail,
 * in a `--ui-timeline-icon-box` square. {@link Timeline.Commits} groups a push; all of it is HTML.
 *
 * @param handle Runtime handle carrying the `<ol>`'s props.
 * @returns The render function producing the list's markup.
 * @example
 * <Timeline>
 * 	<Timeline.Event icon={<CircleDotIcon />} tone="danger" actor="Uptime" time={<RelativeTime date={opened} />}>
 * 		opened the incident
 * 	</Timeline.Event>
 * 	<Timeline.Event icon={<MessageSquareIcon />} avatar={<Avatar size="xs" />} actor="Ana" body={<p>Rolling back.</p>}>
 * 		commented
 * 	</Timeline.Event>
 * </Timeline>
 * @example
 * <Timeline aria-label={t("pull.conversation")}>
 * 	<Timeline.Comment id="comment-12" avatar={<Avatar size="xs" />} author="ana" action={t("pull.commented")} time={<RelativeTime date={at} />}>
 * 		<Markdown source={body} />
 * 	</Timeline.Comment>
 * 	<Timeline.Commits icon={<GitCommitHorizontalIcon />} actor="ana" summary={t("pull.addedCommits", { count: 1 })}>
 * 		<Timeline.Commit sha="a1b2c3d" href="/commit/a1b2c3d">Fix the parser</Timeline.Commit>
 * 	</Timeline.Commits>
 * </Timeline>
 */
export function Timeline(handle: Handle<Timeline.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<ol
				data-slot="timeline"
				{...rest}
				mix={mergeMix(
					[
						relative(),
						m(0),
						p(0),
						listStyle("none"),
						vstack({ gap: 3 }),
						text("sm"),
						before([
							pseudoContent('""'),
							raw({
								position: "absolute",
								insetBlock: `calc(${ICON_BOX} / 2)`,
								insetInlineStart: `calc(${ICON_BOX} / 2 - 1px)`,
								inlineSize: "2px",
							}),
							bg("neutral.border"),
						]),
					],
					mix,
				)}
			/>
		);
	};
}

/**
 * Renders one event: its toned icon on the rail, then a single wrapping line of avatar,
 * actor, description and time, then the body card when one is given.
 *
 * @param handle Runtime handle carrying the `<li>`'s props.
 * @returns The render function producing the event's markup.
 * @example
 * <Timeline.Event icon={<RocketIcon />} tone="brand" actor="deploy-bot" time="2m ago">
 * 	deployed v4.2.1
 * </Timeline.Event>
 */
Timeline.Event = function TimelineEvent(handle: Handle<Timeline.EventProps>) {
	return () => {
		let { icon, tone, avatar, actor, time, body, children, mix, ...rest } = handle.props;
		let resolvedTone = tone ?? DEFAULT_TONE;

		return (
			<li
				data-slot="timeline-event"
				data-tone={resolvedTone}
				{...rest}
				mix={mergeMix(rowTrack(), mix)}
			>
				<TimelineIcon tone={resolvedTone}>{icon}</TimelineIcon>
				<div mix={[vstack({ gap: 2 }), minIs(0)]}>
					<p
						data-slot="timeline-line"
						mix={[
							m(0),
							flex(),
							items("center"),
							raw({ flexWrap: "wrap", minBlockSize: ICON_BOX }),
							gap(1.5),
							leading("1.25rem"),
						]}
					>
						{avatar ? <span mix={[inlineFlex()]}>{avatar}</span> : null}
						{actor ? (
							<span data-slot="timeline-actor" mix={[weight("semibold")]}>
								{actor}
							</span>
						) : null}
						{children ? (
							<span data-slot="timeline-description" mix={[fg("neutral.muted")]}>
								{children}
							</span>
						) : null}
						{time ? (
							<span data-slot="timeline-time" mix={[fg("neutral.muted"), text("xs")]}>
								{time}
							</span>
						) : null}
					</p>
					{body ? (
						<div
							data-slot="timeline-body"
							mix={[
								p(3),
								rounded("md"),
								border({ color: "neutral.border", width: 1 }),
								bg("neutral.tint"),
								raw({
									"& > :first-child": { marginBlockStart: 0 },
									"& > :last-child": { marginBlockEnd: 0 },
								}),
							]}
						>
							{body}
						</div>
					) : null}
				</div>
			</li>
		);
	};
};

/**
 * Renders a run of events folded behind a `<details>`: its summary sits on the rail with
 * an ellipsis glyph, and its events open in place, in the same list and on the same rail.
 *
 * @param handle Runtime handle carrying the `<li>`'s props.
 * @returns The render function producing the folded run's markup.
 * @example
 * <Timeline.More summary="4 more events">
 * 	{checks.map((check) => <Timeline.Event icon={<CheckIcon />} actor="Uptime">{check.text}</Timeline.Event>)}
 * </Timeline.More>
 */
Timeline.More = function TimelineMore(handle: Handle<Timeline.MoreProps>) {
	return () => {
		let { summary, open, children, mix, ...rest } = handle.props;

		return (
			<li data-slot="timeline-more" {...rest} mix={mergeMix([], mix)}>
				<details open={open} mix={[raw({ "&[open] > summary": { display: "none" } })]}>
					<summary
						mix={[
							...rowTrack(),
							listStyle("none"),
							raw({ "&::-webkit-details-marker": { display: "none" } }),
							cursor("pointer"),
							rounded("md"),
							focusVisible(outline({ color: "brand.ring", width: 2, offset: 2 })),
						]}
					>
						<TimelineIcon tone="neutral">
							<EllipsisIcon size={16} aria-hidden="true" />
						</TimelineIcon>
						<span
							mix={[
								flex(),
								items("center"),
								bs(ICON_BOX),
								fg("neutral.muted"),
								weight("medium"),
								hover(fg("neutral.emphasis")),
							]}
						>
							{summary}
						</span>
					</summary>
					<ol mix={[m(0), p(0), listStyle("none"), vstack({ gap: 3 })]}>{children}</ol>
				</details>
			</li>
		);
	};
};

/**
 * Renders a comment as a card on the rail: the author's avatar sits where an event's icon
 * would, the header reads "name action time" with a `⋯` slot at its end, and the body and
 * reactions follow. A conversation reads as cards and housekeeping as single lines.
 *
 * @param handle Runtime handle carrying the `<li>`'s props.
 * @returns The render function producing the comment's markup.
 * @example
 * <Timeline.Comment id="comment-12" avatar={<Avatar size="xs" />} author="ana" action="commented" time={<RelativeTime date={at} />} menu={<CommentMenu />} reactions={<Reactions />}>
 * 	<Markdown source={body} />
 * </Timeline.Comment>
 */
Timeline.Comment = function TimelineComment(handle: Handle<Timeline.CommentProps>) {
	return () => {
		let { avatar, author, action, time, menu, reactions, children, mix, ...rest } = handle.props;

		return (
			<li data-slot="timeline-comment" {...rest} mix={mergeMix(rowTrack(), mix)}>
				<span
					data-slot="timeline-avatar"
					mix={[
						relative(),
						inlineFlex(),
						items("center"),
						justify("center"),
						is(ICON_BOX),
						bs(ICON_BOX),
						rounded("full"),
						bg("var(--ui-timeline-surface, var(--ui-bg, Canvas))"),
					]}
				>
					{avatar}
				</span>
				<div
					data-slot="timeline-card"
					mix={[
						minIs(0),
						rounded("md"),
						border({ color: "neutral.border", width: 1 }),
						bg("var(--ui-timeline-surface, var(--ui-bg, Canvas))"),
						raw({ overflow: "clip" }),
					]}
				>
					<header
						data-slot="timeline-comment-header"
						mix={[
							flex(),
							items("center"),
							gap(2),
							pi(3),
							raw({ minBlockSize: "2.5rem", paddingBlock: "0.375rem" }),
							bg("neutral.tint"),
							raw({ borderBlockEnd: "1px solid var(--ui-neutral-border)" }),
						]}
					>
						<p
							mix={[
								m(0),
								flex(),
								items("baseline"),
								raw({ flexWrap: "wrap", columnGap: "0.375rem", flex: "1 1 auto" }),
								minIs(0),
								leading("1.25rem"),
							]}
						>
							<span data-slot="timeline-actor" mix={[weight("semibold")]}>
								{author}
							</span>
							{action ? (
								<span data-slot="timeline-description" mix={[fg("neutral.muted")]}>
									{action}
								</span>
							) : null}
							{time ? (
								<span data-slot="timeline-time" mix={[fg("neutral.muted")]}>
									{time}
								</span>
							) : null}
						</p>
						{menu ? (
							<span data-slot="timeline-comment-menu" mix={[inlineFlex(), raw({ flexShrink: 0 })]}>
								{menu}
							</span>
						) : null}
					</header>
					<div
						data-slot="timeline-comment-body"
						mix={[
							p(3),
							raw({
								overflowWrap: "anywhere",
								"& > :first-child": { marginBlockStart: 0 },
								"& > :last-child": { marginBlockEnd: 0 },
							}),
						]}
					>
						{children}
					</div>
					{reactions ? (
						<div
							data-slot="timeline-reactions"
							mix={[
								flex(),
								items("center"),
								raw({ flexWrap: "wrap" }),
								gap(1.5),
								pi(3),
								raw({ paddingBlockEnd: "0.75rem" }),
							]}
						>
							{reactions}
						</div>
					) : null}
				</div>
			</li>
		);
	};
};

/**
 * Renders a push as one event on the rail with its commits listed under the line: each row
 * gives the subject, its checks and the short sha, so a run of commits costs one rail stop.
 *
 * @param handle Runtime handle carrying the `<li>`'s props.
 * @returns The render function producing the group's markup.
 * @example
 * <Timeline.Commits icon={<GitCommitHorizontalIcon />} actor="ana" summary="added 2 commits" time="3h ago">
 * 	<Timeline.Commit sha="a1b2c3d" href="/commit/a1b2c3d" check={<CheckIcon aria-label="Checks passed" />}>Fix the parser</Timeline.Commit>
 * </Timeline.Commits>
 */
Timeline.Commits = function TimelineCommits(handle: Handle<Timeline.CommitsProps>) {
	return () => {
		let { icon, avatar, actor, summary, time, children, mix, ...rest } = handle.props;

		return (
			<li
				data-slot="timeline-commits"
				data-tone="neutral"
				{...rest}
				mix={mergeMix(rowTrack(), mix)}
			>
				<TimelineIcon tone="neutral">{icon}</TimelineIcon>
				<div mix={[vstack({ gap: 1.5 }), minIs(0)]}>
					<p
						data-slot="timeline-line"
						mix={[
							m(0),
							flex(),
							items("center"),
							raw({ flexWrap: "wrap", minBlockSize: ICON_BOX }),
							gap(1.5),
							leading("1.25rem"),
						]}
					>
						{avatar ? <span mix={[inlineFlex()]}>{avatar}</span> : null}
						{actor ? (
							<span data-slot="timeline-actor" mix={[weight("semibold")]}>
								{actor}
							</span>
						) : null}
						{summary ? (
							<span data-slot="timeline-description" mix={[fg("neutral.muted")]}>
								{summary}
							</span>
						) : null}
						{time ? (
							<span data-slot="timeline-time" mix={[fg("neutral.muted"), text("xs")]}>
								{time}
							</span>
						) : null}
					</p>
					<ol
						data-slot="timeline-commit-list"
						mix={[m(0), p(0), listStyle("none"), vstack({ gap: 0.5 })]}
					>
						{children}
					</ol>
				</div>
			</li>
		);
	};
};

/**
 * Renders one commit of a {@link Timeline.Commits} group: avatar, the subject (truncated to
 * one line), the check-state slot, then the short sha in monospace at the row's end.
 *
 * @param handle Runtime handle carrying the `<li>`'s props.
 * @returns The render function producing the commit's row.
 * @example <Timeline.Commit sha="a1b2c3d" href="/commit/a1b2c3d">Fix the parser</Timeline.Commit>
 */
Timeline.Commit = function TimelineCommit(handle: Handle<Timeline.CommitProps>) {
	return () => {
		let { sha, href, avatar, check, children, mix, ...rest } = handle.props;
		let linkMix = [
			fg("inherit"),
			raw({ textDecoration: "none" }),
			hover(raw({ textDecoration: "underline" })),
		];

		return (
			<li
				data-slot="timeline-commit"
				{...rest}
				mix={mergeMix(
					[flex(), items("center"), gap(2), minIs(0), raw({ minBlockSize: "1.75rem" })],
					mix,
				)}
			>
				{avatar ? <span mix={[inlineFlex(), raw({ flexShrink: 0 })]}>{avatar}</span> : null}
				<span data-slot="timeline-commit-subject" mix={[truncate(), raw({ flex: "0 1 auto" })]}>
					{href ? (
						<a href={href} mix={linkMix}>
							{children}
						</a>
					) : (
						children
					)}
				</span>
				{check ? (
					<span data-slot="timeline-commit-check" mix={[inlineFlex(), raw({ flexShrink: 0 })]}>
						{check}
					</span>
				) : null}
				<code
					data-slot="timeline-commit-sha"
					mix={[
						raw({ marginInlineStart: "auto", flexShrink: 0 }),
						font("mono"),
						text("xs"),
						fg("neutral.muted"),
					]}
				>
					{href ? (
						<a href={href} mix={linkMix}>
							{sha}
						</a>
					) : (
						sha
					)}
				</code>
			</li>
		);
	};
};

/** Props {@link TimelineIcon} reads. */
interface TimelineIconProps {
	tone: Timeline.Tone;
	children: RemixNode;
}

/**
 * The icon box on the rail: the glyph in its tone, on the surface colour so the rail
 * reads as passing behind it.
 *
 * @param handle Runtime handle carrying the tone and glyph.
 * @returns The render function producing the icon box.
 */
function TimelineIcon(handle: Handle<TimelineIconProps>) {
	return () => {
		let { tone, children } = handle.props;

		return (
			<span
				data-slot="timeline-icon"
				data-tone={tone}
				aria-hidden="true"
				mix={[
					relative(),
					inlineFlex(),
					items("center"),
					justify("center"),
					is(ICON_BOX),
					bs(ICON_BOX),
					rounded("full"),
					bg("var(--ui-timeline-surface, var(--ui-bg, Canvas))"),
					fg("neutral.muted"),
					data("tone", "brand", fg("brand")),
					data("tone", "success", fg("success")),
					data("tone", "warning", fg("warning")),
					data("tone", "danger", fg("danger")),
					when("& > svg", raw({ inlineSize: "1rem", blockSize: "1rem" })),
				]}
			>
				{children}
			</span>
		);
	};
}
