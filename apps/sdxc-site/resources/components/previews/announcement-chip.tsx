/**
 * Live preview for `AnnouncementChip`: the two callouts a hero opens with, the quiet rim
 * for a forward link and the special variant for a launch.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack } from "@sdxc/u/layout";
import { AnnouncementChip } from "@sdxc/ui/patterns";

/** The source the page shows, matching the markup below. */
const CODE = `<div mix={[hstack({ gap: 3, align: "center" })]}>
	<AnnouncementChip>Status pages now support custom domains</AnnouncementChip>
	<AnnouncementChip variant="special">New: multi-region checks</AnnouncementChip>
</div>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[hstack({ gap: 3, align: "center" })]}>
			<AnnouncementChip>Status pages now support custom domains</AnnouncementChip>
			<AnnouncementChip variant="special">New: multi-region checks</AnnouncementChip>
		</div>
	),
};
