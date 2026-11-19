/**
 * A journey of one or more legs: the title, stop count and total duration over the whole trip
 * on one line, then a native `<details>` whose toggle lists every leg with the layovers
 * between them. It opens and closes with no script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { ChevronDownIcon, ClockIcon, CircleAlertIcon } from "@sdxc/icons";
import { bg, border, fg, outline } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { cursor, listStyle, raw, mergeMix } from "@sdxc/u/general";
import { container, flex, gap, inlineFlex, items, vstack } from "@sdxc/u/layout";
import { motionSafe } from "@sdxc/u/responsive";
import { m, minIs, p, pi } from "@sdxc/u/size";
import { focusVisible, hover, when } from "@sdxc/u/state";
import { leading, tabularNums, text, truncate, weight } from "@sdxc/u/typography";

import { FlightRoute, FlightSegment } from "./flight-segment.js";

/** Container the journey names, so its legs measure the journey rather than the page. */
const CONTAINER_NAME = "ui-flight-itinerary";

/** Tone a layover takes when `tone` is left out. */
const DEFAULT_LAYOVER_TONE: FlightItinerary.LayoverTone = "default";

/**
 * Prop types for {@link FlightItinerary} and its compound parts.
 */
export namespace FlightItinerary {
	/** `"warning"` flags a connection worth a second look: a short one, an overnight one. */
	export type LayoverTone = "default" | "warning";

	/** Every native `<section>` attribute, plus the journey's summary and its legs. */
	export interface Props extends Omit<TagProps<"section">, "title"> {
		/** What the journey is, such as "Outbound · Fri 14 Mar", over the summary line. */
		title?: RemixNode;
		/** Who flies it, such as "Larkwing Air" or "Larkwing Air, Fenwick Connect". */
		airline?: RemixNode;
		/** Where the whole journey starts. */
		departure: FlightRoute.Endpoint;
		/** Where the whole journey ends. */
		arrival: FlightRoute.Endpoint;
		/** The whole journey's duration, layovers included, such as "9h 40m". */
		duration: RemixNode;
		/**
		 * How many stops the summary line draws.
		 *
		 * @default 0
		 */
		stops?: number;
		/** The stop count as words, such as "Nonstop" or "1 stop". */
		stopsLabel?: RemixNode;
		/** The badge after the final arrival time, such as "+1". */
		dayOffset?: string;
		/** What the day badge means, read in its place. */
		dayOffsetLabel?: string;
		/** Hidden words that make the summary line a sentence; see {@link FlightRoute.Labels}. */
		labels?: FlightRoute.Labels;
		/** The words on the disclosure's toggle, such as "Flight details". */
		toggleLabel: RemixNode;
		/** Starts with every leg showing. */
		open?: boolean;
		/** The {@link FlightItinerary.Segment} and {@link FlightItinerary.Layover} items, in order. */
		children: RemixNode;
	}

	/** Every {@link FlightSegment} prop, for one leg of the journey. */
	export interface SegmentProps extends FlightSegment.Props {}

	/** Every native `<li>` attribute, plus what the connection is. */
	export interface LayoverProps extends Omit<TagProps<"li">, "children"> {
		/** The connection in words, such as "1h 35m layover in VLS Vellis". */
		children: RemixNode;
		/** A second line, such as "Overnight · change terminals". */
		note?: RemixNode;
		/** @default "default" */
		tone?: LayoverTone;
		/** A glyph before the words; a clock, or an alert for a warning, when left out. */
		icon?: RemixNode;
	}
}

/**
 * Renders the journey: a `<section>` with the title, stop count and total duration over the trip
 * on one {@link FlightRoute} line, then a `<details>` whose `<summary>` is the toggle and whose
 * body is an ordered list of legs and layovers, so the legs open and close with no script.
 *
 * @param handle Runtime handle carrying the journey's props.
 * @returns The render function producing the journey's markup.
 * @example
 * <FlightItinerary title="Outbound · Fri 14 Mar" airline="Larkwing Air" departure={{ time: "08:40", code: "MRW" }}
 * 	arrival={{ time: "18:20", code: "OSK" }} duration="9h 40m" stops={1} stopsLabel="1 stop" toggleLabel="Flight details">
 * 	<FlightItinerary.Segment airline="Larkwing Air" flightNumber="LW 214" … />
 * 	<FlightItinerary.Layover>1h 35m layover in VLS Vellis</FlightItinerary.Layover>
 * 	<FlightItinerary.Segment airline="Larkwing Air" flightNumber="LW 731" … />
 * </FlightItinerary>
 */
