/**
 * The documentation right rail: the page's own headings, then one square product ad
 * pinned under them. The ad is chosen for the path and the UTC day so a stored copy
 * of the page keeps the same tile until the day rolls over. The rail fills the
 * sticky column's height so a long table of contents scrolls while the ad stays visible.
 * Pages without enough headings for a ToC omit the rail entirely — the ad rides with it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { grow, shrink, vstack } from "@sdxc/u/layout";
import { overflowY } from "@sdxc/u/overflow";
import { minBs } from "@sdxc/u/size";

import type { Anchor } from "~/app/services/article";

import { pickSidebarAd } from "~/app/services/ads";
import SidebarAd from "~/resources/components/sidebar-ad";
import { TableOfContents, TOC_MIN_ANCHORS } from "~/resources/components/table-of-contents";

namespace DocsAside {
	export interface Props {
		/** Headings the in-page nav lists; fewer than two suppress the rail. */
		anchors: Anchor[];
		/** Path being read, which seeds which ad this page shows today. */
		path: string;
	}
}

/**
 * Whether a page's headings earn the right rail (ToC plus ad).
 *
 * @param anchors - Headings collected for the page.
 * @returns True when the rail should render.
 */
export function hasDocsAside(anchors: readonly Anchor[]): boolean {
	return anchors.length >= TOC_MIN_ANCHORS;
}

/** Renders the table of contents and the ad for the documentation right rail. */
export default function DocsAside(handle: Handle<DocsAside.Props>) {
	return () => {
		let { anchors, path } = handle.props;
		if (!hasDocsAside(anchors)) return null;

		let { ad } = pickSidebarAd(path);

		return (
			<div mix={[vstack({ gap: 8, align: "stretch" }), grow(), shrink(1), minBs(0)]}>
				<div mix={[grow(), shrink(1), minBs(0), overflowY("auto")]}>
					<TableOfContents anchors={anchors} />
				</div>
				<div mix={[shrink()]}>
					<SidebarAd ad={ad} />
				</div>
			</div>
		);
	};
}
