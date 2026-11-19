/**
 * One flight leg: the airline's mark, name and flight number, then departure and arrival
 * either side of a track that carries the duration, a dot per stop and a plane glyph. Times
 * arrive formatted, and the leg sets its airline beside the route once its container is wide.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { PlaneIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw, mergeMix } from "@sdxc/u/general";
import { container, flex, gap, grid, inlineFlex, items, justify, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { bs, is, m, minIs } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { leading, tabularNums, text, truncate, weight } from "@sdxc/u/typography";

/** Container a segment names, so its layout follows the space it sits in. */
const CONTAINER_NAME = "ui-flight-segment";

/** Segment width from which the airline moves into a column before the route. */
const SIDE_BY_SIDE_WIDTH = "34rem";

/**
 * Prop types for {@link FlightRoute} and {@link FlightSegment}.
 */
export namespace FlightRoute {
	/** One end of a flight: when it leaves or lands, and where. */
	export interface Endpoint {
		/** The local time, formatted by the caller, such as "08:40". */
		time: RemixNode;
		/** A machine-readable moment for the `<time>` the time sits in, such as "2026-03-14T08:40". */
		dateTime?: string;
		/** The airport code, such as "MRW", set large in tabular figures. */
		code: string;
		/** The city or airport name under the code, such as "Merrow". */
		city?: RemixNode;
	}

	/** Visually hidden words that turn the route into a sentence for a screen reader. */
	export interface Labels {
		/** Read before the departure, such as "Departs". */
		departs?: string;
		/** Read before the arrival, such as "Arrives". */
		arrives?: string;
		/** Read before the duration, such as "Flight time". */
		duration?: string;
	}

	/** Every native `<div>` attribute, plus the two ends and what lies between them. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		departure: Endpoint;
		arrival: Endpoint;
		/** The time in the air or the whole journey, formatted, such as "2h 15m". */
		duration: RemixNode;
		/**
		 * How many stops the track draws as dots; zero draws a clear line.
		 *
		 * @default 0
		 */
		stops?: number;
		/** What the stops amount to, under the track, such as "Nonstop" or "1 stop · VLS". */
		stopsLabel?: RemixNode;
		/** The badge after the arrival time when it lands on a later day, such as "+1". */
		dayOffset?: string;
		/** What the day badge means, read in its place, such as "arrives the next day". */
		dayOffsetLabel?: string;
		labels?: Labels;
	}
}

/**
 * Prop types for {@link FlightSegment}.
 */
export namespace FlightSegment {
	/** Every route prop, plus who flies the leg and on what. */
	export interface Props extends FlightRoute.Props {
		/** The operating airline's name, such as "Larkwing Air". */
		airline: RemixNode;
		/** The airline's mark, such as a small SVG or `<img>`, drawn in a 2rem square. */
		mark?: RemixNode;
		/** The flight number, such as "LW 214". */
		flightNumber?: RemixNode;
		/** The aircraft, such as "Aerion 320neo". */
		aircraft?: RemixNode;
		/** The cabin booked, such as "Economy". */
		cabin?: RemixNode;
		/** Anything else about the leg, such as "Operated by Fenwick Connect", after the cabin. */
		extra?: RemixNode;
	}
}

/** Props {@link RouteEnd} reads. */
interface RouteEndProps {
	endpoint: FlightRoute.Endpoint;
	align: "start" | "end";
	label?: string;
	dayOffset?: string;
	dayOffsetLabel?: string;
}

/**
 * One end of the route: the time over the airport code and city. The day badge rides the
 * arrival time and is read as its label, so "+1" is heard as "arrives the next day".
 *
 * @param handle Runtime handle carrying the endpoint and which edge it hugs.
 * @returns The render function producing the endpoint's markup.
 */
function RouteEnd(handle: Handle<RouteEndProps>) {
	return () => {
		let { endpoint, align, label, dayOffset, dayOffsetLabel } = handle.props;
		let time =
			endpoint.dateTime === undefined ? (
				endpoint.time
			) : (
				<time dateTime={endpoint.dateTime}>{endpoint.time}</time>
			);

		return (
			<div
				data-slot={align === "start" ? "flight-route-departure" : "flight-route-arrival"}
				mix={[vstack({ gap: 0.5 }), minIs(0), raw({ textAlign: align })]}
			>
				<span
					data-slot="flight-route-time"
					mix={[
						text("lg"),
						weight("semibold"),
						leading(1.1),
						tabularNums(),
						fg("neutral.emphasis"),
						raw({ whiteSpace: "nowrap" }),
					]}
				>
					{label === undefined ? null : <span mix={[visuallyHidden()]}>{`${label} `}</span>}
					{time}
					{dayOffset === undefined ? null : (
						<>
							<sup
								data-slot="flight-route-day-offset"
								aria-hidden={dayOffsetLabel === undefined ? undefined : "true"}
								mix={[
									text("xs"),
									weight("semibold"),
									fg("warning.emphasis"),
									raw({ marginInlineStart: "0.125rem", verticalAlign: "super" }),
								]}
							>
								{dayOffset}
							</sup>
							{dayOffsetLabel === undefined ? null : (
								<span mix={[visuallyHidden()]}>{` ${dayOffsetLabel}`}</span>
							)}
						</>
					)}
				</span>
				<span mix={[text("sm"), fg("neutral.muted"), truncate()]}>
					<abbr
						data-slot="flight-route-code"
						mix={[weight("semibold"), fg("neutral.emphasis"), raw({ textDecoration: "none" })]}
					>
						{endpoint.code}
					</abbr>
					{endpoint.city === undefined ? null : <> {endpoint.city}</>}
				</span>
			</div>
		);
	};
}

