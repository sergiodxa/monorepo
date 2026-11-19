/**
 * Live preview for `TripTimeline`: the first two days of a trip to Vellis, a flight, a rental
 * car and a hotel check-in on day one and a walking tour and a packing note on day two, each
 * on the rail with its time, status and an "Add to calendar" link.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { Badge } from "@sdxc/ui";
import { TripTimeline } from "@sdxc/ui/travel/trip-timeline";

/** The source the page shows, matching the markup below. */
const CODE = `<TripTimeline aria-label="Trip to Vellis" kindLabels={{ flight: "Flight", stay: "Stay", car: "Car" }}>
	<TripTimeline.Day heading="Fri 14 Mar" date="2026-03-14" detail="Day 1 · Merrow → Vellis">
		<TripTimeline.Item
			kind="flight"
			time="08:40"
			title="LW 214 Merrow → Vellis"
			details={["Terminal 2 · Gate B14", "Confirmation LWX4Q2"]}
			status={<Badge color="success" variant="secondary">Confirmed</Badge>}
			actions={<a href="/trip/lw214.ics">Add to calendar</a>}
		/>
		<TripTimeline.Item kind="car" time="11:30" title="Pick up at Tallow Rent" … />
		<TripTimeline.Item kind="stay" time="15:00" title="Check in at Hotel Saltmarsh" … />
	</TripTimeline.Day>
</TripTimeline>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[raw({ inlineSize: "100%", maxInlineSize: "40rem", marginBlock: "1.5rem" })]}>
			<TripTimeline
				aria-label="Trip to Vellis"
				kindLabels={{
					flight: "Flight",
					stay: "Stay",
					car: "Car",
					activity: "Activity",
					note: "Note",
				}}
			>
				<TripTimeline.Day heading="Fri 14 Mar" date="2026-03-14" detail="Day 1 · Merrow → Vellis">
					<TripTimeline.Item
						kind="flight"
						time="08:40"
						dateTime="2026-03-14T08:40"
						title="LW 214 Merrow → Vellis"
						details={["Terminal 2 · Gate B14 · Seat 14C", "Confirmation LWX4Q2"]}
						status={
							<Badge color="success" variant="secondary">
								Confirmed
							</Badge>
						}
						actions={<a href="#calendar">Add to calendar</a>}
					/>
					<TripTimeline.Item
						kind="car"
						time="11:30"
						dateTime="2026-03-14T11:30"
						title="Pick up at Tallow Rent"
						details={["Vellis Airport, arrivals hall", "Compact · Velo C3 or similar"]}
						status={
							<Badge color="success" variant="secondary">
								Confirmed
							</Badge>
						}
					/>
					<TripTimeline.Item
						kind="stay"
						time="15:00"
						dateTime="2026-03-14T15:00"
						title="Check in at Hotel Saltmarsh"
						details={["12 Quay Row, Vellis", "5 nights · Double room"]}
						status={
							<Badge color="warning" variant="secondary">
								Pay at hotel
							</Badge>
						}
						actions={
							<>
								<a href="#directions">Directions</a>
								<a href="#calendar">Add to calendar</a>
							</>
						}
					/>
				</TripTimeline.Day>
				<TripTimeline.Day heading="Sat 15 Mar" date="2026-03-15" detail="Day 2 · Vellis">
					<TripTimeline.Item
						kind="activity"
						time="10:00"
						dateTime="2026-03-15T10:00"
						title="Harbour walking tour"
						details={["Meet at the lighthouse steps · 2h"]}
					/>
					<TripTimeline.Item kind="note" title="Pack a light jacket for the evening" />
				</TripTimeline.Day>
			</TripTimeline>
		</div>
	),
};
