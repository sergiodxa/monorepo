/**
 * Centered eyebrow + chapter title + lead at the top of a marketing band.
 * Thin adapter over {@link MarketingHeader} so existing call sites keep a
 * stable `SectionHeader` name while inheriting display chapter typography.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { HeadingScope, MarketingHeader } from "@sdxc/ui";

namespace SectionHeader {
	export interface Props {
		badge?: string;
		title: RemixNode;
		description?: RemixNode;
	}
}

/**
 * Renders an optional pill eyebrow, a chapter-sized title, and an optional
 * lead — centered to match the product's band rhythm.
 */
export default function SectionHeader(handle: Handle<SectionHeader.Props>) {
	return () => (
		<HeadingScope>
			<MarketingHeader
				eyebrow={handle.props.badge}
				eyebrowVariant="pill"
				description={handle.props.description}
				align="center"
			>
				{handle.props.title}
			</MarketingHeader>
		</HeadingScope>
	);
}