/** Props {@link RouteTrack} reads. */
interface RouteTrackProps {
	stops: number;
}

/**
 * The drawn line between the two ends: an origin ring, a hairline broken by a dot per stop,
 * and the plane at the destination edge, mirrored for right-to-left reading. It is decoration;
 * the stops label beneath carries the words.
 *
 * @param handle Runtime handle carrying the stop count.
 * @returns The render function producing the track's markup.
 */
function RouteTrack(handle: Handle<RouteTrackProps>) {
	return () => {
		let count = Math.max(0, Math.floor(handle.props.stops));
		let pieces: RemixNode[] = [<TrackLine />];
		for (let index = 0; index < count; index++) {
			pieces.push(<TrackDot kind="stop" />, <TrackLine />);
		}

		return (
			<span
				data-slot="flight-route-track"
				data-stops={count}
				aria-hidden="true"
				mix={[flex(), items("center"), gap(1), fg("neutral.muted")]}
			>
				<TrackDot kind="origin" />
				{pieces}
				<span
					mix={[
						inlineFlex(),
						raw({ flexShrink: 0, rotate: "45deg" }),
						when("&:dir(rtl)", raw({ scale: "-1 1" })),
						when("& > svg", raw({ inlineSize: "1rem", blockSize: "1rem" })),
					]}
				>
					<PlaneIcon size={16} />
				</span>
			</span>
		);
	};
}

/**
 * One hairline run of the track, sharing what is left with every other run.
 *
 * @returns The render function producing the hairline.
 */
function TrackLine() {
	return () => (
		<span
			mix={[raw({ flex: "1 1 0", minInlineSize: "0.5rem" }), bs("1px"), bg("neutral.border")]}
		/>
	);
}

/** Props {@link TrackDot} reads. */
interface TrackDotProps {
	kind: "origin" | "stop";
}

/**
 * A ring on the track: hollow where the flight starts, filled with the warning tone at each
 * stop, so a stop reads by shape as well as colour.
 *
 * @param handle Runtime handle carrying which ring to draw.
 * @returns The render function producing the ring.
 */
function TrackDot(handle: Handle<TrackDotProps>) {
	return () => {
		let stop = handle.props.kind === "stop";
		return (
			<span
				data-slot={stop ? "flight-route-stop" : "flight-route-origin"}
				mix={[
					is(stop ? "0.5rem" : "0.4375rem"),
					bs(stop ? "0.5rem" : "0.4375rem"),
					raw({ flexShrink: 0 }),
					rounded("full"),
					stop
						? [bg("warning.solid"), raw({ boxShadow: "0 0 0 2px var(--ui-bg, Canvas)" })]
						: border({ color: "neutral.border-strong", width: 1.5 }),
				]}
			/>
		);
	};
}

/**
 * Renders the route on one line: departure at the start, arrival at the end, and between them
 * the duration over a drawn track with the stops label under it. It never wraps, so it doubles
 * as the compact summary of a whole journey in a results row.
 *
 * @param handle Runtime handle carrying the route's props.
 * @returns The render function producing the route's markup.
 * @example
 * <FlightRoute
 * 	departure={{ time: "08:40", code: "MRW", city: "Merrow" }}
 * 	arrival={{ time: "06:05", code: "OSK", city: "Oskarn" }}
 * 	duration="19h 25m" stops={1} stopsLabel="1 stop · VLS" dayOffset="+1" dayOffsetLabel="next day"
 * />
 */
export function FlightRoute(handle: Handle<FlightRoute.Props>) {
	return () => {
		let {
			departure,
			arrival,
			duration,
			stops,
			stopsLabel,
			dayOffset,
			dayOffsetLabel,
			labels,
			mix,
			...rest
		} = handle.props;

		return (
			<div
				data-slot="flight-route"
				{...rest}
				mix={mergeMix(
					[
						grid(),
						raw({
							gridTemplateColumns: "auto minmax(3.5rem, 1fr) auto",
							columnGap: "0.75rem",
							alignItems: "center",
						}),
						minIs(0),
					],
					mix,
				)}
			>
				<RouteEnd endpoint={departure} align="start" label={labels?.departs} />
				<div
					data-slot="flight-route-middle"
					mix={[vstack({ gap: 1 }), minIs(0), text("xs"), fg("neutral.muted")]}
				>
					<span
						data-slot="flight-route-duration"
						mix={[raw({ textAlign: "center" }), tabularNums(), truncate()]}
					>
						{labels?.duration === undefined ? null : (
							<span mix={[visuallyHidden()]}>{`${labels.duration} `}</span>
						)}
						{duration}
					</span>
					<RouteTrack stops={stops ?? 0} />
					{stopsLabel === undefined ? null : (
						<span
							data-slot="flight-route-stops"
							mix={[
								raw({ textAlign: "center" }),
								truncate(),
								(stops ?? 0) > 0 ? fg("warning.emphasis") : fg("success.emphasis"),
							]}
						>
							{stopsLabel}
						</span>
					)}
				</div>
				<RouteEnd
					endpoint={arrival}
					align="end"
					label={labels?.arrives}
					dayOffset={dayOffset}
					dayOffsetLabel={dayOffsetLabel}
				/>
			</div>
		);
	};
}

