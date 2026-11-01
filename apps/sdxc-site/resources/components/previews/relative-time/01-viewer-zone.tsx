/**
 * Live example for `RelativeTime` in the reader's own zone: a release that went out late on
 * a Friday in UTC. The server can only name UTC, so `local` hydrates the island that rewrites
 * the date and title in whatever zone the reader's device is set to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { hstack } from "@sdxc/u/layout";
import { RelativeTime } from "@sdxc/ui/relative-time";

/** The source the page shows, matching the markup below. */
const CODE = `<p>
	<span>Released</span>
	<RelativeTime date="2026-10-02T23:30:00Z" now={requestTime} locale="en" local />
</p>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "In the reader's time zone",
	code: CODE,
	render: () => (
		<p mix={[hstack({ gap: 2, align: "baseline" })]}>
			<span mix={[fg("neutral.muted")]}>Released</span>
			<RelativeTime date="2026-10-02T23:30:00Z" now="2026-11-01T12:00:00Z" locale="en" local />
		</p>
	),
};
