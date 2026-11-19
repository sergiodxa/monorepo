/**
 * A whole trip on one vertical timeline: days under headings, and within each day a flight,
 * stay, car, activity or note per item, each with its icon on a connecting rail, its time,
 * title, detail lines, a status slot and an actions slot.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { BedDoubleIcon, CarIcon, PlaneIcon, StickyNoteIcon, TicketIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { listStyle, pseudoContent, raw, mergeMix } from "@sdxc/u/general";
import {
	container,
	flex,
	gap,
	grid,
	inlineFlex,
	items,
	justify,
	relative,
	vstack,
} from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { bs, is, m, minIs, p } from "@sdxc/u/size";
import { after, data, when } from "@sdxc/u/state";
import { leading, tabularNums, text, weight } from "@sdxc/u/typography";

import type { HeadingLevel } from "../components/heading-scope.js";

import {
	readAmbientLevel,
	resolveHeadingLevel,
	TAG_BY_LEVEL,
} from "../components/heading-scope.js";

/** Container the timeline names, so items lay out by the timeline's width. */
const CONTAINER_NAME = "ui-trip-timeline";

/** Timeline width from which an item's time takes a column before the rail. */
const TIME_COLUMN_WIDTH = "30rem";

/** The side of the round marker each item's icon sits in; the rail runs through its middle. */
const MARKER = "var(--ui-trip-timeline-marker, 2rem)";

/** Space between items, which the rail spans to reach the next marker. */
const ITEM_GAP = "1.25rem";

/** Heading level a day takes where nothing sets one. */
const DEFAULT_LEVEL: HeadingLevel = 3;

/**
 * Prop types for {@link TripTimeline} and its compound parts.
 */
export namespace TripTimeline {
	/** What an item is, which picks its icon and tone. */
	export type Kind = "flight" | "stay" | "car" | "activity" | "note";

	/** What {@link TripTimeline} shares with its days and items. */
	export interface Context {
		kindLabels?: Partial<Record<Kind, string>>;
		level?: HeadingLevel;
	}

	/** Every native `<ol>` attribute, plus the words for each kind. */
	export interface Props extends TagProps<"ol"> {
		/**
		 * Hidden words read before an item's title in place of its icon, such as
		 * `{ flight: "Flight", stay: "Stay" }`.
		 */
		kindLabels?: Partial<Record<Kind, string>>;
		/** The heading level of every day; the ambient level, then 3, when left out. */
		level?: HeadingLevel;
		/** The {@link TripTimeline.Day} items. */
		children: RemixNode;
	}

	/** Every native `<li>` attribute, plus the day's heading and its items. */
	export interface DayProps extends Omit<TagProps<"li">, "children"> {
		/** The day, formatted, such as "Fri 14 Mar". */
		heading: RemixNode;
		/** A machine-readable date for the `<time>` the heading sits in, such as "2026-03-14". */
		date?: string;
		/** Muted words after the heading, such as "Day 1 · Merrow". */
		detail?: RemixNode;
		/** The {@link TripTimeline.Item} entries. */
		children: RemixNode;
	}

	/** Every native `<li>` attribute, plus what the item is and when. */
	export interface ItemProps extends Omit<TagProps<"li">, "children" | "title"> {
		kind: Kind;
		/** A glyph in place of the kind's own. */
		icon?: RemixNode;
		/** When it happens, formatted, such as "08:40" or "Check-in from 15:00". */
		time?: RemixNode;
		/** A machine-readable moment for the `<time>` the time sits in. */
		dateTime?: string;
		/** What it is, such as "LW 214 Merrow → Vellis". */
		title: RemixNode;
		/** Lines under the title, such as a terminal, a confirmation code or an address. */
		details?: RemixNode[];
		/** A status at the title's end, such as a `<Badge>` reading "Confirmed". */
		status?: RemixNode;
		/** Links or buttons under the item, such as "Add to calendar". */
		actions?: RemixNode;
		/** Anything else under the details, such as a small map or a note. */
		children?: RemixNode;
	}
}

/**
 * The glyph for an item of each kind.
 *
 * @param kind What the item is.
 * @returns A 16px icon for the kind.
 */
function kindIcon(kind: TripTimeline.Kind): RemixNode {
	if (kind === "flight") return <PlaneIcon size={16} />;
	if (kind === "stay") return <BedDoubleIcon size={16} />;
	if (kind === "car") return <CarIcon size={16} />;
	if (kind === "activity") return <TicketIcon size={16} />;
	return <StickyNoteIcon size={16} />;
}

