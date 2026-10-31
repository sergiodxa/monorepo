/**
 * An animated sequence diagram: two to four parties side by side, each with a lifeline,
 * and the messages between them drawn in order as arrows, then the exchange's outcome. It
 * shows a protocol working (an OAuth sign-in, a webhook delivery) with its real messages.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { CheckIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { keyframes } from "@sdxc/u/animation";
import { raw } from "@sdxc/u/general";
import { motionSafe } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";

import { marketingSurface } from "../styles/marketing.js";

import { MotionLoop } from "./motion-loop.js";

/** Length of one loop: the messages play, the outcome holds, then everything resets. */
const CYCLE_SECONDS = 10;

/** Percent of the cycle at which the first message starts. */
const FIRST_MESSAGE_AT = 8;

/** Most percent of the cycle between one message starting and the next. */
const MAX_MESSAGE_GAP = 14;

/** Percent of the cycle the messages share, so a long exchange still holds its outcome. */
const MESSAGES_SPAN = 70;

/** Share of a message's slot its arrow takes to draw; the arrowhead lands when it ends. */
const DRAW_SHARE = 0.6;

/** Percent of the cycle at which every drawn element clears for the next loop. */
const RESET_AT = 94;

/**
 * Space above the actor row for the pause toggle pinned to the surface's top corner: the
 * toggle's inset and size plus a gap, so the last actor's label never runs under it.
 */
const PAUSE_CLEARANCE = "3.25rem";

/** Block size of an arrow's track, which the arrowhead fills. */
const ARROW_HEIGHT = "0.625rem";

/**
 * Prop types for {@link SequenceDiagram}.
 */
export namespace SequenceDiagram {
	/** One party to the exchange, given its own column and lifeline. */
	export interface Actor {
		name: RemixNode;
		/** Glyph shown above the name, drawn in the brand ink. */
		icon?: RemixNode;
	}

	/** One message, sent from one actor to another, or a note an actor makes to itself. */
	export interface Message {
		/** Index into `actors` of the sender. */
		from: number;
		/** Index into `actors` of the receiver; equal to `from` for a note on one lifeline. */
		to: number;
		/** What is sent, set above the arrow. */
		label: RemixNode;
		/** The message's wire form, set in mono under the arrow. */
		code?: string;
	}

	/**
	 * Props accepted by {@link SequenceDiagram}.
	 */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/** Accessible name of the message list. Required — the library ships no copy. */
		"aria-label": string;
		/** Accessible name of the pause toggle. */
		pauseLabel?: string;
		/** The parties, left to right; two to four fit a phone column. */
		actors: readonly Actor[];
		/** The messages, in the order they are sent. */
		messages: readonly Message[];
		/** The result badge that appears once the last message lands, such as "Signed in". */
		outcome?: RemixNode;
		/** A note across from the outcome, such as what the exchange protects against. */
		footnote?: RemixNode;
	}
}

/**
 * Renders the exchange on a raised surface inside a {@link MotionLoop}: an actor row, a
 * lifeline per actor, and one list item per message whose arrow runs between the two
 * lifelines' centres. Without motion every arrow shows drawn, so the static picture is the
 * finished exchange. Two diagrams with the same message count share keyframes.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the diagram's markup.
 * @example
 * <SequenceDiagram
 * 	aria-label="A PKCE sign-in"
 * 	actors={[{ name: "Browser" }, { name: "Your app" }]}
 * 	messages={[{ from: 0, to: 1, label: "Open /login" }]}
 * 	outcome="Signed in"
 * />
 */
