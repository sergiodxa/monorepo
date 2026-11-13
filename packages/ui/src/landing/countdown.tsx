/**
 * The days, hours, minutes and seconds left until a launch, a sale's end or an event's doors,
 * as one `<time>` naming the moment. The server renders the time left from `now`, and the
 * optional island keeps it ticking from the viewer's clock, so a cached page still reads true.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle } from "remix/component";

import { clientEntry, css } from "remix/component";

import type { CountdownParts } from "./utils/countdown.js";

import { countdownTick, formatUnit } from "./mixins/countdown-tick.js";
import { countdownParts } from "./utils/countdown.js";

export { countdownParts } from "./utils/countdown.js";

/** The units the countdown shows, largest first. */
const UNITS = ["days", "hours", "minutes", "seconds"] as const;

/** The English unit names, used for any `labels` entry a page leaves out. */
const DEFAULT_LABELS: Countdown.Labels = {
	days: "days",
	hours: "hours",
	minutes: "minutes",
	seconds: "seconds",
};

/**
 * Prop types for {@link Countdown} and its island.
 */
export namespace Countdown {
	/** A moment as a `Date`, an ISO 8601 string or epoch milliseconds. */
	export type DateInput = CountdownParts.DateInput;

	/** The name printed under each unit's figure. */
	export interface Labels {
		days: string;
		hours: string;
		minutes: string;
		seconds: string;
	}

	/**
	 * The moment and the countdown's text. A page styles the figures from an ancestor through
	 * the `countdown-units`, `countdown-unit`, `countdown-value`, `countdown-label` and
	 * `countdown-done` slots, which reach the server render and the island alike.
	 */
	export interface Props {
		/** The moment counted down to. */
		to: DateInput;
		/** The moment counted from; pass the request's time so server and tests render the same text. */
		now?: DateInput;
		/** Unit names, merged over the English ones. */
		labels?: Partial<Labels>;
		/** Shows the seconds unit and ticks every second; off, the minutes are the smallest unit. */
		seconds?: boolean;
		/** What the countdown reads once the moment has passed, such as "Doors are open". */
		done: string;
		/**
		 * Hydrates {@link CountdownLive}, which counts from the viewer's clock every second.
		 * Needs `@sdxc/ui/landing/countdown#CountdownLive` in the app's browser entry.
		 */
		live?: boolean;
		/** Accessible name for the `<time>`. */
		"aria-label"?: string;
		/** Element id for the `<time>`. */
		id?: string;
	}

	/** Props {@link CountdownLive} serializes for hydration, so they stay plain JSON. */
	export interface LiveProps {
		/** The moment, as an ISO 8601 string or epoch milliseconds. */
		to: string | number;
		/** The moment the server counted from, so the hydrated text matches its HTML. */
		now: string | number;
		labels: Labels;
		seconds: boolean;
		done: string;
		/** Accessible name, passed through to the `<time>`. */
		"aria-label"?: string;
		/** Element id, passed through to the `<time>`. */
		id?: string;
	}
}

/**
 * Renders the units left as `<time datetime>`, each a figure over its name, with the done text
 * beside them hidden until the moment passes. With `live` it hands the same props to
 * {@link CountdownLive}, so the server HTML is identical and the island takes over the ticking.
 *
 * @param handle Runtime handle carrying the moment, the labels and the `<time>`'s props.
 * @returns The render function producing the countdown.
 * @example <Countdown to="2027-04-15T07:00:00Z" now={ctx.requestTime} done="Doors are open" />
 * @example <Countdown to={launch} done="Live now" labels={{ days: "días" }} live />
 */
export function Countdown(handle: Handle<Countdown.Props>) {
	return () => {
		let { to, now, labels, seconds = true, done, live, ...rest } = handle.props;
		let names = { ...DEFAULT_LABELS, ...labels };
		let from = now ?? new Date();

		if (live) {
			return (
				<CountdownLive
					to={serializable(to)}
					now={serializable(from)}
					labels={names}
					seconds={seconds}
					done={done}
					{...rest}
				/>
			);
		}

		return (
			<time {...rest} dateTime={isoString(to)} data-slot="countdown">
				<CountdownBody to={to} now={from} labels={names} seconds={seconds} done={done} />
			</time>
		);
	};
}

/**
 * Client island behind {@link Countdown}'s `live` prop: the same `<time>` the server renders,
 * ticking from the viewer's clock once it is in the document. Until the island loads, the
 * server's figures stand.
 *
 * @example <CountdownLive to="2027-04-15T07:00:00Z" now="2026-11-13T09:00:00Z" labels={labels} seconds done="Doors are open" />
 */
export const CountdownLive: EntryComponent<Countdown.LiveProps> = clientEntry(
	"@sdxc/ui/landing/countdown#CountdownLive",
	function CountdownLive(handle: Handle<Countdown.LiveProps>) {
		return () => {
			let { to, now, labels, seconds, done, ...rest } = handle.props;
			return (
				<time
					{...rest}
					dateTime={isoString(to)}
					data-slot="countdown"
					mix={[countdownTick(seconds)]}
				>
					<CountdownBody to={to} now={now} labels={labels} seconds={seconds} done={done} />
				</time>
			);
		};
	},
);

namespace CountdownBody {
	export interface Props {
		to: Countdown.DateInput;
		now: Countdown.DateInput;
		labels: Countdown.Labels;
		seconds: boolean;
		done: string;
	}
}

/**
 * The units and the done text inside the `<time>`, with `data-state` on neither: the host
 * carries it, and exactly one of the two children is visible at a time.
 */
function CountdownBody(handle: Handle<CountdownBody.Props>) {
	return () => {
		let { to, now, labels, seconds, done } = handle.props;
		let left = countdownParts(to, now);
		let units = seconds ? UNITS : UNITS.slice(0, 3);

		return (
			<>
				<span
					data-slot="countdown-units"
					hidden={left.done}
					mix={css({
						display: "inline-flex",
						flexWrap: "wrap",
						alignItems: "flex-start",
						columnGap: "1em",
						rowGap: "0.5em",
						"&[hidden]": { display: "none" },
					})}
				>
					{units.map((unit) => (
						<span
							key={unit}
							data-slot="countdown-unit"
							data-unit={unit}
							mix={css({ display: "inline-flex", flexDirection: "column", alignItems: "center" })}
						>
							<span
								data-slot="countdown-value"
								mix={css({
									fontVariantNumeric: "tabular-nums",
									fontSize: "1.5em",
									fontWeight: "600",
									lineHeight: "1",
								})}
							>
								{formatUnit(unit, left[unit])}
							</span>
							<span
								data-slot="countdown-label"
								mix={css({ fontSize: "0.75em", lineHeight: "1.4" })}
							>
								{labels[unit]}
							</span>
						</span>
					))}
				</span>
				<span data-slot="countdown-done" hidden={!left.done}>
					{done}
				</span>
			</>
		);
	};
}

/** The moment as an ISO string for `datetime`, empty when it does not parse. */
function isoString(value: Countdown.DateInput): string {
	let date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

/** Turns a `Date` into its ISO string so an island prop survives serialization. */
function serializable(value: Countdown.DateInput): string | number {
	return value instanceof Date ? value.toISOString() : value;
}