/**
 * Renders the trip as an `<ol>` of days. Under 30rem each item's time sits over its title; wider,
 * times take a column before the rail so a day reads down like a schedule.
 *
 * @param handle Runtime handle carrying the list's props and sharing kind words and level.
 * @returns The render function producing the timeline's markup.
 * @example
 * <TripTimeline aria-label="Trip to Vellis" kindLabels={{ flight: "Flight", stay: "Stay" }}>
 * 	<TripTimeline.Day heading="Fri 14 Mar" date="2026-03-14" detail="Day 1">
 * 		<TripTimeline.Item kind="flight" time="08:40" title="LW 214 Merrow → Vellis" status={<Badge>Confirmed</Badge>} />
 * 		<TripTimeline.Item kind="stay" time="15:00" title="Check in at Hotel Saltmarsh" />
 * 	</TripTimeline.Day>
 * </TripTimeline>
 */
export function TripTimeline(handle: Handle<TripTimeline.Props, TripTimeline.Context>) {
	return () => {
		let { kindLabels, level, children, mix, ...rest } = handle.props;
		handle.context.set({ kindLabels, level });

		return (
			<ol
				data-slot="trip-timeline"
				{...rest}
				mix={mergeMix(
					[
						container(CONTAINER_NAME, "inline-size"),
						m(0),
						p(0),
						listStyle("none"),
						vstack({ gap: 6 }),
						minIs(0),
						text("sm"),
					],
					mix,
				)}
			>
				{children}
			</ol>
		);
	};
}

/**
 * Renders one day: a heading at the ambient level (its date in a `<time>`) with muted detail
 * beside it, then the day's items in their own ordered list on one rail.
 *
 * @param handle Runtime handle carrying the day's props.
 * @returns The render function producing the day's list item.
 * @example
 * <TripTimeline.Day heading="Sat 15 Mar" date="2026-03-15" detail="Day 2 · Vellis">…</TripTimeline.Day>
 */
TripTimeline.Day = function TripTimelineDay(handle: Handle<TripTimeline.DayProps>) {
	return () => {
		let { heading, date, detail, children, mix, ...rest } = handle.props;
		let { level } = handle.context.get(TripTimeline);
		let Heading =
			TAG_BY_LEVEL[resolveHeadingLevel(handle, level ?? readAmbientLevel(handle) ?? DEFAULT_LEVEL)];

		return (
			<li
				data-slot="trip-timeline-day"
				{...rest}
				mix={mergeMix([vstack({ gap: 3 }), minIs(0)], mix)}
			>
				<div
					mix={[
						flex(),
						items("baseline"),
						raw({ flexWrap: "wrap", columnGap: "0.5rem" }),
						p(0),
						raw({ paddingBlockEnd: "0.5rem" }),
						raw({ borderBlockEnd: "1px solid var(--ui-neutral-border)" }),
					]}
				>
					<Heading
						data-slot="trip-timeline-day-heading"
						mix={[m(0), text("base"), weight("semibold"), fg("neutral.emphasis")]}
					>
						{date === undefined ? heading : <time dateTime={date}>{heading}</time>}
					</Heading>
					{detail === undefined ? null : (
						<span data-slot="trip-timeline-day-detail" mix={[text("xs"), fg("neutral.muted")]}>
							{detail}
						</span>
					)}
				</div>
				<ol
					data-slot="trip-timeline-items"
					mix={[m(0), p(0), listStyle("none"), vstack({ gap: 0 }), raw({ rowGap: ITEM_GAP })]}
				>
					{children}
				</ol>
			</li>
		);
	};
};

/**
 * Renders one booked item: a round marker with the kind's icon on the rail, which runs on to the
 * next item's marker, then the time, the title with its status, detail lines and actions. The
 * marker takes the kind's tone, and the kind's words from `kindLabels` lead the title.
 *
 * @param handle Runtime handle carrying the item's props.
 * @returns The render function producing the item's list item.
 * @example
 * <TripTimeline.Item kind="car" time="11:30" title="Pick up at Tallow Rent" details={["Terminal 1, level 0", "Ref. TR-58213"]}
 * 	actions={<a href="/trip.ics">Add to calendar</a>} />
 */
