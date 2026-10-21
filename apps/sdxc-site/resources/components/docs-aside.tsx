/**
 * The documentation right rail: the page's own headings and one square product ad
 * above or below them. The ad is chosen for the path and the UTC day so a stored
 * copy of the page keeps the same tile until the day rolls over.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { vstack } from "sdxc/u/layout";

import type { Anchor } from "~/app/services/article";

import { pickSidebarAd } from "~/app/services/ads";
import SidebarAd from "~/resources/components/sidebar-ad";
import { TableOfContents } from "~/resources/components/table-of-contents";

namespace DocsAside {
	export interface Props {
		/** Headings the in-page nav lists; fewer than two suppress the list only. */
		anchors: Anchor[];
		/** Path being read, which seeds which ad this page shows today. */
		path: string;
	}
}

/** Renders the ad and the table of contents for the documentation right rail. */
export default function DocsAside(handle: Handle<DocsAside.Props>) {
	return () => {
		let { anchors, path } = handle.props;
		let { ad, placement } = pickSidebarAd(path);

		return (
			<div mix={[vstack({ gap: 8, align: "stretch" })]}>
				{placement === "above" ? <SidebarAd ad={ad} /> : null}
				<TableOfContents anchors={anchors} />
				{placement === "below" ? <SidebarAd ad={ad} /> : null}
			</div>
		);
	};
}
