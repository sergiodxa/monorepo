/**
 * Live preview for `Agenda`: three days of a schedule, today's heading in the brand colour, a
 * row that opens a popover, one that links, a tentative invitation and an event already over.
 * Narrow the frame and each day's date stacks above its events.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { Agenda } from "@sdxc/ui/app/agenda";

/** The source the page shows, matching the markup below apart from the preview's frame. */
const CODE = `<Agenda
	id="schedule"
	label="Next three days"
	today="2026-11-18"
	days={[
		{
			date: "2026-11-18",
			events: [
				{ id: "standup", title: "Standup", time: "9:30 – 9:45 AM", detail: "Huddle" },
				{ id: "crit", title: "Design crit", time: "2 – 3 PM", popover: <EventCard /> },
			],
		},
		{ date: "2026-11-19", events: [{ id: "retro", title: "Sprint retro", time: "3:30 – 4:30 PM", href: "/events/retro" }] },
	]}
/>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div
			mix={[
				raw({
					inlineSize: "min(100%, 36rem)",
					maxBlockSize: "22rem",
					overflowY: "auto",
					border: "1px solid var(--ui-neutral-border)",
					borderRadius: "var(--ui-radius-lg)",
					paddingInline: "0.5rem",
				}),
			]}
		>
			<Agenda
				id="preview-agenda"
				label="Next three days"
				locale="en-US"
				today="2026-11-18"
				days={[
					{
						date: "2026-11-18",
						href: "#2026-11-18",
						events: [
							{
								id: "standup",
								title: "Standup",
								time: "9:30 – 9:45 AM",
								detail: "Huddle · #product",
								color: "oklch(0.52 0.13 320)",
								past: true,
							},
							{
								id: "crit",
								title: "Design crit",
								time: "2 – 3 PM",
								detail: "Video call",
								popover: (
									<p mix={[raw({ margin: "0", padding: "1rem", maxInlineSize: "16rem" })]}>
										Mara presents the onboarding flow; bring one question each.
									</p>
								),
							},
							{
								id: "metrics",
								title: "Metrics walkthrough",
								time: "4 – 5 PM",
								tentative: true,
								color: "oklch(0.6 0.14 40)",
							},
						],
					},
					{
						date: "2026-11-19",
						href: "#2026-11-19",
						events: [
							{
								id: "dentist",
								title: "Dentist",
								time: "8 – 8:45 AM",
								detail: "5th Ave",
								color: "oklch(0.58 0.12 150)",
							},
							{ id: "retro", title: "Sprint retro", time: "3:30 – 4:30 PM", href: "#retro" },
						],
					},
					{
						date: "2026-11-20",
						href: "#2026-11-20",
						events: [
							{
								id: "offsite",
								title: "Product offsite",
								time: "All day",
								color: "oklch(0.62 0.1 200)",
							},
						],
					},
				]}
			/>
		</div>
	),
};
