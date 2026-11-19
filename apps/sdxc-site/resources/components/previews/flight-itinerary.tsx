/**
 * Live preview for `FlightItinerary`: an outbound journey from Merrow to Oskarn on one line,
 * opened to show both Larkwing Air legs and the overnight layover in Vellis flagged between them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { FlightItinerary } from "@sdxc/ui/travel/flight-itinerary";

/** The source the page shows, matching the markup below. */
const CODE = `<FlightItinerary
	title="Outbound · Fri 14 Mar"
	airline="Larkwing Air"
	departure={{ time: "18:10", code: "MRW", city: "Merrow" }}
	arrival={{ time: "09:30", code: "OSK", city: "Oskarn" }}
	duration="15h 20m"
	stops={1}
	stopsLabel="1 stop"
	dayOffset="+1"
	dayOffsetLabel="arrives the next day"
	toggleLabel="Flight details"
	open
>
	<FlightItinerary.Segment airline="Larkwing Air" flightNumber="LW 214" … />
	<FlightItinerary.Layover tone="warning" note="Overnight · change terminals">
		10h 05m layover in VLS Vellis
	</FlightItinerary.Layover>
	<FlightItinerary.Segment airline="Larkwing Air" flightNumber="LW 731" … />
</FlightItinerary>`;

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
			<FlightItinerary
				title="Outbound · Fri 14 Mar"
				airline="Larkwing Air"
				departure={{ time: "18:10", code: "MRW", city: "Merrow" }}
				arrival={{ time: "09:30", code: "OSK", city: "Oskarn" }}
				duration="15h 20m"
				stops={1}
				stopsLabel="1 stop"
				dayOffset="+1"
				dayOffsetLabel="arrives the next day"
				toggleLabel="Flight details"
				open
			>
				<FlightItinerary.Segment
					airline="Larkwing Air"
					flightNumber="LW 214"
					departure={{ time: "18:10", code: "MRW", city: "Merrow" }}
					arrival={{ time: "20:25", code: "VLS", city: "Vellis" }}
					duration="2h 15m"
					stopsLabel="Nonstop"
					aircraft="Aerion 320neo"
					cabin="Economy"
				/>
				<FlightItinerary.Layover tone="warning" note="Overnight · change terminals">
					10h 05m layover in VLS Vellis
				</FlightItinerary.Layover>
				<FlightItinerary.Segment
					airline="Larkwing Air"
					flightNumber="LW 731"
					departure={{ time: "06:30", code: "VLS", city: "Vellis" }}
					arrival={{ time: "09:30", code: "OSK", city: "Oskarn" }}
					duration="3h 00m"
					stopsLabel="Nonstop"
					aircraft="Aerion 220"
					cabin="Economy"
				/>
			</FlightItinerary>
		</div>
	),
};
