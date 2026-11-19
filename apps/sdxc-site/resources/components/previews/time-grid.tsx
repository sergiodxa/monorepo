/**
 * Live preview for `TimeGrid`: three days with two zones down the side, an offsite in the
 * all-day lane, two meetings sharing an hour side by side, and an editable block that drags,
 * resizes and moves with Alt+arrows once hydrated (its posts land nowhere in the preview).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { TimeGrid } from "@sdxc/ui/schedule/time-grid";

/** The source the page shows, matching the markup below apart from the preview's frame. */
const CODE = `<TimeGrid
	id="week"
	label="Three days from November 17"
	days={[{ date: "2026-11-17" }, { date: "2026-11-18" }, { date: "2026-11-19" }]}
	zones={[{ label: "EST", hours: est }, { label: "GMT", hours: gmt }]}
	today="2026-11-18"
	spans={[{ id: "offsite", start: "2026-11-18", end: "2026-11-19", title: "Product offsite" }]}
	events={[
		{ id: "a", date: "2026-11-18", start: 540, end: 600, title: "Standup", time: "9 – 10 AM" },
		{ id: "b", date: "2026-11-18", start: 570, end: 660, title: "Design review", time: "9:30 – 11 AM" },
		{ id: "c", date: "2026-11-17", start: 600, end: 690, title: "Planning", editable: true },
	]}
	edit={{ move: { action: "/events/move" }, create: { action: "/events/new", method: "get" } }}
	labels={{ allDay: "All day", now: "Now", moved: "{title} moved to {time}", resized: "{title} now ends at {time}" }}
/>`;

/** Hour labels for a zone `shift` hours ahead of the first. */
function hours(shift: number): string[] {
	return Array.from({ length: 24 }, (_, hour) => {
		let at = (hour + shift) % 24;
		return `${at % 12 === 0 ? 12 : at % 12} ${at < 12 ? "AM" : "PM"}`;
	});
}

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div
			mix={[
				raw({
					display: "flex",
					inlineSize: "100%",
					blockSize: "22rem",
					border: "1px solid var(--ui-neutral-border)",
					borderRadius: "var(--ui-radius-lg)",
					overflow: "hidden",
					"--ui-time-grid-hour": "2.75rem",
				}),
			]}
		>
			<TimeGrid
				id="preview-time-grid"
				label="Three days from November 17"
				locale="en-US"
				days={[{ date: "2026-11-17" }, { date: "2026-11-18" }, { date: "2026-11-19" }]}
				zones={[
					{ label: "EST", hours: hours(0) },
					{ label: "GMT", hours: hours(5) },
				]}
				today="2026-11-18"
				workday={{ start: 540, end: 1080 }}
				scrollTo={510}
				spans={[
					{
						id: "offsite",
						start: "2026-11-18",
						end: "2026-11-19",
						title: "Product offsite",
						color: "oklch(0.62 0.1 200)",
					},
				]}
				events={[
					{
						id: "a",
						date: "2026-11-18",
						start: 540,
						end: 600,
						title: "Standup",
						time: "9 – 10 AM",
						color: "oklch(0.52 0.13 320)",
					},
					{
						id: "b",
						date: "2026-11-18",
						start: 570,
						end: 660,
						title: "Design review",
						time: "9:30 – 11 AM",
						detail: "Room Gnomon",
					},
					{
						id: "c",
						date: "2026-11-17",
						start: 600,
						end: 690,
						title: "Planning",
						time: "10 – 11:30 AM",
						editable: true,
						color: "oklch(0.58 0.12 150)",
					},
					{
						id: "d",
						date: "2026-11-19",
						start: 780,
						end: 840,
						title: "Interview",
						time: "1 – 2 PM",
						tentative: true,
					},
				]}
				edit={{ move: { action: "#moved" }, create: { action: "#new", method: "get" } }}
				labels={{
					allDay: "All day",
					now: "Now",
					moved: "{title} moved to {time}",
					resized: "{title} now ends at {time}",
				}}
				mix={[raw({ flex: "1 1 auto" })]}
			/>
		</div>
	),
};
