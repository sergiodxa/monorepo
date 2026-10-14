/**
 * Live preview for `YouTubeEmbed`: the player for one video, filling a column at 16:9. The
 * player carries no script of its own, so the preview renders on the server alone and the
 * frame loads from YouTube's privacy-enhanced host once it scrolls into view.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is, maxIs } from "@sdxc/u/size";
import { YouTubeEmbed } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<div mix={[is("full"), maxIs("36rem")]}>
	<YouTubeEmbed videoId="dQw4w9WgXcQ" title="Rick Astley — Never Gonna Give You Up" />
</div>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full"), maxIs("36rem")]}>
			<YouTubeEmbed videoId="dQw4w9WgXcQ" title="Rick Astley — Never Gonna Give You Up" />
		</div>
	),
};
