/**
 * Live example for a download `LinkButton` beside one that is not ready yet. The waiting
 * one carries `aria-disabled="true"` and drops its `href`, which is what keeps Enter from
 * following it while it stays readable to assistive technology.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DownloadIcon } from "@sdxc/icons";
import { flexWrap, hstack } from "@sdxc/u/layout";
import { LinkButton } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<div mix={[hstack({ gap: 3, align: "center" }), flexWrap()]}>
	<LinkButton href="/sitemap.xml" download>
		<DownloadIcon />
		Download sitemap
	</LinkButton>
	<LinkButton download aria-disabled="true">
		<DownloadIcon />
		Download usage report
	</LinkButton>
</div>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Download not ready",
	code: CODE,
	render: () => (
		<div mix={[hstack({ gap: 3, align: "center" }), flexWrap()]}>
			<LinkButton href="/sitemap.xml" download>
				<DownloadIcon />
				Download sitemap
			</LinkButton>
			<LinkButton download aria-disabled="true">
				<DownloadIcon />
				Download usage report
			</LinkButton>
		</div>
	),
};