export function SequenceDiagram(handle: Handle<SequenceDiagram.Props>) {
	return () => {
		let {
			"aria-label": label,
			actors,
			footnote,
			messages,
			mix,
			outcome,
			pauseLabel,
			...rest
		} = handle.props;
		let timing = timingFor(messages.length);
		let columns = `repeat(${actors.length}, minmax(0, 1fr))`;

		return (
			<MotionLoop {...rest} pauseLabel={pauseLabel} placement="start-end" mix={mix}>
				<div
					data-slot="sequence-diagram"
					mix={[
						marketingSurface(),
						raw({
							display: "grid",
							gap: "1.25rem",
							padding: "clamp(1rem, 4cqi, 2rem)",
							paddingBlockStart: PAUSE_CLEARANCE,
						}),
					]}
				>
					<div
						data-slot="sequence-diagram-actors"
						mix={[raw({ display: "grid", gridTemplateColumns: columns })]}
					>
						{actors.map((actor, index) => (
							<div key={index} mix={[actorCell()]}>
								{actor.icon === undefined ? null : (
									<span aria-hidden="true" mix={[actorIcon()]}>
										{actor.icon}
									</span>
								)}
								<span mix={[actorName()]}>{actor.name}</span>
							</div>
						))}
					</div>

					<div mix={[raw({ position: "relative" })]}>
						<div
							aria-hidden="true"
							mix={[
								raw({
									position: "absolute",
									inset: "-1.25rem 0 0",
									display: "grid",
									gridTemplateColumns: columns,
								}),
							]}
						>
							{actors.map((_, index) => (
								<span key={index} mix={[raw({ position: "relative" })]}>
									<span data-slot="sequence-diagram-lifeline" mix={[lifeline()]} />
								</span>
							))}
						</div>
						<ol
							aria-label={label}
							mix={[
								raw({
									position: "relative",
									display: "grid",
									gap: "1rem",
									margin: "0",
									padding: "0",
									listStyle: "none",
								}),
							]}
						>
							{messages.map((message, index) => (
								<li
									key={index}
									mix={[
										raw({
											position: "relative",
											display: "grid",
											gridTemplateColumns: columns,
										}),
									]}
								>
									<span mix={[visuallyHidden()]}>
										{actors[message.from]?.name}
										{message.from === message.to ? null : <> → {actors[message.to]?.name}</>}:{" "}
									</span>
									<MessageRow message={message} timing={timing} index={index} />
								</li>
							))}
						</ol>
					</div>

					{outcome === undefined && footnote === undefined ? null : (
						<div
							data-slot="sequence-diagram-footer"
							mix={[
								raw({
									display: "flex",
									flexWrap: "wrap",
									alignItems: "center",
									justifyContent: "space-between",
									gap: "0.75rem",
									paddingBlockStart: "1.25rem",
									borderBlockStart:
										"1px solid var(--ui-marketing-hairline, var(--ui-neutral-border))",
								}),
							]}
						>
							{outcome === undefined ? null : (
								<span data-slot="sequence-diagram-outcome" mix={[outcomeBadge(timing)]}>
									<CheckIcon size={14} strokeWidth={2.5} aria-hidden="true" />
									{outcome}
								</span>
							)}
							{footnote === undefined ? null : (
								<span
									mix={[
										detail(),
										raw({ display: "inline-flex", alignItems: "center", gap: "0.375rem" }),
									]}
								>
									{footnote}
								</span>
							)}
						</div>
					)}
				</div>
			</MotionLoop>
		);
	};
}

/** When each message of an exchange of a given length plays, in percent of the cycle. */
interface Timing {
	/** Number of messages, which names the keyframes so equal exchanges share them. */
	count: number;
	gap: number;
}

/** Spreads `count` messages over {@link MESSAGES_SPAN}, never further apart than the max gap. */
function timingFor(count: number): Timing {
	return {
		count,
		gap: count > 0 ? Math.min(MAX_MESSAGE_GAP, MESSAGES_SPAN / count) : MAX_MESSAGE_GAP,
	};
}

/** Percent of the cycle at which message `index` starts; `count` gives when the last ends. */
function startsAt(timing: Timing, index: number) {
	return FIRST_MESSAGE_AT + index * timing.gap;
}

/** Percent of the cycle at which message `index`'s arrow finishes drawing. */
function landsAt(timing: Timing, index: number) {
	return startsAt(timing, index) + timing.gap * DRAW_SHARE;
}

/** Props {@link MessageRow} reads. */
interface MessageRowProps {
	message: SequenceDiagram.Message;
	timing: Timing;
	index: number;
}

/**
 * A message's label, arrow and code, spanning the columns from sender to receiver. The
 * arrow's track is inset by half a column on each side, so it starts and ends on the two
 * lifelines' centres however wide the card is. A note to self is a pill on one lifeline.
 */
