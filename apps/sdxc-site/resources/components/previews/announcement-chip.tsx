/**
 * Live preview for `AnnouncementChip`: the default quiet pill as a linked callout, then
 * each eyebrow look it shares, and the dual-tone `special` edge kept for a launch.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { flexWrap, hstack, vstack } from "@sdxc/u/layout";
import { AnnouncementChip } from "@sdxc/ui/patterns";

/** The source the page shows, matching the markup below. */
const CODE = `<AnnouncementChip href="/examples/changelog/custom-domains">
	Status pages now support custom domains
</AnnouncementChip>

<AnnouncementChip variant="soft">Scheduled maintenance windows</AnnouncementChip>
<AnnouncementChip variant="pill">New: heartbeat monitors</AnnouncementChip>
<AnnouncementChip variant="mono">Changelog</AnnouncementChip>
<AnnouncementChip variant="special" href="/examples/changelog/multi-region">
	Launching multi-region checks
</AnnouncementChip>`;

/** What the preview registry reads: the source to show, and the chips to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[vstack({ gap: 5, align: "start" })]}>
			<AnnouncementChip href="/examples/changelog/custom-domains">
				Status pages now support custom domains
			</AnnouncementChip>
			<div mix={[hstack({ gap: 3, align: "center" }), flexWrap()]}>
				<AnnouncementChip variant="soft">Scheduled maintenance windows</AnnouncementChip>
				<AnnouncementChip variant="pill">New: heartbeat monitors</AnnouncementChip>
				<AnnouncementChip variant="mono">Changelog</AnnouncementChip>
				<AnnouncementChip variant="special" href="/examples/changelog/multi-region">
					Launching multi-region checks
				</AnnouncementChip>
			</div>
		</div>
	),
};
