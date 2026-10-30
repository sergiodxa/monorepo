/**
 * Live preview for `IconWell`: the quiet hairline tile at each of the three sizes, then the
 * brand tile for a claim that should read as a highlight.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BellRingIcon, GaugeIcon, ZapIcon } from "@sdxc/icons";
import { hstack, vstack } from "@sdxc/u/layout";
import { IconWell } from "@sdxc/ui/patterns";

/** The source the page shows, matching the markup below. */
const CODE = `<div mix={[vstack({ gap: 4 })]}>
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
	<div mix={[hstack({ gap: 4, align: "center" })]}>
		<IconWell tone="brand" size="sm">
			<ZapIcon aria-hidden="true" />
		</IconWell>
		<IconWell tone="brand">
			<BellRingIcon aria-hidden="true" />
		</IconWell>
		<IconWell tone="brand" size="lg">
			<GaugeIcon aria-hidden="true" />
		</IconWell>
	</div>
</div>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[vstack({ gap: 4 })]}>
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
			<div mix={[hstack({ gap: 4, align: "center" })]}>
				<IconWell tone="brand" size="sm">
					<ZapIcon aria-hidden="true" />
				</IconWell>
				<IconWell tone="brand">
					<BellRingIcon aria-hidden="true" />
				</IconWell>
				<IconWell tone="brand" size="lg">
					<GaugeIcon aria-hidden="true" />
				</IconWell>
			</div>
		</div>
	),
};