/**
 * Renders one leg: the airline's mark, name and flight number, the {@link FlightRoute}, then a
 * muted line of aircraft, cabin and extras. Under 34rem the airline heads the leg; wider, it
 * takes a column before the route so legs in a list line their routes up.
 *
 * @param handle Runtime handle carrying the leg's props.
 * @returns The render function producing the leg's markup.
 * @example
 * <FlightSegment
 * 	airline="Larkwing Air" mark={<LarkwingMark />} flightNumber="LW 214"
 * 	departure={{ time: "08:40", code: "MRW", city: "Merrow" }}
 * 	arrival={{ time: "10:55", code: "VLS", city: "Vellis" }}
 * 	duration="2h 15m" stopsLabel="Nonstop" aircraft="Aerion 320neo" cabin="Economy"
 * />
 */
export function FlightSegment(handle: Handle<FlightSegment.Props>) {
	return () => {
		let {
			airline,
			mark,
			flightNumber,
			aircraft,
			cabin,
			extra,
			departure,
			arrival,
			duration,
			stops,
			stopsLabel,
			dayOffset,
			dayOffsetLabel,
			labels,
			mix,
			...rest
		} = handle.props;
		let meta = [aircraft, cabin, extra].filter((part) => part !== undefined && part !== null);

		return (
			<div
				data-slot="flight-segment"
				{...rest}
				mix={mergeMix([container(CONTAINER_NAME, "inline-size"), minIs(0)], mix)}
			>
				<div
					data-slot="flight-segment-body"
					mix={[
						grid(),
						raw({ gridTemplateAreas: '"carrier" "route" "meta"', rowGap: "0.75rem" }),
						text("sm"),
						at(
							SIDE_BY_SIDE_WIDTH,
							CONTAINER_NAME,
							raw({
								gridTemplateColumns: "minmax(9rem, 12rem) minmax(0, 1fr)",
								gridTemplateAreas: '"carrier route" "carrier meta"',
								columnGap: "1.5rem",
								rowGap: "0.5rem",
							}),
						),
					]}
				>
					<div
						data-slot="flight-segment-carrier"
						mix={[flex(), items("center"), gap(2.5), minIs(0), raw({ gridArea: "carrier" })]}
					>
						{mark === undefined ? null : (
							<span
								data-slot="flight-segment-mark"
								aria-hidden="true"
								mix={[
									inlineFlex(),
									items("center"),
									justify("center"),
									is("2rem"),
									bs("2rem"),
									rounded("md"),
									raw({ flexShrink: 0, overflow: "hidden" }),
									when("& > :is(svg, img)", raw({ inlineSize: "100%", blockSize: "100%" })),
								]}
							>
								{mark}
							</span>
						)}
						<span mix={[vstack({ gap: 0 }), minIs(0)]}>
							<span
								data-slot="flight-segment-airline"
								mix={[weight("medium"), fg("neutral.emphasis"), truncate()]}
							>
								{airline}
							</span>
							{flightNumber === undefined ? null : (
								<span
									data-slot="flight-segment-number"
									mix={[text("xs"), fg("neutral.muted"), tabularNums()]}
								>
									{flightNumber}
								</span>
							)}
						</span>
					</div>
					<FlightRoute
						departure={departure}
						arrival={arrival}
						duration={duration}
						stops={stops}
						stopsLabel={stopsLabel}
						dayOffset={dayOffset}
						dayOffsetLabel={dayOffsetLabel}
						labels={labels}
						mix={[raw({ gridArea: "route" })]}
					/>
					{meta.length === 0 ? null : (
						<ul
							data-slot="flight-segment-meta"
							mix={[
								m(0),
								raw({ padding: 0, listStyle: "none", gridArea: "meta", flexWrap: "wrap" }),
								flex(),
								raw({ columnGap: "0.75rem", rowGap: "0.25rem" }),
								text("xs"),
								fg("neutral.muted"),
								when(
									"& > li + li::before",
									raw({ content: '"·" / ""', marginInlineEnd: "0.75rem" }),
								),
							]}
						>
							{meta.map((part) => (
								<li>{part}</li>
							))}
						</ul>
					)}
				</div>
			</div>
		);
	};
}
