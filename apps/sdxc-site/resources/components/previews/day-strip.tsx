/**
 * Live preview for `DayStrip`: three weeks of November in a phone-wide scroller, the 20th
 * current, today ringed, and a dot under each day that has events. Once hydrated, the strip
 * scrolls to keep the current day in view.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { DayStrip } from "@sdxc/ui/schedule/day-strip";

/** The source the page shows, matching the markup below apart from the preview's frame. */
const CODE = `<DayStrip
	label="November 2026"
	today="2026-11-18"
	days={[
		{ date: "2026-11-18", href: "?day=2026-11-18", note: <Dot />, label: "2 events" },
		{ date: "2026-11-19", href: "?day=2026-11-19" },
		{ date: "2026-11-20", href: "?day=2026-11-20", current: true, note: <Dot />, label: "1 event" },
	]}
/>`;

/** Which November days carry events in the preview. */
const BUSY = new Set([3, 4, 9, 12, 17, 18, 20, 24]);

/** A small brand dot under a day with events. */
function Dot() {
	return () => (
		<span
			mix={[
				raw({
					inlineSize: "0.3125rem",
					blockSize: "0.3125rem",
					borderRadius: "999px",
					backgroundColor: "currentColor",
					opacity: "0.7",
				}),
			]}
		/>
	);
}

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div
			mix={[
				raw({
					inlineSize: "min(100%, 22rem)",
					border: "1px solid var(--ui-neutral-border)",
					borderRadius: "var(--ui-radius-lg)",
					backgroundColor: "var(--ui-bg)",
					overflow: "hidden",
				}),
			]}
		>
			<DayStrip
				label="November 2026"
				locale="en-US"
				today="2026-11-18"
				days={Array.from({ length: 21 }, (_, index) => {
					let day = index + 6;
					let date = `2026-11-${String(day).padStart(2, "0")}`;
					return {
						date,
						href: `#${date}`,
						current: day === 20,
						note: BUSY.has(day) ? <Dot /> : undefined,
						label: BUSY.has(day) ? "Has events" : undefined,
					};
				})}
			/>
		</div>
	),
};
