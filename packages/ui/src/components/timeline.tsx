/**
 * A record's activity as an ordered list: a 2px rail threading 16px event icons toned by
 * what happened, one line per event (avatar, bold actor, muted verb, time), an optional
 * comment card, and a native `<details>` folding a run of quiet events into "N more".
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
import { bs, is, m, minIs, p } from "@sdxc/u/size";
import { before, data, focusVisible, hover, when } from "@sdxc/u/state";
import { leading, text, weight } from "@sdxc/u/typography";

/** The side of the square each event's icon sits centred in; the rail runs through its middle. */
const ICON_BOX = "var(--ui-timeline-icon-box, 1.5rem)";

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
		/** @default "neutral" */
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
 * Renders the `<ol>` and its rail. The rail is drawn once, behind every icon from the
 * first to the last, so a folded run keeps the line continuous when it opens; icons sit on
 * the page's background, `--ui-timeline-surface`, which masks the rail where they meet it.
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
		let resolvedTone = tone ?? "neutral";

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