export function FlightItinerary(handle: Handle<FlightItinerary.Props>) {
	return () => {
		let {
			title,
			airline,
			departure,
			arrival,
			duration,
			stops,
			stopsLabel,
			dayOffset,
			dayOffsetLabel,
			labels,
			toggleLabel,
			open,
			children,
			mix,
			...rest
		} = handle.props;

		return (
			<section
				data-slot="flight-itinerary"
				{...rest}
				mix={mergeMix(
					[container(CONTAINER_NAME, "inline-size"), vstack({ gap: 3 }), minIs(0), text("sm")],
					mix,
				)}
			>
				<div
					data-slot="flight-itinerary-header"
					mix={[
						flex(),
						items("baseline"),
						raw({ flexWrap: "wrap", columnGap: "0.75rem", rowGap: "0.125rem" }),
					]}
				>
					{title === undefined ? null : (
						<span
							data-slot="flight-itinerary-title"
							mix={[weight("semibold"), fg("neutral.emphasis"), raw({ flex: "1 1 auto" })]}
						>
							{title}
						</span>
					)}
					{airline === undefined ? null : (
						<span
							data-slot="flight-itinerary-airline"
							mix={[fg("neutral.muted"), truncate(), raw({ flex: "1 1 auto" })]}
						>
							{airline}
						</span>
					)}
					<span
						data-slot="flight-itinerary-totals"
						mix={[text("xs"), fg("neutral.muted"), tabularNums(), raw({ whiteSpace: "nowrap" })]}
					>
						{stopsLabel}
						{stopsLabel === undefined ? null : " · "}
						{duration}
					</span>
				</div>
				<FlightRoute
					departure={departure}
					arrival={arrival}
					duration={duration}
					stops={stops}
					dayOffset={dayOffset}
					dayOffsetLabel={dayOffsetLabel}
					labels={labels}
				/>
				<details
					open={open}
					mix={[when("&[open] [data-slot=flight-itinerary-chevron]", raw({ rotate: "180deg" }))]}
				>
					<summary
						data-slot="flight-itinerary-summary"
						mix={[
							inlineFlex(),
							items("center"),
							gap(1),
							listStyle("none"),
							raw({ "&::-webkit-details-marker": { display: "none" } }),
							cursor("pointer"),
							rounded("sm"),
							text("xs"),
							weight("medium"),
							fg("brand"),
							hover(raw({ textDecoration: "underline" })),
							focusVisible(outline({ color: "brand.ring", width: 2, offset: 2 })),
						]}
					>
						{toggleLabel}
						<span
							data-slot="flight-itinerary-chevron"
							aria-hidden="true"
							mix={[inlineFlex(), motionSafe(raw({ transition: "rotate 150ms ease" }))]}
						>
							<ChevronDownIcon size={14} />
						</span>
					</summary>
					<ol
						data-slot="flight-itinerary-legs"
						mix={[
							m(0),
							p(0),
							listStyle("none"),
							vstack({ gap: 3 }),
							raw({ marginBlockStart: "1rem", paddingBlockStart: "1rem" }),
							border({ color: "neutral.border", width: 0 }),
							raw({ borderBlockStartWidth: "1px", borderBlockStartStyle: "solid" }),
						]}
					>
						{children}
					</ol>
				</details>
			</section>
		);
	};
}

/**
 * Renders one leg of the journey as a list item holding a {@link FlightSegment}.
 *
 * @param handle Runtime handle carrying the leg's props.
 * @returns The render function producing the leg's list item.
 * @example
 * <FlightItinerary.Segment airline="Larkwing Air" flightNumber="LW 214"
 * 	departure={{ time: "08:40", code: "MRW" }} arrival={{ time: "10:55", code: "VLS" }} duration="2h 15m" />
 */
FlightItinerary.Segment = function FlightItinerarySegment(
	handle: Handle<FlightItinerary.SegmentProps>,
) {
	return () => (
		<li data-slot="flight-itinerary-segment">
			<FlightSegment {...handle.props} />
		</li>
	);
};

/**
 * Renders the connection between two legs as a tinted row with a glyph, the caller's words
 * and an optional note. A `"warning"` layover takes the warning tone and an alert glyph, so a
 * tight or overnight change stands out by shape as well as colour.
 *
 * @param handle Runtime handle carrying the layover's props.
 * @returns The render function producing the layover's list item.
 * @example
 * <FlightItinerary.Layover tone="warning" note="Overnight · change terminals">10h 05m layover in VLS Vellis</FlightItinerary.Layover>
 */
FlightItinerary.Layover = function FlightItineraryLayover(
	handle: Handle<FlightItinerary.LayoverProps>,
) {
	return () => {
		let { children, note, tone, icon, mix, ...rest } = handle.props;
		let resolved = tone ?? DEFAULT_LAYOVER_TONE;
		let warning = resolved === "warning";
		let glyph = icon ?? (warning ? <CircleAlertIcon size={16} /> : <ClockIcon size={16} />);

		return (
			<li
				data-slot="flight-itinerary-layover"
				data-tone={resolved}
				{...rest}
				mix={mergeMix(
					[
						flex(),
						items("start"),
						gap(2),
						pi(3),
						raw({ paddingBlock: "0.5rem" }),
						rounded("md"),
						text("xs"),
						leading(1.4),
						warning
							? [
									bg("warning.tint"),
									fg("warning.emphasis"),
									border({ color: "warning.border", width: 1 }),
								]
							: [
									bg("neutral.tint"),
									fg("neutral.muted"),
									border({ color: "transparent", width: 1 }),
								],
					],
					mix,
				)}
			>
				<span
					aria-hidden="true"
					mix={[inlineFlex(), raw({ flexShrink: 0, marginBlockStart: "0.0625rem" })]}
				>
					{glyph}
				</span>
				<span mix={[vstack({ gap: 0.5 }), minIs(0)]}>
					<span data-slot="flight-itinerary-layover-text" mix={[weight("medium")]}>
						{children}
					</span>
					{note === undefined ? null : (
						<span data-slot="flight-itinerary-layover-note">{note}</span>
					)}
				</span>
			</li>
		);
	};
};
