/**
 * Live preview for `RelativeTime`: an activity feed whose times read relative within a week
 * and as dates after it, rendered against the request time. Hover any time for the exact moment
 * in the server's zone and in UTC.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { hstack, vstack } from "@sdxc/u/layout";
import { fontSize } from "@sdxc/u/typography";
import { RelativeTime } from "@sdxc/ui/relative-time";

/** The request time the page renders against, so the server text is the same on every render. */
const NOW = "2026-11-01T12:00:00Z";

/** The events in the feed, newest first. */
const EVENTS = [
	{ id: "e1", text: "checkout.acme.dev recovered", at: "2026-11-01T11:59:40Z" },
	{ id: "e2", text: "Ana Ruiz paused docs.acme.dev", at: "2026-11-01T11:46:00Z" },
	{ id: "e3", text: "Deploy 4f2c1a9 went live", at: "2026-11-01T07:15:00Z" },
	{ id: "e4", text: "Kenji Mori added a webhook", at: "2026-10-29T16:30:00Z" },
	{ id: "e5", text: "Status page published", at: "2026-10-12T09:00:00Z" },
];

/** The source the page shows, matching the markup below. */
const CODE = `{events.map((event) => (
	<li key={event.id}>
		<span>{event.text}</span>
		<RelativeTime date={event.at} now={requestTime} locale="en" mix={[fg("neutral.muted"), fontSize("sm")]} />
	</li>
))}`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<ul mix={[vstack({ gap: 2 })]}>
			{EVENTS.map((event) => (
				<li key={event.id} mix={[hstack({ gap: 3, justify: "between", align: "baseline" })]}>
					<span>{event.text}</span>
					<RelativeTime
						date={event.at}
						now={NOW}
						locale="en"
						mix={[fg("neutral.muted"), fontSize("sm")]}
					/>
				</li>
			))}
		</ul>
	),
};
