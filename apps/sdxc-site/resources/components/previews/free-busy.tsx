/**
 * Live preview for `FreeBusy`: three people over a working day, a London teammate whose evening
 * is hatched as outside their hours, busy blocks with one tentative, and the two times everyone
 * can make drawn as bands across every row, the first one picked.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { FreeBusy } from "@sdxc/ui/app/free-busy";

/** The source the page shows, matching the markup below apart from the preview's frame. */
const CODE = `<FreeBusy
	label="Availability on November 18"
	start={480}
	end={1080}
	hours={hours}
	labels={{ busy: "Busy {times}", free: "Free all day" }}
	people={[
		{ id: "noor", name: "Noor Haddad", detail: "New York", busy: [{ start: 570, end: 600, title: "Standup" }] },
		{ id: "mara", name: "Mara Lindqvist", detail: "London", busy: [], outside: [{ start: 750, end: 1080 }] },
	]}
	slots={[{ start: 600, end: 690, label: "10:00", href: "/new?start=600", selected: true }]}
/>`;

/** A minute of the day as `H:MM`. */
function clock(minute: number): string {
	return `${Math.floor(minute / 60)}:${String(minute % 60).padStart(2, "0")}`;
}

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
			<FreeBusy
				label="Availability on November 18"
				start={480}
				end={1080}
				hours={Array.from({ length: 11 }, (_, index) => ({
					minute: 480 + index * 60,
					label: `${8 + index}:00`,
				}))}
				formatTime={clock}
				labels={{ busy: "Busy {times}", free: "Free all day" }}
				people={[
					{
						id: "noor",
						name: "Noor Haddad",
						detail: "New York · 10:12 AM",
						busy: [
							{ start: 570, end: 600, title: "Standup" },
							{ start: 780, end: 870, title: "Roadmap review" },
						],
						outside: [{ start: 1050, end: 1080 }],
					},
					{
						id: "mara",
						name: "Mara Lindqvist",
						detail: "London · 3:12 PM",
						busy: [{ start: 540, end: 570, title: "Crit prep", tentative: true }],
						outside: [{ start: 750, end: 1080 }],
					},
					{
						id: "tomas",
						name: "Tomás Reyes",
						detail: "Mexico City · 9:12 AM",
						busy: [{ start: 690, end: 720 }],
						outside: [{ start: 480, end: 600 }],
					},
				]}
				slots={[
					{ start: 600, end: 690, label: "10:00", href: "#10", selected: true },
					{ start: 720, end: 750, label: "12:00", href: "#12" },
				]}
			/>
		</div>
	),
};