function MessageRow(handle: Handle<MessageRowProps>) {
	return () => {
		let { index, message, timing } = handle.props;
		let first = Math.min(message.from, message.to);
		let last = Math.max(message.from, message.to);
		let spanned = last - first + 1;
		let text = textFade(timing, index);
		let code =
			message.code === undefined ? null : (
				<code
					mix={[
						detail(),
						raw({ fontFamily: "var(--ui-font-mono)", paddingInline: "0.25rem" }),
						text,
					]}
				>
					{message.code}
				</code>
			);

		if (message.from === message.to) {
			return (
				<span
					data-slot="sequence-diagram-message"
					mix={[messageCell(first, last), raw({ justifyItems: "center" })]}
				>
					<span data-slot="sequence-diagram-note" mix={[notePill(), noteFade(timing, index)]}>
						{message.label}
					</span>
					{code}
				</span>
			);
		}

		let forward = message.to > message.from;
		let inset = `calc(100% / ${2 * spanned})`;

		return (
			<span data-slot="sequence-diagram-message" mix={[messageCell(first, last)]}>
				<span mix={[caption(), text]}>{message.label}</span>
				<span
					aria-hidden="true"
					data-slot="sequence-diagram-arrow"
					data-direction={forward ? "end" : "start"}
					mix={[
						raw({
							position: "relative",
							display: "block",
							blockSize: ARROW_HEIGHT,
							marginInline: inset,
							color: "var(--ui-brand-fg)",
						}),
					]}
				>
					<span mix={[arrowLine(timing, index, forward)]} />
					<svg
						viewBox="0 0 10 10"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						mix={[arrowHead(timing, index, forward)]}
					>
						<path d="M4 1 L9 5 L4 9" />
					</svg>
				</span>
				{code}
			</span>
		);
	};
}

/** The animation declarations every drawn element shares: one linear loop of the cycle. */
function loop(name: string) {
	return {
		animationName: name,
		animationDuration: `${CYCLE_SECONDS}s`,
		animationTimingFunction: "linear",
		animationIterationCount: "infinite",
		animationFillMode: "both",
	};
}

/**
 * Keyframe stops that hold `off` until `at`, switch to `on`, and go back to `off` at
 * {@link RESET_AT}, so every element of the exchange resets together.
 */
function litFrames(at: number, off: Record<string, string>, on: Record<string, string>) {
	return {
		"0%": off,
		[`${at - 1}%`]: off,
		[`${at}%`]: on,
		[`${RESET_AT}%`]: on,
		[`${RESET_AT + 2}%`]: off,
		"100%": off,
	};
}

/** The grid area a message spans, from the sender's column to the receiver's. */
function messageCell(first: number, last: number) {
	return raw({
		gridColumn: `${first + 1} / ${last + 2}`,
		display: "grid",
		gap: "0.25rem",
		minInlineSize: "0",
		textAlign: "center",
	});
}

/** A message's label and code, which fade in as its arrow starts. */
function textFade(timing: Timing, index: number) {
	let name = `ui-sequence-diagram-text-${timing.count}-${index}`;

	return [
		keyframes(name, litFrames(startsAt(timing, index), { opacity: "0" }, { opacity: "1" })),
		motionSafe(raw(loop(name))),
	];
}

/**
 * An arrow's shaft, drawn out from the sender's side of the track. `forward` arrows point
 * toward the inline end, so the origin flips on right-to-left pages along with the columns.
 */
function arrowLine(timing: Timing, index: number, forward: boolean) {
	let name = `ui-sequence-diagram-arrow-${timing.count}-${index}`;
	let from = startsAt(timing, index);
	let to = landsAt(timing, index);

	return [
		keyframes(name, {
			"0%": { transform: "scaleX(0)" },
			[`${from}%`]: { transform: "scaleX(0)" },
			[`${to}%`]: { transform: "scaleX(1)" },
			[`${RESET_AT}%`]: { transform: "scaleX(1)" },
			[`${RESET_AT + 2}%`]: { transform: "scaleX(0)" },
			"100%": { transform: "scaleX(0)" },
		}),
		raw({
			position: "absolute",
			insetInline: "0",
			insetBlockStart: `calc(${ARROW_HEIGHT} / 2 - 1px)`,
			blockSize: "2px",
			borderRadius: "1px",
			backgroundColor: "currentColor",
			transformOrigin: forward ? "left" : "right",
		}),
		when("&:dir(rtl)", raw({ transformOrigin: forward ? "right" : "left" })),
		motionSafe(raw(loop(name))),
	];
}

/**
 * An arrow's head at the receiver's lifeline, shown once the shaft reaches it. It sits on
 * the receiver's logical side and turns to face it in either writing direction.
 */
