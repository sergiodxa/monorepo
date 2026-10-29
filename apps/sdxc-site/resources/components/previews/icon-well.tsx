/**
 * Live preview for `IconWell`: one glyph framed at each of the three sizes, the tile a
 * feature cell or a step leads with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BellRingIcon, GaugeIcon, ZapIcon } from "@sdxc/icons";
import { hstack } from "@sdxc/u/layout";
import { IconWell } from "@sdxc/ui/patterns";

/** The source the page shows, matching the markup below. */
const CODE = `<div mix={[hstack({ gap: 4, align: "center" })]}>
	<IconWell size="sm">
		<ZapIcon aria-hidden="true" />
	</IconWell>
	<IconWell>
		<BellRingIcon aria-hidden="true" />
	</IconWell>
	<IconWell size="lg">
		<GaugeIcon aria-hidden="true" />
	</IconWell>
</div>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[hstack({ gap: 4, align: "center" })]}>
			<IconWell size="sm">
				<ZapIcon aria-hidden="true" />
			</IconWell>
			<IconWell>
				<BellRingIcon aria-hidden="true" />
			</IconWell>
			<IconWell size="lg">
				<GaugeIcon aria-hidden="true" />
			</IconWell>
		</div>
	),
};
