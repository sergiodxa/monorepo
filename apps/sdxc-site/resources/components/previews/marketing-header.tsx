/**
 * Live preview for `MarketingHeader`: a centered chapter header with a pill eyebrow and a
 * lead, the way a landing band opens. The eyebrow keeps its own width at either alignment.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is, m, maxIs } from "@sdxc/u/size";
import { HeadingScope, MarketingHeader } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<MarketingHeader
	eyebrow="Monitoring"
	description="Checks run every thirty seconds from six regions, and an alert only fires when two of them agree."
	align="center"
>
	Know it is down before your users do
</MarketingHeader>`;

/** What the preview registry reads: the source to show, and the header to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full"), maxIs("40rem")]}>
			<HeadingScope>
				<MarketingHeader
					eyebrow="Monitoring"
					description="Checks run every thirty seconds from six regions, and an alert only fires when two of them agree."
					align="center"
					mix={[m(0)]}
				>
					Know it is down before your users do
				</MarketingHeader>
			</HeadingScope>
		</div>
	),
};
