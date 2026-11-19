/**
 * Live preview for `FlightSegment`: one overnight Larkwing Air leg from Merrow to Oskarn with a
 * stop in Vellis, the arrival flagged "+1", and the aircraft and cabin under the route.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { FlightSegment } from "@sdxc/ui/travel/flight-segment";

/** The source the page shows, matching the markup below. */
const CODE = `<FlightSegment
	airline="Larkwing Air"
	mark={<LarkwingMark />}
	flightNumber="LW 214"
	departure={{ time: "22:40", dateTime: "2026-03-14T22:40", code: "MRW", city: "Merrow" }}
	arrival={{ time: "06:05", dateTime: "2026-03-15T06:05", code: "OSK", city: "Oskarn" }}
	duration="7h 25m"
	stops={1}
	stopsLabel="1 stop · VLS"
	dayOffset="+1"
	dayOffsetLabel="arrives the next day"
	labels={{ departs: "Departs", arrives: "Arrives", duration: "Flight time" }}
	aircraft="Aerion 320neo"
	cabin="Economy"
/>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div
			mix={[
				raw({
					inlineSize: "100%",
					maxInlineSize: "40rem",
					marginBlock: "1.5rem",
					padding: "1.25rem",
					border: "1px solid var(--ui-neutral-border)",
					borderRadius: "0.75rem",
				}),
			]}
		>
			<FlightSegment
				airline="Larkwing Air"
				mark={<LarkwingMark />}
				flightNumber="LW 214"
				departure={{ time: "22:40", dateTime: "2026-03-14T22:40", code: "MRW", city: "Merrow" }}
				arrival={{ time: "06:05", dateTime: "2026-03-15T06:05", code: "OSK", city: "Oskarn" }}
				duration="7h 25m"
				stops={1}
				stopsLabel="1 stop · VLS"
				dayOffset="+1"
				dayOffsetLabel="arrives the next day"
				labels={{ departs: "Departs", arrives: "Arrives", duration: "Flight time" }}
				aircraft="Aerion 320neo"
				cabin="Economy"
			/>
		</div>
	),
};

/**
 * Larkwing Air's invented mark: a swept wing on the brand tile.
 *
 * @returns The render function producing the mark.
 */
function LarkwingMark() {
	return () => (
		<svg viewBox="0 0 32 32">
			<rect width="32" height="32" rx="7" fill="var(--ui-brand-bg-solid)" />
			<path d="M6 21c6-1 11-5 20-12-3 7-8 12-15 13z" fill="var(--ui-brand-fg-on-solid)" />
		</svg>
	);
}
