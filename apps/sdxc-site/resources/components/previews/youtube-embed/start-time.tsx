/**
 * Live example for a `YouTubeEmbed` that opens at the chorus: `start` is in seconds, so the
 * player begins 43 seconds in, the way a link shared with `?t=43` does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is, maxIs } from "sdxc/u/size";
import { YouTubeEmbed } from "sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<div mix={[is("full"), maxIs("36rem")]}>
	<YouTubeEmbed
		videoId="dQw4w9WgXcQ"
		start={43}
		title="Rick Astley — Never Gonna Give You Up, from the chorus"
	/>
</div>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Start at a time",
	code: CODE,
	render: () => (
		<div mix={[is("full"), maxIs("36rem")]}>
			<YouTubeEmbed
				videoId="dQw4w9WgXcQ"
				start={43}
				title="Rick Astley — Never Gonna Give You Up, from the chorus"
			/>
		</div>
	),
};
