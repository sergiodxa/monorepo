/**
 * Live preview for `MonthView`: November with a trip across a week boundary, a busy Wednesday
 * that overflows into "+2 more", and timed events as a dot, a time and a title. Narrow the
 * frame and each day turns into dots.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { MonthView } from "@sdxc/ui/app/month-view";

/** The source the page shows, matching the markup below apart from the preview's frame. */
const CODE = `<MonthView
	id="november"
	month="2026-11"
	today="2026-11-18"
	weekStartsOn={1}
	dayHref={(date) => \`/day/\${date}\`}
	labels={{ more: "+{count} more", count: "{count} events" }}
	events={[
		{ id: "trip", start: "2026-11-13", end: "2026-11-16", title: "Lisbon trip" },
		{ id: "standup", start: "2026-11-18", time: "9a", title: "Standup" },
	]}
/>`;

/** Four meetings on one Wednesday, so the day overflows. */
const BUSY = ["9a Standup", "11a Design review", "2p 1:1 with Mara", "4p Launch prep", "5p Drinks"];

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div
			mix={[
				raw({
					inlineSize: "100%",
					border: "1px solid var(--ui-neutral-border)",
					borderRadius: "var(--ui-radius-lg)",
					overflow: "hidden",
				}),
			]}
		>
			<MonthView
				id="preview-month"
				month="2026-11"
				today="2026-11-18"
				weekStartsOn={1}
				locale="en-US"
				dayHref={(date) => `#${date}`}
				labels={{ more: "+{count} more", count: "{count} events" }}
				events={[
					{
						id: "trip",
						start: "2026-11-13",
						end: "2026-11-16",
						title: "Lisbon trip",
						color: "oklch(0.62 0.1 200)",
					},
					{
						id: "holiday",
						start: "2026-11-26",
						end: "2026-11-26",
						allDay: true,
						title: "Thanksgiving",
						color: "oklch(0.72 0.15 75)",
					},
					{
						id: "dentist",
						start: "2026-11-05",
						time: "8a",
						title: "Dentist",
						color: "oklch(0.58 0.12 150)",
					},
					{ id: "review", start: "2026-11-23", time: "1p", title: "Roadmap review" },
					...BUSY.map((entry, index) => {
						let [time = "", ...title] = entry.split(" ");
						return { id: `wed-${index}`, start: "2026-11-18", time, title: title.join(" ") };
					}),
				]}
			/>
		</div>
	),
};