function arrowHead(timing: Timing, index: number, forward: boolean) {
	let name = `ui-sequence-diagram-head-${timing.count}-${index}`;

	return [
		keyframes(name, litFrames(landsAt(timing, index), { opacity: "0" }, { opacity: "1" })),
		raw({
			position: "absolute",
			insetBlockStart: "0",
			[forward ? "insetInlineEnd" : "insetInlineStart"]: "-1px",
			inlineSize: ARROW_HEIGHT,
			blockSize: ARROW_HEIGHT,
			transform: forward ? "none" : "scaleX(-1)",
		}),
		when("&:dir(rtl)", raw({ transform: forward ? "scaleX(-1)" : "none" })),
		motionSafe(raw(loop(name))),
	];
}

/** A note to self, which pops onto its lifeline when its turn comes. */
function noteFade(timing: Timing, index: number) {
	let name = `ui-sequence-diagram-note-${timing.count}-${index}`;

	return [
		keyframes(
			name,
			litFrames(
				startsAt(timing, index),
				{ opacity: "0", transform: "scale(0.9)" },
				{ opacity: "1", transform: "none" },
			),
		),
		motionSafe(raw(loop(name))),
	];
}

/** The pill a note to self sits in, opaque so its lifeline passes behind it. */
function notePill() {
	return raw({
		maxInlineSize: "100%",
		paddingInline: "0.5rem",
		paddingBlock: "0.125rem",
		borderRadius: "0.75rem",
		border: "1px solid var(--ui-brand-border)",
		backgroundColor: "var(--ui-bg)",
		fontSize: "0.8125rem",
		lineHeight: "1.25rem",
		fontWeight: "600",
		color: "var(--ui-neutral-fg-emphasis)",
		overflowWrap: "anywhere",
	});
}

/** A dashed line down the middle of an actor's column. */
function lifeline() {
	return raw({
		position: "absolute",
		insetBlock: "0",
		insetInlineStart: "calc(50% - 0.5px)",
		inlineSize: "0",
		borderInlineStart: "1px dashed var(--ui-neutral-border)",
	});
}

/** An actor's cell in the header row: its icon over its name, centred on its lifeline. */
function actorCell() {
	return raw({
		display: "grid",
		justifyItems: "center",
		alignContent: "end",
		gap: "0.375rem",
		minInlineSize: "0",
		paddingInline: "0.125rem",
		textAlign: "center",
	});
}

/** The round well an actor's icon sits in. */
function actorIcon() {
	return raw({
		display: "grid",
		placeItems: "center",
		inlineSize: "1.75rem",
		blockSize: "1.75rem",
		borderRadius: "9999px",
		border: "1px solid var(--ui-brand-border)",
		backgroundColor: "var(--ui-bg)",
		color: "var(--ui-brand-fg)",
	});
}

/** An actor's name in the heading ink. */
function actorName() {
	return raw({
		maxInlineSize: "100%",
		fontSize: "0.75rem",
		lineHeight: "1.125rem",
		fontWeight: "600",
		color: "var(--ui-neutral-fg-emphasis)",
		overflowWrap: "anywhere",
		hyphens: "auto",
	});
}

/** The exchange's outcome, which appears after the last message lands. */
function outcomeBadge(timing: Timing) {
	let name = `ui-sequence-diagram-outcome-${timing.count}`;

	return [
		keyframes(
			name,
			litFrames(
				startsAt(timing, timing.count),
				{ opacity: "0", transform: "translateY(4px)" },
				{ opacity: "1", transform: "none" },
			),
		),
		raw({
			display: "inline-flex",
			alignItems: "center",
			gap: "0.375rem",
			paddingInline: "0.625rem",
			paddingBlock: "0.25rem",
			borderRadius: "9999px",
			fontSize: "0.8125rem",
			fontWeight: "600",
			color: "var(--ui-success-fg)",
			backgroundColor: "var(--ui-success-bg-tint)",
		}),
		motionSafe(raw(loop(name))),
	];
}

/** A message's label in the heading ink, wrapping within the columns it spans. */
function caption() {
	return raw({
		paddingInline: "0.25rem",
		fontSize: "0.8125rem",
		lineHeight: "1.25rem",
		fontWeight: "600",
		color: "var(--ui-neutral-fg-emphasis)",
		overflowWrap: "anywhere",
	});
}

/** A message's code line, and the footnote. */
function detail() {
	return raw({
		fontSize: "0.75rem",
		lineHeight: "1.125rem",
		color: "var(--ui-neutral-fg-muted)",
		overflowWrap: "anywhere",
	});
}