TripTimeline.Item = function TripTimelineItem(handle: Handle<TripTimeline.ItemProps>) {
	return () => {
		let { kind, icon, time, dateTime, title, details, status, actions, children, mix, ...rest } =
			handle.props;
		let { kindLabels } = handle.context.get(TripTimeline);
		let kindLabel = kindLabels?.[kind];

		return (
			<li
				data-slot="trip-timeline-item"
				data-kind={kind}
				{...rest}
				mix={mergeMix(
					[
						grid(),
						raw({
							gridTemplateColumns: `${MARKER} minmax(0, 1fr)`,
							gridTemplateAreas: '"marker time" "marker body"',
							columnGap: "0.75rem",
							alignItems: "start",
						}),
						when(
							"&:last-child > [data-slot=trip-timeline-marker]::after",
							raw({ display: "none" }),
						),
						when(
							"&:not(:has([data-slot=trip-timeline-time]))",
							raw({ gridTemplateAreas: '"marker body"' }),
						),
						at(
							TIME_COLUMN_WIDTH,
							CONTAINER_NAME,
							raw({
								gridTemplateColumns: `5.5rem ${MARKER} minmax(0, 1fr)`,
								gridTemplateAreas: '"time marker body"',
							}),
						),
					],
					mix,
				)}
			>
				<span
					data-slot="trip-timeline-marker"
					mix={[
						relative(),
						raw({ gridArea: "marker", alignSelf: "stretch" }),
						after([
							pseudoContent('""'),
							raw({
								position: "absolute",
								insetBlockStart: `calc(${MARKER} + 0.25rem)`,
								insetBlockEnd: `calc(-1 * ${ITEM_GAP} + 0.25rem)`,
								insetInlineStart: "calc(50% - 1px)",
								inlineSize: "2px",
								borderRadius: "1px",
							}),
							bg("neutral.border"),
						]),
					]}
				>
					<span
						data-slot="trip-timeline-icon"
						aria-hidden="true"
						mix={[
							inlineFlex(),
							items("center"),
							justify("center"),
							is(MARKER),
							bs(MARKER),
							rounded("full"),
							bg("neutral.tint"),
							fg("neutral.muted"),
							raw({ boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)" }),
							data("kind", "flight", [
								bg("brand.tint"),
								fg("brand"),
								raw({ boxShadow: "inset 0 0 0 1px var(--ui-brand-border)" }),
							]),
							data("kind", "stay", [
								bg("success.tint"),
								fg("success"),
								raw({ boxShadow: "inset 0 0 0 1px var(--ui-success-border)" }),
							]),
							data("kind", "car", [
								bg("warning.tint"),
								fg("warning.emphasis"),
								raw({ boxShadow: "inset 0 0 0 1px var(--ui-warning-border)" }),
							]),
							data("kind", "activity", [
								bg("danger.tint"),
								fg("danger"),
								raw({ boxShadow: "inset 0 0 0 1px var(--ui-danger-border)" }),
							]),
							when("& > svg", raw({ inlineSize: "1rem", blockSize: "1rem" })),
						]}
						data-kind={kind}
					>
						{icon ?? kindIcon(kind)}
					</span>
				</span>
				{time === undefined ? null : (
					<span
						data-slot="trip-timeline-time"
						mix={[
							raw({ gridArea: "time" }),
							text("xs"),
							weight("medium"),
							fg("neutral.muted"),
							tabularNums(),
							at(TIME_COLUMN_WIDTH, CONTAINER_NAME, [
								text("sm"),
								raw({ textAlign: "end", lineHeight: MARKER }),
							]),
						]}
					>
						{dateTime === undefined ? time : <time dateTime={dateTime}>{time}</time>}
					</span>
				)}
				<div
					data-slot="trip-timeline-body"
					mix={[
						raw({ gridArea: "body" }),
						vstack({ gap: 1.5 }),
						minIs(0),
						at(TIME_COLUMN_WIDTH, CONTAINER_NAME, raw({ paddingBlockStart: "0.3125rem" })),
					]}
				>
					<div
						mix={[
							flex(),
							items("start"),
							raw({ flexWrap: "wrap", justifyContent: "space-between" }),
							gap(2),
						]}
					>
						<p
							data-slot="trip-timeline-title"
							mix={[
								m(0),
								minIs(0),
								weight("semibold"),
								leading(1.35),
								fg("neutral.emphasis"),
								raw({ flex: "1 1 12rem" }),
							]}
						>
							{kindLabel === undefined ? null : (
								<span mix={[visuallyHidden()]}>{`${kindLabel}: `}</span>
							)}
							{title}
						</p>
						{status === undefined ? null : (
							<span data-slot="trip-timeline-status" mix={[inlineFlex(), raw({ flexShrink: 0 })]}>
								{status}
							</span>
						)}
					</div>
					{details === undefined || details.length === 0 ? null : (
						<ul
							data-slot="trip-timeline-details"
							mix={[
								m(0),
								p(0),
								listStyle("none"),
								vstack({ gap: 0.5 }),
								text("xs"),
								fg("neutral.muted"),
								leading(1.45),
							]}
						>
							{details.map((line) => (
								<li mix={[raw({ overflowWrap: "anywhere" })]}>{line}</li>
							))}
						</ul>
					)}
					{children}
					{actions === undefined ? null : (
						<div
							data-slot="trip-timeline-actions"
							mix={[
								flex(),
								raw({ flexWrap: "wrap" }),
								gap(3),
								text("xs"),
								raw({ marginBlockStart: "0.25rem" }),
							]}
						>
							{actions}
						</div>
					)}
				</div>
			</li>
		);
	};
};
